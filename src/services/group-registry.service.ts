import type { Api } from "grammy";
import { prisma } from "../db/prisma.js";
import type { BotConfigService } from "./bot-config.service.js";
import type { GroupConfigService } from "./group-config.service.js";
import { parseGroupSettings, type GroupSettings } from "../types/group-settings.js";

export interface ManagedGroupView {
  id: string;
  chatId: bigint;
  title: string | null;
  topic: string | null;
  chatType: string;
  isActive: boolean;
  memberStatus: string | null;
  syncEnabled: boolean;
  settings: GroupSettings;
}

export class GroupRegistryService {
  constructor(
    private readonly botInstanceId: string,
    private readonly configService: BotConfigService,
    private readonly groupConfigService?: GroupConfigService,
  ) {}

  async upsertGroup(params: {
    chatId: bigint;
    title?: string | null;
    topic?: string | null;
    chatType: string;
    memberStatus?: string;
    isActive?: boolean;
  }) {
    return prisma.managedGroup.upsert({
      where: {
        botInstanceId_chatId: {
          botInstanceId: this.botInstanceId,
          chatId: params.chatId,
        },
      },
      create: {
        botInstanceId: this.botInstanceId,
        chatId: params.chatId,
        title: params.title ?? null,
        topic: params.topic ?? null,
        chatType: params.chatType,
        memberStatus: params.memberStatus,
        isActive: params.isActive ?? true,
      },
      update: {
        title: params.title ?? undefined,
        topic: params.topic ?? undefined,
        chatType: params.chatType,
        memberStatus: params.memberStatus,
        isActive: params.isActive ?? true,
      },
    });
  }

  async markInactive(chatId: bigint, memberStatus: string) {
    return prisma.managedGroup.updateMany({
      where: { botInstanceId: this.botInstanceId, chatId },
      data: { isActive: false, memberStatus },
    });
  }

  async listGroups(): Promise<ManagedGroupView[]> {
    const settings = await this.configService.getSettings();
    const syncIds = new Set(settings.chatIngestion.syncChatIds);
    const groups = await prisma.managedGroup.findMany({
      where: { botInstanceId: this.botInstanceId },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    });

    return Promise.all(
      groups.map(async (group) => ({
        id: group.id,
        chatId: group.chatId,
        title: group.title,
        topic: group.topic,
        chatType: group.chatType,
        isActive: group.isActive,
        memberStatus: group.memberStatus,
        syncEnabled: syncIds.has(Number(group.chatId)),
        settings: this.groupConfigService
          ? await this.groupConfigService.getSettings(group.chatId)
          : parseGroupSettings(group.settings),
      })),
    );
  }

  async getGroup(chatId: bigint): Promise<ManagedGroupView | null> {
    const groups = await this.listGroups();
    return groups.find((g) => g.chatId === chatId) ?? null;
  }

  async toggleGroupSync(chatId: bigint): Promise<boolean> {
    if (this.groupConfigService) {
      const current = await this.groupConfigService.getSettings(chatId);
      const next = !current.syncEnabled;
      await this.groupConfigService.updateSettings(chatId, { syncEnabled: next });
      return next;
    }

    const settings = await this.configService.getSettings();
    const id = Number(chatId);
    const enabled = settings.chatIngestion.syncChatIds.includes(id);

    if (enabled) {
      await this.configService.removeSyncChatId(id);
      return false;
    }

    await this.configService.addSyncChatId(id);
    return true;
  }

  async refreshTitle(api: Api, chatId: bigint): Promise<string | null> {
    try {
      const chat = await api.getChat(Number(chatId));
      const title = "title" in chat ? chat.title : null;
      if (title) {
        await prisma.managedGroup.updateMany({
          where: { botInstanceId: this.botInstanceId, chatId },
          data: { title },
        });
      }
      return title ?? null;
    } catch {
      return null;
    }
  }

  formatGroupLabel(group: ManagedGroupView): string {
    const name = group.title ?? `Group ${group.chatId}`;
    const status = !group.isActive ? " (left)" : group.syncEnabled ? " 🔄" : "";
    return `${name}${status}`;
  }
}