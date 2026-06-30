import type { AccessListType } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

export class AccessListService {
  constructor(private readonly botInstanceId: string) {}

  async isWhitelisted(chatId: bigint, userId: number): Promise<boolean> {
    const entries = await prisma.accessListEntry.findMany({
      where: {
        botInstanceId: this.botInstanceId,
        userId: BigInt(userId),
        listType: "WHITELIST",
        OR: [{ chatId: null }, { chatId }],
      },
    });
    return entries.length > 0;
  }

  async isBlacklisted(chatId: bigint, userId: number): Promise<boolean> {
    const entries = await prisma.accessListEntry.findMany({
      where: {
        botInstanceId: this.botInstanceId,
        userId: BigInt(userId),
        listType: "BLACKLIST",
        OR: [{ chatId: null }, { chatId }],
      },
    });
    return entries.length > 0;
  }

  async add(params: {
    userId: number;
    listType: AccessListType;
    chatId?: bigint;
    reason?: string;
    createdById?: number;
  }) {
    const chatId = params.chatId ?? null;
    const existing = await prisma.accessListEntry.findFirst({
      where: {
        botInstanceId: this.botInstanceId,
        chatId,
        userId: BigInt(params.userId),
        listType: params.listType,
      },
    });

    if (existing) {
      return prisma.accessListEntry.update({
        where: { id: existing.id },
        data: { reason: params.reason },
      });
    }

    return prisma.accessListEntry.create({
      data: {
        botInstanceId: this.botInstanceId,
        chatId,
        userId: BigInt(params.userId),
        listType: params.listType,
        reason: params.reason,
        createdById: params.createdById !== undefined ? BigInt(params.createdById) : null,
      },
    });
  }

  async remove(id: string) {
    return prisma.accessListEntry.delete({ where: { id } });
  }

  async list(listType?: AccessListType, chatId?: bigint) {
    return prisma.accessListEntry.findMany({
      where: {
        botInstanceId: this.botInstanceId,
        ...(listType ? { listType } : {}),
        ...(chatId !== undefined ? { OR: [{ chatId: null }, { chatId }] } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  }
}