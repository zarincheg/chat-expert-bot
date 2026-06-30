import { Prisma } from "@prisma/client";
import { InlineKeyboard } from "grammy";
import type { Api } from "grammy";
import { prisma } from "../../db/prisma.js";
import type { ModerationLogService } from "./moderation-log.service.js";

export interface WelcomeButton {
  label: string;
  url?: string;
}

export class WelcomeService {
  constructor(
    private readonly botInstanceId: string,
    private readonly logService: ModerationLogService,
  ) {}

  async getConfig(chatId: bigint) {
    return prisma.welcomeConfig.findUnique({
      where: { botInstanceId_chatId: { botInstanceId: this.botInstanceId, chatId } },
    });
  }

  async upsertConfig(params: {
    chatId: bigint;
    enabled?: boolean;
    text: string;
    photoFileId?: string | null;
    photoUrl?: string | null;
    buttons?: WelcomeButton[];
    deleteJoinMessage?: boolean;
  }) {
    return prisma.welcomeConfig.upsert({
      where: { botInstanceId_chatId: { botInstanceId: this.botInstanceId, chatId: params.chatId } },
      create: {
        botInstanceId: this.botInstanceId,
        chatId: params.chatId,
        text: params.text,
        photoFileId: params.photoFileId,
        photoUrl: params.photoUrl,
        buttons: (params.buttons ?? []) as unknown as Prisma.InputJsonValue,
        enabled: params.enabled ?? true,
        deleteJoinMessage: params.deleteJoinMessage ?? true,
      },
      update: {
        text: params.text,
        photoFileId: params.photoFileId,
        photoUrl: params.photoUrl,
        buttons: (params.buttons ?? []) as unknown as Prisma.InputJsonValue,
        enabled: params.enabled,
        deleteJoinMessage: params.deleteJoinMessage,
      },
    });
  }

  renderText(template: string, vars: { name: string; username?: string; group: string }) {
    return template
      .replace(/\{name\}/g, vars.name)
      .replace(/\{username\}/g, vars.username ? `@${vars.username}` : vars.name)
      .replace(/\{group\}/g, vars.group);
  }

  buildKeyboard(buttons: WelcomeButton[]): InlineKeyboard | undefined {
    if (!buttons.length) return undefined;
    const kb = new InlineKeyboard();
    for (const btn of buttons) {
      if (btn.url) kb.url(btn.label, btn.url).row();
    }
    return kb;
  }

  async sendWelcome(
    api: Api,
    chatId: bigint,
    member: { userId: number; firstName?: string; username?: string },
    groupTitle: string,
  ) {
    const config = await this.getConfig(chatId);
    if (!config?.enabled) return;

    const text = this.renderText(config.text, {
      name: member.firstName ?? "there",
      username: member.username,
      group: groupTitle,
    });
    const buttons = (config.buttons as unknown as WelcomeButton[]) ?? [];
    const keyboard = this.buildKeyboard(buttons);

    try {
      if (config.photoFileId) {
        await api.sendPhoto(Number(chatId), config.photoFileId, {
          caption: text,
          reply_markup: keyboard,
        });
      } else if (config.photoUrl) {
        await api.sendPhoto(Number(chatId), config.photoUrl, {
          caption: text,
          reply_markup: keyboard,
        });
      } else {
        await api.sendMessage(Number(chatId), text, { reply_markup: keyboard });
      }

      await this.logService.log({
        chatId,
        targetUserId: member.userId,
        actionType: "WELCOME_SENT",
        details: { text: text.slice(0, 200) },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.logService.log({
        chatId,
        targetUserId: member.userId,
        actionType: "WELCOME_SENT",
        success: false,
        errorMessage: message,
      });
    }
  }
}