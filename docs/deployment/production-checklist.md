# Production Checklist

Use before going live with real community groups.

## Telegram

- [ ] Bot created in [@BotFather](https://t.me/BotFather)
- [ ] **Group Privacy disabled** (`/setprivacy` → Disable)
- [ ] Bot description and about text set
- [ ] Test `/start` and `/ping` in DM

## Secrets and access

- [ ] `BOT_TOKEN` stored in secrets manager / CI variables — not in git
- [ ] `POSTGRES_PASSWORD` is strong and unique
- [ ] `ADMIN_USER_IDS` lists only trusted operators
- [ ] `.env.prod` file permissions restricted (`chmod 600`)

## Infrastructure

- [ ] Docker Compose prod stack deployed (`docker-compose.prod.yml`)
- [ ] Postgres **not** exposed on public ports
- [ ] Firewall allows outbound HTTPS (Telegram API + optional RAG URLs)
- [ ] Named volume `postgres_data` backed up (see [Operations](../operations.md))
- [ ] Container restart policy: `unless-stopped`

## Database

- [ ] Migrations applied (`prisma migrate deploy` in entrypoint logs)
- [ ] Seed run once if fresh install (`RUN_DB_SEED=true`)
- [ ] `BOT_INSTANCE_ID` matches seeded instance slug

## Bot configuration

- [ ] `/admin` works in DM for all `ADMIN_USER_IDS`
- [ ] Test group registered and sync enabled
- [ ] Per-group RAG + capture + triggers verified
- [ ] At least one moderator added per production group

## Knowledge pipeline

- [ ] Data source added and ingested OR chat sync tested
- [ ] `RAG_QUERY_URL` / `RAG_INGEST_URL` set (if using external RAG)
- [ ] `RAG_FALLBACK_LOCAL=false` when real query API is live
- [ ] Community approve → ingest tested (`/promote` → `/mod` → approve)

## Background jobs

- [ ] Chat sync scheduled (`SYNC_SCHEDULER_ENABLED=true` OR `sync-worker` profile)
- [ ] Source ingest scheduled if using URL sources
- [ ] Job failures monitored in logs

## CI/CD

- [ ] Pipeline runs tests on every merge
- [ ] Deploy uses pinned image tags (not `:latest` in prod)
- [ ] Rollback procedure documented (previous image tag + DB backup)

## Monitoring

- [ ] Log aggregation or `docker compose logs` access
- [ ] Alert on container restart loop
- [ ] Periodic `/ping` or smoke-test from CI

## Legal / community

- [ ] Members informed that messages may be stored (capture/sync)
- [ ] Moderation policy for `/promote` documented for the community