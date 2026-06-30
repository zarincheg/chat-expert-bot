import type { NextFunction } from "grammy";
import { env } from "../../config/env.js";
import type { BotContext } from "../context.js";

const levels = ["debug", "info", "warn", "error"] as const;

function shouldLog(level: (typeof levels)[number]): boolean {
  return levels.indexOf(level) >= levels.indexOf(env.LOG_LEVEL);
}

function getUpdateKind(ctx: BotContext): string {
  if (ctx.message) return "message";
  if (ctx.callbackQuery) return "callback_query";
  if (ctx.editedMessage) return "edited_message";
  return Object.keys(ctx.update)[0] ?? "unknown";
}

export async function loggerMiddleware(ctx: BotContext, next: NextFunction) {
  const start = Date.now();
  const from = ctx.from?.username ?? ctx.from?.id ?? "unknown";
  const chat = ctx.chat?.id ?? "unknown";
  const kind = ctx.update.message?.text ?? ctx.callbackQuery?.data ?? getUpdateKind(ctx);

  if (shouldLog("debug")) {
    console.debug(`[update] ${getUpdateKind(ctx)} from=${from} chat=${chat} payload=${kind}`);
  }

  await next();

  if (shouldLog("info")) {
    console.info(`[handled] ${getUpdateKind(ctx)} in ${Date.now() - start}ms`);
  }
}