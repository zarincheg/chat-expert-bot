import { createHash } from "node:crypto";
import { prisma } from "../../db/prisma.js";

export class QuestionLogService {
  constructor(private readonly botInstanceId: string) {}

  async log(params: {
    chatId: bigint;
    userId?: number;
    question: string;
    answerSource: string;
    ragScore?: number;
    replyToMessageId?: number;
    communityAnswerId?: string;
  }) {
    const normalized = createHash("sha256")
      .update(params.question.toLowerCase().trim())
      .digest("hex")
      .slice(0, 16);

    await prisma.questionLog.create({
      data: {
        botInstanceId: this.botInstanceId,
        chatId: params.chatId,
        userId: params.userId !== undefined ? BigInt(params.userId) : null,
        question: params.question,
        normalized,
        answerSource: params.answerSource,
        ragScore: params.ragScore,
        replyToMessageId:
          params.replyToMessageId !== undefined ? BigInt(params.replyToMessageId) : null,
        communityAnswerId: params.communityAnswerId,
      },
    });
  }
}