import "dotenv/config";
import { env } from "../src/config/env.js";
import { prisma } from "../src/db/prisma.js";
import { BotConfigService } from "../src/services/bot-config.service.js";
import { ChatHistoryService } from "../src/services/chat-history.service.js";
import { MessageCaptureService } from "../src/services/capture/message-capture.service.js";
import { GroupConfigService } from "../src/services/group-config.service.js";
import { CommunityAnswerService } from "../src/services/community/community-answer.service.js";
import { QuestionLogService } from "../src/services/community/question-log.service.js";
import { RagOrchestrator } from "../src/services/rag/rag-orchestrator.js";
import { RagService } from "../src/services/rag.service.js";

async function verifyTelegramToken(): Promise<string> {
  const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getMe`);
  const data = (await response.json()) as {
    ok: boolean;
    result?: { username: string; first_name: string };
    description?: string;
  };

  if (!data.ok || !data.result) {
    throw new Error(data.description ?? "Telegram getMe failed");
  }

  return data.result.username;
}

async function sendStartupPing(username: string): Promise<void> {
  const adminId = env.ADMIN_USER_IDS[0];
  if (!adminId) return;

  const text = [
    "Smoke test: bot skeleton is running.",
    `Instance: ${env.BOT_INSTANCE_ID}`,
    `Bot: @${username}`,
    "Try /start or /ping in this chat.",
  ].join("\n");

  const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: adminId, text }),
  });

  const data = (await response.json()) as { ok: boolean; description?: string };
  if (!data.ok) {
    throw new Error(data.description ?? "Failed to send startup ping");
  }
}

async function main() {
  console.log("[smoke] checking database...");
  const instance = await prisma.botInstance.findUnique({
    where: { slug: env.BOT_INSTANCE_ID },
    include: {
      commands: true,
      buttons: true,
      knowledgeChunks: true,
    },
  });

  if (!instance) {
    throw new Error(`Bot instance "${env.BOT_INSTANCE_ID}" not found. Run: npm run db:seed`);
  }

  console.log(
    `[smoke] instance "${instance.slug}" — ${instance.commands.length} commands, ${instance.buttons.length} buttons, ${instance.knowledgeChunks.length} chunks`,
  );

  const configService = new BotConfigService();
  const settings = await configService.getSettings();
  console.log(`[smoke] settings: rag=${settings.ragEnabled}, style=${settings.responseStyle}`);

  const captureService = new MessageCaptureService(instance.id);
  captureService.configureFromSettings(settings.chatIngestion);
  const groupConfigService = new GroupConfigService(instance.id, configService);
  const communityService = new CommunityAnswerService(instance.id, instance.slug);
  const questionLogService = new QuestionLogService(instance.id);

  const orchestrator = new RagOrchestrator(
    instance.id,
    instance.slug,
    new ChatHistoryService(
      instance.id,
      env.RAG_HISTORY_LIMIT,
      captureService,
      configService,
    ),
    configService,
    groupConfigService,
    communityService,
    questionLogService,
  );
  const ragService = new RagService(orchestrator);

  const testChatId = BigInt(env.ADMIN_USER_IDS[0] ?? 1);
  const ragResult = await ragService.answer({
    chatId: testChatId,
    chatType: "private",
    question: "When is standup?",
  });

  console.log(`[smoke] RAG answer preview: ${ragResult.answer.split("\n")[0]}`);
  console.log(`[smoke] RAG sources: ${ragResult.sources.length}, scope chatId=${testChatId}`);

  console.log("[smoke] checking Telegram token...");
  const username = await verifyTelegramToken();
  console.log(`[smoke] Telegram bot: @${username}`);

  await sendStartupPing(username);
  console.log(`[smoke] sent startup ping to admin user ${env.ADMIN_USER_IDS[0]}`);
}

main()
  .catch((error) => {
    console.error("[smoke] FAILED:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });