# Decision Log

Living record of product and technical decisions. Update when you confirm or change direction.

---

## Confirmed (Phases A–D — 2026-06-30)

| # | Topic | Decision |
|---|-------|----------|
| D-1 | RAG query vs ingest URL | Separate `RAG_QUERY_URL` / `RAG_INGEST_URL` |
| D-2 | Per-group KB isolation | Required `chatId` on every query |
| D-3 | Local KnowledgeChunk fallback | Dev only (`RAG_FALLBACK_LOCAL`) |
| D-4 | URL ingestion depth | Simple HTML strip v1 |
| D-5 | Promote permissions | **Per-group moderators** + global admins |
| D-6 | Question heuristic default | Off per group |
| D-7 | Community approval | CANDIDATE → APPROVED workflow |
| D-8 | Admin session in conversations | Pass mode as entry arg, not `ctx.session` |
| D-9 | Production deploy | Docker Compose + GitHub/GitLab CI/CD |

---

## Confirmed (Phases E–J — 2026-06-30)

| ID | Decision |
|----|----------|
| E-1 | Supergroups + linked discussion groups (not broadcast channels) |
| E-2 | Restrict first; ban on high trust score / severe rules |
| E-3 | Trust API timeout → **restrict** |
| E-4 | Default newcomer grace **24h** |
| E-5 | Keyword rules on first message within join window |
| E-6 | Violation → **silent delete** + log |
| E-7 | Newcomer rate limit **5 msg/hour** during grace |
| E-8 | Substring keywords v1 |
| E-9 | Nickname check: first_name, last_name, username |
| E-10 | Trust thresholds: restrict ≥ 50, ban ≥ 80 |
| E-11 | Global + per-group access lists |
| E-12 | Welcome image via URL v1; web upload in dashboard |
| E-13 | Welcome posted **in group** |
| E-14 | Delete join service message when possible |
| E-15 | **Auth.js** with Telegram Login |
| E-16 | Web access **admins only** (`ADMIN_USER_IDS`) |
| E-17 | Keep Telegram `/admin` as mobile fallback |
| E-18 | React + Vite in `web/` |
| E-19 | Ship **web together** with moderation backend (E–J parallel) |
| E-20 | Stats retention 90 days detail |
| E-21 | v1 stats: joins, bans, questions, newcomer violations (tables) |

## Open — Moderation & Web (Phases E–J)

> All E-1–E-21 resolved 2026-06-30. See confirmed table above.

### Scope & target

| ID | Question | Options | Proposal |
|----|----------|---------|----------|
| **E-1** | What does "channel" mean for you? | (a) Supergroup (b) Linked discussion group (c) Broadcast channel | **(a) + (b)** — not broadcast-only |
| **E-2** | Primary punishment ladder? | (a) delete msg only (b) restrict (c) ban | **(b) restrict first**, ban on repeat / high trust score |
| **E-3** | Trust API timeout on join | (a) allow (b) restrict (c) ban | **(b) restrict** until manual review |

### Newcomer policy

| ID | Question | Options | Proposal |
|----|----------|---------|----------|
| **E-4** | Default grace period? | 0h / 1h / 24h / 72h | **24h** restrict links+media; text allowed |
| **E-5** | "First message" for keyword rules | (a) First ever in group (b) First N after join (c) First within X hours | **(a) first ever** + **(c) within 24h** optional |
| **E-6** | Violation handling | (a) delete silently (b) delete + DM warn (c) delete + public warn | **(a) delete** + log; optional warn in v2 |
| **E-7** | Newcomer rate limit | Messages per hour | Default **5/hour** during grace |

### Auto-ban rules

| ID | Question | Options | Proposal |
|----|----------|---------|----------|
| **E-8** | Keyword matching | (a) substring (b) regex (c) both | **(a) substring** v1; regex in web UI v2 |
| **E-9** | Nickname rules | Check `first_name`, `last_name`, `username` | **All three** |
| **E-10** | Trust score thresholds | block / restrict | Default **block ≥ 80**, **restrict ≥ 50** |
| **E-11** | Lists scope | Global lists apply to all groups? | **Yes** global + per-group override |

### Welcome message

| ID | Question | Options | Proposal |
|----|----------|---------|----------|
| **E-12** | Image source | (a) URL (b) upload via web → Telegram file_id (c) file_id in config | **(b) web upload** via bot API in Phase J; URL in H |
| **E-13** | Welcome target | (a) DM new member (b) post in group | **(b) group** (DM may fail if user hasn't started bot) |
| **E-14** | Delete "X joined" service message? | yes / no | **yes** when bot can delete |

### Web admin

| ID | Question | Options | Proposal |
|----|----------|---------|----------|
| **E-15** | Auth method | (a) API key only (b) Password + API key (c) Telegram Login Widget | **(a) API key** v1; **(c)** in J.1 if you want |
| **E-16** | Who can access web? | Admins only / admins + mods | **Admins only** v1; mod-scoped views v2 |
| **E-17** | Keep Telegram `/admin`? | yes / deprecate | **yes** — mobile fallback |
| **E-18** | Frontend preference | React / Svelte / none (API only first) | **React + Vite** in `web/` |
| **E-19** | Ship order | (a) E–H bot-only then I–J (b) full stack per phase | **(a)** — usable moderation before web |

### Stats

| ID | Question | Options | Proposal |
|----|----------|---------|----------|
| **E-20** | Stats retention | 30 / 90 / 365 days | **90 days** detail; daily rollups kept 1 year |
| **E-21** | Must-have charts for v1 | list | Joins, bans, questions, newcomer violations (tables OK) |

---

## Deferred / future (Phase K+)

| ID | Topic | Notes |
|----|-------|-------|
| K-1 | Captcha unlock | Button press to lift newcomer restrict |
| K-2 | Appeal flow | User DM bot → mod queue |
| K-3 | Rule templates | Import spam word packs |
| K-4 | Webhook mode | Replace long-polling for scale |
| K-5 | Redis rate limits | Multi-replica bot |

---

## Change log

| Date | Change |
|------|--------|
| 2026-06-30 | Created decision log; added open questions E-1–E-21 for moderation + web phases |
| 2026-06-30 | Confirmed A–D decisions (imported from PRODUCT-PLAN) |