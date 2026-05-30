#!/bin/bash
set -e

EMAIL=$1
NEW_PASSWORD=$2

if [ -z "$EMAIL" ] || [ -z "$NEW_PASSWORD" ]; then
  echo "Usage: bash scripts/reset-admin-password.sh <email> <new-password>"
  exit 1
fi

if [ ${#NEW_PASSWORD} -lt 10 ]; then
  echo "Error: Password must be at least 10 characters"
  exit 1
fi

source .env 2>/dev/null

echo "Resetting password for: $EMAIL"

HASH=$(docker compose exec -T backend node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('${NEW_PASSWORD}', 12).then(h => process.stdout.write(h));
")

docker compose exec -T postgres psql -U ${DB_USER:-postgres} -d jewellery_store -c \
  "UPDATE \"User\" SET \"passwordHash\" = '${HASH}' WHERE email = '${EMAIL}';"

echo "✅ Password reset successful for $EMAIL"
