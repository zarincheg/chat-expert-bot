export interface ChatIngestionSettings {
  enabled: boolean;
  intervalHours: number;
  syncChatIds: number[];
  captureGroupMessages: boolean;
  chunkSize: number;
  maxMessagesPerRun: number;
  retentionDays: number;
}

export interface BotSettings {
  ragEnabled: boolean;
  proactiveDigestEnabled: boolean;
  responseStyle: "concise" | "detailed";
  welcomeMessage?: string;
  chatIngestion: ChatIngestionSettings;
}

export const DEFAULT_CHAT_INGESTION_SETTINGS: ChatIngestionSettings = {
  enabled: false,
  intervalHours: 6,
  syncChatIds: [],
  captureGroupMessages: false,
  chunkSize: 10,
  maxMessagesPerRun: 500,
  retentionDays: 90,
};

export const DEFAULT_BOT_SETTINGS: BotSettings = {
  ragEnabled: true,
  proactiveDigestEnabled: false,
  responseStyle: "concise",
  welcomeMessage: "Hi! I'm your group assistant. Ask me anything or use the buttons below.",
  chatIngestion: DEFAULT_CHAT_INGESTION_SETTINGS,
};

export type ButtonActionType =
  | "faq"
  | "ask_ai"
  | "report_issue"
  | "show_help"
  | "custom";

export interface SessionData {
  awaitingAiQuestion?: boolean;
}