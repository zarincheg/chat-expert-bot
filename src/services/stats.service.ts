import { prisma } from "../db/prisma.js";
import type { ModerationLogService } from "./moderation/moderation-log.service.js";

export class StatsService {
  constructor(
    private readonly botInstanceId: string,
    private readonly moderationLog: ModerationLogService,
  ) {}

  async getOverview(days = 7) {
    const since = new Date(Date.now() - days * 86400_000);

    const [questions, joins, bans, restricts, newcomerBlocks, groups, members] =
      await Promise.all([
        prisma.questionLog.count({
          where: { botInstanceId: this.botInstanceId, createdAt: { gte: since } },
        }),
        prisma.groupMember.count({
          where: { botInstanceId: this.botInstanceId, joinedAt: { gte: since } },
        }),
        this.moderationLog.countSince(since, "BAN"),
        this.moderationLog.countSince(since, "RESTRICT"),
        this.moderationLog.countSince(since, "NEWCOMER_BLOCK"),
        prisma.managedGroup.count({
          where: { botInstanceId: this.botInstanceId, isActive: true },
        }),
        prisma.groupMember.count({
          where: { botInstanceId: this.botInstanceId, status: "ACTIVE" },
        }),
      ]);

    const questionsBySource = await prisma.questionLog.groupBy({
      by: ["answerSource"],
      where: { botInstanceId: this.botInstanceId, createdAt: { gte: since } },
      _count: true,
    });

    return {
      periodDays: days,
      questions,
      joins,
      bans,
      restricts,
      newcomerBlocks,
      activeGroups: groups,
      activeMembers: members,
      questionsBySource: questionsBySource.map((r) => ({
        source: r.answerSource,
        count: r._count,
      })),
    };
  }
}