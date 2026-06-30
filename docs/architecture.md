# Architecture

## Overview

```mermaid
flowchart TB
    subgraph tg [Telegram]
        DM[Admin DM]
        Group[Group chat]
    end

    subgraph app [Bot Service - Node.js]
        Grammy[Grammy + Conversations]
        Handlers[Commands / Messages / Callbacks]
        Admin[Admin Conversation]
        Orchestrator[RagOrchestrator]
        Query[RagQueryClient]
        Ingest[RagIngestClient]
        AI[AiClient]
        Capture[MessageCapture]
        Sync[ChatSyncService]
        Community[CommunityAnswerService]
        GroupCfg[GroupConfigService]
    end

    subgraph db [(PostgreSQL)]
        Instance[BotInstance]
        Groups[ManagedGroup]
        Messages[ChatMessage]
        Sources[DataSource]
        Answers[CommunityAnswer]
    end

    subgraph ext [External - optional]
        RAGQuery[RAG Query API]
        RAGIngest[RAG Ingest API]
        LLM[LLM API]
    end

    DM --> Admin
    Group --> Handlers
    Handlers --> Orchestrator
    Admin --> GroupCfg
    Orchestrator --> Query --> RAGQuery
    Orchestrator --> AI --> LLM
    Orchestrator --> Community
    Sync --> Ingest --> RAGIngest
    Capture --> Messages
    GroupCfg --> Groups
    Handlers --> db
    Orchestrator --> db
```

## Layers

| Layer | Path | Responsibility |
|-------|------|----------------|
| Entry | `src/index.ts` | Boot, scheduler, graceful shutdown |
| Bot | `src/bot/` | Grammy wiring, handlers, conversations |
| Admin | `src/admin/` | Inline admin UI |
| Services | `src/services/` | Business logic |
| Data | `prisma/` | Schema and migrations |
| Jobs | `src/jobs/` | CLI batch tasks |

## Request flow — group question

1. Message arrives → `messages.ts`
2. `TriggerPolicyService` checks per-group triggers + rate limit
3. `RagOrchestrator.answer()`:
   - Load global + group settings
   - Store user message in history
   - `RagQueryClient.search(chatId, query)`
   - Merge approved `CommunityAnswer` hits
   - Optional local `KnowledgeChunk` fallback
   - `AiClient.chat()` with persona, sources, history
   - Format citation footer
   - Log to `QuestionLog`
4. Reply sent to group

## Multi-tenancy

- **Bot instance:** `BOT_INSTANCE_ID` → `BotInstance` row
- **Group scope:** `chatId` on every query/ingest/capture row
- **Config:** Global (`BotInstance.settings`) + per-group (`ManagedGroup.settings`)

## Deployment unit

One Docker image contains:

- Compiled bot (`dist/src/index.js`)
- Prisma migrations
- Job scripts (`dist/src/jobs/`)
- Entrypoint (migrate + start)

PostgreSQL runs as a separate container with a named volume.

## Extension points

| Interface | File | Swap for |
|-----------|------|----------|
| `AiClient` | `src/services/ai-client/` | OpenAI, Anthropic, local LLM |
| `RagQueryClient` | `src/services/rag/rag-query.client.ts` | Your vector search API |
| `RagIngestClient` | `src/services/ingestion/rag-ingest.client.ts` | Your indexing API |
| Capture filters | `src/services/capture/filters/` | Custom message filtering |

See [RAG Integration](api/rag-integration.md) and [Developer Guide](developer-guide.md).