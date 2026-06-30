export type ContentType =
  | "text"
  | "photo"
  | "video"
  | "document"
  | "audio"
  | "voice"
  | "sticker"
  | "animation"
  | "poll"
  | "link";

export interface NewcomerSettings {
  enabled: boolean;
  gracePeriodHours: number;
  restrictOnJoin: boolean;
  allowedContentTypes: ContentType[];
  maxMessagesPerHour: number;
  blockLinks: boolean;
  blockForwards: boolean;
}

export interface TrustScoreSettings {
  enabled: boolean;
  blockAbove: number;
  restrictAbove: number;
  timeoutMs: number;
  failAction: "restrict" | "allow" | "ban";
}

export interface AutoBanSettings {
  enabled: boolean;
  checkNickname: boolean;
  checkFirstMessage: boolean;
  firstMessageWindowHours: number;
  trustScore: TrustScoreSettings;
}

export interface WelcomeSettingsRef {
  enabled: boolean;
  deleteJoinServiceMessage: boolean;
}

export interface ModerationSettings {
  enabled: boolean;
  newcomer: NewcomerSettings;
  autoBan: AutoBanSettings;
  welcome: WelcomeSettingsRef;
}

export const DEFAULT_MODERATION_SETTINGS: ModerationSettings = {
  enabled: false,
  newcomer: {
    enabled: true,
    gracePeriodHours: 24,
    restrictOnJoin: true,
    allowedContentTypes: ["text"],
    maxMessagesPerHour: 5,
    blockLinks: true,
    blockForwards: true,
  },
  autoBan: {
    enabled: true,
    checkNickname: true,
    checkFirstMessage: true,
    firstMessageWindowHours: 24,
    trustScore: {
      enabled: true,
      blockAbove: 80,
      restrictAbove: 50,
      timeoutMs: 3000,
      failAction: "restrict",
    },
  },
  welcome: {
    enabled: true,
    deleteJoinServiceMessage: true,
  },
};

export function parseModerationSettings(raw: unknown): ModerationSettings {
  const base = structuredClone(DEFAULT_MODERATION_SETTINGS);
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Partial<ModerationSettings> & {
    newcomer?: Partial<NewcomerSettings>;
    autoBan?: Partial<AutoBanSettings> & { trustScore?: Partial<TrustScoreSettings> };
    welcome?: Partial<WelcomeSettingsRef>;
  };
  return {
    enabled: obj.enabled ?? base.enabled,
    newcomer: { ...base.newcomer, ...obj.newcomer },
    autoBan: {
      ...base.autoBan,
      ...obj.autoBan,
      trustScore: { ...base.autoBan.trustScore, ...obj.autoBan?.trustScore },
    },
    welcome: { ...base.welcome, ...obj.welcome },
  };
}