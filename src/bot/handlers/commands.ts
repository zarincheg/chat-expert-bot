import type { Bot } from "grammy";
import type { BotContext } from "../context.js";
import type { BotConfigService } from "../../services/bot-config.service.js";
import type { RagService } from "../../services/rag.service.js";
import type { GroupConfigService } from "../../services/group-config.service.js";
import type { CommunityAnswerService } from "../../services/community/community-answer.service.js";
import { isAdmin } from "../../config/env.js";
import { buildInlineKeyboard, buildReplyKeyboard } from "../keyboards/main.keyboard.js";
import { resolveChatType } from "../utils/chat-type.js";

export function registerCommandHandlers(
  bot: Bot<BotContext>,
  configService: BotConfigService,
  ragService: RagService,
  groupConfigService: GroupConfigService,
  communityService: CommunityAnswerService,
) {
  bot.command("start", async (ctx) => {
    const instance = await configService.getBotInstance();
    const settings = await configService.getSettings();
    const welcome = settings.welcomeMessage ?? `Welcome to ${instance.name}!`;
    const inline = buildInlineKeyboard(instance.buttons);
    const reply = buildReplyKeyboard(instance.buttons);

    await ctx.reply(welcome, { reply_markup: inline });
    if (instance.buttons.some((b) => b.keyboardType === "reply")) {
      await ctx.reply("Quick actions:", { reply_markup: reply });
    }
  });

  bot.command("help", async (ctx) => {
    const instance = await configService.getBotInstance();
    const settings = await configService.getSettings();
    await ctx.reply(configService.buildHelpText(instance.commands, settings));
  });

  bot.command("ping", async (ctx) => {
    await ctx.reply("pong");
  });

  bot.command("ask", async (ctx) => {
    const question = ctx.match?.trim();
    if (!question || !ctx.chat) {
      await ctx.reply("Usage: /ask <your question>");
      return;
    }

    await ctx.replyWithChatAction("typing");
    const result = await ragService.answer({
      chatId: BigInt(ctx.chat.id),
      chatType: resolveChatType(ctx.chat.type),
      userId: ctx.from?.id,
      username: ctx.from?.username,
      question,
      messageId: ctx.message?.message_id,
    });
    await ctx.reply(result.answer);
  });

  bot.command("promote", async (ctx) => {
    if (!ctx.chat || !ctx.message) return;

    const chatId = BigInt(ctx.chat.id);
    const isMod = await groupConfigService.isModerator(chatId, ctx.from?.id);
    if (!isMod) {
      await ctx.reply("Only group moderators or admins can use /promote.");
      return;
    }

    const replyTo = ctx.message.reply_to_message;
    if (!replyTo?.text) {
      await ctx.reply("Reply to a message with /promote to save it as community knowledge.");
      return;
    }

    await communityService.promote({
      chatId,
      sourceMessageId: replyTo.message_id,
      sourceUserId: replyTo.from?.id,
      sourceUsername: replyTo.from?.username,
      content: replyTo.text,
    });

    await ctx.reply("Queued for review. A moderator can approve it in /admin → Community.");
  });

  bot.command("digest", async (ctx) => {
    const digest = await ragService.getDailyDigest();
    await ctx.reply(digest);
  });

  bot.command("admin", async (ctx) => {
    if (!isAdmin(ctx.from?.id)) {
      await ctx.reply("You are not authorized to use /admin.");
      return;
    }
    await ctx.conversation.enter("adminConversation", "full");
  });

  bot.command("mod", async (ctx) => {
    const canMod = await groupConfigService.isModeratorAnywhere(ctx.from?.id);
    if (!canMod) {
      await ctx.reply("You are not a group moderator. Ask an admin to add you.");
      return;
    }
    await ctx.conversation.enter("adminConversation", "mod");
  });

  bot.command("report", async (ctx) => {
    await ctx.conversation.enter("reportIssueConversation");
  });
}