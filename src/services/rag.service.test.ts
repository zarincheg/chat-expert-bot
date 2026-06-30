import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AiClient } from "./ai-client/types.js";
import { RagService } from "./rag.service.js";
import { RagOrchestrator } from "./rag/rag-orchestrator.js";
import type { ChatHistoryService } from "./chat-history.service.js";
import type { BotConfigService } from "./bot-config.service.js";
import type { GroupConfigService } from "./group-config.service.js";
import type { CommunityAnswerService } from "./community/community-answer.service.js";
import type { QuestionLogService } from "./community/question-log.service.js";
import { DEFAULT_CHAT_INGESTION_SETTINGS } from "../types/index.js";
import { DEFAULT_GROUP_SETTINGS } from "../types/group-settings.js";

describe("RagService", () => {
  const mockAiClient: AiClient = {
    chat: vi.fn().mockResolvedValue({
      answer: "Mock answer",
      model: "test-model",
      tokensUsed: 10,
    }),
  };

  const historyService = {
    storeUserMessage: vi.fn(),
    storeAssistantMessage: vi.fn(),
    getRecentHistory: vi.fn().mockResolvedValue([
      { role: "user", content: "previous question" },
    ]),
  } as unknown as ChatHistoryService;

  const configService = {
    getSettings: vi.fn().mockResolvedValue({
      ragEnabled: true,
      responseStyle: "concise",
      proactiveDigestEnabled: false,
      chatIngestion: DEFAULT_CHAT_INGESTION_SETTINGS,
    }),
  } as unknown as BotConfigService;

  const groupConfigService = {
    getSettings: vi.fn().mockResolvedValue(DEFAULT_GROUP_SETTINGS),
    getGroupMeta: vi.fn().mockResolvedValue({ title: "Test Group", topic: null }),
  } as unknown as GroupConfigService;

  const communityService = {
    searchApproved: vi.fn().mockResolvedValue([]),
  } as unknown as CommunityAnswerService;

  const questionLogService = {
    log: vi.fn(),
  } as unknown as QuestionLogService;

  let ragService: RagService;

  beforeEach(() => {
    vi.clearAllMocks();
    const orchestrator = new RagOrchestrator(
      "test-instance",
      "test-slug",
      historyService,
      configService,
      groupConfigService,
      communityService,
      questionLogService,
      {
        search: vi.fn().mockResolvedValue([
          { id: "1", title: "FAQ", content: "answer", score: 1 },
        ]),
      },
      mockAiClient,
    );
    ragService = new RagService(orchestrator);
  });

  it("stores messages and calls AI client when RAG is enabled", async () => {
    const result = await ragService.answer({
      chatId: BigInt(-100123),
      chatType: "supergroup",
      userId: 42,
      question: "When is standup?",
    });

    expect(historyService.storeUserMessage).toHaveBeenCalled();
    expect(mockAiClient.chat).toHaveBeenCalled();
    expect(historyService.storeAssistantMessage).toHaveBeenCalled();
    expect(result.answer).toContain("Mock answer");
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it("returns fallback when RAG is disabled globally", async () => {
    vi.mocked(configService.getSettings).mockResolvedValueOnce({
      ragEnabled: false,
      responseStyle: "concise",
      proactiveDigestEnabled: false,
      chatIngestion: DEFAULT_CHAT_INGESTION_SETTINGS,
    });

    const result = await ragService.answer({
      chatId: BigInt(-100123),
      chatType: "supergroup",
      question: "test",
    });

    expect(result.answer).toContain("RAG is disabled");
    expect(mockAiClient.chat).not.toHaveBeenCalled();
  });

  it("returns fallback when RAG is disabled for group", async () => {
    vi.mocked(groupConfigService.getSettings).mockResolvedValueOnce({
      ...DEFAULT_GROUP_SETTINGS,
      ragEnabled: false,
    });

    const result = await ragService.answer({
      chatId: BigInt(-100123),
      chatType: "supergroup",
      question: "test",
    });

    expect(result.answer).toContain("RAG is disabled");
    expect(mockAiClient.chat).not.toHaveBeenCalled();
  });
});