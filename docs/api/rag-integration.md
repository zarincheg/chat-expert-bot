# RAG Service Integration

The bot delegates retrieval and indexing to an external RAG API. Both clients use **mock implementations** when URLs are unset — sufficient to run the full bot service without your AI stack.

## Endpoints

### Query — `RAG_QUERY_URL`

```
POST {RAG_QUERY_URL}/query/search
Authorization: Bearer {RAG_QUERY_API_KEY}   # optional
Content-Type: application/json
```

**Request:**

```json
{
  "botInstanceId": "cuid...",
  "botInstanceSlug": "cronomad",
  "chatId": "-1001234567890",
  "query": "When is standup?",
  "topK": 5,
  "filters": {}
}
```

**Response:**

```json
{
  "results": [
    {
      "id": "chunk-1",
      "title": "Meeting schedule",
      "content": "Standups are at 10:00 UTC.",
      "score": 0.92,
      "metadata": { "sourceType": "chat_history" }
    }
  ]
}
```

**Implementation:** `src/services/rag/rag-query.client.ts`

### Ingest — `RAG_INGEST_URL`

```
POST {RAG_INGEST_URL}/ingest/chunks
Authorization: Bearer {RAG_INGEST_API_KEY}   # optional
Content-Type: application/json
```

**Request:**

```json
{
  "botInstanceId": "cuid...",
  "botInstanceSlug": "cronomad",
  "chatId": "-1001234567890",
  "dataSourceId": "source-id",
  "chunks": [
    {
      "externalId": "chat-sync-abc-0",
      "title": "Group chat excerpt",
      "content": "...",
      "metadata": {
        "messageIds": ["..."],
        "timeRange": { "from": "...", "to": "..." },
        "roles": ["user"],
        "chatId": "-1001234567890",
        "capturedFrom": ["group"],
        "sourceType": "community_answer",
        "sourceUsername": "alice"
      }
    }
  ]
}
```

**Response:**

```json
{
  "accepted": 3,
  "rejected": 0,
  "jobId": "job-123"
}
```

**Implementation:** `src/services/ingestion/rag-ingest.client.ts`

---

## Scoping rules

| Field | Required | Purpose |
|-------|----------|---------|
| `chatId` | Yes for groups | Isolate knowledge per Telegram group |
| `botInstanceId` | Yes | Multi-bot deployments on one RAG service |

Query and ingest for the same `chatId` must share an index namespace in your RAG service.

---

## Local fallback

When `RAG_FALLBACK_LOCAL=true` and the query API returns no results, the bot searches the `KnowledgeChunk` table (keyword match). Useful for dev; disable in production when the real API is live.

---

## Community answers

Approved promotions ingest with:

```json
"metadata": {
  "sourceType": "community_answer",
  "sourceUsername": "alice",
  "capturedFrom": ["community_answer"]
}
```

The orchestrator merges local approved answers before calling the query API. Your API should return community chunks with comparable scores for hybrid retrieval.

---

## AI layer (separate)

The bot calls `AiClient.chat()` after retrieval. Replace `mockAiClient` with your LLM provider — the RAG API does not need to generate final answers unless you collapse query+generate into one service.

**Context passed to AI:**

- `sources` — retrieved chunks
- `expertPersona`, `topic` — per-group
- `history` — recent chat messages
- `responseStyle` — concise | detailed
- `threadSnippet` — reply context

---

## Testing integration

1. Set `RAG_QUERY_URL` and `RAG_INGEST_URL` in `.env`
2. Run ingest: `npm run job:sync-chats` or approve a community answer
3. Ask in group: `/ask <question>`
4. Check bot logs for HTTP errors

Mock mode logs:

```
[query:mock] chat=-100... q="..." topK=5
[ingest:mock] batch chat=-100... chunks=3
```