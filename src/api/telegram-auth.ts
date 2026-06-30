import crypto from "node:crypto";
import { env, isAdmin } from "../config/env.js";

export interface TelegramAuthPayload {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export function verifyTelegramLogin(data: TelegramAuthPayload): boolean {
  const { hash, ...rest } = data;
  const check = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key as keyof typeof rest]}`)
    .join("\n");

  const secret = crypto.createHash("sha256").update(env.BOT_TOKEN).digest();
  const hmac = crypto.createHmac("sha256", secret).update(check).digest("hex");
  return hmac === hash;
}

export function validateTelegramSession(data: TelegramAuthPayload) {
  if (!verifyTelegramLogin(data)) {
    throw new Error("Invalid Telegram auth signature");
  }

  const age = Math.floor(Date.now() / 1000) - data.auth_date;
  if (age > 86400) {
    throw new Error("Telegram auth data expired");
  }

  if (!isAdmin(data.id)) {
    throw new Error("Not authorized as admin");
  }

  return {
    id: String(data.id),
    name: data.first_name,
    image: data.photo_url,
    username: data.username,
  };
}