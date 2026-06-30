# Quick Start for Group Admins

This guide is for **community owners and admins** who want to use the bot in a Telegram group. No coding required.

## What you get

- Answers to member questions from your group's knowledge base
- Per-group settings (tone, triggers, capture)
- Moderators who can promote good human answers into the knowledge base
- Admin panel in DM to manage everything via buttons

> **Note:** Without an external RAG/AI service, the bot runs in **mock mode** — useful for testing workflows. Connect `RAG_QUERY_URL` and replace the AI client for production-quality answers.

---

## Step 1 — Create the bot (one time)

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/newbot`, follow prompts, save the **bot token**.
3. Send `/setprivacy` → select your bot → **Disable** (so the bot can read group messages for capture and triggers).

Give the token and your Telegram user ID to whoever deploys the service (or use the [Docker deployment](../deployment/docker.md) guide yourself).

## Step 2 — Get your Telegram user ID

Message [@userinfobot](https://t.me/userinfobot) or [@getidsbot](https://t.me/getidsbot). Your deployer must add this ID to `ADMIN_USER_IDS`.

## Step 3 — Add the bot to your group

1. Add the bot as a **member** (admin rights optional but recommended).
2. The bot auto-registers the group when it sees a message.

## Step 4 — Open admin panel (in DM)

1. Open a **private chat** with the bot.
2. Send `/admin`.
3. You should see the **Admin Panel** with inline buttons.

> Always use `/admin` in **DM**, not in the group — keeps configuration private.

## Step 5 — Enable your group

1. Tap **👥 Groups** → select your group.
2. Tap **▶️ Enable sync** to add the group to the chat sync allowlist.
3. Open **⚙️ Group settings** and confirm:
   - **RAG** is on
   - **Capture** is on (if you want message history stored)
   - Triggers: **@mention** and **Reply to bot** (defaults)

## Step 6 — Add knowledge

Choose one or more:

| Method | How |
|--------|-----|
| **Data sources** | `/admin` → **📚 Data sources** → add URL/FILE/MANUAL → **Ingest now** |
| **Chat sync** | `/admin` → **🔄 Chat sync** → enable sync → **Run sync now** |
| **Community promote** | Moderator replies `/promote` to a good answer → approve in `/mod` or `/admin` → **Community** |

## Step 7 — Test in the group

| Action | Example |
|--------|---------|
| Mention the bot | `@your_bot When is standup?` |
| Command | `/ask When is standup?` |
| Reply to bot | Reply to any bot message with a follow-up question |

---

## Add moderators (recommended)

Moderators can promote and approve community answers without full admin access.

1. `/admin` → **👥 Groups** → your group → **👮 Moderators**
2. Tap **➕ Add moderator** → send their Telegram user ID
3. They use `/mod` in DM to review pending answers

See [Moderation](moderation.md) for the full workflow.

---

## Common issues

| Problem | Fix |
|---------|-----|
| Bot doesn't see group messages | Disable Group Privacy in BotFather (`/setprivacy`) |
| `/admin` says not authorized | Your user ID must be in `ADMIN_USER_IDS` |
| Bot never replies in group | Check group **RAG** is on in Group settings; mention `@botname` or use `/ask` |
| No knowledge in answers | Add data sources or run chat sync; or enable `RAG_FALLBACK_LOCAL` for dev FAQ chunks |

---

## Next steps

- [Features](features.md) — full capability list
- [Group Setup](group-setup.md) — triggers, persona, sync details
- [Moderation](moderation.md) — `/promote` and `/mod` workflow