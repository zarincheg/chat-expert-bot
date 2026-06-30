#!/bin/sh
set -e

echo "[entrypoint] applying database migrations..."
npx prisma migrate deploy

if [ "${RUN_DB_SEED:-false}" = "true" ]; then
  echo "[entrypoint] seeding database (RUN_DB_SEED=true)..."
  node dist/scripts/seed.js
fi

echo "[entrypoint] starting bot..."
exec node dist/src/index.js