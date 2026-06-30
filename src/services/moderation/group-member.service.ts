import type { GroupMemberStatus } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

export class GroupMemberService {
  constructor(private readonly botInstanceId: string) {}

  async upsertJoin(params: {
    chatId: bigint;
    userId: number;
    username?: string;
    firstName?: string;
    lastName?: string;
  }) {
    return prisma.groupMember.upsert({
      where: {
        botInstanceId_chatId_userId: {
          botInstanceId: this.botInstanceId,
          chatId: params.chatId,
          userId: BigInt(params.userId),
        },
      },
      create: {
        botInstanceId: this.botInstanceId,
        chatId: params.chatId,
        userId: BigInt(params.userId),
        username: params.username,
        firstName: params.firstName,
        lastName: params.lastName,
        status: "ACTIVE",
      },
      update: {
        username: params.username,
        firstName: params.firstName,
        lastName: params.lastName,
        status: "ACTIVE",
        leftAt: null,
      },
    });
  }

  async markLeft(chatId: bigint, userId: number) {
    return prisma.groupMember.updateMany({
      where: {
        botInstanceId: this.botInstanceId,
        chatId,
        userId: BigInt(userId),
      },
      data: { status: "LEFT", leftAt: new Date() },
    });
  }

  async recordMessage(chatId: bigint, userId: number) {
    const member = await prisma.groupMember.findUnique({
      where: {
        botInstanceId_chatId_userId: {
          botInstanceId: this.botInstanceId,
          chatId,
          userId: BigInt(userId),
        },
      },
    });
    if (!member) return null;

    const isFirst = !member.firstMessageAt;
    return prisma.groupMember.update({
      where: { id: member.id },
      data: {
        messageCount: { increment: 1 },
        firstMessageAt: isFirst ? new Date() : member.firstMessageAt,
      },
    });
  }

  async setStatus(chatId: bigint, userId: number, status: GroupMemberStatus) {
    return prisma.groupMember.updateMany({
      where: {
        botInstanceId: this.botInstanceId,
        chatId,
        userId: BigInt(userId),
      },
      data: { status },
    });
  }

  async getMember(chatId: bigint, userId: number) {
    return prisma.groupMember.findUnique({
      where: {
        botInstanceId_chatId_userId: {
          botInstanceId: this.botInstanceId,
          chatId,
          userId: BigInt(userId),
        },
      },
    });
  }
}