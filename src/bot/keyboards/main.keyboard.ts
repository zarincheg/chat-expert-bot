import { InlineKeyboard, Keyboard } from "grammy";
import type { BotButton } from "@prisma/client";

export function buildInlineKeyboard(buttons: BotButton[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  const inlineButtons = buttons.filter((b) => b.keyboardType === "inline");

  inlineButtons.forEach((button, index) => {
    keyboard.text(button.label, `action:${button.actionType}:${button.id}`);
    if (index % 2 === 1) keyboard.row();
  });

  return keyboard;
}

export function buildReplyKeyboard(buttons: BotButton[]): Keyboard {
  const keyboard = new Keyboard().resized();
  const replyButtons = buttons.filter((b) => b.keyboardType === "reply");

  replyButtons.forEach((button, index) => {
    keyboard.text(button.label);
    if (index % 2 === 1) keyboard.row();
  });

  if (replyButtons.length > 0) {
    keyboard.row().text("Hide keyboard");
  }

  return keyboard;
}