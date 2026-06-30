import "dotenv/config";
import { env } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { SourceIngestService } from "../services/ingestion/source-ingest.service.js";

async function main() {
  const instance = await prisma.botInstance.findUnique({
    where: { slug: env.BOT_INSTANCE_ID },
  });
  if (!instance) throw new Error(`Bot instance "${env.BOT_INSTANCE_ID}" not found`);

  const service = new SourceIngestService(instance.id, instance.slug);
  const results = await service.ingestPending();
  console.info(`[job:ingest-sources] processed ${results.length} source(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());