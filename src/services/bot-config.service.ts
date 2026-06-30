import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { env } from "../config/env.js";
import {
  DEFAULT_BOT_SETTINGS,
  DEFAULT_CHAT_INGESTION_SETTINGS,
  type BotSettings,
  type ChatIngestionSettings,
} from "../types/index.js";

const CACHE_TTL_MS = 30_000;

interface ConfigCache {
  expiresAt: number;
  instanceId: string;
  settings: BotSettings;
}

let cache: ConfigCache | null = null;

function parseChatIngestion(raw: unknown): ChatIngestionSettings {
  const base = { ...DEFAULT_CHAT_INGESTION_SETTINGS };
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Partial<ChatIngestionSettings>;
  return {
    enabled: obj.enabled ?? base.enabled,
    intervalHours: obj.intervalHours ?? base.intervalHours,
    syncChatIds: obj.syncChatIds ?? base.syncChatIds,
    captureGroupMessages: obj.captureGroupMessages ?? base.captureGroupMessages,
    chunkSize: obj.chunkSize ?? base.chunkSize,
    maxMessagesPerRun: obj.maxMessagesPerRun ?? base.maxMessagesPerRun,
    retentionDays: obj.retentionDays ?? base.retentionDays,
  };
}

function parseSettings(raw: unknown): BotSettings {
  const base = { ...DEFAULT_BOT_SETTINGS, chatIngestion: { ...DEFAULT_CHAT_INGESTION_SETTINGS } };
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Partial<BotSettings> & { chatIngestion?: unknown };
  return {
    ragEnabled: obj.ragEnabled ?? base.ragEnabled,
    proactiveDigestEnabled: obj.proactiveDigestEnabled ?? base.proactiveDigestEnabled,
    responseStyle: obj.responseStyle ?? base.responseStyle,
    welcomeMessage: obj.welcomeMessage ?? base.welcomeMessage,
    chatIngestion: parseChatIngestion(obj.chatIngestion),
  };
}

export class BotConfigService {
  async getBotInstance() {
    const instance = await prisma.botInstance.findUnique({
      where: { slug: env.BOT_INSTANCE_ID },
      include: {
        commands: { where: { isEnabled: true }, orderBy: { sortOrder: "asc" } },
        buttons: { where: { isEnabled: true }, orderBy: { sortOrder: "asc" } },
        dataSources: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!instance) {
      throw new Error(
        `Bot instance "${env.BOT_INSTANCE_ID}" not found. Run: npm run db:seed`,
      );
    }

    return instance;
  }

  async getSettings(): Promise<BotSettings> {
    if (cache && cache.expiresAt > Date.now()) {
      return cache.settings;
    }

    const instance = await this.getBotInstance();
    const settings = parseSettings(instance.settings);
    cache = {
      expiresAt: Date.now() + CACHE_TTL_MS,
      instanceId: instance.id,
      settings,
    };
    return settings;
  }

  async updateChatIngestion(
    partial: Partial<ChatIngestionSettings>,
  ): Promise<ChatIngestionSettings> {
    const current = await this.getSettings();
    const next = { ...current.chatIngestion, ...partial };
    await this.updateSettings({ chatIngestion: next });
    return next;
  }

  async addSyncChatId(chatId: number): Promise<ChatIngestionSettings> {
    const current = await this.getSettings();
    const ids = new Set(current.chatIngestion.syncChatIds);
    ids.add(chatId);
    return this.updateChatIngestion({ syncChatIds: [...ids] });
  }

  async removeSyncChatId(chatId: number): Promise<ChatIngestionSettings> {
    const current = await this.getSettings();
    return this.updateChatIngestion({
      syncChatIds: current.chatIngestion.syncChatIds.filter((id) => id !== chatId),
    });
  }

  async updateSettings(partial: Partial<BotSettings>): Promise<BotSettings> {
    const instance = await this.getBotInstance();
    const current = await this.getSettings();
    const next: BotSettings = {
      ...current,
      ...partial,
      chatIngestion: partial.chatIngestion
        ? { ...current.chatIngestion, ...partial.chatIngestion }
        : current.chatIngestion,
    };

    await prisma.botInstance.update({
      where: { id: instance.id },
      data: { settings: next as unknown as Prisma.InputJsonValue },
    });

    cache = {
      expiresAt: Date.now() + CACHE_TTL_MS,
      instanceId: instance.id,
      settings: next,
    };

    return next;
  }

  invalidateCache(): void {
    cache = null;
  }

  async listCommands() {
    const instance = await this.getBotInstance();
    return prisma.botCommand.findMany({
      where: { botInstanceId: instance.id },
      orderBy: { sortOrder: "asc" },
    });
  }

  async upsertCommand(data: {
    name: string;
    description: string;
    response?: string;
    isEnabled?: boolean;
  }) {
    const instance = await this.getBotInstance();
    const command = await prisma.botCommand.upsert({
      where: {
        botInstanceId_name: {
          botInstanceId: instance.id,
          name: data.name,
        },
      },
      create: {
        botInstanceId: instance.id,
        name: data.name,
        description: data.description,
        response: data.response,
        isEnabled: data.isEnabled ?? true,
      },
      update: {
        description: data.description,
        response: data.response,
        isEnabled: data.isEnabled,
      },
    });
    this.invalidateCache();
    return command;
  }

  async toggleCommand(name: string, isEnabled: boolean) {
    const instance = await this.getBotInstance();
    const command = await prisma.botCommand.update({
      where: {
        botInstanceId_name: {
          botInstanceId: instance.id,
          name,
        },
      },
      data: { isEnabled },
    });
    this.invalidateCache();
    return command;
  }

  async listButtons() {
    const instance = await this.getBotInstance();
    return prisma.botButton.findMany({
      where: { botInstanceId: instance.id },
      orderBy: { sortOrder: "asc" },
    });
  }

  async createButton(data: {
    label: string;
    actionType: string;
    keyboardType?: string;
  }) {
    const instance = await this.getBotInstance();
    const maxOrder = await prisma.botButton.aggregate({
      where: { botInstanceId: instance.id },
      _max: { sortOrder: true },
    });

    const button = await prisma.botButton.create({
      data: {
        botInstanceId: instance.id,
        label: data.label,
        actionType: data.actionType,
        keyboardType: data.keyboardType ?? "inline",
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    });
    this.invalidateCache();
    return button;
  }

  async toggleButton(id: string, isEnabled: boolean) {
    const button = await prisma.botButton.update({
      where: { id },
      data: { isEnabled },
    });
    this.invalidateCache();
    return button;
  }

  async listDataSources() {
    const instance = await this.getBotInstance();
    return prisma.dataSource.findMany({
      where: { botInstanceId: instance.id },
      orderBy: { createdAt: "desc" },
    });
  }

  async createDataSource(data: {
    name: string;
    type: "URL" | "FILE" | "MANUAL";
    location: string;
  }) {
    const instance = await this.getBotInstance();
    const source = await prisma.dataSource.create({
      data: {
        botInstanceId: instance.id,
        name: data.name,
        type: data.type,
        location: data.location,
        status: "PENDING",
      },
    });
    this.invalidateCache();
    return source;
  }

  async activateDataSource(id: string) {
    const source = await prisma.dataSource.update({
      where: { id },
      data: { status: "ACTIVE" },
    });
    this.invalidateCache();
    return source;
  }

  buildHelpText(
    commands: Array<{ name: string; description: string }>,
    settings: BotSettings,
  ): string {
    const lines = [
      "Available commands:",
      ...commands.map((c) => `/${c.name} — ${c.description}`),
      "",
      `RAG: ${settings.ragEnabled ? "enabled" : "disabled"}`,
      `Style: ${settings.responseStyle}`,
    ];
    return lines.join("\n");
  }
}

export const botConfigService = new BotConfigService();