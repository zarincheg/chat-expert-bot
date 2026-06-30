import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import { fetchSourceContent } from "./source-fetchers/index.js";
import { SourceChunkerService } from "./source-chunker.service.js";
import { createRagIngestClient, type RagIngestClient } from "./rag-ingest.client.js";

export class SourceIngestService {
  private readonly chunker = new SourceChunkerService();

  constructor(
    private readonly botInstanceId: string,
    private readonly botInstanceSlug: string,
    private readonly ingestClient: RagIngestClient = createRagIngestClient(),
  ) {}

  async ingestSource(dataSourceId: string) {
    const source = await prisma.dataSource.findUnique({ where: { id: dataSourceId } });
    if (!source || source.botInstanceId !== this.botInstanceId) {
      throw new Error("Data source not found");
    }

    const run = await prisma.sourceIngestionRun.create({
      data: {
        botInstanceId: this.botInstanceId,
        dataSourceId: source.id,
        status: "running",
      },
    });

    if (source.type === "CHAT_HISTORY") {
      throw new Error("CHAT_HISTORY sources are synced via chat sync, not source ingest");
    }

    try {
      const text = await fetchSourceContent(source.type, source.location);
      const chunks = this.chunker.chunkText({
        text,
        dataSourceId: source.id,
        chatId: source.chatId?.toString(),
        maxChars: env.SOURCE_MAX_CHUNK_CHARS,
      });

      if (chunks.length === 0) {
        throw new Error("No content extracted from source");
      }

      const result = await this.ingestClient.upsertChunks({
        botInstanceId: this.botInstanceId,
        botInstanceSlug: this.botInstanceSlug,
        chatId: source.chatId?.toString() ?? "global",
        dataSourceId: source.id,
        chunks,
      });

      await prisma.dataSource.update({
        where: { id: source.id },
        data: {
          status: "ACTIVE",
          lastIngestedAt: new Date(),
          lastError: null,
          chunkCount: result.accepted,
          ingestJobId: result.jobId ?? null,
        },
      });

      await prisma.sourceIngestionRun.update({
        where: { id: run.id },
        data: {
          status: "success",
          finishedAt: new Date(),
          chunksSent: result.accepted,
        },
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.dataSource.update({
        where: { id: source.id },
        data: { status: "ERROR", lastError: message },
      });
      await prisma.sourceIngestionRun.update({
        where: { id: run.id },
        data: { status: "failed", finishedAt: new Date(), error: message },
      });
      throw error;
    }
  }

  async ingestPending() {
    const sources = await prisma.dataSource.findMany({
      where: {
        botInstanceId: this.botInstanceId,
        status: "PENDING",
        type: { in: ["URL", "FILE", "MANUAL"] },
      },
    });

    const results = [];
    for (const source of sources) {
      try {
        results.push(await this.ingestSource(source.id));
      } catch (error) {
        console.error(`[ingest] failed for ${source.id}:`, error);
      }
    }
    return results;
  }
}