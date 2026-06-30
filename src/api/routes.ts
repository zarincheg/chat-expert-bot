import { Router } from "express";
import { prisma } from "../db/prisma.js";
import type { ModerationServices } from "../bot/bot.js";
import { StatsService } from "../services/stats.service.js";
import { requireAdmin } from "./middleware.js";

export function createApiRouter(services: ModerationServices, botUsername?: string) {
  const router = Router();
  const stats = new StatsService(services.botInstanceId, services.moderationLog);

  router.get("/public/config", (_req, res) => {
    res.json({ botUsername: botUsername ?? null });
  });

  router.use(requireAdmin);

  router.get("/stats/overview", async (req, res) => {
    const days = Number(req.query.days ?? 7);
    res.json(await stats.getOverview(days));
  });

  router.get("/groups", async (_req, res) => {
    const groups = await prisma.managedGroup.findMany({
      where: { botInstanceId: services.botInstanceId },
      orderBy: { updatedAt: "desc" },
    });
    res.json(
      groups.map((g) => ({
        id: g.id,
        chatId: g.chatId.toString(),
        title: g.title,
        isActive: g.isActive,
        topic: g.topic,
      })),
    );
  });

  router.get("/groups/:chatId/moderation", async (req, res) => {
    const chatId = BigInt(req.params.chatId);
    res.json(await services.moderationConfig.getSettings(chatId));
  });

  router.patch("/groups/:chatId/moderation", async (req, res) => {
    const chatId = BigInt(req.params.chatId);
    const updated = await services.moderationConfig.updateSettings(chatId, req.body);
    res.json(updated);
  });

  router.get("/groups/:chatId/welcome", async (req, res) => {
    const chatId = BigInt(req.params.chatId);
    res.json((await services.welcomeService.getConfig(chatId)) ?? null);
  });

  router.put("/groups/:chatId/welcome", async (req, res) => {
    const chatId = BigInt(req.params.chatId);
    const { text, photoUrl, photoFileId, buttons, enabled, deleteJoinMessage } = req.body;
    const config = await services.welcomeService.upsertConfig({
      chatId,
      text,
      photoUrl,
      photoFileId,
      buttons,
      enabled,
      deleteJoinMessage,
    });
    res.json(config);
  });

  router.get("/rules", async (req, res) => {
    const chatId = req.query.chatId ? BigInt(String(req.query.chatId)) : undefined;
    res.json(await services.ruleService.listRules(chatId));
  });

  router.post("/rules", async (req, res) => {
    const { chatId, name, ruleType, pattern, action } = req.body;
    const rule = await services.ruleService.create({
      chatId: chatId ? BigInt(chatId) : undefined,
      name,
      ruleType,
      pattern,
      action,
    });
    res.status(201).json(rule);
  });

  router.patch("/rules/:id", async (req, res) => {
    res.json(await services.ruleService.update(req.params.id, req.body));
  });

  router.delete("/rules/:id", async (req, res) => {
    await services.ruleService.delete(req.params.id);
    res.status(204).end();
  });

  router.get("/access-lists", async (req, res) => {
    const listType = req.query.type as "BLACKLIST" | "WHITELIST" | undefined;
    const chatId = req.query.chatId ? BigInt(String(req.query.chatId)) : undefined;
    res.json(await services.accessListService.list(listType, chatId));
  });

  router.post("/access-lists", async (req, res) => {
    const { userId, listType, chatId, reason } = req.body;
    const entry = await services.accessListService.add({
      userId: Number(userId),
      listType,
      chatId: chatId ? BigInt(chatId) : undefined,
      reason,
      createdById: (req as { adminUserId?: number }).adminUserId,
    });
    res.status(201).json(entry);
  });

  router.delete("/access-lists/:id", async (req, res) => {
    await services.accessListService.remove(req.params.id);
    res.status(204).end();
  });

  router.get("/moderation/logs", async (req, res) => {
    const chatId = req.query.chatId ? BigInt(String(req.query.chatId)) : undefined;
    const limit = Number(req.query.limit ?? 50);
    const offset = Number(req.query.offset ?? 0);
    const actionType = req.query.actionType as string | undefined;
    res.json(
      await services.moderationLog.list({
        chatId,
        limit,
        offset,
        actionType: actionType as never,
      }),
    );
  });

  return router;
}