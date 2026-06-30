import { describe, it, expect } from "vitest";
import { ChunkBuilderService } from "./chunk-builder.service.js";

describe("ChunkBuilderService", () => {
  const builder = new ChunkBuilderService();

  it("builds raw chunks from message windows", () => {
    const now = new Date("2026-06-29T10:00:00Z");
    const messages = Array.from({ length: 3 }, (_, index) => ({
      id: `msg-${index}`,
      botInstanceId: "bot-1",
      chatId: BigInt(-1001),
      userId: BigInt(42),
      username: "alice",
      role: "user",
      content: `Message ${index}`,
      messageId: BigInt(100 + index),
      capturedFrom: "group",
      contentHash: null,
      syncedAt: null,
      createdAt: new Date(now.getTime() + index * 1000),
    }));

    const chunks = builder.buildRawChunks({
      messages,
      chatId: BigInt(-1001),
      chunkSize: 2,
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0].metadata.messageIds).toEqual(["msg-0", "msg-1"]);
    expect(chunks[0].content).toContain("Message 0");
    expect(chunks[1].metadata.messageIds).toEqual(["msg-2"]);
  });
});