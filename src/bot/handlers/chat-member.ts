import type { Bot } from "grammy";
import type { BotContext } from "../context.js";
import type { GroupRegistryService } from "../../services/group-registry.service.js";
import { isGroupChat, resolveChatType } from "../utils/chat-type.js";

export function registerChatMemberHandlers(
  bot: Bot<BotContext>,
  groupRegistry: GroupRegistryService,
) {
  bot.on("my_chat_member", async (ctx) => {
    const chat = ctx.chat;
    if (!chat || !isGroupChat(resolveChatType(chat.type))) return;

    const status = ctx.myChatMember.new_chat_member.status;
    const isPresent = status === "member" || status === "administrator";

    if (isPresent) {
      await groupRegistry.upsertGroup({
        chatId: BigInt(chat.id),
        title: "title" in chat ? chat.title : null,
        chatType: chat.type,
        memberStatus: status,
        isActive: true,
      });
      return;
    }

    await groupRegistry.markInactive(BigInt(chat.id), status);
  });
}