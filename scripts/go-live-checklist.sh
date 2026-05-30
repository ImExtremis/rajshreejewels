#!/bin/bash
# -----------------------------------------------------------------------------
# Rajshree Jewels — Go-Live Production Verification & Diagnostics Checklist
# -----------------------------------------------------------------------------
set -e

# Load configurations
BACKEND_URL="http://localhost:4000"
STOREFRONT_URL="http://localhost:3000"

echo "====================================================================="
echo "💎 Rajshree Jewels — Go-Live Production Verification Suite"
echo "====================================================================="

# Helper function to print pass/fail statuses
print_status() {
  if [ "$2" = "PASS" ]; then
    echo -e "  [✅ PASS] $1"
  else
    echo -e "  [❌ FAIL] $1"
  fi
}

# 1. Storefront Reachability Check
echo "🔍 1. Storefront (Next.js) Health Checks..."
if storefront_code=$(curl -s -o /dev/null -w "%{http_code}" "$STOREFRONT_URL/"); then
  if [ "$storefront_code" -eq 200 ]; then
    print_status "Storefront homepage resolves to Status 200 (HTTP OK)" "PASS"
  else
    print_status "Storefront homepage returned status code: $storefront_code" "FAIL"
  fi
else
  print_status "Failed to reach Next.js storefront server at $STOREFRONT_URL" "FAIL"
fi

# 2. Backend Health Checks (DB & Redis)
echo "🔍 2. Express Backend Health Endpoint Checks..."
if backend_health=$(curl -s "$BACKEND_URL/health"); then
  db_status=$(echo "$backend_health" | grep -o '"db":"[^"]*"' | cut -d':' -f2 | tr -d '"')
  redis_status=$(echo "$backend_health" | grep -o '"redis":"[^"]*"' | cut -d':' -f2 | tr -d '"')
  
  if [ "$db_status" = "ok" ]; then
    print_status "PostgreSQL connection pool assertion: CONNECTED" "PASS"
  else
    print_status "PostgreSQL connection status: DEGRADED" "FAIL"
  fi

  if [ "$redis_status" = "ok" ]; then
    print_status "Redis connection assertion: ACTIVE" "PASS"
  else
    print_status "Redis connection status: DISCONNECTED / FAIL" "FAIL"
  fi
else
  print_status "Failed to reach backend health endpoint at $BACKEND_URL/health" "FAIL"
fi

# 3. Environment Assertions & Configurations
echo "🔍 3. Environment Variable Security Checks..."
# Checking for standard .env file presence
if [ -f "../.env" ]; then
  print_status "Production .env configuration file exists" "PASS"
  
  # Check secret length validations
  JWT_SECRET_LEN=$(grep "^JWT_SECRET=" ../.env | cut -d'=' -f2 | tr -d '"' | tr -d '\r' | wc -c || echo 0)
  if [ "$JWT_SECRET_LEN" -ge 32 ]; then
    print_status "JWT_SECRET cryptographic entropy verified (>= 32 chars)" "PASS"
  else
    print_status "JWT_SECRET token is too weak (< 32 characters)!" "FAIL"
  fi
else
  print_status "No .env configuration file found!" "FAIL"
fi

# 4. Port Accessibility Validation
echo "🔍 4. Security Port Restrictions..."
# Warning admin panel ports should remain hidden
echo "  [⚠️ WARNING] Verify that Nginx Port 3001 is BLOCKED on public firewalls."
echo "              Access to Port 3001 must be routed strictly via local VPNs"
echo "              or secure private subnets (allow 192.168.0.0/16)."

echo "====================================================================="
echo "🎉 Diagnostic verification complete. Review fail states before ship!"
echo "====================================================================="
