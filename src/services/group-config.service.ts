import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { isAdmin } from "../config/env.js";
import {
  DEFAULT_GROUP_SETTINGS,
  parseGroupSettings,
  type GroupSettings,
  type TriggerPolicy,
} from "../types/group-settings.js";
import type { BotConfigService } from "./bot-config.service.js";

export class GroupConfigService {
  constructor(
    private readonly botInstanceId: string,
    private readonly configService: BotConfigService,
  ) {}

  async getSettings(chatId: bigint): Promise<GroupSettings> {
    const row = await prisma.managedGroup.findUnique({
      where: {
        botInstanceId_chatId: { botInstanceId: this.botInstanceId, chatId },
      },
    });
    if (!row) return structuredClone(DEFAULT_GROUP_SETTINGS);
    return parseGroupSettings(row.settings);
  }

  async updateSettings(
    chatId: bigint,
    partial: Partial<Omit<GroupSettings, "triggers">> & { triggers?: Partial<TriggerPolicy> },
  ): Promise<GroupSettings> {
    const current = await this.getSettings(chatId);
    const next: GroupSettings = {
      ...current,
      ...partial,
      triggers: partial.triggers ? { ...current.triggers, ...partial.triggers } : current.triggers,
    };

    await prisma.managedGroup.upsert({
      where: {
        botInstanceId_chatId: { botInstanceId: this.botInstanceId, chatId },
      },
      create: {
        botInstanceId: this.botInstanceId,
        chatId,
        chatType: "supergroup",
        settings: next as unknown as Prisma.InputJsonValue,
      },
      update: {
        settings: next as unknown as Prisma.InputJsonValue,
      },
    });

    if (partial.syncEnabled !== undefined) {
      if (next.syncEnabled) {
        await this.configService.addSyncChatId(Number(chatId));
      } else {
        await this.configService.removeSyncChatId(Number(chatId));
      }
    }

    return next;
  }

  async getGroupMeta(chatId: bigint) {
    return prisma.managedGroup.findUnique({
      where: {
        botInstanceId_chatId: { botInstanceId: this.botInstanceId, chatId },
      },
    });
  }

  async isModerator(chatId: bigint, userId: number | undefined): Promise<boolean> {
    if (userId === undefined) return false;
    if (isAdmin(userId)) return true;
    const settings = await this.getSettings(chatId);
    return settings.moderatorUserIds.includes(userId);
  }

  async addModerator(chatId: bigint, userId: number): Promise<GroupSettings> {
    const settings = await this.getSettings(chatId);
    const ids = new Set(settings.moderatorUserIds);
    ids.add(userId);
    return this.updateSettings(chatId, { moderatorUserIds: [...ids] });
  }

  async removeModerator(chatId: bigint, userId: number): Promise<GroupSettings> {
    const settings = await this.getSettings(chatId);
    return this.updateSettings(chatId, {
      moderatorUserIds: settings.moderatorUserIds.filter((id) => id !== userId),
    });
  }

  async canCapture(chatId: bigint): Promise<boolean> {
    const global = await this.configService.getSettings();
    const group = await this.getSettings(chatId);
    return (
      global.chatIngestion.enabled &&
      global.chatIngestion.captureGroupMessages &&
      group.captureEnabled &&
      global.chatIngestion.syncChatIds.includes(Number(chatId))
    );
  }

  async canSync(chatId: bigint): Promise<boolean> {
    const global = await this.configService.getSettings();
    const group = await this.getSettings(chatId);
    return global.chatIngestion.enabled && group.syncEnabled;
  }

  async isModeratorAnywhere(userId: number | undefined): Promise<boolean> {
    if (userId === undefined) return false;
    if (isAdmin(userId)) return true;

    const groups = await prisma.managedGroup.findMany({
      where: { botInstanceId: this.botInstanceId, isActive: true },
      select: { chatId: true, settings: true },
    });

    return groups.some((group) => {
      const settings = parseGroupSettings(group.settings);
      return settings.moderatorUserIds.includes(userId);
    });
  }

  async listModeratedChatIds(userId: number | undefined): Promise<bigint[]> {
    if (userId === undefined) return [];
    if (isAdmin(userId)) {
      const groups = await prisma.managedGroup.findMany({
        where: { botInstanceId: this.botInstanceId },
        select: { chatId: true },
      });
      return groups.map((g) => g.chatId);
    }

    const groups = await prisma.managedGroup.findMany({
      where: { botInstanceId: this.botInstanceId, isActive: true },
      select: { chatId: true, settings: true },
    });

    return groups
      .filter((group) => {
        const settings = parseGroupSettings(group.settings);
        return settings.moderatorUserIds.includes(userId);
      })
      .map((g) => g.chatId);
  }
}