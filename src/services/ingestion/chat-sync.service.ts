import { prisma } from "../../db/prisma.js";
import type { ChatIngestionSettings } from "../../types/index.js";
import { BotConfigService } from "../bot-config.service.js";
import { ChunkBuilderService } from "./chunk-builder.service.js";
import {
  createRagIngestClient,
  type IngestChunkBatch,
  type RagIngestClient,
} from "./rag-ingest.client.js";

export interface SyncRunResult {
  runId: string;
  chatsProcessed: number;
  chunksSent: number;
  messagesSent: number;
  errors: Array<{ chatId: string; error: string }>;
}

export class ChatSyncService {
  private readonly chunkBuilder = new ChunkBuilderService();

  constructor(
    private readonly botInstanceId: string,
    private readonly botInstanceSlug: string,
    private readonly configService: BotConfigService,
    private readonly ingestClient: RagIngestClient = createRagIngestClient(),
  ) {}

  async run(options?: { autoEnable?: boolean }): Promise<SyncRunResult> {
    let settings = await this.getIngestionSettings();

    if (!settings.enabled) {
      if (options?.autoEnable) {
        settings = await this.configService.updateChatIngestion({ enabled: true });
      } else {
        throw new Error(
          "Periodic sync is disabled. Tap “Enable sync” first, or use Run sync now from admin.",
        );
      }
    }

    if (settings.syncChatIds.length === 0) {
      throw new Error(
        "No groups registered. Tap “Register this group” while /admin is open in a group chat.",
      );
    }

    const run = await prisma.ingestionRun.create({
      data: {
        botInstanceId: this.botInstanceId,
        status: "running",
      },
    });

    const result: SyncRunResult = {
      runId: run.id,
      chatsProcessed: 0,
      chunksSent: 0,
      messagesSent: 0,
      errors: [],
    };

    try {
      for (const chatId of settings.syncChatIds) {
        try {
          const chatResult = await this.syncChat(BigInt(chatId), settings);
          result.chatsProcessed += 1;
          result.chunksSent += chatResult.chunksSent;
          result.messagesSent += chatResult.messagesSent;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.errors.push({ chatId: String(chatId), error: message });
          await this.markChatSyncError(BigInt(chatId), message);
        }
      }

      await prisma.ingestionRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          status: result.errors.length > 0 ? "partial" : "success",
          chatsProcessed: result.chatsProcessed,
          chunksSent: result.chunksSent,
          messagesSent: result.messagesSent,
          error: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
        },
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.ingestionRun.update({
        where: { id: run.id },
        data: {
          finishedAt: new Date(),
          status: "failed",
          error: message,
        },
      });
      throw error;
    }
  }

  private async syncChat(
    chatId: bigint,
    settings: ChatIngestionSettings,
  ): Promise<{ chunksSent: number; messagesSent: number }> {
    const dataSource = await this.ensureChatDataSource(chatId);
    const syncState = await this.ensureChatSyncState(chatId, dataSource.id);

    const unsynced = await prisma.chatMessage.findMany({
      where: {
        botInstanceId: this.botInstanceId,
        chatId,
        syncedAt: null,
      },
      orderBy: { createdAt: "asc" },
      take: settings.maxMessagesPerRun,
    });

    if (unsynced.length === 0) {
      await prisma.chatSyncState.update({
        where: { id: syncState.id },
        data: {
          lastRunAt: new Date(),
          lastRunStatus: "success",
          lastError: null,
        },
      });
      return { chunksSent: 0, messagesSent: 0 };
    }

    const chunks = this.chunkBuilder.buildRawChunks({
      messages: unsynced,
      chatId,
      chunkSize: settings.chunkSize,
    });

    const batch: IngestChunkBatch = {
      botInstanceId: this.botInstanceId,
      botInstanceSlug: this.botInstanceSlug,
      chatId: chatId.toString(),
      dataSourceId: dataSource.id,
      chunks,
    };

    const ingestResult = await this.ingestClient.upsertChunks(batch);
    const syncedAt = new Date();
    const lastMessage = unsynced[unsynced.length - 1];

    await prisma.chatMessage.updateMany({
      where: { id: { in: unsynced.map((m) => m.id) } },
      data: { syncedAt },
    });

    await prisma.chatSyncState.update({
      where: { id: syncState.id },
      data: {
        lastSyncedAt: lastMessage.createdAt,
        lastMessageId: lastMessage.id,
        lastRunAt: syncedAt,
        lastRunStatus: "success",
        lastError: null,
        chunksExported: { increment: ingestResult.accepted },
      },
    });

    return {
      chunksSent: ingestResult.accepted,
      messagesSent: unsynced.length,
    };
  }

  private async ensureChatDataSource(chatId: bigint) {
    const name = `Chat history ${chatId}`;
    const existing = await prisma.dataSource.findFirst({
      where: {
        botInstanceId: this.botInstanceId,
        type: "CHAT_HISTORY",
        name,
      },
    });

    if (existing) return existing;

    return prisma.dataSource.create({
      data: {
        botInstanceId: this.botInstanceId,
        name,
        type: "CHAT_HISTORY",
        location: chatId.toString(),
        status: "ACTIVE",
        metadata: { chatId: chatId.toString() },
      },
    });
  }

  private async ensureChatSyncState(chatId: bigint, dataSourceId: string) {
    return prisma.chatSyncState.upsert({
      where: {
        botInstanceId_chatId: {
          botInstanceId: this.botInstanceId,
          chatId,
        },
      },
      create: {
        botInstanceId: this.botInstanceId,
        chatId,
        dataSourceId,
      },
      update: {},
    });
  }

  private async markChatSyncError(chatId: bigint, error: string) {
    const state = await prisma.chatSyncState.findUnique({
      where: {
        botInstanceId_chatId: {
          botInstanceId: this.botInstanceId,
          chatId,
        },
      },
    });

    if (!state) return;

    await prisma.chatSyncState.update({
      where: { id: state.id },
      data: {
        lastRunAt: new Date(),
        lastRunStatus: "error",
        lastError: error,
      },
    });
  }

  private async getIngestionSettings(): Promise<ChatIngestionSettings> {
    return (await this.configService.getSettings()).chatIngestion;
  }

  async getLastRun() {
    return prisma.ingestionRun.findFirst({
      where: { botInstanceId: this.botInstanceId },
      orderBy: { startedAt: "desc" },
    });
  }

  async listSyncStates() {
    return prisma.chatSyncState.findMany({
      where: { botInstanceId: this.botInstanceId },
      include: { dataSource: true },
      orderBy: { updatedAt: "desc" },
    });
  }
}