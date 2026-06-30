import { createHash } from "node:crypto";
import type { ChatMessage } from "@prisma/client";
import type { IngestChunk } from "./rag-ingest.client.js";

export class ChunkBuilderService {
  buildRawChunks(params: {
    messages: ChatMessage[];
    chatId: bigint;
    chunkSize: number;
  }): IngestChunk[] {
    const { messages, chatId, chunkSize } = params;
    if (messages.length === 0) return [];

    const chunks: IngestChunk[] = [];

    for (let i = 0; i < messages.length; i += chunkSize) {
      const window = messages.slice(i, i + chunkSize);
      const first = window[0];
      const last = window[window.length - 1];
      const externalId = this.buildExternalId(chatId, window);

      const content = window
        .map((message) => {
          const user = message.username ? `@${message.username}` : message.role;
          return `[${message.createdAt.toISOString()}] [${user}] ${message.content}`;
        })
        .join("\n");

      chunks.push({
        externalId,
        title: this.buildTitle(chatId, first, last),
        content,
        metadata: {
          messageIds: window.map((m) => m.id),
          timeRange: {
            from: first.createdAt.toISOString(),
            to: last.createdAt.toISOString(),
          },
          roles: [...new Set(window.map((m) => m.role))],
          chatId: chatId.toString(),
          capturedFrom: [...new Set(window.map((m) => m.capturedFrom ?? "unknown"))],
        },
      });
    }

    return chunks;
  }

  private buildExternalId(chatId: bigint, messages: ChatMessage[]): string {
    const payload = [
      chatId.toString(),
      messages[0]?.id ?? "",
      messages[messages.length - 1]?.id ?? "",
      messages.length.toString(),
    ].join(":");
    return createHash("sha256").update(payload).digest("hex").slice(0, 32);
  }

  private buildTitle(chatId: bigint, first: ChatMessage, last: ChatMessage): string {
    const from = first.createdAt.toISOString().slice(0, 16).replace("T", " ");
    const to = last.createdAt.toISOString().slice(0, 16).replace("T", " ");
    return `Chat ${chatId} ${from} → ${to}`;
  }
}