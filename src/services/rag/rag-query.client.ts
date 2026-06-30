import type { KnowledgeSource } from "../ai-client/types.js";

export interface RagQueryRequest {
  botInstanceId: string;
  botInstanceSlug: string;
  chatId: string;
  query: string;
  topK?: number;
}

export interface RagQueryClient {
  search(request: RagQueryRequest): Promise<KnowledgeSource[]>;
}

export class MockRagQueryClient implements RagQueryClient {
  async search(request: RagQueryRequest): Promise<KnowledgeSource[]> {
    console.info(
      `[query:mock] chat=${request.chatId} q="${request.query.slice(0, 60)}" topK=${request.topK ?? 5}`,
    );
    return [
      {
        id: "mock-chunk-1",
        title: "Mock knowledge",
        content: `Mock result for "${request.query}" in chat ${request.chatId}.`,
        score: 0.9,
        sourceType: "rag",
      },
    ];
  }
}

export class HttpRagQueryClient implements RagQueryClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey?: string,
  ) {}

  async search(request: RagQueryRequest): Promise<KnowledgeSource[]> {
    const response = await fetch(`${this.baseUrl}/query/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`RAG query failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as {
      results: KnowledgeSource[];
    };
    return data.results ?? [];
  }
}

export function createRagQueryClient(): RagQueryClient {
  const baseUrl = process.env.RAG_QUERY_URL?.trim();
  const apiKey = process.env.RAG_QUERY_API_KEY?.trim();
  if (baseUrl) return new HttpRagQueryClient(baseUrl, apiKey);
  return new MockRagQueryClient();
}