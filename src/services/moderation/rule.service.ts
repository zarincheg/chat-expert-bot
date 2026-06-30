import { prisma } from "../../db/prisma.js";

export interface RuleMatch {
  ruleId: string;
  ruleType: string;
  pattern: string;
  action: string;
}

export class ModerationRuleService {
  constructor(private readonly botInstanceId: string) {}

  async listRules(chatId?: bigint) {
    return prisma.moderationRule.findMany({
      where: {
        botInstanceId: this.botInstanceId,
        enabled: true,
        ...(chatId ? { OR: [{ chatId: null }, { chatId }] } : {}),
      },
    });
  }

  async create(params: {
    chatId?: bigint;
    name: string;
    ruleType: string;
    pattern: string;
    action: string;
  }) {
    return prisma.moderationRule.create({
      data: {
        botInstanceId: this.botInstanceId,
        chatId: params.chatId ?? null,
        name: params.name,
        ruleType: params.ruleType,
        pattern: params.pattern.toLowerCase(),
        action: params.action,
      },
    });
  }

  async update(id: string, data: Partial<{ name: string; pattern: string; action: string; enabled: boolean }>) {
    return prisma.moderationRule.update({
      where: { id },
      data: {
        ...data,
        pattern: data.pattern?.toLowerCase(),
      },
    });
  }

  async delete(id: string) {
    return prisma.moderationRule.delete({ where: { id } });
  }

  matchNickname(
    rules: Awaited<ReturnType<typeof this.listRules>>,
    names: { username?: string; firstName?: string; lastName?: string },
  ): RuleMatch | null {
    const haystack = [names.username, names.firstName, names.lastName]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    for (const rule of rules.filter((r) => r.ruleType === "nickname")) {
      if (haystack.includes(rule.pattern)) {
        return {
          ruleId: rule.id,
          ruleType: rule.ruleType,
          pattern: rule.pattern,
          action: rule.action,
        };
      }
    }
    return null;
  }

  matchFirstMessage(
    rules: Awaited<ReturnType<typeof this.listRules>>,
    text: string,
  ): RuleMatch | null {
    const lower = text.toLowerCase();
    for (const rule of rules.filter((r) => r.ruleType === "keyword_first_message")) {
      if (lower.includes(rule.pattern)) {
        return {
          ruleId: rule.id,
          ruleType: rule.ruleType,
          pattern: rule.pattern,
          action: rule.action,
        };
      }
    }
    return null;
  }
}