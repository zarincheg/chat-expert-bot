import type { CommunityAnswer } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../db/prisma.js";
import type { KnowledgeSource } from "../ai-client/types.js";
import {
  createRagIngestClient,
  type IngestChunk,
  type RagIngestClient,
} from "../ingestion/rag-ingest.client.js";

export class CommunityAnswerService {
  constructor(
    private readonly botInstanceId: string,
    private readonly botInstanceSlug: string,
    private readonly ingestClient: RagIngestClient = createRagIngestClient(),
  ) {}

  async promote(params: {
    chatId: bigint;
    sourceMessageId: number;
    sourceUserId?: number;
    sourceUsername?: string;
    content: string;
    title?: string;
  }) {
    return prisma.communityAnswer.upsert({
      where: {
        botInstanceId_chatId_sourceMessageId: {
          botInstanceId: this.botInstanceId,
          chatId: params.chatId,
          sourceMessageId: BigInt(params.sourceMessageId),
        },
      },
      create: {
        botInstanceId: this.botInstanceId,
        chatId: params.chatId,
        sourceMessageId: BigInt(params.sourceMessageId),
        sourceUserId: params.sourceUserId !== undefined ? BigInt(params.sourceUserId) : null,
        sourceUsername: params.sourceUsername,
        content: params.content,
        title: params.title,
        status: "CANDIDATE",
      },
      update: {
        content: params.content,
        status: "CANDIDATE",
      },
    });
  }

  async listCandidates(chatId?: bigint) {
    return prisma.communityAnswer.findMany({
      where: {
        botInstanceId: this.botInstanceId,
        status: "CANDIDATE",
        ...(chatId ? { chatId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  }

  async approve(id: string, endorsedById: number) {
    const answer = await prisma.communityAnswer.update({
      where: { id },
      data: { status: "APPROVED", endorsedById: BigInt(endorsedById) },
    });

    if (env.COMMUNITY_AUTO_INGEST_ON_APPROVE) {
      await this.ingestApproved(answer.id);
    }

    return answer;
  }

  async reject(id: string) {
    return prisma.communityAnswer.update({
      where: { id },
      data: { status: "REJECTED" },
    });
  }

  async ingestApproved(id: string) {
    const answer = await prisma.communityAnswer.findUnique({ where: { id } });
    if (!answer || answer.status !== "APPROVED") return null;

    const chunk: IngestChunk = {
      externalId: `community-${answer.id}`,
      title: answer.title ?? `Community answer by ${answer.sourceUsername ?? "member"}`,
      content: answer.content,
      metadata: {
        messageIds: [answer.id],
        timeRange: { from: answer.createdAt.toISOString(), to: answer.createdAt.toISOString() },
        roles: ["community"],
        chatId: answer.chatId.toString(),
        capturedFrom: ["community_answer"],
        sourceUsername: answer.sourceUsername,
        sourceType: "community_answer",
      },
    };

    await this.ingestClient.upsertChunks({
      botInstanceId: this.botInstanceId,
      botInstanceSlug: this.botInstanceSlug,
      chatId: answer.chatId.toString(),
      dataSourceId: `community-${answer.chatId}`,
      chunks: [chunk],
    });

    return prisma.communityAnswer.update({
      where: { id },
      data: {
        status: "INGESTED",
        ingestedAt: new Date(),
        externalChunkId: chunk.externalId,
      },
    });
  }

  async searchApproved(chatId: bigint, query: string): Promise<KnowledgeSource[]> {
    const normalized = query.toLowerCase();
    const answers = await prisma.communityAnswer.findMany({
      where: {
        botInstanceId: this.botInstanceId,
        chatId,
        status: { in: ["APPROVED", "INGESTED"] },
      },
      take: 20,
    });

    return answers
      .filter(
        (a: CommunityAnswer) =>
          a.content.toLowerCase().includes(normalized.slice(0, 12)) || normalized.length < 4,
      )
      .slice(0, 2)
      .map((a: CommunityAnswer, i: number) => ({
        id: a.id,
        title: a.title ?? `Community: ${a.sourceUsername ?? "member"}`,
        content: a.content,
        score: 0.95 - i * 0.05,
        sourceType: "community" as const,
        citedUsername: a.sourceUsername,
      }));
  }
}