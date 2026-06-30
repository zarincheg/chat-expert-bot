# Group Setup

## BotFather settings

### Group Privacy (required for capture)

1. Message [@BotFather](https://t.me/BotFather)
2. `/setprivacy` → select your bot → **Disable**

With privacy **enabled**, the bot only sees commands, mentions, and replies — not general chat. Disable privacy if you want:

- Message capture for chat sync
- Question-heuristic triggers on all messages

### Optional BotFather settings

| Setting | Recommendation |
|---------|----------------|
| `/setjoingroups` | Enable if you want the bot addable to groups |
| `/setdescription` | Short description for members |
| `/setabouttext` | Link to help or community rules |

---

## Registering a group

Groups are registered automatically when:

- The bot is added to the group (`my_chat_member` event)
- Any member sends a message while the bot is present
- An admin adds the group manually: `/admin` → **Groups** → **Add by chat ID**

### Finding the group chat ID

Forward any message from the group to [@getidsbot](https://t.me/getidsbot). Supergroup IDs look like `-1001234567890`.

---

## Sync allowlist

Chat sync only processes groups in the allowlist.

1. `/admin` → **👥 Groups** → select group
2. Tap **▶️ Enable sync**

Or from **🔄 Chat sync** → **Register this group** (when `/admin` is open inside the group).

Per-group `syncEnabled` in settings stays in sync with the global allowlist.

---

## Trigger configuration

`/admin` → **Groups** → group → **⚙️ Group settings**

| Trigger | Default | When to enable |
|---------|---------|----------------|
| @mention | On | Always — primary interaction |
| Reply to bot | On | Follow-up questions in threads |
| Question heuristic | Off | Noisy groups — detects `?`, "how", "where", etc. |

**Rate limits** (defaults): 30s cooldown, 20 replies/hour per group.

---

## Expert persona and topic

Set per group in **Group settings**:

- **Topic** — one line describing the community ("Cycling club in Berlin")
- **Persona** — instructions for answer tone ("You are a helpful volunteer moderator for…")

These are passed to the AI client in the RAG orchestrator.

---

## Capture vs sync

| Feature | What it does |
|---------|--------------|
| **Capture** | Stores each group message in PostgreSQL |
| **Sync** | Periodically chunks captured messages and sends to RAG ingest API |

Both require:

- Global chat ingestion enabled (`/admin` → **Chat sync**)
- Group in sync allowlist
- Per-group capture/sync flags enabled

---

## Multi-group deployments

Each group has an isolated knowledge scope (`chatId` on every RAG query). One bot instance can serve many communities with different settings and moderators.