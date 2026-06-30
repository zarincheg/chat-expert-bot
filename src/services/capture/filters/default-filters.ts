import type { ChatIngestionSettings } from "../../../types/index.js";
import type { CaptureContext, CaptureFilter } from "./types.js";

export class NoDmFilter implements CaptureFilter {
  readonly name = "no_dm";

  shouldCapture(context: CaptureContext): boolean {
    return context.chatType === "group" || context.chatType === "supergroup";
  }
}

export class AllowlistedChatFilter implements CaptureFilter {
  readonly name = "allowlisted_chat";

  constructor(private readonly settings: ChatIngestionSettings) {}

  shouldCapture(context: CaptureContext): boolean {
    if (this.settings.syncChatIds.length === 0) return false;
    return this.settings.syncChatIds.includes(Number(context.chatId));
  }
}

export class MinLengthFilter implements CaptureFilter {
  readonly name = "min_length";

  constructor(private readonly minLength = 2) {}

  shouldCapture(context: CaptureContext): boolean {
    return context.content.trim().length >= this.minLength;
  }
}

export class SkipCommandsFilter implements CaptureFilter {
  readonly name = "skip_commands";

  shouldCapture(context: CaptureContext): boolean {
    return !context.isCommand;
  }
}

export class SkipEmptyFilter implements CaptureFilter {
  readonly name = "skip_empty";

  shouldCapture(context: CaptureContext): boolean {
    return context.content.trim().length > 0;
  }
}

export function createDefaultCaptureFilters(
  settings: ChatIngestionSettings,
): CaptureFilter[] {
  return [
    new NoDmFilter(),
    new AllowlistedChatFilter(settings),
    new SkipEmptyFilter(),
    new SkipCommandsFilter(),
    new MinLengthFilter(2),
  ];
}