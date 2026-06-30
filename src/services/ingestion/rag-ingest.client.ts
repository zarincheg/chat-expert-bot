export interface IngestChunkMetadata {
  messageIds: string[];
  timeRange: { from: string; to: string };
  roles: string[];
  chatId: string;
  capturedFrom: string[];
  sourceUsername?: string | null;
  sourceType?: string;
}

export interface IngestChunk {
  externalId: string;
  title?: string;
  content: string;
  metadata: IngestChunkMetadata;
}

export interface IngestChunkBatch {
  botInstanceId: string;
  botInstanceSlug: string;
  chatId: string;
  dataSourceId: string;
  chunks: IngestChunk[];
}

export interface IngestResult {
  accepted: number;
  rejected: number;
  jobId?: string;
  raw?: unknown;
}

export interface RagIngestClient {
  upsertChunks(batch: IngestChunkBatch): Promise<IngestResult>;
}

export class MockRagIngestClient implements RagIngestClient {
  async upsertChunks(batch: IngestChunkBatch): Promise<IngestResult> {
    console.info(
      `[ingest:mock] batch chat=${batch.chatId} chunks=${batch.chunks.length} source=${batch.dataSourceId}`,
    );

    for (const chunk of batch.chunks) {
      console.debug(
        `[ingest:mock] ${chunk.externalId} title=${chunk.title ?? "(none)"} bytes=${chunk.content.length}`,
      );
    }

    return {
      accepted: batch.chunks.length,
      rejected: 0,
      jobId: `mock-${Date.now()}`,
      raw: { mode: "mock" },
    };
  }
}

export class HttpRagIngestClient implements RagIngestClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
  ) {}

  async upsertChunks(batch: IngestChunkBatch): Promise<IngestResult> {
    const response = await fetch(`${this.baseUrl}/ingest/chunks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`RAG ingest failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as IngestResult;
    return data;
  }
}

export function createRagIngestClient(): RagIngestClient {
  const baseUrl = process.env.RAG_INGEST_URL?.trim();
  const apiKey = process.env.RAG_INGEST_API_KEY?.trim();

  if (baseUrl) {
    return new HttpRagIngestClient(baseUrl, apiKey);
  }

  return new MockRagIngestClient();
}