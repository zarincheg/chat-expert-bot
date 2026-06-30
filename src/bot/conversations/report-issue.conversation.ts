import type { Conversation } from "@grammyjs/conversations";
import type { BotContext } from "../context.js";

export async function reportIssueConversation(
  conversation: Conversation<BotContext, BotContext>,
  ctx: BotContext,
) {
  await ctx.reply("Let's report an issue. What category is it? (bug / question / other)");

  const categoryCtx = await conversation.wait();
  const category = categoryCtx.message?.text?.trim();
  if (!category) {
    await ctx.reply("No category received. Cancelled.");
    return;
  }

  await ctx.reply("Please describe the issue in a few sentences:");
  const descriptionCtx = await conversation.wait();
  const description = descriptionCtx.message?.text?.trim();
  if (!description) {
    await ctx.reply("No description received. Cancelled.");
    return;
  }

  await ctx.reply(
    [
      "Issue recorded (demo — not persisted yet):",
      `Category: ${category}`,
      `Description: ${description}`,
      "",
      "An admin can wire this to ticketing in a future iteration.",
    ].join("\n"),
  );
}