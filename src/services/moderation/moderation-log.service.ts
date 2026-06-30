import type { ModerationActionType, Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

export class ModerationLogService {
  constructor(private readonly botInstanceId: string) {}

  async log(params: {
    chatId: bigint;
    targetUserId?: number;
    actionType: ModerationActionType;
    ruleId?: string;
    trustScore?: number;
    details?: Prisma.InputJsonValue;
    success?: boolean;
    errorMessage?: string;
  }) {
    return prisma.moderationActionLog.create({
      data: {
        botInstanceId: this.botInstanceId,
        chatId: params.chatId,
        targetUserId: params.targetUserId !== undefined ? BigInt(params.targetUserId) : null,
        actionType: params.actionType,
        ruleId: params.ruleId,
        trustScore: params.trustScore,
        details: params.details,
        success: params.success ?? true,
        errorMessage: params.errorMessage,
      },
    });
  }

  async list(params: {
    chatId?: bigint;
    actionType?: ModerationActionType;
    limit?: number;
    offset?: number;
  }) {
    return prisma.moderationActionLog.findMany({
      where: {
        botInstanceId: this.botInstanceId,
        ...(params.chatId ? { chatId: params.chatId } : {}),
        ...(params.actionType ? { actionType: params.actionType } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: params.limit ?? 50,
      skip: params.offset ?? 0,
    });
  }

  async countSince(since: Date, actionType?: ModerationActionType) {
    return prisma.moderationActionLog.count({
      where: {
        botInstanceId: this.botInstanceId,
        createdAt: { gte: since },
        ...(actionType ? { actionType } : {}),
      },
    });
  }
}