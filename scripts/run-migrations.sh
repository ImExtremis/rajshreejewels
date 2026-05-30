#!/bin/bash
set -e

echo "Waiting for postgres to be ready..."
until docker compose exec postgres pg_isready -U ${DB_USER:-postgres} -d jewellery_store 2>/dev/null; do
  echo "Postgres not ready yet — retrying in 3s..."
  sleep 3
done

echo "Running Prisma migrations inside backend container..."
docker compose exec backend npx prisma migrate deploy

echo "✅ Migrations complete."
