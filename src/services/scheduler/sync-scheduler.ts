import type { ChatSyncService } from "../ingestion/chat-sync.service.js";
import type { BotConfigService } from "../bot-config.service.js";

export class SyncScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly syncService: ChatSyncService,
    private readonly configService: BotConfigService,
  ) {}

  async start(): Promise<void> {
    await this.scheduleNext();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async scheduleNext(): Promise<void> {
    const settings = (await this.configService.getSettings()).chatIngestion;
    const intervalMs = Math.max(settings.intervalHours, 1) * 60 * 60 * 1000;

    if (!settings.enabled) {
      console.info("[sync-scheduler] chat ingestion disabled — scheduler idle");
      return;
    }

    console.info(
      `[sync-scheduler] enabled — interval ${settings.intervalHours}h (${intervalMs}ms)`,
    );

    this.timer = setInterval(() => {
      void this.runSafe();
    }, intervalMs);

    void this.runSafe();
  }

  private async runSafe(): Promise<void> {
    try {
      const settings = (await this.configService.getSettings()).chatIngestion;
      if (!settings.enabled) return;

      console.info("[sync-scheduler] starting chat sync run...");
      const result = await this.syncService.run();
      console.info(
        `[sync-scheduler] done — chats=${result.chatsProcessed} chunks=${result.chunksSent} messages=${result.messagesSent}`,
      );
      if (result.errors.length > 0) {
        console.warn("[sync-scheduler] partial errors:", result.errors);
      }
    } catch (error) {
      console.error("[sync-scheduler] run failed:", error);
    }
  }
}