import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  BOT_INSTANCE_ID: z.string().default("default"),
  ADMIN_USER_IDS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .map((id) => Number(id))
        .filter((id) => !Number.isNaN(id)),
    ),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  RAG_HISTORY_LIMIT: z.coerce.number().int().positive().default(20),
  SYNC_SCHEDULER_ENABLED: z
    .string()
    .default("false")
    .transform((value) => value === "true" || value === "1"),
  RAG_INGEST_URL: z.string().optional(),
  RAG_INGEST_API_KEY: z.string().optional(),
  RAG_QUERY_URL: z.string().optional(),
  RAG_QUERY_API_KEY: z.string().optional(),
  RAG_QUERY_TOP_K: z.coerce.number().int().positive().default(5),
  RAG_FALLBACK_LOCAL: z
    .string()
    .default("true")
    .transform((v) => v === "true" || v === "1"),
  SOURCE_INGEST_SCHEDULER_ENABLED: z
    .string()
    .default("false")
    .transform((v) => v === "true" || v === "1"),
  SOURCE_MAX_CHUNK_CHARS: z.coerce.number().int().positive().default(2000),
  COMMUNITY_AUTO_INGEST_ON_APPROVE: z
    .string()
    .default("true")
    .transform((v) => v === "true" || v === "1"),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);

export function isAdmin(userId: number | undefined): boolean {
  if (userId === undefined) return false;
  return env.ADMIN_USER_IDS.includes(userId);
}