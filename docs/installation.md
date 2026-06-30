# Installation

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | 20+ |
| npm | 10+ |
| Docker & Compose | For PostgreSQL (local or production) |
| Telegram bot token | From [@BotFather](https://t.me/BotFather) |

---

## Local development

### 1. Clone and install

```bash
git clone <repository-url> telegram-rag-bot
cd telegram-rag-bot
npm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

This starts Postgres on `localhost:5432` (user/password/db: `bot` / `bot` / `telegram_rag_bot`).

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
BOT_TOKEN=<from BotFather>
ADMIN_USER_IDS=<your Telegram user ID>
BOT_INSTANCE_ID=default
DATABASE_URL=postgresql://bot:bot@localhost:5432/telegram_rag_bot?schema=public
```

### 4. Database setup

```bash
npm run db:migrate
npm run db:seed
```

### 5. Run the bot

```bash
npm run dev
```

### 6. Verify

```bash
npm run test
npm run smoke-test
```

Message your bot `/ping` in Telegram — expect `pong`.

---

## Production (Docker)

See [Docker Deployment](deployment/docker.md) for the full production stack.

Quick version:

```bash
cp .env.prod.example .env.prod
# fill BOT_TOKEN, ADMIN_USER_IDS, POSTGRES_PASSWORD

docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

First-time deploy with seed data:

```bash
RUN_DB_SEED=true docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

---

## Multiple bot instances

One process = one `BOT_INSTANCE_ID`. To run multiple bots:

1. Create separate `BotInstance` rows (different slugs) via seed or Prisma Studio
2. Deploy separate containers with different `BOT_TOKEN` and `BOT_INSTANCE_ID`
3. Use separate databases or shared DB with distinct instance slugs

---

## Upgrade

```bash
git pull
npm run db:migrate   # or: docker compose exec bot npx prisma migrate deploy
npm run build        # bare metal
# restart bot process / container
```

See [Operations](operations.md) for zero-downtime notes.