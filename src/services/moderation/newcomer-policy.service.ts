import type { GroupMember } from "@prisma/client";
import type { ContentType, ModerationSettings } from "../../types/moderation-settings.js";

export interface MessageContentInfo {
  contentTypes: ContentType[];
  hasLink: boolean;
  isForward: boolean;
}

export class NewcomerPolicyService {
  isNewcomer(member: GroupMember | null, settings: ModerationSettings): boolean {
    if (!settings.newcomer.enabled || !member) return false;
    const graceMs = settings.newcomer.gracePeriodHours * 3600_000;
    return Date.now() - member.joinedAt.getTime() < graceMs;
  }

  detectContent(message: {
    text?: string;
    photo?: unknown;
    video?: unknown;
    document?: unknown;
    audio?: unknown;
    voice?: unknown;
    sticker?: unknown;
    animation?: unknown;
    poll?: unknown;
    forward_origin?: unknown;
  }): MessageContentInfo {
    const types: ContentType[] = [];
    if (message.text) types.push("text");
    if (message.photo) types.push("photo");
    if (message.video) types.push("video");
    if (message.document) types.push("document");
    if (message.audio) types.push("audio");
    if (message.voice) types.push("voice");
    if (message.sticker) types.push("sticker");
    if (message.animation) types.push("animation");
    if (message.poll) types.push("poll");

    const text = message.text ?? "";
    const hasLink =
      /https?:\/\//i.test(text) || /www\./i.test(text) || /t\.me\//i.test(text);
    if (hasLink) types.push("link");

    return {
      contentTypes: types,
      hasLink,
      isForward: message.forward_origin !== undefined,
    };
  }

  checkViolation(
    settings: ModerationSettings,
    content: MessageContentInfo,
    messagesThisHour: number,
  ): string | null {
    const n = settings.newcomer;
    if (messagesThisHour >= n.maxMessagesPerHour) {
      return "rate_limit";
    }
    if (n.blockLinks && content.hasLink) return "link";
    if (n.blockForwards && content.isForward) return "forward";

    for (const type of content.contentTypes) {
      if (!n.allowedContentTypes.includes(type)) {
        return `content_type:${type}`;
      }
    }
    return null;
  }
}