const CHAT_ID_PATTERN = /^-?\d+$/;

export function parseTelegramChatId(raw: string): bigint | null {
  const trimmed = raw.trim();
  if (!CHAT_ID_PATTERN.test(trimmed)) return null;
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
}

export function parseChatIdFromCallback(data: string, prefix: string): bigint | null {
  if (!data.startsWith(prefix)) return null;
  return parseTelegramChatId(data.slice(prefix.length));
}