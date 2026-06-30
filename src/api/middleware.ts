import type { Request, Response, NextFunction } from "express";
import { getSession } from "@auth/express";
import { isAdmin } from "../config/env.js";
import { authConfig } from "./auth.js";

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const session = await getSession(req, authConfig);
    const userId = session?.user?.id ? Number(session.user.id) : undefined;
    if (!isAdmin(userId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    (req as Request & { adminUserId: number }).adminUserId = userId!;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}