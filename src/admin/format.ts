import type { BotButton, BotCommand, DataSource } from "@prisma/client";
import type { CommunityAnswer } from "@prisma/client";
import type { BotSettings, ChatIngestionSettings } from "../types/index.js";
import type { IngestionRun } from "@prisma/client";
import type { ManagedGroupView } from "../services/group-registry.service.js";

export function mainMenuText(inDm: boolean, modOnly = false): string {
  if (modOnly) {
    return [
      "👮 Moderator Panel",
      "",
      "Review community answers promoted via /promote.",
      "Approve to add them to the group knowledge base.",
    ].join("\n");
  }

  return [
    "⚙️ Admin Panel",
    "",
    inDm
      ? "Manage bot settings and groups from here."
      : "Tip: use /admin in DM to manage groups privately.",
    "Choose a section below:",
  ].join("\n");
}

export function groupsText(groups: ManagedGroupView[]): string {
  const lines = groups.map((group) => {
    const name = group.title ?? `Chat ${group.chatId}`;
    const active = group.isActive ? "" : " (bot left)";
    const sync = group.syncEnabled ? " 🔄 sync on" : "";
    const rag = group.settings.ragEnabled ? "" : " (RAG off)";
    return `• ${name}${active}${sync}${rag}\n  id: ${group.chatId}`;
  });

  return [
    "👥 Managed Groups",
    "",
    lines.length > 0 ? lines.join("\n\n") : "No groups yet.",
    "",
    "Groups appear when the bot is added, or use Add by chat ID.",
    "Tap a group to configure sync, triggers, and moderators.",
  ].join("\n");
}

export function groupDetailText(group: ManagedGroupView): string {
  const name = group.title ?? "(no title)";
  const mods =
    group.settings.moderatorUserIds.length > 0
      ? group.settings.moderatorUserIds.map((id) => `• ${id}`).join("\n")
      : "None — add moderators to allow /promote and review.";

  return [
    `👥 ${name}`,
    "",
    `Chat ID: ${group.chatId}`,
    `Type: ${group.chatType}`,
    `Bot in group: ${group.isActive ? "yes" : "no"}`,
    `Sync allowlist: ${group.syncEnabled ? "✅ enabled" : "❌ disabled"}`,
    `RAG: ${group.settings.ragEnabled ? "✅ on" : "❌ off"}`,
    group.topic ? `Topic: ${group.topic}` : "",
    group.memberStatus ? `Bot role: ${group.memberStatus}` : "",
    "",
    "Moderators:",
    mods,
  ]
    .filter(Boolean)
    .join("\n");
}

export function groupSettingsText(group: ManagedGroupView): string {
  const s = group.settings;
  const t = s.triggers;
  return [
    `⚙️ Settings — ${group.title ?? group.chatId}`,
    "",
    `RAG: ${s.ragEnabled ? "✅ on" : "❌ off"}`,
    `Capture: ${s.captureEnabled ? "✅ on" : "❌ off"}`,
    `Sync: ${s.syncEnabled ? "✅ on" : "❌ off"}`,
    `Style: ${s.responseStyle}`,
    "",
    "Triggers:",
    `• @mention: ${t.onMention ? "on" : "off"}`,
    `• Reply to bot: ${t.onReplyToBot ? "on" : "off"}`,
    `• Question heuristic: ${t.onQuestionHeuristic ? "on" : "off"}`,
    `• Cooldown: ${t.cooldownSeconds}s, max ${t.maxRepliesPerHour}/h`,
    "",
    group.topic ? `Topic: ${group.topic}` : "Topic: (not set)",
    s.expertPersona ? `Persona: ${s.expertPersona.slice(0, 120)}...` : "Persona: (not set)",
  ].join("\n");
}

export function groupModeratorsText(group: ManagedGroupView): string {
  const lines =
    group.settings.moderatorUserIds.length > 0
      ? group.settings.moderatorUserIds.map((id) => `• ${id}`).join("\n")
      : "No moderators yet.";

  return [
    `👮 Moderators — ${group.title ?? group.chatId}`,
    "",
    lines,
    "",
    "Moderators can /promote answers and approve them via /mod.",
    "Global admins always have moderator rights.",
  ].join("\n");
}

export function communityText(candidates: CommunityAnswer[]): string {
  const lines = candidates.map((c, i) => {
    const who = c.sourceUsername ? `@${c.sourceUsername}` : "member";
    const preview =
      c.content.length > 80 ? `${c.content.slice(0, 77)}...` : c.content;
    return `${i + 1}. [${c.chatId}] ${who}\n   ${preview}`;
  });

  return [
    "💬 Community Answers (pending)",
    "",
    lines.length > 0 ? lines.join("\n\n") : "No pending candidates.",
    "",
    "Tap ✅ to approve (ingests to RAG) or ❌ to reject.",
  ].join("\n");
}

export function commandsText(commands: BotCommand[]): string {
  const lines = commands.map((command) => {
    const status = command.isEnabled ? "✅" : "❌";
    return `${status} /${command.name} — ${command.description}`;
  });

  return [
    "📝 Commands",
    "",
    lines.length > 0 ? lines.join("\n") : "No commands yet.",
    "",
    "Tap a command to toggle it, or add a new one.",
  ].join("\n");
}

export function buttonsText(buttons: BotButton[]): string {
  const lines = buttons.map((button) => {
    const status = button.isEnabled ? "✅" : "❌";
    const kind = button.keyboardType === "inline" ? "inline" : "reply";
    return `${status} ${button.label} → ${button.actionType} (${kind})`;
  });

  return [
    "🔘 Buttons",
    "",
    lines.length > 0 ? lines.join("\n") : "No buttons yet.",
    "",
    "Tap a button to enable/disable it.",
  ].join("\n");
}

export function dataSourcesText(sources: DataSource[]): string {
  const lines = sources.map((source) => {
    const status =
      source.status === "ACTIVE" ? "🟢" : source.status === "PENDING" ? "🟡" : "🔴";
    const location =
      source.location.length > 48 ? `${source.location.slice(0, 45)}...` : source.location;
    const ingest = source.lastIngestedAt
      ? `ingested ${source.lastIngestedAt.toISOString()} (${source.chunkCount} chunks)`
      : "not ingested yet";
    const err = source.lastError ? `\n   ⚠️ ${source.lastError.slice(0, 60)}` : "";
    return `${status} ${source.name} (${source.type})\n   ${location}\n   ${ingest}${err}`;
  });

  return [
    "📚 Data Sources",
    "",
    lines.length > 0 ? lines.join("\n\n") : "No data sources yet.",
    "",
    "Tap to activate pending sources or run ingest.",
  ].join("\n");
}

export function chatSyncText(
  ingestion: ChatIngestionSettings,
  lastRun: IngestionRun | null,
): string {
  const chatList =
    ingestion.syncChatIds.length > 0
      ? ingestion.syncChatIds.map((id) => `• ${id}`).join("\n")
      : "No chats in sync allowlist — open 👥 Groups to add.";

  const lastRunText = lastRun
    ? [
        `Last run: ${lastRun.status} at ${lastRun.startedAt.toISOString()}`,
        `Chunks: ${lastRun.chunksSent}, messages: ${lastRun.messagesSent}`,
        lastRun.error ? `Error: ${lastRun.error}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "No sync runs yet.";

  return [
    "🔄 Chat Sync",
    "",
    `Periodic sync: ${ingestion.enabled ? "✅ enabled" : "❌ disabled"}`,
    `Interval: ${ingestion.intervalHours}h`,
    `Message capture: ${ingestion.captureGroupMessages ? "✅ enabled" : "❌ disabled"}`,
    `Chunk size: ${ingestion.chunkSize} messages`,
    `Max per run: ${ingestion.maxMessagesPerRun}`,
    "",
    "Allowlisted chats:",
    chatList,
    "",
    lastRunText,
    "",
    "Capture = store group messages. Sync = export chunks to RAG API.",
    "Requires Group Privacy off in BotFather.",
  ].join("\n");
}

export function settingsText(settings: BotSettings): string {
  return [
    "⚙️ Bot Settings",
    "",
    `RAG: ${settings.ragEnabled ? "✅ enabled" : "❌ disabled"}`,
    `Response style: ${settings.responseStyle}`,
    `Proactive digest: ${settings.proactiveDigestEnabled ? "✅ on" : "❌ off"}`,
    "",
    "Use the buttons below to change settings.",
  ].join("\n");
}