export interface TriggerPolicy {
  onMention: boolean;
  onReplyToBot: boolean;
  onQuestionHeuristic: boolean;
  questionPatterns: string[];
  cooldownSeconds: number;
  maxRepliesPerHour: number;
}

export interface GroupSettings {
  ragEnabled: boolean;
  captureEnabled: boolean;
  syncEnabled: boolean;
  proactiveEnabled: boolean;
  triggers: TriggerPolicy;
  responseStyle: "concise" | "detailed";
  welcomeMessage?: string;
  expertPersona?: string;
  moderatorUserIds: number[];
}

export const DEFAULT_TRIGGER_POLICY: TriggerPolicy = {
  onMention: true,
  onReplyToBot: true,
  onQuestionHeuristic: false,
  questionPatterns: [],
  cooldownSeconds: 30,
  maxRepliesPerHour: 20,
};

export const DEFAULT_GROUP_SETTINGS: GroupSettings = {
  ragEnabled: true,
  captureEnabled: true,
  syncEnabled: false,
  proactiveEnabled: false,
  triggers: DEFAULT_TRIGGER_POLICY,
  responseStyle: "concise",
  moderatorUserIds: [],
};

export function parseGroupSettings(raw: unknown): GroupSettings {
  const base = structuredClone(DEFAULT_GROUP_SETTINGS);
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Partial<GroupSettings> & { triggers?: Partial<TriggerPolicy> };
  return {
    ragEnabled: obj.ragEnabled ?? base.ragEnabled,
    captureEnabled: obj.captureEnabled ?? base.captureEnabled,
    syncEnabled: obj.syncEnabled ?? base.syncEnabled,
    proactiveEnabled: obj.proactiveEnabled ?? base.proactiveEnabled,
    triggers: { ...base.triggers, ...obj.triggers },
    responseStyle: obj.responseStyle ?? base.responseStyle,
    welcomeMessage: obj.welcomeMessage ?? base.welcomeMessage,
    expertPersona: obj.expertPersona ?? base.expertPersona,
    moderatorUserIds: obj.moderatorUserIds ?? base.moderatorUserIds,
  };
}