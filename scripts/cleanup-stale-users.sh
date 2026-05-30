#!/bin/bash
# Removes unverified users with no orders who registered more than 24 hours ago
# Safe to run during development to clean test data

source .env 2>/dev/null

docker compose exec -T postgres psql -U ${DB_USER:-postgres} -d jewellery_store -c "
DELETE FROM \"User\"
WHERE \"isVerified\" = false
AND \"createdAt\" < NOW() - INTERVAL '24 hours'
AND id NOT IN (SELECT DISTINCT \"userId\" FROM \"Order\" WHERE \"userId\" IS NOT NULL);
"
echo "✅ Stale unverified users cleaned."
