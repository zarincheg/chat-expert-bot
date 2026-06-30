import { createBot } from "./bot/bot.js";
import { env } from "./config/env.js";
import { prisma } from "./db/prisma.js";

async function main() {
  const { bot, syncScheduler } = await createBot();

  if (env.SYNC_SCHEDULER_ENABLED) {
    await syncScheduler.start();
  }

  const shutdown = async (signal: string) => {
    console.info(`[shutdown] received ${signal}`);
    syncScheduler.stop();
    await bot.stop();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  console.info("[bot] starting in long-polling mode...");
  await bot.start({
    onStart: (info) => {
      console.info(`[bot] @${info.username} is running`);
    },
  });
}

main().catch(async (error) => {
  console.error("[fatal]", error);
  await prisma.$disconnect();
  process.exit(1);
});