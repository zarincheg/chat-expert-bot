# Developer Guide

## Getting started

```bash
npm install
docker compose up -d
cp .env.example .env
npm run db:migrate && npm run db:seed
npm run dev
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Watch mode (`tsx watch`) |
| `npm run build` | Compile to `dist/` |
| `npm run start` | Run compiled bot (dev) |
| `npm run start:prod` | Production entry (`node dist/src/index.js`) |
| `npm run test` | Vitest unit tests |
| `npm run smoke-test` | DB + RAG + Telegram token check |
| `npm run db:migrate` | Dev migrations |
| `npm run db:seed` | Seed instance, commands, FAQ chunks |
| `npm run job:sync-chats` | Manual chat sync |
| `npm run job:ingest-sources` | Manual source ingest |

## Project layout

```
src/
├── index.ts                 # Entry point
├── config/env.ts            # Env validation (Zod)
├── bot/
│   ├── bot.ts               # Wiring
│   ├── handlers/            # commands, messages, callbacks
│   └── conversations/       # Multi-step dialogs
├── admin/                   # Admin panel (keyboards, format, conversation)
├── services/
│   ├── rag/                 # Orchestrator, query client
│   ├── ingestion/           # Chat sync, source ingest
│   ├── community/           # Promote, approve, citations
│   ├── trigger/             # Policy, rate limit, heuristics
│   └── capture/             # Message capture pipeline
├── jobs/                    # Cron-friendly CLI jobs
└── types/                   # Shared TypeScript types
prisma/schema.prisma         # Data model
scripts/seed.ts              # Bootstrap data
```

## Key conventions

- **ESM** — `"type": "module"`, `.js` extensions in imports
- **Strict TypeScript** — no unused locals/parameters
- **Services** — stateless classes; inject dependencies in `bot.ts`
- **BigInt** — Telegram `chatId` stored as `BigInt` in Prisma
- **Conversations** — pass data as entry args, not `ctx.session` (replay-safe)

## Adding a command

1. Register handler in `src/bot/handlers/commands.ts`
2. Add row via seed or `/admin` → Commands
3. Document in `docs/admin/features.md`

## Adding an admin panel section

1. Add callbacks in `src/admin/keyboards.ts`
2. Add text formatters in `src/admin/format.ts`
3. Handle callbacks in `src/admin/admin-conversation.ts`

## Testing

```bash
npm run test
```

Tests live next to source (`*.test.ts`). CI runs tests against a Postgres service container.

## Database changes

```bash
# Edit prisma/schema.prisma
npm run db:migrate    # creates migration in dev
npm run db:generate   # refresh client
```

Production containers run `prisma migrate deploy` on start.

## Implementing real AI

1. Create `src/services/ai-client/openai.client.ts` implementing `AiClient`
2. Inject in `RagOrchestrator` constructor (or factory in `bot.ts`)
3. Add env vars to `src/config/env.ts` and `.env.example`

## Implementing real RAG

See [RAG Integration](api/rag-integration.md).

## Code quality

- Match existing naming and file structure
- Keep handlers thin — logic in services
- Validate user input before `BigInt()` (see `src/admin/parse-id.ts`)

## Related docs

- [Architecture](architecture.md)
- [Configuration](configuration.md)
- [PLAN.md](../PLAN.md) — design decisions
- [PRODUCT-PLAN.md](../PRODUCT-PLAN.md) — roadmap