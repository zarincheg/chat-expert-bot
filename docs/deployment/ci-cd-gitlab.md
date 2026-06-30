# CI/CD — GitLab

Playbook for testing and deploying the bot with GitLab CI/CD.

## Pipeline file

`.gitlab-ci.yml` — stages: **test** → **build** → **deploy**

## Required CI/CD variables

**Settings → CI/CD → Variables** (masked + protected):

| Variable | Description |
|----------|-------------|
| `BOT_TOKEN` | Telegram bot token |
| `ADMIN_USER_IDS` | Admin Telegram user IDs |
| `POSTGRES_PASSWORD` | Production database password |
| `CI_REGISTRY_USER` | GitLab registry user (auto for built-in) |
| `CI_REGISTRY_PASSWORD` | GitLab registry token |

**Deploy stage (SSH):**

| Variable | Description |
|----------|-------------|
| `DEPLOY_SSH_KEY` | Private key (file type variable) |
| `DEPLOY_HOST` | Target server hostname |
| `DEPLOY_USER` | SSH user |
| `DEPLOY_PATH` | Remote directory |

Optional RAG variables: `RAG_QUERY_URL`, `RAG_INGEST_URL`, `RAG_*_API_KEY`

---

## Stage: test

Runs on merge requests and `main`:

- `npm ci`
- Postgres service (`postgres:16-alpine`)
- `prisma migrate deploy` + seed
- `npm run test` + `npm run build`

---

## Stage: build

Runs on `main` and tags:

- `docker build` with GitLab Container Registry
- Push `$CI_REGISTRY_IMAGE:$CI_COMMIT_SHA`
- Push `$CI_REGISTRY_IMAGE:latest` on `main`
- Push `$CI_REGISTRY_IMAGE:$CI_COMMIT_TAG` on tags

---

## Stage: deploy

Runs on **tags only** (`v1.0.0`, …) or manual on `main`:

1. SSH to production server
2. Render `.env.prod` from CI variables
3. `docker compose pull && up -d`
4. Tail logs for startup confirmation

### Protect production

- Enable **protected branches** for `main`
- Enable **protected tags** for `v*`
- Mark deploy variables as **protected**

---

## Server setup (one time)

```bash
# VPS with Docker
curl -fsSL https://get.docker.com | sh
mkdir -p /opt/telegram-rag-bot
```

Copy `docker-compose.prod.yml` to the server or let deploy job clone the repo.

---

## Manual pipeline run

**CI/CD → Pipelines → Run pipeline** on `main` with `DEPLOY_MANUAL=true` (if configured).

---

## Rollback

```bash
# On server
export BOT_IMAGE=registry.gitlab.com/group/telegram-rag-bot:v1.0.0
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

---

## Self-hosted GitLab Runner (optional)

For deploy jobs that must reach a private network:

```toml
# /etc/gitlab-runner/config.toml
[[runners]]
  executor = "docker"
  [runners.docker]
    privileged = false
    volumes = ["/var/run/docker.sock:/var/run/docker.sock"]
```

Tag deploy job with `self-hosted`.

---

## Comparison with GitHub

| Feature | GitLab | GitHub |
|---------|--------|--------|
| Registry | Built-in Container Registry | GHCR |
| Environments | GitLab Environments UI | GitHub Environments |
| Manual deploy | `when: manual` | `workflow_dispatch` |

---

## See also

- [Docker Deployment](docker.md)
- [Production Checklist](production-checklist.md)
- `.gitlab-ci.yml` in repo root