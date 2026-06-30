import type { GroupSettings } from "../../types/group-settings.js";
import { looksLikeQuestion } from "./question-heuristic.js";
import { ChatRateLimiter } from "./rate-limiter.js";

export interface TriggerContext {
  chatId: bigint;
  text: string;
  botUsername?: string;
  isGroup: boolean;
  isReplyToBot: boolean;
  rateLimiter: ChatRateLimiter;
}

export class TriggerPolicyService {
  shouldRespond(settings: GroupSettings, ctx: TriggerContext): boolean {
    const { triggers } = settings;
    const chatKey = ctx.chatId.toString();

    if (!ctx.isGroup) return false;

    if (!ctx.rateLimiter.canReply(chatKey, triggers.cooldownSeconds, triggers.maxRepliesPerHour)) {
      return false;
    }

    const mentionsBot =
      ctx.botUsername &&
      ctx.text.toLowerCase().includes(`@${ctx.botUsername.toLowerCase()}`);

    if (triggers.onMention && mentionsBot) return true;
    if (triggers.onReplyToBot && ctx.isReplyToBot) return true;
    if (triggers.onQuestionHeuristic && looksLikeQuestion(ctx.text, triggers.questionPatterns)) {
      return true;
    }

    return false;
  }

  extractQuestion(text: string, botUsername?: string): string {
    if (!botUsername) return text.trim();
    return text.replace(new RegExp(`@${botUsername}`, "i"), "").trim();
  }
}