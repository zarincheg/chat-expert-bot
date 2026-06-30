import type { Conversation } from "@grammyjs/conversations";
import type { BotContext } from "../context.js";
import type { RagService } from "../../services/rag.service.js";
import { resolveChatType } from "../utils/chat-type.js";

export function createAskAiConversation(ragService: RagService) {
  return async function askAiConversation(
    conversation: Conversation<BotContext, BotContext>,
    ctx: BotContext,
  ) {
    await ctx.reply("Ask your question. I'll answer using the group knowledge base.");

    const questionCtx = await conversation.wait();
    const question = questionCtx.message?.text?.trim();

    if (!question || !ctx.chat) {
      await ctx.reply("No question received. Cancelled.");
      return;
    }

    await ctx.replyWithChatAction("typing");

    const result = await ragService.answer({
      chatId: BigInt(ctx.chat.id),
      chatType: resolveChatType(ctx.chat.type),
      userId: ctx.from?.id,
      username: ctx.from?.username,
      question,
      messageId: questionCtx.message?.message_id,
    });

    await ctx.reply(result.answer);
  };
}