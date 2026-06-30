# Operations

Day-2 guide for running the bot in production.

## Process model

| Component | Default | Notes |
|-----------|---------|-------|
| **Bot** | Long-polling | Single Node process; stateless except in-memory rate limiter |
| **PostgreSQL** | Required | All config, messages, knowledge metadata |
| **Sync scheduler** | Optional in-process | Set `SYNC_SCHEDULER_ENABLED=true` for small deploys |
| **Workers** | Optional containers | Recommended at scale — see Docker workers profile |

## Background jobs

### Chat sync

Exports captured group messages as chunks to the RAG ingest API.

```bash
npm run job:sync-chats
```

**Schedule:** every 6 hours (configurable per instance in admin → Chat sync).

**Docker worker:**

```bash
docker compose -f docker-compose.prod.yml --profile workers up -d sync-worker
```

### Source ingest

Processes `PENDING` URL/FILE/MANUAL data sources.

```bash
npm run job:ingest-sources
```

**Docker worker:**

```bash
docker compose -f docker-compose.prod.yml --profile workers up -d source-ingest-worker
```

---

## Logs

```bash
# Docker
docker compose -f docker-compose.prod.yml logs -f bot

# Look for
[bot] @your_bot is running
[query:mock] chat=-100... q="..."
[ingest:mock] batch chat=...
```

Set `LOG_LEVEL=debug` for verbose output (not recommended in production).

---

## Health checks

| Check | Command |
|-------|---------|
| Bot alive | Telegram `/ping` → `pong` |
| DB connectivity | `docker compose exec bot npx prisma migrate status` |
| Smoke test | `npm run smoke-test` (from CI or ops host with env) |

---

## Backups

### PostgreSQL

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U bot telegram_rag_bot > backup-$(date +%Y%m%d).sql
```

Restore:

```bash
cat backup.sql | docker compose -f docker-compose.prod.yml exec -T postgres \
  psql -U bot telegram_rag_bot
```

**Backup schedule:** daily minimum; test restores monthly.

### What to back up

- PostgreSQL volume (`postgres_data`)
- `.env.prod` / secrets store (not in git)
- Bot token (revocable via BotFather)

---

## Upgrades

```bash
# Pull new image / rebuild
docker compose -f docker-compose.prod.yml --env-file .env.prod pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Migrations run automatically via entrypoint (prisma migrate deploy)
```

### Zero-downtime (single instance)

1. Long-polling stops cleanly on `SIGTERM` (entrypoint uses `tini`)
2. `docker compose up -d` recreates container — ~5–15s gap
3. For stricter SLA: run blue/green with two tokens (not typical for bots)

---

## Scaling notes

| Concern | Current behavior | Future |
|---------|------------------|--------|
| Rate limiter | In-memory per process | Redis for multi-replica |
| Long-polling | One active poller per token | Webhook + load balancer |
| Chat sync | Single worker | Queue-based workers |

**Do not** run two containers with the same `BOT_TOKEN` in long-polling mode.

---

## Security

- Store secrets in CI/CD variables or a secrets manager — never commit `.env`
- Restrict server SSH; use firewall (no public Postgres port in production)
- Rotate `BOT_TOKEN` via BotFather if leaked
- `ADMIN_USER_IDS` is the only admin gate — keep the list minimal

---

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Container restart loop | Invalid `BOT_TOKEN` or DB unreachable |
| Migrations fail | Postgres not healthy; check `depends_on` healthcheck |
| No group messages | Group Privacy enabled in BotFather |
| Empty RAG answers | `RAG_QUERY_URL` unset and no local chunks |