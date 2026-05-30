#!/bin/bash
set -e

echo "Waiting for postgres to be ready..."
until docker compose exec postgres pg_isready -U ${DB_USER:-jewellery_user} -d jewellery_store; do
  echo "Postgres not ready yet — retrying in 3s..."
  sleep 3
done

echo "Running Prisma migrations inside backend container..."
docker compose exec backend npx prisma migrate deploy

echo "Seeding default settings..."
docker compose exec backend npx prisma db seed 2>/dev/null || echo "No seed script — skipping"

echo "✅ Migrations complete."
