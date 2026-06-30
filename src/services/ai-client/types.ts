export interface ChatMessageInput {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface KnowledgeSource {
  id: string;
  title: string | null;
  content: string;
  score: number;
  sourceType?: "rag" | "community" | "local";
  citedUsername?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RagContext {
  chatId: string;
  groupTitle?: string | null;
  expertPersona?: string;
  topic?: string | null;
  history: ChatMessageInput[];
  sources: KnowledgeSource[];
  responseStyle: "concise" | "detailed";
  threadSnippet?: string;
}

export interface AiResponse {
  answer: string;
  model: string;
  tokensUsed: number;
}

export interface AiClient {
  chat(messages: ChatMessageInput[], context: RagContext): Promise<AiResponse>;
}