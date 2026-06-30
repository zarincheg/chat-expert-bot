import "dotenv/config";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { BotConfigService } from "../services/bot-config.service.js";
import { ChatSyncService } from "../services/ingestion/chat-sync.service.js";

async function main() {
  const instance = await prisma.botInstance.findUnique({
    where: { slug: env.BOT_INSTANCE_ID },
  });

  if (!instance) {
    throw new Error(`Bot instance "${env.BOT_INSTANCE_ID}" not found.`);
  }

  const configService = new BotConfigService();
  const syncService = new ChatSyncService(instance.id, instance.slug, configService);

  console.info(`[job:sync-chats] starting for instance "${instance.slug}"`);
  const result = await syncService.run();

  console.info(
    `[job:sync-chats] finished — chats=${result.chatsProcessed} chunks=${result.chunksSent} messages=${result.messagesSent}`,
  );

  if (result.errors.length > 0) {
    console.warn("[job:sync-chats] errors:", result.errors);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("[job:sync-chats] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });