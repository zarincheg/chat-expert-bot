# CI/CD — GitHub Actions

Playbook for testing and deploying the bot with GitHub Actions.

## Workflows

| File | Trigger | Purpose |
|------|---------|---------|
| `.github/workflows/ci.yml` | Push / PR to `main` | Test + build |
| `.github/workflows/deploy.yml` | Tag `v*` or manual | Build image + deploy |

## CI pipeline (`ci.yml`)

Runs on every push and pull request:

1. Checkout code
2. Setup Node.js 20
3. `npm ci`
4. Start Postgres service container
5. `prisma migrate deploy` + `db:seed`
6. `npm run test`
7. `npm run build`
8. `docker build` (verify Dockerfile)

No secrets required for CI except none — uses ephemeral Postgres.

---

## Deploy pipeline (`deploy.yml`)

### Prerequisites

Configure **GitHub repository secrets**:

| Secret | Description |
|--------|-------------|
| `BOT_TOKEN` | Telegram bot token |
| `ADMIN_USER_IDS` | Admin Telegram IDs |
| `POSTGRES_PASSWORD` | Production DB password |
| `DEPLOY_HOST` | SSH hostname (if using SSH deploy) |
| `DEPLOY_USER` | SSH user |
| `DEPLOY_SSH_KEY` | Private SSH key |
| `DEPLOY_PATH` | Remote path with `docker-compose.prod.yml` |

Optional:

| Secret | Description |
|--------|-------------|
| `RAG_QUERY_URL` | External query API |
| `RAG_INGEST_URL` | External ingest API |
| `RAG_QUERY_API_KEY` | Query API key |
| `RAG_INGEST_API_KEY` | Ingest API key |

### Registry deploy (GHCR)

The workflow pushes to `ghcr.io/<owner>/telegram-rag-bot:<tag>`.

Enable **Settings → Actions → General → Workflow permissions → Read and write**.

### Triggers

- **Automatic:** push tag `v1.0.0`, `v1.0.1`, …
- **Manual:** Actions → Deploy → Run workflow

### Deploy steps

1. Run CI checks
2. Build and push Docker image
3. SSH to server (or use self-hosted runner)
4. Write `.env.prod` from secrets
5. `docker compose pull && docker compose up -d`
6. Verify bot logs

---

## Server setup (one time)

```bash
# On your VPS
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER

mkdir -p ~/telegram-rag-bot
# Copy docker-compose.prod.yml or clone repo
```

---

## Manual deploy without CI

```bash
git clone <repo> && cd telegram-rag-bot
cp .env.prod.example .env.prod
# edit secrets
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

---

## Rollback

```bash
# On server
export BOT_IMAGE=ghcr.io/owner/telegram-rag-bot:v1.0.0
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

Restore DB from backup if a migration caused issues.

---

## Environment-specific branches

| Branch | Deploy target |
|--------|---------------|
| `main` | CI only |
| `v*` tags | Production |
| `staging` | Optional — duplicate workflow with `DEPLOY_*_STAGING` secrets |

---

## See also

- [Docker Deployment](docker.md)
- [Production Checklist](production-checklist.md)
- Workflow files in `.github/workflows/`