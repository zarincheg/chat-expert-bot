import type { Conversation } from "@grammyjs/conversations";
import type { InlineKeyboard } from "grammy";
import { isAdmin } from "../config/env.js";
import type { BotConfigService } from "../services/bot-config.service.js";
import type { ChatSyncService } from "../services/ingestion/chat-sync.service.js";
import type { GroupRegistryService } from "../services/group-registry.service.js";
import type { GroupConfigService } from "../services/group-config.service.js";
import type { SourceIngestService } from "../services/ingestion/source-ingest.service.js";
import type { CommunityAnswerService } from "../services/community/community-answer.service.js";
import { isGroupChat, resolveChatType } from "../bot/utils/chat-type.js";
import type { BotContext } from "../bot/context.js";
import { prisma } from "../db/prisma.js";
import { parseChatIdFromCallback, parseTelegramChatId } from "./parse-id.js";
import {
  AdminCallback,
  actionTypeKeyboard,
  backKeyboard,
  buttonsKeyboard,
  chatSyncKeyboard,
  commandsKeyboard,
  communityKeyboard,
  dataSourcesKeyboard,
  groupDetailKeyboard,
  groupModeratorsKeyboard,
  groupSettingsKeyboard,
  groupsKeyboard,
  mainMenuKeyboard,
  settingsKeyboard,
  sourceTypeKeyboard,
} from "./keyboards.js";
import {
  buttonsText,
  chatSyncText,
  commandsText,
  communityText,
  dataSourcesText,
  groupDetailText,
  groupModeratorsText,
  groupSettingsText,
  groupsText,
  mainMenuText,
  settingsText,
} from "./format.js";

interface AdminDraft {
  commandName?: string;
  buttonLabel?: string;
  buttonActionType?: string;
  sourceName?: string;
  sourceType?: "URL" | "FILE" | "MANUAL";
  editGroupChatId?: bigint;
}

export function createAdminConversation(
  configService: BotConfigService,
  syncService: ChatSyncService,
  groupRegistry: GroupRegistryService,
  groupConfigService: GroupConfigService,
  sourceIngestService: SourceIngestService,
  communityService: CommunityAnswerService,
) {
  return async function adminConversation(
    conversation: Conversation<BotContext, BotContext>,
    ctx: BotContext,
    mode: "full" | "mod" = "full",
  ) {
    const modOnly = mode === "mod";
    const userId = ctx.from?.id;

    if (modOnly) {
      const canMod = await groupConfigService.isModeratorAnywhere(userId);
      if (!canMod) {
        await ctx.reply("You are not a group moderator.");
        return;
      }
    } else if (!isAdmin(userId)) {
      await ctx.reply("You are not authorized to use admin mode.");
      return;
    }

    const draft: AdminDraft = {};
    let panelMessageId: number | undefined;
    const inDm = ctx.chat?.type === "private";

    async function showPanel(text: string, keyboard: InlineKeyboard, edit = true) {
      if (edit && panelMessageId && ctx.chat) {
        try {
          await ctx.api.editMessageText(ctx.chat.id, panelMessageId, text, {
            reply_markup: keyboard,
          });
          return;
        } catch {
          // Message unchanged or too old — send a new one
        }
      }

      const sent = await ctx.reply(text, { reply_markup: keyboard });
      panelMessageId = sent.message_id;
    }

    async function waitForAdminAction(): Promise<BotContext> {
      while (true) {
        const nextCtx = await conversation.wait();
        const data = nextCtx.callbackQuery?.data;

        if (data?.startsWith("adm:")) {
          await nextCtx.answerCallbackQuery();
          return nextCtx;
        }

        if (nextCtx.message?.text) {
          await nextCtx.reply("Use the inline buttons to navigate admin mode.", {
            reply_markup: backKeyboard(),
          });
        }
      }
    }

    async function waitForText(prompt: string): Promise<string | null> {
      await ctx.reply(prompt, { reply_markup: backKeyboard() });
      const textCtx = await conversation.waitFor("message:text", {
        otherwise: (otherCtx) =>
          otherCtx.reply("Please send a text message or tap Cancel.", {
            reply_markup: backKeyboard(),
          }),
      });

      const text = textCtx.message.text.trim();
      if (text.toLowerCase() === "cancel") return null;
      return text;
    }

    async function canModerateChat(chatId: bigint): Promise<boolean> {
      return groupConfigService.isModerator(chatId, userId);
    }

    async function showMainMenu() {
      await showPanel(mainMenuText(inDm, modOnly), mainMenuKeyboard(modOnly), true);
    }

    async function showGroupsPanel() {
      const groups = await groupRegistry.listGroups();
      await showPanel(groupsText(groups), groupsKeyboard(groups));
    }

    async function showGroupDetail(chatId: bigint) {
      const group = await groupRegistry.getGroup(chatId);
      if (!group) {
        await ctx.reply("Group not found.");
        await showGroupsPanel();
        return;
      }
      await showPanel(groupDetailText(group), groupDetailKeyboard(group));
    }

    async function showGroupSettings(chatId: bigint) {
      const group = await groupRegistry.getGroup(chatId);
      if (!group) {
        await showGroupsPanel();
        return;
      }
      await showPanel(groupSettingsText(group), groupSettingsKeyboard(group));
    }

    async function showGroupModerators(chatId: bigint) {
      const group = await groupRegistry.getGroup(chatId);
      if (!group) {
        await showGroupsPanel();
        return;
      }
      await showPanel(groupModeratorsText(group), groupModeratorsKeyboard(group));
    }

    async function showCommunityPanel() {
      let candidates = await communityService.listCandidates();
      if (modOnly && userId) {
        const allowed = new Set(
          (await groupConfigService.listModeratedChatIds(userId)).map((id) => id.toString()),
        );
        candidates = candidates.filter((c) => allowed.has(c.chatId.toString()));
      }
      await showPanel(communityText(candidates), communityKeyboard(candidates));
    }

    async function showChatSyncPanel() {
      const settings = await configService.getSettings();
      const lastRun = await syncService.getLastRun();
      const inGroupChat = !!ctx.chat && isGroupChat(resolveChatType(ctx.chat.type));
      await showPanel(
        chatSyncText(settings.chatIngestion, lastRun),
        chatSyncKeyboard(settings.chatIngestion, lastRun, inGroupChat),
      );
    }

    await showPanel(mainMenuText(inDm, modOnly), mainMenuKeyboard(modOnly), false);

    while (true) {
      const actionCtx = await waitForAdminAction();
      const data = actionCtx.callbackQuery!.data!;

      if (data === AdminCallback.exit) {
        if (ctx.chat && panelMessageId) {
          await ctx.api.editMessageText(ctx.chat.id, panelMessageId, "👋 Session closed.");
        } else {
          await ctx.reply("👋 Session closed.");
        }
        return;
      }

      if (data === AdminCallback.back || data === AdminCallback.main) {
        await showMainMenu();
        continue;
      }

      if (data === AdminCallback.community) {
        await showCommunityPanel();
        continue;
      }

      if (data.startsWith("adm:com:a:")) {
        const id = data.slice("adm:com:a:".length);
        const answer = await prisma.communityAnswer.findUnique({ where: { id } });
        if (!answer || !(await canModerateChat(answer.chatId))) {
          await ctx.reply("Not authorized to approve this answer.");
          await showCommunityPanel();
          continue;
        }
        await communityService.approve(id, userId!);
        await showPanel("✅ Approved and queued for ingest.", communityKeyboard([]), false);
        await showCommunityPanel();
        continue;
      }

      if (data.startsWith("adm:com:r:")) {
        const id = data.slice("adm:com:r:".length);
        const answer = await prisma.communityAnswer.findUnique({ where: { id } });
        if (!answer || !(await canModerateChat(answer.chatId))) {
          await ctx.reply("Not authorized to reject this answer.");
          await showCommunityPanel();
          continue;
        }
        await communityService.reject(id);
        await showCommunityPanel();
        continue;
      }

      if (modOnly) {
        await ctx.reply("Use Community review from the moderator menu.");
        await showMainMenu();
        continue;
      }

      if (data === AdminCallback.groups || data === AdminCallback.chatSyncManageGroups) {
        await showGroupsPanel();
        continue;
      }

      if (data.startsWith("adm:g:s:")) {
        const chatId = parseChatIdFromCallback(data, "adm:g:s:");
        if (chatId === null) {
          await showGroupsPanel();
          continue;
        }
        await showGroupDetail(chatId);
        continue;
      }

      if (data.startsWith("adm:g:cfg:")) {
        const chatId = parseChatIdFromCallback(data, "adm:g:cfg:");
        if (chatId === null) {
          await showGroupsPanel();
          continue;
        }
        await showGroupSettings(chatId);
        continue;
      }

      if (data.startsWith("adm:g:mod:")) {
        const chatId = parseChatIdFromCallback(data, "adm:g:mod:");
        if (chatId === null) {
          await showGroupsPanel();
          continue;
        }
        await showGroupModerators(chatId);
        continue;
      }

      if (data.startsWith("adm:g:rag:")) {
        const chatId = parseChatIdFromCallback(data, "adm:g:rag:");
        if (chatId === null) {
          await showGroupsPanel();
          continue;
        }
        const current = await groupConfigService.getSettings(chatId);
        await groupConfigService.updateSettings(chatId, { ragEnabled: !current.ragEnabled });
        await showGroupSettings(chatId);
        continue;
      }

      if (data.startsWith("adm:g:cap:")) {
        const chatId = parseChatIdFromCallback(data, "adm:g:cap:");
        if (chatId === null) {
          await showGroupsPanel();
          continue;
        }
        const current = await groupConfigService.getSettings(chatId);
        await groupConfigService.updateSettings(chatId, { captureEnabled: !current.captureEnabled });
        await showGroupSettings(chatId);
        continue;
      }

      if (data.startsWith("adm:g:tm:")) {
        const chatId = parseChatIdFromCallback(data, "adm:g:tm:");
        if (chatId === null) {
          await showGroupsPanel();
          continue;
        }
        const current = await groupConfigService.getSettings(chatId);
        await groupConfigService.updateSettings(chatId, {
          triggers: { onMention: !current.triggers.onMention },
        });
        await showGroupSettings(chatId);
        continue;
      }

      if (data.startsWith("adm:g:tr:")) {
        const chatId = parseChatIdFromCallback(data, "adm:g:tr:");
        if (chatId === null) {
          await showGroupsPanel();
          continue;
        }
        const current = await groupConfigService.getSettings(chatId);
        await groupConfigService.updateSettings(chatId, {
          triggers: { onReplyToBot: !current.triggers.onReplyToBot },
        });
        await showGroupSettings(chatId);
        continue;
      }

      if (data.startsWith("adm:g:tq:")) {
        const chatId = parseChatIdFromCallback(data, "adm:g:tq:");
        if (chatId === null) {
          await showGroupsPanel();
          continue;
        }
        const current = await groupConfigService.getSettings(chatId);
        await groupConfigService.updateSettings(chatId, {
          triggers: { onQuestionHeuristic: !current.triggers.onQuestionHeuristic },
        });
        await showGroupSettings(chatId);
        continue;
      }

      if (data.startsWith("adm:g:et:")) {
        const chatId = parseChatIdFromCallback(data, "adm:g:et:");
        if (chatId === null) {
          await showGroupsPanel();
          continue;
        }
        draft.editGroupChatId = chatId;
        const topic = await waitForText("Send the group topic (short description for AI context):");
        if (topic) {
          await prisma.managedGroup.updateMany({
            where: { chatId, botInstanceId: (await configService.getBotInstance()).id },
            data: { topic },
          });
        }
        await showGroupSettings(chatId);
        continue;
      }

      if (data.startsWith("adm:g:ep:")) {
        const chatId = parseChatIdFromCallback(data, "adm:g:ep:");
        if (chatId === null) {
          await showGroupsPanel();
          continue;
        }
        const persona = await waitForText("Send the expert persona for this group:");
        if (persona) {
          await groupConfigService.updateSettings(chatId, { expertPersona: persona });
        }
        await showGroupSettings(chatId);
        continue;
      }

      if (data.startsWith("adm:g:ma:")) {
        const chatId = parseChatIdFromCallback(data, "adm:g:ma:");
        if (chatId === null) {
          await showGroupsPanel();
          continue;
        }
        const raw = await waitForText("Send the Telegram user ID to add as moderator:");
        if (raw) {
          const modId = Number(raw.trim());
          if (!Number.isNaN(modId) && Number.isInteger(modId) && modId > 0) {
            await groupConfigService.addModerator(chatId, modId);
          } else {
            await ctx.reply("Invalid user ID. Send a positive numeric Telegram user ID.");
          }
        }
        await showGroupModerators(chatId);
        continue;
      }

      if (data.startsWith("adm:g:mr:")) {
        const rest = data.slice("adm:g:mr:".length);
        const [chatIdStr, userIdStr] = rest.split(":");
        const chatId = parseTelegramChatId(chatIdStr);
        const modId = Number(userIdStr);
        if (chatId === null || Number.isNaN(modId)) {
          await showGroupsPanel();
          continue;
        }
        await groupConfigService.removeModerator(chatId, modId);
        await showGroupModerators(chatId);
        continue;
      }

      if (data.startsWith("adm:g:t:")) {
        const chatId = parseChatIdFromCallback(data, "adm:g:t:");
        if (chatId === null) {
          await showGroupsPanel();
          continue;
        }
        await groupRegistry.toggleGroupSync(chatId);
        await showGroupDetail(chatId);
        continue;
      }

      if (data.startsWith("adm:g:r:")) {
        const chatId = parseChatIdFromCallback(data, "adm:g:r:");
        if (chatId === null) {
          await showGroupsPanel();
          continue;
        }
        await groupRegistry.refreshTitle(ctx.api, chatId);
        await showGroupDetail(chatId);
        continue;
      }

      if (data === AdminCallback.groupAdd) {
        const rawId = await waitForText(
          "Send the group chat ID (negative number, e.g. -1001234567890):",
        );
        if (!rawId) {
          await showGroupsPanel();
          continue;
        }
        const chatId = parseTelegramChatId(rawId);
        if (chatId === null) {
          await ctx.reply(
            "That doesn't look like a valid chat ID. Send a numeric ID (e.g. -1001234567890), or tap Cancel.",
            { reply_markup: backKeyboard() },
          );
          continue;
        }
        await groupRegistry.upsertGroup({
          chatId,
          chatType: "supergroup",
          title: null,
        });
        await groupRegistry.refreshTitle(ctx.api, chatId);
        await showGroupDetail(chatId);
        continue;
      }

      if (data === AdminCallback.commands) {
        const commands = await configService.listCommands();
        await showPanel(commandsText(commands), commandsKeyboard(commands));
        continue;
      }

      if (data.startsWith("adm:c:t:")) {
        const name = data.slice("adm:c:t:".length);
        const commands = await configService.listCommands();
        const existing = commands.find((c) => c.name === name);
        if (existing) {
          await configService.toggleCommand(name, !existing.isEnabled);
        }
        const updated = await configService.listCommands();
        await showPanel(commandsText(updated), commandsKeyboard(updated));
        continue;
      }

      if (data === AdminCallback.commandAdd) {
        const name = await waitForText("Send the command name (without /):");
        if (!name) {
          await showMainMenu();
          continue;
        }
        const description = await waitForText(`Description for /${name}:`);
        if (!description) {
          await showMainMenu();
          continue;
        }
        await configService.upsertCommand({ name, description });
        const commands = await configService.listCommands();
        await showPanel(
          `✅ Command /${name} saved.\n\n${commandsText(commands)}`,
          commandsKeyboard(commands),
          false,
        );
        continue;
      }

      if (data === AdminCallback.buttons) {
        const buttons = await configService.listButtons();
        await showPanel(buttonsText(buttons), buttonsKeyboard(buttons));
        continue;
      }

      if (data.startsWith("adm:b:t:")) {
        const index = Number(data.slice("adm:b:t:".length));
        const buttons = await configService.listButtons();
        const target = buttons[index];
        if (target) {
          await configService.toggleButton(target.id, !target.isEnabled);
        }
        const updated = await configService.listButtons();
        await showPanel(buttonsText(updated), buttonsKeyboard(updated));
        continue;
      }

      if (data === AdminCallback.buttonAdd) {
        const label = await waitForText("Button label:");
        if (!label) {
          await showMainMenu();
          continue;
        }
        draft.buttonLabel = label;
        await ctx.reply("Choose button action:", { reply_markup: actionTypeKeyboard() });
        const typeCtx = await waitForAdminAction();
        const typeData = typeCtx.callbackQuery!.data!;
        if (!typeData.startsWith("adm:at:")) {
          await showMainMenu();
          continue;
        }
        draft.buttonActionType = typeData.slice("adm:at:".length);
        await configService.createButton({
          label: draft.buttonLabel,
          actionType: draft.buttonActionType,
        });
        const buttons = await configService.listButtons();
        await showPanel(
          `✅ Button "${draft.buttonLabel}" created.\n\n${buttonsText(buttons)}`,
          buttonsKeyboard(buttons),
          false,
        );
        continue;
      }

      if (data === AdminCallback.dataSources) {
        const sources = await configService.listDataSources();
        await showPanel(dataSourcesText(sources), dataSourcesKeyboard(sources));
        continue;
      }

      if (data.startsWith("adm:d:i:")) {
        const sourceId = data.slice("adm:d:i:".length);
        try {
          const result = await sourceIngestService.ingestSource(sourceId);
          const sources = await configService.listDataSources();
          await showPanel(
            `✅ Ingested ${result.accepted} chunk(s).\n\n${dataSourcesText(sources)}`,
            dataSourcesKeyboard(sources),
            false,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await ctx.reply(`Ingest failed: ${message}`);
          const sources = await configService.listDataSources();
          await showPanel(dataSourcesText(sources), dataSourcesKeyboard(sources));
        }
        continue;
      }

      if (data.startsWith("adm:d:a:")) {
        const index = Number(data.slice("adm:d:a:".length));
        const sources = await configService.listDataSources();
        const target = sources[index];
        if (target && target.status !== "ACTIVE") {
          await configService.activateDataSource(target.id);
        }
        const updated = await configService.listDataSources();
        await showPanel(dataSourcesText(updated), dataSourcesKeyboard(updated));
        continue;
      }

      if (data === AdminCallback.dataSourceAdd) {
        const name = await waitForText("Data source name:");
        if (!name) {
          await showMainMenu();
          continue;
        }
        draft.sourceName = name;
        await ctx.reply("Choose source type:", { reply_markup: sourceTypeKeyboard() });
        const typeCtx = await waitForAdminAction();
        const typeData = typeCtx.callbackQuery!.data!;
        if (!typeData.startsWith("adm:st:")) {
          await showMainMenu();
          continue;
        }
        draft.sourceType = typeData.slice("adm:st:".length) as AdminDraft["sourceType"];
        const location = await waitForText(
          `Location for ${draft.sourceType} (URL, file path, or text reference):`,
        );
        if (!location || !draft.sourceType) {
          await showMainMenu();
          continue;
        }
        await configService.createDataSource({
          name: draft.sourceName,
          type: draft.sourceType,
          location,
        });
        const sources = await configService.listDataSources();
        await showPanel(
          `✅ Data source "${draft.sourceName}" created (pending).\n\n${dataSourcesText(sources)}`,
          dataSourcesKeyboard(sources),
          false,
        );
        continue;
      }

      if (data === AdminCallback.settings) {
        const settings = await configService.getSettings();
        await showPanel(settingsText(settings), settingsKeyboard(settings));
        continue;
      }

      if (data === AdminCallback.settingsToggleRag) {
        const settings = await configService.getSettings();
        const updated = await configService.updateSettings({ ragEnabled: !settings.ragEnabled });
        await showPanel(settingsText(updated), settingsKeyboard(updated));
        continue;
      }

      if (data === AdminCallback.settingsStyleConcise) {
        const updated = await configService.updateSettings({ responseStyle: "concise" });
        await showPanel(settingsText(updated), settingsKeyboard(updated));
        continue;
      }

      if (data === AdminCallback.settingsStyleDetailed) {
        const updated = await configService.updateSettings({ responseStyle: "detailed" });
        await showPanel(settingsText(updated), settingsKeyboard(updated));
        continue;
      }

      if (data === AdminCallback.settingsToggleDigest) {
        const settings = await configService.getSettings();
        const updated = await configService.updateSettings({
          proactiveDigestEnabled: !settings.proactiveDigestEnabled,
        });
        await showPanel(settingsText(updated), settingsKeyboard(updated));
        continue;
      }

      if (data === AdminCallback.chatSync) {
        await showChatSyncPanel();
        continue;
      }

      if (data === AdminCallback.chatSyncToggle) {
        const settings = await configService.getSettings();
        await configService.updateChatIngestion({ enabled: !settings.chatIngestion.enabled });
        await showChatSyncPanel();
        continue;
      }

      if (data === AdminCallback.chatSyncToggleCapture) {
        const settings = await configService.getSettings();
        await configService.updateChatIngestion({
          captureGroupMessages: !settings.chatIngestion.captureGroupMessages,
        });
        await showChatSyncPanel();
        continue;
      }

      if (data.startsWith("adm:ci:h:")) {
        const hours = Number(data.slice("adm:ci:h:".length));
        if (!Number.isNaN(hours) && hours > 0) {
          await configService.updateChatIngestion({ intervalHours: hours });
        }
        await showChatSyncPanel();
        continue;
      }

      if (data === AdminCallback.chatSyncRegister) {
        if (!ctx.chat || !isGroupChat(resolveChatType(ctx.chat.type))) {
          await showGroupsPanel();
          continue;
        }
        await groupRegistry.upsertGroup({
          chatId: BigInt(ctx.chat.id),
          title: "title" in ctx.chat ? ctx.chat.title : null,
          chatType: ctx.chat.type,
        });
        await configService.addSyncChatId(ctx.chat.id);
        await groupConfigService.updateSettings(BigInt(ctx.chat.id), { syncEnabled: true });
        await showChatSyncPanel();
        continue;
      }

      if (data === AdminCallback.chatSyncRun) {
        try {
          const result = await syncService.run({ autoEnable: true });
          const settings = await configService.getSettings();
          const lastRun = await syncService.getLastRun();
          const inGroupChat = !!ctx.chat && isGroupChat(resolveChatType(ctx.chat.type));
          await showPanel(
            [
              "✅ Sync finished",
              `Chats: ${result.chatsProcessed}`,
              `Chunks: ${result.chunksSent}`,
              `Messages: ${result.messagesSent}`,
              result.errors.length > 0 ? `Errors: ${result.errors.length}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
            chatSyncKeyboard(settings.chatIngestion, lastRun, inGroupChat),
            false,
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          await ctx.reply(`Sync failed: ${message}`);
          await showChatSyncPanel();
        }
        continue;
      }
    }
  };
}