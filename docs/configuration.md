# Configuration Reference

All variables are validated at startup via Zod (`src/config/env.ts`).

## Required

| Variable | Description | Example |
|----------|-------------|---------|
| `BOT_TOKEN` | Telegram bot token | `123456:ABC...` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://bot:pass@host:5432/db` |
| `ADMIN_USER_IDS` | Comma-separated Telegram user IDs for `/admin` | `47176761,123456789` |

## Bot instance

| Variable | Default | Description |
|----------|---------|-------------|
| `BOT_INSTANCE_ID` | `default` | Slug of `BotInstance` row to load |

## Runtime

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `RAG_HISTORY_LIMIT` | `20` | Recent messages included in AI context |
| `SYNC_SCHEDULER_ENABLED` | `false` | In-process 6h sync scheduler (dev/small deploys) |

## RAG query API (Phase A)

| Variable | Default | Description |
|----------|---------|-------------|
| `RAG_QUERY_URL` | *(empty)* | Base URL; mock client if unset |
| `RAG_QUERY_API_KEY` | *(empty)* | Bearer token for query API |
| `RAG_QUERY_TOP_K` | `5` | Max results per query |
| `RAG_FALLBACK_LOCAL` | `true` | Fall back to `KnowledgeChunk` table when query empty |

## RAG ingest API

| Variable | Default | Description |
|----------|---------|-------------|
| `RAG_INGEST_URL` | *(empty)* | Base URL; mock client if unset |
| `RAG_INGEST_API_KEY` | *(empty)* | Bearer token for ingest API |

## Source ingestion

| Variable | Default | Description |
|----------|---------|-------------|
| `SOURCE_INGEST_SCHEDULER_ENABLED` | `false` | In-process source ingest scheduler |
| `SOURCE_MAX_CHUNK_CHARS` | `2000` | Max characters per ingested chunk |

## Community answers

| Variable | Default | Description |
|----------|---------|-------------|
| `COMMUNITY_AUTO_INGEST_ON_APPROVE` | `true` | Ingest to RAG immediately on moderator approval |

## Docker Compose production (`.env.prod`)

| Variable | Description |
|----------|-------------|
| `POSTGRES_USER` | PostgreSQL user (default `bot`) |
| `POSTGRES_PASSWORD` | **Required** — strong password |
| `POSTGRES_DB` | Database name (default `telegram_rag_bot`) |
| `RUN_DB_SEED` | `true` on first deploy to seed FAQ chunks |
| `BOT_IMAGE` | Image tag when pulling from registry |

## Per-group settings (database)

Not env vars — configured via `/admin` → Groups:

- `ragEnabled`, `captureEnabled`, `syncEnabled`
- Trigger policy (mention, reply, heuristic, cooldowns)
- `expertPersona`, `topic`, `moderatorUserIds`

Stored in `ManagedGroup.settings` JSON.

## BotFather (Telegram)

| Setting | Production recommendation |
|---------|---------------------------|
| Group Privacy | **Disabled** for capture and heuristics |
| Webhook | Not used — bot runs long-polling by default |

To switch to webhooks later, extend `src/index.ts` and terminate TLS at your reverse proxy.