export type ChatType = "private" | "group" | "supergroup" | "channel";

export interface CaptureContext {
  botInstanceId: string;
  chatId: bigint;
  chatType: ChatType;
  userId?: number;
  username?: string;
  content: string;
  messageId?: number;
  isCommand: boolean;
  isBotMessage: boolean;
  capturedFrom: "group" | "rag" | "dm";
}

export interface CaptureFilter {
  readonly name: string;
  shouldCapture(context: CaptureContext): boolean | Promise<boolean>;
}

export interface CaptureFilterResult {
  allowed: boolean;
  rejectedBy?: string;
}