import type { KnowledgeSource } from "./ai-client/types.js";
import type { RagOrchestrator, RagAnswer, RagAnswerParams } from "./rag/rag-orchestrator.js";

export type { RagAnswer };

export class RagService {
  constructor(private readonly orchestrator: RagOrchestrator) {}

  answer(params: RagAnswerParams): Promise<RagAnswer> {
    return this.orchestrator.answer(params);
  }

  retrieveKnowledge(query: string, chatId: bigint): Promise<KnowledgeSource[]> {
    return this.orchestrator.retrieveKnowledge(query, chatId);
  }

  getDailyDigest(): Promise<string> {
    return this.orchestrator.getDailyDigest();
  }
}