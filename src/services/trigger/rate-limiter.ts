interface Bucket {
  lastReplyAt: number;
  hourWindowStart: number;
  repliesThisHour: number;
}

export class ChatRateLimiter {
  private buckets = new Map<string, Bucket>();

  canReply(chatId: string, cooldownSeconds: number, maxPerHour: number): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(chatId) ?? {
      lastReplyAt: 0,
      hourWindowStart: now,
      repliesThisHour: 0,
    };

    if (now - bucket.hourWindowStart > 3_600_000) {
      bucket.hourWindowStart = now;
      bucket.repliesThisHour = 0;
    }

    if (bucket.repliesThisHour >= maxPerHour) return false;
    if (now - bucket.lastReplyAt < cooldownSeconds * 1000) return false;

    return true;
  }

  recordReply(chatId: string): void {
    const now = Date.now();
    const bucket = this.buckets.get(chatId) ?? {
      lastReplyAt: 0,
      hourWindowStart: now,
      repliesThisHour: 0,
    };
    bucket.lastReplyAt = now;
    bucket.repliesThisHour += 1;
    this.buckets.set(chatId, bucket);
  }
}