import type { Bot } from "grammy";
import type { BotContext } from "../context.js";
import type { BotConfigService } from "../../services/bot-config.service.js";
import type { RagService } from "../../services/rag.service.js";
import type { SessionData } from "../../types/index.js";
import type { MessageCaptureService } from "../../services/capture/message-capture.service.js";
import type { GroupRegistryService } from "../../services/group-registry.service.js";
import type { GroupConfigService } from "../../services/group-config.service.js";
import type { TriggerPolicyService } from "../../services/trigger/trigger-policy.service.js";
import type { ChatRateLimiter } from "../../services/trigger/rate-limiter.js";
import { isGroupChat, resolveChatType } from "../utils/chat-type.js";

export function registerMessageHandlers(
  bot: Bot<BotContext>,
  configService: BotConfigService,
  ragService: RagService,
  captureService: MessageCaptureService,
  groupRegistry: GroupRegistryService,
  groupConfigService: GroupConfigService,
  triggerPolicy: TriggerPolicyService,
  rateLimiter: ChatRateLimiter,
) {
  bot.on("message:text", async (ctx, next) => {
    const text = ctx.message.text;

    if (text.startsWith("/")) {
      return next();
    }

    const settings = await configService.getSettings();
    const chatType = ctx.chat ? resolveChatType(ctx.chat.type) : "private";
    const chatId = ctx.chat ? BigInt(ctx.chat.id) : null;

    if (ctx.chat && isGroupChat(chatType)) {
      await groupRegistry.upsertGroup({
        chatId: BigInt(ctx.chat.id),
        title: "title" in ctx.chat ? ctx.chat.title : null,
        chatType: ctx.chat.type,
        memberStatus: "member",
        isActive: true,
      });
    }

    if (chatId && isGroupChat(chatType) && (await groupConfigService.canCapture(chatId))) {
      captureService.configureFromSettings(settings.chatIngestion);
      await captureService.capture({
        chatId,
        chatType,
        userId: ctx.from?.id,
        username: ctx.from?.username,
        role: "user",
        content: text,
        messageId: ctx.message.message_id,
        capturedFrom: "group",
        isBotMessage: ctx.from?.is_bot ?? false,
      });
    }

    const instance = await configService.getBotInstance();
    const matchingButton = instance.buttons.find(
      (b) => b.keyboardType === "reply" && b.label === text,
    );

    if (matchingButton) {
      switch (matchingButton.actionType) {
        case "faq": {
          const queryChatId = chatId ?? BigInt(ctx.from?.id ?? 0);
          const chunks = await ragService.retrieveKnowledge("faq", queryChatId);
          const reply =
            chunks.length > 0
              ? chunks.map((c) => `• ${c.title ?? "FAQ"}: ${c.content}`).join("\n\n")
              : "No FAQ entries yet.";
          await ctx.reply(reply);
          return;
        }
        case "ask_ai":
          await ctx.conversation.enter("askAiConversation");
          return;
        case "report_issue":
          await ctx.conversation.enter("reportIssueConversation");
          return;
        case "show_help": {
          const helpSettings = await configService.getSettings();
          await ctx.reply(configService.buildHelpText(instance.commands, helpSettings));
          return;
        }
        default:
          await ctx.reply(`Button action "${matchingButton.actionType}" not implemented.`);
          return;
      }
    }

    if (text === "Hide keyboard") {
      await ctx.reply("Keyboard hidden.", {
        reply_markup: { remove_keyboard: true },
      });
      return;
    }

    const session = ctx.session as SessionData;
    if (session.awaitingAiQuestion && ctx.chat) {
      session.awaitingAiQuestion = false;
      await ctx.replyWithChatAction("typing");
      const result = await ragService.answer({
        chatId: BigInt(ctx.chat.id),
        chatType,
        userId: ctx.from?.id,
        username: ctx.from?.username,
        question: text,
        messageId: ctx.message.message_id,
      });
      await ctx.reply(result.answer);
      return;
    }

    const isGroup = isGroupChat(chatType);
    if (!settings.ragEnabled || !isGroup || !ctx.chat || !chatId) {
      return;
    }

    const groupSettings = await groupConfigService.getSettings(chatId);
    if (!groupSettings.ragEnabled) {
      return;
    }

    const botId = ctx.me.id;
    const isReplyToBot = ctx.message.reply_to_message?.from?.id === botId;
    const threadSnippet = ctx.message.reply_to_message?.text?.slice(0, 280);

    const shouldRespond = triggerPolicy.shouldRespond(groupSettings, {
      chatId,
      text,
      botUsername: ctx.me.username,
      isGroup,
      isReplyToBot,
      rateLimiter,
    });

    if (!shouldRespond) {
      return;
    }

    const question = triggerPolicy.extractQuestion(text, ctx.me.username);
    if (question.length === 0) {
      return;
    }

    await ctx.replyWithChatAction("typing");
    const result = await ragService.answer({
      chatId,
      chatType,
      userId: ctx.from?.id,
      username: ctx.from?.username,
      question,
      messageId: ctx.message.message_id,
      replyToMessageId: ctx.message.reply_to_message?.message_id,
      threadSnippet,
    });
    await ctx.reply(result.answer, {
      reply_parameters: { message_id: ctx.message.message_id },
    });
  });
}