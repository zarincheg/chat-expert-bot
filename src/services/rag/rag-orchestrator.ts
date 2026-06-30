import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import type { AiClient, KnowledgeSource } from "../ai-client/types.js";
import { mockAiClient } from "../ai-client/mock.client.js";
import type { ChatHistoryService } from "../chat-history.service.js";
import type { BotConfigService } from "../bot-config.service.js";
import type { GroupConfigService } from "../group-config.service.js";
import type { CommunityAnswerService } from "../community/community-answer.service.js";
import type { QuestionLogService } from "../community/question-log.service.js";
import { formatSourcesFooter } from "../community/citation-formatter.js";
import {
  createRagQueryClient,
  type RagQueryClient,
} from "./rag-query.client.js";
import type { ChatType } from "../capture/filters/types.js";

export interface RagAnswerParams {
  chatId: bigint;
  chatType: ChatType;
  userId?: number;
  username?: string;
  question: string;
  messageId?: number;
  replyToMessageId?: number;
  threadSnippet?: string;
}

export interface RagAnswer {
  answer: string;
  sources: KnowledgeSource[];
  historyUsed: number;
  model: string;
  answerSource: string;
}

export class RagOrchestrator {
  constructor(
    private readonly botInstanceId: string,
    private readonly botInstanceSlug: string,
    private readonly historyService: ChatHistoryService,
    private readonly configService: BotConfigService,
    private readonly groupConfigService: GroupConfigService,
    private readonly communityService: CommunityAnswerService,
    private readonly questionLogService: QuestionLogService,
    private readonly queryClient: RagQueryClient = createRagQueryClient(),
    private readonly aiClient: AiClient = mockAiClient,
  ) {}

  async answer(params: RagAnswerParams): Promise<RagAnswer> {
    const globalSettings = await this.configService.getSettings();
    const groupSettings = await this.groupConfigService.getSettings(params.chatId);
    const groupMeta = await this.groupConfigService.getGroupMeta(params.chatId);

    const ragEnabled = globalSettings.ragEnabled && groupSettings.ragEnabled;

    await this.historyService.storeUserMessage({
      chatId: params.chatId,
      chatType: params.chatType,
      userId: params.userId,
      username: params.username,
      content: params.question,
      messageId: params.messageId,
    });

    if (!ragEnabled) {
      const fallback =
        "RAG is disabled for this group. A moderator can re-enable it in /admin → Groups.";
      await this.storeAndLog(params, fallback, [], "none", 0, "none");
      return { answer: fallback, sources: [], historyUsed: 0, model: "none", answerSource: "none" };
    }

    const history = await this.historyService.getRecentHistory(params.chatId);
    const sources = await this.retrieveKnowledge(params.question, params.chatId);
    const responseStyle = groupSettings.responseStyle ?? globalSettings.responseStyle;

    const response = await this.aiClient.chat(
      [...history, { role: "user", content: params.question }],
      {
        chatId: params.chatId.toString(),
        groupTitle: groupMeta?.title,
        topic: groupMeta?.topic,
        expertPersona: groupSettings.expertPersona,
        history,
        sources,
        responseStyle,
        threadSnippet: params.threadSnippet,
      },
    );

    const footer = formatSourcesFooter(sources);
    const fullAnswer = `${response.answer}${footer}`;
    const topScore = sources[0]?.score ?? 0;
    const answerSource = sources.some((s) => s.sourceType === "community")
      ? "community"
      : sources.length > 0
        ? "rag"
        : "none";

    await this.storeAndLog(
      params,
      fullAnswer,
      sources,
      response.model,
      history.length,
      answerSource,
      topScore,
    );

    return {
      answer: fullAnswer,
      sources,
      historyUsed: history.length,
      model: response.model,
      answerSource,
    };
  }

  async retrieveKnowledge(query: string, chatId: bigint): Promise<KnowledgeSource[]> {
    let sources: KnowledgeSource[] = [];

    try {
      sources = await this.queryClient.search({
        botInstanceId: this.botInstanceId,
        botInstanceSlug: this.botInstanceSlug,
        chatId: chatId.toString(),
        query,
        topK: env.RAG_QUERY_TOP_K,
      });
    } catch (error) {
      console.error("[rag] query failed:", error);
    }

    const community = await this.communityService.searchApproved(chatId, query);
    sources = [...community, ...sources].sort((a, b) => b.score - a.score).slice(0, env.RAG_QUERY_TOP_K);

    if (sources.length === 0 && env.RAG_FALLBACK_LOCAL) {
      sources = await this.retrieveLocalFallback(query);
    }

    return sources;
  }

  private async retrieveLocalFallback(query: string): Promise<KnowledgeSource[]> {
    const normalized = query.toLowerCase();
    const chunks = await prisma.knowledgeChunk.findMany({
      where: { botInstanceId: this.botInstanceId },
      take: 20,
    });

    return chunks
      .filter((c) => c.content.toLowerCase().includes(normalized.slice(0, 20)) || normalized.length < 5)
      .slice(0, 2)
      .map((chunk, i) => ({
        id: chunk.id,
        title: chunk.title,
        content: chunk.content,
        score: 0.1 - i * 0.01,
        sourceType: "local" as const,
      }));
  }

  private async storeAndLog(
    params: RagAnswerParams,
    answer: string,
    sources: KnowledgeSource[],
    _model: string,
    _historyUsed: number,
    answerSource: string,
    ragScore?: number,
  ) {
    await this.historyService.storeAssistantMessage({
      chatId: params.chatId,
      chatType: params.chatType,
      content: answer,
    });

    await this.questionLogService.log({
      chatId: params.chatId,
      userId: params.userId,
      question: params.question,
      answerSource,
      ragScore,
      replyToMessageId: params.replyToMessageId,
      communityAnswerId: sources.find((s) => s.sourceType === "community")?.id,
    });
  }

  async getDailyDigest(): Promise<string> {
    const chunks = await prisma.knowledgeChunk.findMany({
      where: { botInstanceId: this.botInstanceId },
      take: 1,
      orderBy: { updatedAt: "desc" },
    });
    if (chunks.length === 0) {
      return "Daily tip: Add content sources or promote community answers via /promote.";
    }
    const tip = chunks[0];
    return ["Daily tip", tip.title ? `— ${tip.title}` : "", tip.content].filter(Boolean).join("\n");
  }
}