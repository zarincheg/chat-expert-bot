# Telegram RAG Community Bot

Production-ready Telegram group assistant with per-group knowledge, moderator workflows, admin panel, and pluggable RAG/AI backends.

Works standalone in **mock mode** (no external AI/RAG required) — ideal for testing capture, sync, moderation, and admin flows before connecting your retrieval service.

## Features

- **Group Q&A** — `/ask`, @mention, reply-to-bot triggers with per-group policy
- **Admin panel** — `/admin` in DM (commands, buttons, sources, groups, sync, community)
- **Moderators** — per-group `/promote` + `/mod` review workflow
- **Knowledge pipeline** — URL/FILE/MANUAL sources, chat capture + sync, community answers
- **Docker production stack** — PostgreSQL + bot (+ optional workers)
- **CI/CD** — GitHub Actions and GitLab pipelines included

## Documentation

Full guides live in **[docs/](docs/README.md)**:

| Audience | Start here |
|----------|------------|
| Group admins | [docs/admin/quick-start.md](docs/admin/quick-start.md) |
| Operators | [docs/deployment/docker.md](docs/deployment/docker.md) |
| Developers | [docs/developer-guide.md](docs/developer-guide.md) |
| CI/CD | [GitHub](docs/deployment/ci-cd-github.md) · [GitLab](docs/deployment/ci-cd-gitlab.md) |

## Quick start (local dev)

```bash
npm install
docker compose up -d
cp .env.example .env   # set BOT_TOKEN, ADMIN_USER_IDS
npm run db:migrate && npm run db:seed
npm run dev
```

Message your bot `/ping` in Telegram.

## Production (Docker)

```bash
cp .env.prod.example .env.prod
# Set BOT_TOKEN, ADMIN_USER_IDS, POSTGRES_PASSWORD

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

First deploy with seed data: set `RUN_DB_SEED=true` in `.env.prod`.

See [docs/deployment/production-checklist.md](docs/deployment/production-checklist.md).

## Stack

| Layer | Technology |
|-------|------------|
| Bot | Grammy + Conversations |
| Database | PostgreSQL 16 + Prisma |
| Runtime | Node.js 20 |
| Deploy | Docker Compose |

## Commands

| Command | Who | Description |
|---------|-----|-------------|
| `/start` | Everyone | Welcome + buttons |
| `/help` | Everyone | Command list |
| `/ask <q>` | Everyone | Ask knowledge base |
| `/promote` | Moderators | Save replied-to message for review |
| `/mod` | Moderators | Review community answers (DM) |
| `/admin` | Global admins | Full admin panel (DM) |
| `/report` | Everyone | Report issue dialog |
| `/digest` | Everyone | Daily tip |
| `/ping` | Everyone | Health check |

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Development with hot reload |
| `npm run build` | Compile TypeScript |
| `npm run start:prod` | Run compiled bot |
| `npm run test` | Unit tests |
| `npm run smoke-test` | Integration smoke test |
| `npm run job:sync-chats` | Chat history → RAG ingest |
| `npm run job:ingest-sources` | Process pending data sources |

## Environment

See [.env.example](.env.example) (dev) and [.env.prod.example](.env.prod.example) (production).

Optional external services:

- `RAG_QUERY_URL` — vector/search API for retrieval
- `RAG_INGEST_URL` — indexing API for chunks

Both fall back to mock clients when unset. See [docs/api/rag-integration.md](docs/api/rag-integration.md).

## Project structure

```
telegram-rag-bot/
├── docs/                  # Production documentation
├── src/                   # Bot application
├── prisma/                # Schema + migrations
├── docker/                # Entrypoint scripts
├── .github/workflows/     # GitHub CI/CD
├── docker-compose.yml     # Dev Postgres
├── docker-compose.prod.yml
└── Dockerfile
```

## License

Private / unlicensed — adjust for your deployment.