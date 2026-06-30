import { createHash } from "node:crypto";
import type { IngestChunk } from "./rag-ingest.client.js";

export class SourceChunkerService {
  chunkText(params: {
    text: string;
    dataSourceId: string;
    chatId?: string;
    maxChars: number;
  }): IngestChunk[] {
    const paragraphs = params.text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const chunks: IngestChunk[] = [];
    let buffer = "";

    for (const paragraph of paragraphs) {
      if ((buffer + "\n\n" + paragraph).length > params.maxChars && buffer.length > 0) {
        chunks.push(this.buildChunk(buffer, params, chunks.length));
        buffer = paragraph;
      } else {
        buffer = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
      }
    }

    if (buffer.length > 0) {
      chunks.push(this.buildChunk(buffer, params, chunks.length));
    }

    return chunks;
  }

  private buildChunk(
    content: string,
    params: { dataSourceId: string; chatId?: string },
    index: number,
  ): IngestChunk {
    const externalId = createHash("sha256")
      .update(`${params.dataSourceId}:${index}:${content.slice(0, 80)}`)
      .digest("hex")
      .slice(0, 32);

    return {
      externalId,
      title: content.slice(0, 80),
      content,
      metadata: {
        messageIds: [],
        timeRange: { from: new Date().toISOString(), to: new Date().toISOString() },
        roles: ["source"],
        chatId: params.chatId ?? "",
        capturedFrom: ["data_source"],
      },
    };
  }
}