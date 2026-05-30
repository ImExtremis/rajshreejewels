#!/bin/bash
# ===========================================
# Rajshree Jewels — Docker Maintenance Script
# ===========================================
# Usage:
#   bash scripts/maintain.sh                    — standard restart
#   bash scripts/maintain.sh --rebuild          — rebuild all containers
#   bash scripts/maintain.sh --rebuild --no-cache  — full clean rebuild
#   bash scripts/maintain.sh --migrate          — run DB migrations only
#   bash scripts/maintain.sh --logs             — tail all logs
#   bash scripts/maintain.sh --status           — show container status + health
#   bash scripts/maintain.sh --stop             — stop all containers
#   bash scripts/maintain.sh --clean            — remove stopped containers + unused images
#   bash scripts/maintain.sh --full-reset       — nuclear option: wipe and rebuild everything (keeps DB data)

set -e

REBUILD=false
NO_CACHE=false
MIGRATE=false
LOGS=false
STATUS=false
STOP=false
CLEAN=false
FULL_RESET=false

for arg in "$@"; do
  case $arg in
    --rebuild) REBUILD=true ;;
    --no-cache) NO_CACHE=true ;;
    --migrate) MIGRATE=true ;;
    --logs) LOGS=true ;;
    --status) STATUS=true ;;
    --stop) STOP=true ;;
    --clean) CLEAN=true ;;
    --full-reset) FULL_RESET=true ;;
  esac
done

echo ""
echo "🔧 Rajshree Jewels — Docker Maintenance"
echo "======================================="
echo ""

# STATUS only
if [ "$STATUS" = true ]; then
  echo "=== Container Status ==="
  docker compose ps
  echo ""
  echo "=== Health Check ==="
  curl -s http://localhost:4000/api/v1/health | python3 -m json.tool 2>/dev/null || echo "Backend not responding"
  exit 0
fi

# LOGS only
if [ "$LOGS" = true ]; then
  echo "Tailing all logs (Ctrl+C to exit)..."
  docker compose logs -f --tail=50
  exit 0
fi

# STOP
if [ "$STOP" = true ]; then
  echo "Stopping all containers..."
  docker compose down
  echo "✅ All containers stopped."
  exit 0
fi

# CLEAN
if [ "$CLEAN" = true ]; then
  echo "Cleaning stopped containers and unused images..."
  docker compose down --remove-orphans
  docker image prune -f
  docker volume prune -f
  echo "✅ Cleanup complete."
  exit 0
fi

# FULL RESET — nuclear option
if [ "$FULL_RESET" = true ]; then
  echo "⚠️  FULL RESET — this will wipe all containers and images."
  echo "    Database DATA will be preserved (./data/postgres is safe)."
  read -p "    Type 'yes' to confirm: " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    exit 0
  fi
  echo "Stopping and removing everything..."
  docker compose down --rmi all --remove-orphans
  echo "Rebuilding from scratch..."
  docker compose build --no-cache
  docker compose up -d
  sleep 20
  bash scripts/run-migrations.sh
  echo "✅ Full reset complete."
  exit 0
fi

# MIGRATE only
if [ "$MIGRATE" = true ] && [ "$REBUILD" = false ]; then
  bash scripts/run-migrations.sh
  exit 0
fi

# REBUILD
if [ "$REBUILD" = true ]; then
  echo "Taking down running containers..."
  docker compose down

  if [ "$NO_CACHE" = true ]; then
    echo "Building with --no-cache (this takes 5-10 minutes)..."
    docker compose build --no-cache
  else
    echo "Building (using cache where possible)..."
    docker compose build
  fi
else
  echo "Restarting containers (no rebuild)..."
fi

echo "Starting all containers..."
docker compose up -d

echo "Waiting for services to be healthy..."
sleep 15

# Run migrations if --migrate flag or if rebuilding
if [ "$MIGRATE" = true ] || [ "$REBUILD" = true ]; then
  echo "Running database migrations..."
  bash scripts/run-migrations.sh
fi

echo "Restarting Nginx..."
docker compose restart nginx
sleep 3

echo ""
echo "=== Final Status ==="
docker compose ps

echo ""
echo "=== Health Check ==="
curl -s http://localhost:4000/api/v1/health | python3 -m json.tool 2>/dev/null || echo "⚠️  Backend not responding yet — wait 10s and check manually"

echo ""
echo "✅ Maintenance complete."
echo ""
echo "Storefront: http://localhost"
echo "Admin:      http://localhost:8080"
echo "Health:     http://localhost:4000/api/v1/health"
