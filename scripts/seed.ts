import "dotenv/config";
import { Prisma, PrismaClient } from "@prisma/client";
import { DEFAULT_BOT_SETTINGS } from "../src/types/index.js";

const prisma = new PrismaClient();

function titleCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function main() {
  const slug = process.env.BOT_INSTANCE_ID?.trim() || "default";

  const instance = await prisma.botInstance.upsert({
    where: { slug },
    create: {
      slug,
      name: titleCase(slug),
      description: `Bot instance "${slug}" for local development`,
      settings: DEFAULT_BOT_SETTINGS as unknown as Prisma.InputJsonValue,
    },
    update: {},
  });

  const commands = [
    { name: "start", description: "Show welcome message and action buttons", sortOrder: 0 },
    { name: "help", description: "List available commands", sortOrder: 1 },
    { name: "ask", description: "Ask a question using RAG", sortOrder: 2 },
    { name: "report", description: "Report an issue (multi-step dialog)", sortOrder: 3 },
    { name: "digest", description: "Get a proactive daily tip", sortOrder: 4 },
    { name: "admin", description: "Manage bot configuration (admins only)", sortOrder: 5 },
    { name: "mod", description: "Moderator panel for community review", sortOrder: 6 },
    { name: "promote", description: "Promote a reply to community knowledge (moderators)", sortOrder: 7 },
    { name: "ping", description: "Health check", sortOrder: 8 },
  ];

  for (const command of commands) {
    await prisma.botCommand.upsert({
      where: {
        botInstanceId_name: {
          botInstanceId: instance.id,
          name: command.name,
        },
      },
      create: {
        botInstanceId: instance.id,
        name: command.name,
        description: command.description,
        sortOrder: command.sortOrder,
      },
      update: {
        description: command.description,
        sortOrder: command.sortOrder,
      },
    });
  }

  const buttons = [
    { label: "FAQ", actionType: "faq", keyboardType: "inline", sortOrder: 0 },
    { label: "Ask AI", actionType: "ask_ai", keyboardType: "inline", sortOrder: 1 },
    { label: "Report issue", actionType: "report_issue", keyboardType: "inline", sortOrder: 2 },
    { label: "Help", actionType: "show_help", keyboardType: "inline", sortOrder: 3 },
    { label: "Quick FAQ", actionType: "faq", keyboardType: "reply", sortOrder: 4 },
    { label: "Ask AI", actionType: "ask_ai", keyboardType: "reply", sortOrder: 5 },
  ];

  await prisma.botButton.deleteMany({ where: { botInstanceId: instance.id } });

  for (const button of buttons) {
    await prisma.botButton.create({
      data: {
        botInstanceId: instance.id,
        label: button.label,
        actionType: button.actionType,
        keyboardType: button.keyboardType,
        sortOrder: button.sortOrder,
      },
    });
  }

  const dataSourceId = `seed-manual-faq-${slug}`;

  const dataSource = await prisma.dataSource.upsert({
    where: { id: dataSourceId },
    create: {
      id: dataSourceId,
      botInstanceId: instance.id,
      name: "Group FAQ",
      type: "MANUAL",
      location: "inline-seed-content",
      status: "ACTIVE",
    },
    update: {
      status: "ACTIVE",
    },
  });

  await prisma.knowledgeChunk.deleteMany({ where: { botInstanceId: instance.id } });

  const chunks = [
    {
      title: "Meeting schedule",
      content: "Team standups are every weekday at 10:00 AM UTC in #general.",
      keywords: ["meeting", "standup", "schedule"],
    },
    {
      title: "Code of conduct",
      content: "Be respectful, stay on topic, and avoid sharing confidential data in group chats.",
      keywords: ["conduct", "rules", "policy"],
    },
    {
      title: "Onboarding",
      content: "New members should read the pinned message and introduce themselves in #introductions.",
      keywords: ["onboarding", "new", "member"],
    },
  ];

  for (const chunk of chunks) {
    await prisma.knowledgeChunk.create({
      data: {
        botInstanceId: instance.id,
        dataSourceId: dataSource.id,
        title: chunk.title,
        content: chunk.content,
        keywords: chunk.keywords,
      },
    });
  }

  console.log(`Seeded bot instance "${instance.slug}" (${instance.id})`);
  console.log(`  commands: ${commands.length}`);
  console.log(`  buttons: ${buttons.length}`);
  console.log(`  knowledge chunks: ${chunks.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });