import type { Context } from "grammy";

export async function errorHandler(err: unknown) {
  const ctx = (err as { ctx?: Context }).ctx;
  console.error("[bot error]", err);

  if (ctx) {
    try {
      await ctx.reply(
        "Something went wrong. Please try again later or contact an admin.",
      );
    } catch {
      // Reply may fail if chat is inaccessible
    }
  }
}