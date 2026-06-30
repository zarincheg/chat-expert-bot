import { Bot, session } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import type { SessionData } from "../types/index.js";
import type { BotContext } from "./context.js";
import { BotConfigService } from "../services/bot-config.service.js";
import { ChatHistoryService } from "../services/chat-history.service.js";
import { MessageCaptureService } from "../services/capture/message-capture.service.js";
import { GroupConfigService } from "../services/group-config.service.js";
import { CommunityAnswerService } from "../services/community/community-answer.service.js";
import { QuestionLogService } from "../services/community/question-log.service.js";
import { RagOrchestrator } from "../services/rag/rag-orchestrator.js";
import { RagService } from "../services/rag.service.js";
import { ChatSyncService } from "../services/ingestion/chat-sync.service.js";
import { SourceIngestService } from "../services/ingestion/source-ingest.service.js";
import { GroupRegistryService } from "../services/group-registry.service.js";
import { SyncScheduler } from "../services/scheduler/sync-scheduler.js";
import { TriggerPolicyService } from "../services/trigger/trigger-policy.service.js";
import { ChatRateLimiter } from "../services/trigger/rate-limiter.js";
import { loggerMiddleware } from "./middleware/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { registerCommandHandlers } from "./handlers/commands.js";
import { registerCallbackHandlers } from "./handlers/callbacks.js";
import { registerMessageHandlers } from "./handlers/messages.js";
import { registerChatMemberHandlers } from "./handlers/chat-member.js";
import { registerModerationHandlers } from "./handlers/moderation.js";
import { ModerationConfigService } from "../services/moderation/moderation-config.service.js";
import { GroupMemberService } from "../services/moderation/group-member.service.js";
import { AccessListService } from "../services/moderation/access-list.service.js";
import { ModerationLogService } from "../services/moderation/moderation-log.service.js";
import { ModerationRuleService } from "../services/moderation/rule.service.js";
import { WelcomeService } from "../services/moderation/welcome.service.js";
import { ModerationEngine } from "../services/moderation/moderation-engine.service.js";
import { NewcomerPolicyService } from "../services/moderation/newcomer-policy.service.js";
import { reportIssueConversation } from "./conversations/report-issue.conversation.js";
import { createAskAiConversation } from "./conversations/ask-ai.conversation.js";
import { createAdminConversation } from "../admin/admin-conversation.js";

export interface ModerationServices {
  moderationConfig: ModerationConfigService;
  memberService: GroupMemberService;
  accessListService: AccessListService;
  moderationLog: ModerationLogService;
  ruleService: ModerationRuleService;
  welcomeService: WelcomeService;
  botInstanceId: string;
}

export interface BotRuntime {
  bot: Bot<BotContext>;
  syncScheduler: SyncScheduler;
  moderation: ModerationServices;
}

export async function createBot(): Promise<BotRuntime> {
  const bot = new Bot<BotContext>(env.BOT_TOKEN);

  const instance = await prisma.botInstance.findUnique({
    where: { slug: env.BOT_INSTANCE_ID },
  });

  if (!instance) {
    throw new Error(
      `Bot instance "${env.BOT_INSTANCE_ID}" not found. Run: npm run db:seed`,
    );
  }

  const configService = new BotConfigService();
  const groupConfigService = new GroupConfigService(instance.id, configService);
  const captureService = new MessageCaptureService(instance.id);
  const historyService = new ChatHistoryService(
    instance.id,
    env.RAG_HISTORY_LIMIT,
    captureService,
    configService,
  );
  const communityService = new CommunityAnswerService(instance.id, instance.slug);
  const questionLogService = new QuestionLogService(instance.id);
  const orchestrator = new RagOrchestrator(
    instance.id,
    instance.slug,
    historyService,
    configService,
    groupConfigService,
    communityService,
    questionLogService,
  );
  const ragService = new RagService(orchestrator);
  const syncService = new ChatSyncService(instance.id, instance.slug, configService);
  const sourceIngestService = new SourceIngestService(instance.id, instance.slug);
  const groupRegistry = new GroupRegistryService(instance.id, configService, groupConfigService);
  const syncScheduler = new SyncScheduler(syncService, configService);
  const triggerPolicy = new TriggerPolicyService();
  const rateLimiter = new ChatRateLimiter();
  const moderationConfig = new ModerationConfigService(instance.id);
  const memberService = new GroupMemberService(instance.id);
  const accessListService = new AccessListService(instance.id);
  const moderationLog = new ModerationLogService(instance.id);
  const ruleService = new ModerationRuleService(instance.id);
  const welcomeService = new WelcomeService(instance.id, moderationLog);
  const moderationEngine = new ModerationEngine(
    instance.id,
    moderationConfig,
    memberService,
    accessListService,
    moderationLog,
    ruleService,
    welcomeService,
  );
  const newcomerPolicy = new NewcomerPolicyService();

  const settings = await configService.getSettings();
  captureService.configureFromSettings(settings.chatIngestion);

  bot.use(loggerMiddleware);
  bot.use(session({ initial: (): SessionData => ({}) }));
  bot.use(conversations());

  bot.use(createConversation(reportIssueConversation, "reportIssueConversation"));
  bot.use(createConversation(createAskAiConversation(ragService), "askAiConversation"));
  bot.use(
    createConversation(
      createAdminConversation(
        configService,
        syncService,
        groupRegistry,
        groupConfigService,
        sourceIngestService,
        communityService,
      ),
      "adminConversation",
    ),
  );

  registerChatMemberHandlers(bot, groupRegistry);
  registerModerationHandlers(bot, moderationEngine, newcomerPolicy, groupRegistry);
  registerCommandHandlers(bot, configService, ragService, groupConfigService, communityService);
  registerCallbackHandlers(bot, configService, ragService);
  registerMessageHandlers(
    bot,
    configService,
    ragService,
    captureService,
    groupRegistry,
    groupConfigService,
    triggerPolicy,
    rateLimiter,
  );

  bot.catch(errorHandler);

  return {
    bot,
    syncScheduler,
    moderation: {
      moderationConfig,
      memberService,
      accessListService,
      moderationLog,
      ruleService,
      welcomeService,
      botInstanceId: instance.id,
    },
  };
}