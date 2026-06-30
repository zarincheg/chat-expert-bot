import type { ChatType } from "../../services/capture/filters/types.js";

export function resolveChatType(type: string): ChatType {
  if (type === "group" || type === "supergroup" || type === "private" || type === "channel") {
    return type;
  }
  return "private";
}

export function isGroupChat(type: ChatType): boolean {
  return type === "group" || type === "supergroup";
}