import { createHash } from "node:crypto";
import { prisma } from "../../db/prisma.js";
import type { ChatIngestionSettings } from "../../types/index.js";
import { CapturePipeline } from "./capture-pipeline.js";
import { createDefaultCaptureFilters } from "./filters/default-filters.js";
import type { CaptureContext, CaptureFilter, ChatType } from "./filters/types.js";

export interface CaptureMessageInput {
  chatId: bigint;
  chatType: ChatType;
  userId?: number;
  username?: string;
  role: string;
  content: string;
  messageId?: number;
  capturedFrom: CaptureContext["capturedFrom"];
  isCommand?: boolean;
  isBotMessage?: boolean;
  bypassFilters?: boolean;
}

export class MessageCaptureService {
  private pipeline = new CapturePipeline();

  constructor(private readonly botInstanceId: string) {}

  setFilters(filters: CaptureFilter[]): void {
    this.pipeline.setFilters(filters);
  }

  configureFromSettings(settings: ChatIngestionSettings): void {
    this.pipeline.setFilters(createDefaultCaptureFilters(settings));
  }

  addFilter(filter: CaptureFilter): void {
    this.pipeline.addFilter(filter);
  }

  async capture(input: CaptureMessageInput): Promise<boolean> {
    const context: CaptureContext = {
      botInstanceId: this.botInstanceId,
      chatId: input.chatId,
      chatType: input.chatType,
      userId: input.userId,
      username: input.username,
      content: input.content,
      messageId: input.messageId,
      isCommand: input.isCommand ?? input.content.startsWith("/"),
      isBotMessage: input.isBotMessage ?? input.role === "assistant",
      capturedFrom: input.capturedFrom,
    };

    if (!input.bypassFilters) {
      const result = await this.pipeline.evaluate(context);
      if (!result.allowed) {
        return false;
      }
    }

    const contentHash = this.hashContent(context);

    try {
      await prisma.chatMessage.create({
        data: {
          botInstanceId: this.botInstanceId,
          chatId: input.chatId,
          userId: input.userId !== undefined ? BigInt(input.userId) : null,
          username: input.username,
          role: input.role,
          content: input.content,
          messageId: input.messageId !== undefined ? BigInt(input.messageId) : null,
          capturedFrom: input.capturedFrom,
          contentHash,
        },
      });
      return true;
    } catch (error) {
      const isDuplicate =
        error instanceof Error &&
        "code" in error &&
        (error as { code?: string }).code === "P2002";
      return isDuplicate ? false : Promise.reject(error);
    }
  }

  private hashContent(context: CaptureContext): string {
    const payload = [
      this.botInstanceId,
      context.chatId.toString(),
      context.messageId?.toString() ?? "",
      context.content,
    ].join("|");
    return createHash("sha256").update(payload).digest("hex");
  }
}