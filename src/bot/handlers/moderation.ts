import type { Bot } from "grammy";
import type { BotContext } from "../context.js";
import type { ModerationEngine } from "../../services/moderation/moderation-engine.service.js";
import type { NewcomerPolicyService } from "../../services/moderation/newcomer-policy.service.js";
import type { GroupRegistryService } from "../../services/group-registry.service.js";
import { isGroupChat, resolveChatType } from "../utils/chat-type.js";

export function registerModerationHandlers(
  bot: Bot<BotContext>,
  engine: ModerationEngine,
  newcomerPolicy: NewcomerPolicyService,
  groupRegistry: GroupRegistryService,
) {
  bot.on("chat_member", async (ctx) => {
    const update = ctx.chatMember;
    if (!update || !ctx.chat || !isGroupChat(resolveChatType(ctx.chat.type))) return;

    const wasMember = ["member", "administrator", "restricted"].includes(
      update.old_chat_member.status,
    );
    const isMember = ["member", "administrator", "restricted"].includes(
      update.new_chat_member.status,
    );

    if (!wasMember && isMember && update.new_chat_member.user) {
      const user = update.new_chat_member.user;
      if (user.is_bot) return;

      await groupRegistry.upsertGroup({
        chatId: BigInt(ctx.chat.id),
        title: "title" in ctx.chat ? ctx.chat.title : null,
        chatType: ctx.chat.type,
        isActive: true,
      });

      await engine.onMemberJoined(ctx.api, {
        chatId: BigInt(ctx.chat.id),
        chatTitle: "title" in ctx.chat ? (ctx.chat.title ?? "Group") : "Group",
        userId: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
      });
    }
  });

  bot.on("message:new_chat_members", async (ctx) => {
    if (!ctx.chat || !isGroupChat(resolveChatType(ctx.chat.type))) return;

    for (const user of ctx.message.new_chat_members) {
      if (user.is_bot) continue;

      await groupRegistry.upsertGroup({
        chatId: BigInt(ctx.chat.id),
        title: "title" in ctx.chat ? ctx.chat.title : null,
        chatType: ctx.chat.type,
        isActive: true,
      });

      await engine.onMemberJoined(ctx.api, {
        chatId: BigInt(ctx.chat.id),
        chatTitle: "title" in ctx.chat ? (ctx.chat.title ?? "Group") : "Group",
        userId: user.id,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        joinMessageId: ctx.message.message_id,
      });
    }
  });

  bot.on("message", async (ctx, next) => {
    if (!ctx.chat || !ctx.from || ctx.from.is_bot) return next();
    if (!isGroupChat(resolveChatType(ctx.chat.type))) return next();

    const content = newcomerPolicy.detectContent(ctx.message);
    const blocked = await engine.onMessage(ctx.api, {
      chatId: BigInt(ctx.chat.id),
      userId: ctx.from.id,
      messageId: ctx.message.message_id,
      text: ctx.message.text,
      content,
    });

    if (blocked) return;
    return next();
  });
}