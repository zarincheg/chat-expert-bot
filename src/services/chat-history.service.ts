import { prisma } from "../db/prisma.js";
import type { ChatMessageInput } from "./ai-client/types.js";
import type { BotConfigService } from "./bot-config.service.js";
import type { MessageCaptureService } from "./capture/message-capture.service.js";
import type { ChatType } from "./capture/filters/types.js";

export class ChatHistoryService {
  constructor(
    private readonly botInstanceId: string,
    private readonly historyLimit: number,
    private readonly captureService: MessageCaptureService,
    private readonly configService: BotConfigService,
  ) {}

  async storeUserMessage(params: {
    chatId: bigint;
    chatType: ChatType;
    userId?: number;
    username?: string;
    content: string;
    messageId?: number;
  }): Promise<void> {
    await this.storeMessage({ ...params, role: "user", capturedFrom: "rag" });
  }

  async storeAssistantMessage(params: {
    chatId: bigint;
    chatType: ChatType;
    content: string;
    messageId?: number;
  }): Promise<void> {
    await this.storeMessage({
      ...params,
      role: "assistant",
      capturedFrom: "rag",
      isBotMessage: true,
    });
  }

  private async storeMessage(params: {
    chatId: bigint;
    chatType: ChatType;
    userId?: number;
    username?: string;
    role: string;
    content: string;
    messageId?: number;
    capturedFrom: "group" | "rag" | "dm";
    isBotMessage?: boolean;
  }): Promise<void> {
    const settings = await this.configService.getSettings();
    this.captureService.configureFromSettings(settings.chatIngestion);

    await this.captureService.capture({
      chatId: params.chatId,
      chatType: params.chatType,
      userId: params.userId,
      username: params.username,
      role: params.role,
      content: params.content,
      messageId: params.messageId,
      capturedFrom: params.capturedFrom,
      isBotMessage: params.isBotMessage,
    });
  }

  async getRecentHistory(chatId: bigint): Promise<ChatMessageInput[]> {
    const rows = await prisma.chatMessage.findMany({
      where: { botInstanceId: this.botInstanceId, chatId },
      orderBy: { createdAt: "desc" },
      take: this.historyLimit,
    });

    return rows
      .reverse()
      .map((row) => ({
        role: row.role as ChatMessageInput["role"],
        content: row.content,
      }));
  }
}