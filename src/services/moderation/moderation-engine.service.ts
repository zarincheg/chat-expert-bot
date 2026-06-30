import type { Api } from "grammy";
import type { ModerationSettings } from "../../types/moderation-settings.js";
import { AccessListService } from "./access-list.service.js";
import { GroupMemberService } from "./group-member.service.js";
import { ModerationConfigService } from "./moderation-config.service.js";
import { ModerationLogService } from "./moderation-log.service.js";
import { ModerationRuleService } from "./rule.service.js";
import { NewcomerPolicyService, type MessageContentInfo } from "./newcomer-policy.service.js";
import { TelegramModerationActions } from "./telegram-actions.service.js";
import { WelcomeService } from "./welcome.service.js";
import { createTrustScoreClient } from "./trust-score.client.js";

export class ModerationEngine {
  private readonly newcomerPolicy = new NewcomerPolicyService();
  private readonly trustClient = createTrustScoreClient();

  constructor(
    private readonly botInstanceId: string,
    private readonly configService: ModerationConfigService,
    private readonly memberService: GroupMemberService,
    private readonly accessList: AccessListService,
    private readonly logService: ModerationLogService,
    private readonly ruleService: ModerationRuleService,
    private readonly welcomeService: WelcomeService,
  ) {}

  private actions(api: Api) {
    return new TelegramModerationActions(api);
  }

  async onMemberJoined(
    api: Api,
    params: {
      chatId: bigint;
      chatTitle: string;
      userId: number;
      username?: string;
      firstName?: string;
      lastName?: string;
      joinMessageId?: number;
    },
  ) {
    const settings = await this.configService.getSettings(params.chatId);
    if (!settings.enabled) return;

    if (await this.accessList.isWhitelisted(params.chatId, params.userId)) {
      await this.memberService.upsertJoin(params);
      await this.welcomeService.sendWelcome(api, params.chatId, params, params.chatTitle);
      return;
    }

    if (await this.accessList.isBlacklisted(params.chatId, params.userId)) {
      await this.applyBan(api, params.chatId, params.userId, "blacklist");
      return;
    }

    await this.memberService.upsertJoin(params);

    const rules = await this.ruleService.listRules(params.chatId);
    const nickMatch = settings.autoBan.checkNickname
      ? this.ruleService.matchNickname(rules, params)
      : null;

    if (nickMatch) {
      await this.applyRuleAction(api, params.chatId, params.userId, nickMatch, settings);
      return;
    }

    if (settings.autoBan.enabled && settings.autoBan.trustScore.enabled) {
      await this.evaluateTrustScore(api, params.chatId, params.userId, params, settings);
    } else if (settings.newcomer.restrictOnJoin) {
      await this.applyRestrict(api, params.chatId, params.userId, settings, "newcomer_on_join");
    }

    const welcomeConfig = await this.welcomeService.getConfig(params.chatId);
    if (settings.welcome.enabled && welcomeConfig?.enabled) {
      await this.welcomeService.sendWelcome(api, params.chatId, params, params.chatTitle);
    }

    if (settings.welcome.deleteJoinServiceMessage && params.joinMessageId) {
      try {
        await this.actions(api).deleteMessage(params.chatId, params.joinMessageId);
      } catch {
        // bot may lack permission
      }
    }
  }

  async onMessage(
    api: Api,
    params: {
      chatId: bigint;
      userId: number;
      messageId: number;
      text?: string;
      content: MessageContentInfo;
    },
  ): Promise<boolean> {
    const settings = await this.configService.getSettings(params.chatId);
    if (!settings.enabled) return false;

    if (await this.accessList.isWhitelisted(params.chatId, params.userId)) {
      await this.memberService.recordMessage(params.chatId, params.userId);
      return false;
    }

    if (await this.accessList.isBlacklisted(params.chatId, params.userId)) {
      await this.applyBan(api, params.chatId, params.userId, "blacklist");
      return true;
    }

    const member = await this.memberService.recordMessage(params.chatId, params.userId);
    const isFirstMessage = member?.messageCount === 1;

    if (settings.autoBan.enabled && settings.autoBan.checkFirstMessage && isFirstMessage && params.text) {
      const hours = settings.autoBan.firstMessageWindowHours;
      const withinWindow =
        member && Date.now() - member.joinedAt.getTime() < hours * 3600_000;
      if (withinWindow) {
        const rules = await this.ruleService.listRules(params.chatId);
        const match = this.ruleService.matchFirstMessage(rules, params.text);
        if (match) {
          await this.deleteAndLog(api, params.chatId, params.userId, params.messageId, match);
          await this.applyRuleAction(api, params.chatId, params.userId, match, settings);
          return true;
        }
      }
    }

    if (this.newcomerPolicy.isNewcomer(member, settings)) {
      const violation = this.newcomerPolicy.checkViolation(
        settings,
        params.content,
        member?.messageCount ?? 0,
      );
      if (violation) {
        await this.deleteAndLog(api, params.chatId, params.userId, params.messageId, {
          reason: violation,
        });
        await this.logService.log({
          chatId: params.chatId,
          targetUserId: params.userId,
          actionType: "NEWCOMER_BLOCK",
          details: { violation },
        });
        return true;
      }
    }

    return false;
  }

  private async evaluateTrustScore(
    api: Api,
    chatId: bigint,
    userId: number,
    member: { username?: string; firstName?: string; lastName?: string },
    settings: ModerationSettings,
  ) {
    const ts = settings.autoBan.trustScore;
    try {
      const result = await Promise.race([
        this.trustClient.check({
          botInstanceId: this.botInstanceId,
          chatId: chatId.toString(),
          userId: userId.toString(),
          username: member.username,
          firstName: member.firstName,
          lastName: member.lastName,
          joinedAt: new Date().toISOString(),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), ts.timeoutMs),
        ),
      ]);

      await this.logService.log({
        chatId,
        targetUserId: userId,
        actionType: "TRUST_SCORE",
        trustScore: result.score,
        details: { labels: result.labels, action: result.action },
      });

      if (result.score >= ts.blockAbove) {
        await this.applyBan(api, chatId, userId, "trust_score");
      } else if (result.score >= ts.restrictAbove) {
        await this.applyRestrict(api, chatId, userId, settings, "trust_score");
      } else if (settings.newcomer.restrictOnJoin) {
        await this.applyRestrict(api, chatId, userId, settings, "newcomer_on_join");
      }
    } catch (error) {
      const fail = ts.failAction;
      await this.logService.log({
        chatId,
        targetUserId: userId,
        actionType: "TRUST_SCORE",
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        details: { failAction: fail },
      });
      if (fail === "ban") await this.applyBan(api, chatId, userId, "trust_timeout");
      else if (fail === "restrict") await this.applyRestrict(api, chatId, userId, settings, "trust_timeout");
    }
  }

  private async applyRuleAction(
    api: Api,
    chatId: bigint,
    userId: number,
    match: { ruleId: string; action: string },
    settings: ModerationSettings,
  ) {
    await this.logService.log({
      chatId,
      targetUserId: userId,
      actionType: "RULE_MATCH",
      ruleId: match.ruleId,
      details: { action: match.action },
    });

    if (match.action === "ban") await this.applyBan(api, chatId, userId, "rule");
    else if (match.action === "restrict") await this.applyRestrict(api, chatId, userId, settings, "rule");
  }

  private async applyBan(api: Api, chatId: bigint, userId: number, reason: string) {
    try {
      await this.actions(api).ban(chatId, userId);
      await this.memberService.setStatus(chatId, userId, "BANNED");
      await this.logService.log({
        chatId,
        targetUserId: userId,
        actionType: "BAN",
        details: { reason },
      });
    } catch (error) {
      await this.logService.log({
        chatId,
        targetUserId: userId,
        actionType: "BAN",
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async applyRestrict(
    api: Api,
    chatId: bigint,
    userId: number,
    settings: ModerationSettings,
    reason: string,
  ) {
    const until =
      Math.floor(Date.now() / 1000) + settings.newcomer.gracePeriodHours * 3600;
    try {
      await this.actions(api).restrict(chatId, userId, until);
      await this.memberService.setStatus(chatId, userId, "RESTRICTED");
      await this.logService.log({
        chatId,
        targetUserId: userId,
        actionType: "RESTRICT",
        details: { reason, until },
      });
    } catch (error) {
      await this.logService.log({
        chatId,
        targetUserId: userId,
        actionType: "RESTRICT",
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async deleteAndLog(
    api: Api,
    chatId: bigint,
    userId: number,
    messageId: number,
    details: unknown,
  ) {
    try {
      await this.actions(api).deleteMessage(chatId, messageId);
      await this.logService.log({
        chatId,
        targetUserId: userId,
        actionType: "DELETE_MESSAGE",
        details: details as object,
      });
    } catch (error) {
      await this.logService.log({
        chatId,
        targetUserId: userId,
        actionType: "DELETE_MESSAGE",
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }
}