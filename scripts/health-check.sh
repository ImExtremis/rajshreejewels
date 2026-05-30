#!/bin/bash
# scripts/health-check.sh
# Checks port status, database, Redis cache, and public endpoint health.

# Color variables for rich formatting
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}🔍 System Health & Connectivity Diagnostics   ${NC}"
echo -e "${CYAN}=============================================${NC}"

# 1. Check Infrastructure Ports
check_port() {
  local service_name=$1
  local port=$2
  
  if command -v nc &> /dev/null; then
    if nc -z localhost "$port" 2>/dev/null; then
      echo -e "[${GREEN}ONLINE${NC}] $service_name is listening on port $port."
      return 0
    else
      echo -e "[${RED}OFFLINE${NC}] $service_name is unreachable on port $port!"
      return 1
    fi
  else
    # Fallback to pure bash sockets if nc is missing
    if (echo > /dev/tcp/127.0.0.1/"$port") &>/dev/null; then
      echo -e "[${GREEN}ONLINE${NC}] $service_name is listening on port $port."
      return 0
    else
      echo -e "[${RED}OFFLINE${NC}] $service_name is unreachable on port $port!"
      return 1
    fi
  fi
}

echo -e "\n${CYAN}--- Step 1: Checking Infrastructure Ports ---${NC}"
FAILED_PORTS=0
check_port "PostgreSQL Database" 5432 || FAILED_PORTS=$((FAILED_PORTS + 1))
check_port "Redis Cache Engine" 6379 || FAILED_PORTS=$((FAILED_PORTS + 1))
check_port "Express Backend API" 4000 || FAILED_PORTS=$((FAILED_PORTS + 1))
check_port "Next.js Storefront" 3000 || FAILED_PORTS=$((FAILED_PORTS + 1))
check_port "Next.js Admin Panel" 3001 || FAILED_PORTS=$((FAILED_PORTS + 1))

# 2. Verify API response
echo -e "\n${CYAN}--- Step 2: Querying HTTP Endpoint Status ---${NC}"
if command -v curl &> /dev/null; then
  # Check backend root or setup status
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/v1/admin/setup/status || echo "ERR")
  
  if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "[${GREEN}SUCCESS${NC}] Backend Setup status endpoint replied HTTP 200."
  elif [ "$HTTP_STATUS" = "ERR" ]; then
    echo -e "[${RED}FAILED${NC}] Failed to reach Backend API endpoint."
  else
    echo -e "[${YELLOW}WARNING${NC}] Backend API responded with unexpected status: $HTTP_STATUS."
  fi
  
  # Check storefront homepage
  FE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ || echo "ERR")
  if [ "$FE_STATUS" = "200" ]; then
    echo -e "[${GREEN}SUCCESS${NC}] Next.js Storefront is rendering pages (HTTP 200)."
  elif [ "$FE_STATUS" = "ERR" ]; then
    echo -e "[${RED}FAILED${NC}] Storefront Next.js App is unreachable."
  else
    echo -e "[${YELLOW}WARNING${NC}] Next.js Storefront responded with status: $FE_STATUS."
  fi
else
  echo -e "${YELLOW}⚠️ 'curl' not found. Skipping HTTP requests.${NC}"
fi

echo -e "\n${CYAN}=============================================${NC}"
if [ $FAILED_PORTS -eq 0 ]; then
  echo -e "${GREEN}✓ All core processes and ports are healthy!${NC}"
  exit 0
else
  echo -e "${RED}❌ Diagnostics failed! Some services are offline.${NC}"
  exit 1
fi
