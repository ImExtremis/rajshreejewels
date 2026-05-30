#!/bin/bash
# Emergency admin password reset
# Usage: bash scripts/reset-admin-password.sh <email> <new-password>
# Example: bash scripts/reset-admin-password.sh owner@store.com newpassword123

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

echo "Resetting password for: $EMAIL"

# Generate bcrypt hash inside the backend container (has bcryptjs installed)
HASH=$(docker compose exec -T backend node -e "
const bcrypt = require('bcryptjs');
bcrypt.hash('${NEW_PASSWORD}', 12).then(h => process.stdout.write(h));
")

# Update in database
docker compose exec -T postgres psql -U ${DB_USER:-jewellery_user} -d jewellery_store -c \
  "UPDATE \"User\" SET \"passwordHash\" = '${HASH}' WHERE email = '${EMAIL}';"

echo "✅ Password reset successful for $EMAIL"
echo "All existing sessions will be invalidated on next login attempt."
