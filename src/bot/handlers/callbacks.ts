import type { Bot } from "grammy";
import type { BotContext } from "../context.js";
import type { BotConfigService } from "../../services/bot-config.service.js";
import type { RagService } from "../../services/rag.service.js";

export function registerCallbackHandlers(
  bot: Bot<BotContext>,
  configService: BotConfigService,
  ragService: RagService,
) {
  bot.callbackQuery(/^action:/, async (ctx) => {
    const data = ctx.callbackQuery.data;
    const [, actionType] = data.split(":");
    await ctx.answerCallbackQuery();

    const chatId = ctx.chat ? BigInt(ctx.chat.id) : BigInt(ctx.from?.id ?? 0);

    switch (actionType) {
      case "faq": {
        const chunks = await ragService.retrieveKnowledge("faq help", chatId);
        const text =
          chunks.length > 0
            ? chunks.map((c) => `• ${c.title ?? "FAQ"}: ${c.content}`).join("\n\n")
            : "No FAQ entries yet. Add knowledge via /admin.";
        await ctx.reply(text);
        break;
      }
      case "ask_ai":
        await ctx.conversation.enter("askAiConversation");
        break;
      case "report_issue":
        await ctx.conversation.enter("reportIssueConversation");
        break;
      case "show_help": {
        const instance = await configService.getBotInstance();
        const settings = await configService.getSettings();
        await ctx.reply(configService.buildHelpText(instance.commands, settings));
        break;
      }
      default:
        await ctx.reply(`Action "${actionType}" is not implemented yet.`);
    }
  });
}