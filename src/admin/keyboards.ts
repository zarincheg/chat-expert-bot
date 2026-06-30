import { InlineKeyboard } from "grammy";
import type { BotButton, BotCommand, DataSource } from "@prisma/client";
import type { CommunityAnswer } from "@prisma/client";
import type { BotSettings, ChatIngestionSettings } from "../types/index.js";
import type { IngestionRun } from "@prisma/client";
import type { ManagedGroupView } from "../services/group-registry.service.js";

export const AdminCallback = {
  main: "adm:m",
  exit: "adm:x",
  commands: "adm:c",
  commandToggle: (name: string) => `adm:c:t:${name}`,
  commandAdd: "adm:c:a",
  buttons: "adm:b",
  buttonToggle: (index: number) => `adm:b:t:${index}`,
  buttonAdd: "adm:b:a",
  dataSources: "adm:d",
  dataSourceActivate: (index: number) => `adm:d:a:${index}`,
  dataSourceIngest: (id: string) => `adm:d:i:${id}`,
  dataSourceAdd: "adm:d:n",
  community: "adm:com",
  communityApprove: (id: string) => `adm:com:a:${id}`,
  communityReject: (id: string) => `adm:com:r:${id}`,
  settings: "adm:s",
  settingsToggleRag: "adm:s:rag",
  settingsStyleConcise: "adm:s:con",
  settingsStyleDetailed: "adm:s:det",
  settingsToggleDigest: "adm:s:dig",
  back: "adm:back",
  confirmYes: "adm:yes",
  confirmNo: "adm:no",
  actionType: (type: string) => `adm:at:${type}`,
  sourceType: (type: string) => `adm:st:${type}`,
  chatSync: "adm:ci",
  chatSyncToggle: "adm:ci:toggle",
  chatSyncToggleCapture: "adm:ci:cap",
  chatSyncInterval: (hours: number) => `adm:ci:h:${hours}`,
  chatSyncRegister: "adm:ci:reg",
  chatSyncRun: "adm:ci:run",
  chatSyncManageGroups: "adm:ci:mg",
  groups: "adm:g",
  groupSelect: (chatId: string) => `adm:g:s:${chatId}`,
  groupToggleSync: (chatId: string) => `adm:g:t:${chatId}`,
  groupAdd: "adm:g:a",
  groupRefresh: (chatId: string) => `adm:g:r:${chatId}`,
  groupSettings: (chatId: string) => `adm:g:cfg:${chatId}`,
  groupToggleRag: (chatId: string) => `adm:g:rag:${chatId}`,
  groupToggleCapture: (chatId: string) => `adm:g:cap:${chatId}`,
  groupToggleMention: (chatId: string) => `adm:g:tm:${chatId}`,
  groupToggleReply: (chatId: string) => `adm:g:tr:${chatId}`,
  groupToggleQuestion: (chatId: string) => `adm:g:tq:${chatId}`,
  groupEditTopic: (chatId: string) => `adm:g:et:${chatId}`,
  groupEditPersona: (chatId: string) => `adm:g:ep:${chatId}`,
  groupModerators: (chatId: string) => `adm:g:mod:${chatId}`,
  groupModAdd: (chatId: string) => `adm:g:ma:${chatId}`,
  groupModRemove: (chatId: string, userId: number) => `adm:g:mr:${chatId}:${userId}`,
} as const;

export function mainMenuKeyboard(modOnly = false): InlineKeyboard {
  if (modOnly) {
    return new InlineKeyboard()
      .text("💬 Community review", AdminCallback.community)
      .row()
      .text("🚪 Exit", AdminCallback.exit);
  }

  return new InlineKeyboard()
    .text("📝 Commands", AdminCallback.commands)
    .text("🔘 Buttons", AdminCallback.buttons)
    .row()
    .text("📚 Data sources", AdminCallback.dataSources)
    .text("⚙️ Settings", AdminCallback.settings)
    .row()
    .text("👥 Groups", AdminCallback.groups)
    .text("🔄 Chat sync", AdminCallback.chatSync)
    .row()
    .text("💬 Community", AdminCallback.community)
    .row()
    .text("🚪 Exit", AdminCallback.exit);
}

export function backKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text("◀️ Back to menu", AdminCallback.back);
}

export function commandsKeyboard(commands: BotCommand[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const command of commands) {
    const status = command.isEnabled ? "✅" : "❌";
    keyboard
      .text(`${status} /${command.name}`, AdminCallback.commandToggle(command.name))
      .row();
  }

  keyboard.text("➕ Add command", AdminCallback.commandAdd).row();
  keyboard.text("◀️ Back to menu", AdminCallback.back);

  return keyboard;
}

export function buttonsKeyboard(buttons: BotButton[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  buttons.forEach((button, index) => {
    const status = button.isEnabled ? "✅" : "❌";
    const kind = button.keyboardType === "inline" ? "🔲" : "⌨️";
    keyboard
      .text(`${status} ${kind} ${button.label}`, AdminCallback.buttonToggle(index))
      .row();
  });

  keyboard.text("➕ Add button", AdminCallback.buttonAdd).row();
  keyboard.text("◀️ Back to menu", AdminCallback.back);

  return keyboard;
}

export function dataSourcesKeyboard(sources: DataSource[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  sources.forEach((source, index) => {
    const status =
      source.status === "ACTIVE" ? "🟢" : source.status === "PENDING" ? "🟡" : "🔴";
    const label = `${status} ${source.name}`;
    if (source.status !== "ACTIVE") {
      keyboard.text(`Activate: ${label}`, AdminCallback.dataSourceActivate(index)).row();
    }
    if (source.type !== "CHAT_HISTORY") {
      keyboard.text(`▶️ Ingest: ${source.name}`, AdminCallback.dataSourceIngest(source.id)).row();
    }
  });

  keyboard.text("➕ Add source", AdminCallback.dataSourceAdd).row();
  keyboard.text("◀️ Back to menu", AdminCallback.back);

  return keyboard;
}

export function communityKeyboard(candidates: CommunityAnswer[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const candidate of candidates.slice(0, 8)) {
    const preview =
      candidate.content.length > 24
        ? `${candidate.content.slice(0, 21)}...`
        : candidate.content;
    keyboard
      .text(`✅ ${preview}`, AdminCallback.communityApprove(candidate.id))
      .text("❌", AdminCallback.communityReject(candidate.id))
      .row();
  }

  keyboard.text("◀️ Back to menu", AdminCallback.back);
  return keyboard;
}

export function settingsKeyboard(settings: BotSettings): InlineKeyboard {
  const ragLabel = settings.ragEnabled ? "✅ RAG on" : "❌ RAG off";
  const digestLabel = settings.proactiveDigestEnabled ? "✅ Digest on" : "❌ Digest off";
  const conciseMark = settings.responseStyle === "concise" ? " •" : "";
  const detailedMark = settings.responseStyle === "detailed" ? " •" : "";

  return new InlineKeyboard()
    .text(ragLabel, AdminCallback.settingsToggleRag)
    .row()
    .text(`Concise${conciseMark}`, AdminCallback.settingsStyleConcise)
    .text(`Detailed${detailedMark}`, AdminCallback.settingsStyleDetailed)
    .row()
    .text(digestLabel, AdminCallback.settingsToggleDigest)
    .row()
    .text("◀️ Back to menu", AdminCallback.back);
}

export function actionTypeKeyboard(): InlineKeyboard {
  const types = ["faq", "ask_ai", "report_issue", "show_help", "custom"] as const;

  const keyboard = new InlineKeyboard();
  types.forEach((type, index) => {
    keyboard.text(type, AdminCallback.actionType(type));
    if (index % 2 === 1) keyboard.row();
  });
  keyboard.row().text("◀️ Cancel", AdminCallback.back);
  return keyboard;
}

export function sourceTypeKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("URL", AdminCallback.sourceType("URL"))
    .text("FILE", AdminCallback.sourceType("FILE"))
    .text("MANUAL", AdminCallback.sourceType("MANUAL"))
    .row()
    .text("◀️ Cancel", AdminCallback.back);
}

export function groupsKeyboard(groups: ManagedGroupView[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  for (const group of groups.slice(0, 12)) {
    const icon = !group.isActive ? "💤" : group.syncEnabled ? "🔄" : "💬";
    const label = group.title ?? `Chat ${group.chatId}`;
    const short = label.length > 28 ? `${label.slice(0, 25)}...` : label;
    keyboard
      .text(`${icon} ${short}`, AdminCallback.groupSelect(group.chatId.toString()))
      .row();
  }

  keyboard.text("➕ Add by chat ID", AdminCallback.groupAdd).row();
  keyboard.text("◀️ Back to menu", AdminCallback.back);
  return keyboard;
}

export function groupDetailKeyboard(group: ManagedGroupView): InlineKeyboard {
  const syncAction = group.syncEnabled ? "⏸ Remove from sync" : "▶️ Enable sync";
  return new InlineKeyboard()
    .text(syncAction, AdminCallback.groupToggleSync(group.chatId.toString()))
    .row()
    .text("⚙️ Group settings", AdminCallback.groupSettings(group.chatId.toString()))
    .text("👮 Moderators", AdminCallback.groupModerators(group.chatId.toString()))
    .row()
    .text("🔃 Refresh title", AdminCallback.groupRefresh(group.chatId.toString()))
    .row()
    .text("◀️ Back to groups", AdminCallback.groups);
}

export function groupSettingsKeyboard(group: ManagedGroupView): InlineKeyboard {
  const s = group.settings;
  const chatId = group.chatId.toString();
  return new InlineKeyboard()
    .text(s.ragEnabled ? "✅ RAG on" : "❌ RAG off", AdminCallback.groupToggleRag(chatId))
    .text(s.captureEnabled ? "✅ Capture" : "❌ Capture", AdminCallback.groupToggleCapture(chatId))
    .row()
    .text(s.triggers.onMention ? "✅ @mention" : "❌ @mention", AdminCallback.groupToggleMention(chatId))
    .text(s.triggers.onReplyToBot ? "✅ Reply" : "❌ Reply", AdminCallback.groupToggleReply(chatId))
    .row()
    .text(
      s.triggers.onQuestionHeuristic ? "✅ Questions" : "❌ Questions",
      AdminCallback.groupToggleQuestion(chatId),
    )
    .row()
    .text("✏️ Topic", AdminCallback.groupEditTopic(chatId))
    .text("✏️ Persona", AdminCallback.groupEditPersona(chatId))
    .row()
    .text("◀️ Back to group", AdminCallback.groupSelect(chatId));
}

export function groupModeratorsKeyboard(group: ManagedGroupView): InlineKeyboard {
  const chatId = group.chatId.toString();
  const keyboard = new InlineKeyboard();

  for (const userId of group.settings.moderatorUserIds.slice(0, 8)) {
    keyboard.text(`➖ ${userId}`, AdminCallback.groupModRemove(chatId, userId)).row();
  }

  keyboard.text("➕ Add moderator", AdminCallback.groupModAdd(chatId)).row();
  keyboard.text("◀️ Back to group", AdminCallback.groupSelect(chatId));
  return keyboard;
}

export function chatSyncKeyboard(
  ingestion: ChatIngestionSettings,
  lastRun: IngestionRun | null,
  inGroupChat: boolean,
): InlineKeyboard {
  const syncAction = ingestion.enabled ? "⏸ Disable sync" : "▶️ Enable sync";
  const captureAction = ingestion.captureGroupMessages
    ? "⏸ Disable capture"
    : "▶️ Enable capture";

  const keyboard = new InlineKeyboard()
    .text(syncAction, AdminCallback.chatSyncToggle)
    .row()
    .text(captureAction, AdminCallback.chatSyncToggleCapture)
    .row()
    .text("1h", AdminCallback.chatSyncInterval(1))
    .text("6h", AdminCallback.chatSyncInterval(6))
    .text("12h", AdminCallback.chatSyncInterval(12))
    .text("24h", AdminCallback.chatSyncInterval(24))
    .row();

  if (inGroupChat) {
    keyboard.text("➕ Register this group", AdminCallback.chatSyncRegister).row();
  } else {
    keyboard.text("👥 Manage groups", AdminCallback.chatSyncManageGroups).row();
  }

  keyboard
    .text("▶️ Run sync now", AdminCallback.chatSyncRun)
    .row()
    .text("◀️ Back to menu", AdminCallback.back);

  if (lastRun) {
    void lastRun;
  }

  return keyboard;
}

export function confirmKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("✅ Confirm", AdminCallback.confirmYes)
    .text("❌ Cancel", AdminCallback.confirmNo);
}