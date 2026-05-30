#!/bin/bash
# -----------------------------------------------------------------------------
# Rajshree Jewels — Storefront & API Performance Load-Testing Script
# -----------------------------------------------------------------------------
set -e

# Load settings
TARGET_URL=${1:-"http://localhost:3000"}
API_URL=${2:-"http://localhost:4000/api/v1"}

echo "====================================================================="
echo "⚡ Performance & Load-Testing Suite using wrk / curl"
echo "====================================================================="
echo "Target Storefront URL : $TARGET_URL"
echo "Target API Base URL   : $API_URL"
echo "---------------------------------------------------------------------"

# Check if wrk is installed
if ! command -v wrk &> /dev/null; then
    echo "⚠️ Load-testing tool 'wrk' not found on system path."
    echo "To install wrk:"
    echo "  - Linux (Ubuntu/Debian): sudo apt install wrk"
    echo "  - MacOS: brew install wrk"
    echo ""
    echo "Falling back to running high-frequency curl latency check..."
    
    echo "⏱️ Testing 10 sequential storefront requests for latency..."
    for i in {1..10}; do
        latency=$(curl -o /dev/null -s -w "%{time_starttransfer}\n" "$TARGET_URL")
        echo "  Request #$i: Time-to-First-Byte = ${latency}s"
        sleep 0.1
    done
    exit 0
fi

# Storefront SSR Route load test (moderate load)
echo "🚀 Run 1: Load testing storefront home page (12 threads, 400 connections, 10s)..."
wrk -t12 -c400 -d10s "$TARGET_URL/"

echo "---------------------------------------------------------------------"

# Storefront shop catalog route load test (simulate real search/browse query requests)
echo "🚀 Run 2: Load testing shop catalog listing (12 threads, 200 connections, 10s)..."
wrk -t12 -c200 -d10s "$TARGET_URL/shop"

echo "---------------------------------------------------------------------"

# API Products GET route load test
echo "🚀 Run 3: Load testing API Products endpoint (8 threads, 100 connections, 10s)..."
wrk -t8 -c100 -d10s "$API_URL/products"

echo "====================================================================="
echo "✅ Load test completed successfully!"
