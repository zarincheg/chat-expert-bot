import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import {
  DEFAULT_MODERATION_SETTINGS,
  parseModerationSettings,
  type ModerationSettings,
} from "../../types/moderation-settings.js";
import { parseGroupSettings, type GroupSettings } from "../../types/group-settings.js";

type SettingsBlob = GroupSettings & { moderation?: unknown };

export class ModerationConfigService {
  constructor(private readonly botInstanceId: string) {}

  private parseBlob(raw: unknown): SettingsBlob {
    const group = parseGroupSettings(raw);
    const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    return { ...group, moderation: obj.moderation };
  }

  async getSettings(chatId: bigint): Promise<ModerationSettings> {
    const row = await prisma.managedGroup.findUnique({
      where: { botInstanceId_chatId: { botInstanceId: this.botInstanceId, chatId } },
    });
    if (!row) return structuredClone(DEFAULT_MODERATION_SETTINGS);
    const blob = this.parseBlob(row.settings);
    return parseModerationSettings(blob.moderation);
  }

  async updateSettings(
    chatId: bigint,
    partial: Partial<ModerationSettings> & {
      newcomer?: Partial<ModerationSettings["newcomer"]>;
      autoBan?: Partial<ModerationSettings["autoBan"]>;
      welcome?: Partial<ModerationSettings["welcome"]>;
    },
  ): Promise<ModerationSettings> {
    const row = await prisma.managedGroup.findUnique({
      where: { botInstanceId_chatId: { botInstanceId: this.botInstanceId, chatId } },
    });
    const blob = this.parseBlob(row?.settings);
    const current = parseModerationSettings(blob.moderation);
    const next: ModerationSettings = {
      ...current,
      ...partial,
      newcomer: partial.newcomer ? { ...current.newcomer, ...partial.newcomer } : current.newcomer,
      autoBan: partial.autoBan
        ? {
            ...current.autoBan,
            ...partial.autoBan,
            trustScore: partial.autoBan.trustScore
              ? { ...current.autoBan.trustScore, ...partial.autoBan.trustScore }
              : current.autoBan.trustScore,
          }
        : current.autoBan,
      welcome: partial.welcome ? { ...current.welcome, ...partial.welcome } : current.welcome,
    };

    const settingsJson = { ...blob, moderation: next } as unknown as Prisma.InputJsonValue;

    await prisma.managedGroup.upsert({
      where: { botInstanceId_chatId: { botInstanceId: this.botInstanceId, chatId } },
      create: {
        botInstanceId: this.botInstanceId,
        chatId,
        chatType: "supergroup",
        settings: settingsJson,
      },
      update: { settings: settingsJson },
    });

    return next;
  }
}