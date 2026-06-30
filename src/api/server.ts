import express from "express";
import cors from "cors";
import { ExpressAuth } from "@auth/express";
import { env } from "../config/env.js";
import { authConfig } from "./auth.js";
import { createApiRouter } from "./routes.js";
import type { ModerationServices } from "../bot/bot.js";

export function createAdminApi(services: ModerationServices, botUsername?: string) {
  const app = express();

  app.use(
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
    }),
  );

  app.use(express.json());
  app.use("/auth/*", ExpressAuth(authConfig));
  app.use("/api", createApiRouter(services, botUsername));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}

export function startAdminApi(services: ModerationServices, botUsername?: string) {
  if (!env.ADMIN_API_ENABLED) return null;

  const app = createAdminApi(services, botUsername);
  const server = app.listen(env.ADMIN_API_PORT, () => {
    console.info(`[api] admin API listening on :${env.ADMIN_API_PORT}`);
  });

  return server;
}