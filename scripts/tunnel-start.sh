#!/bin/bash
# scripts/tunnel-start.sh
# Automated startup script for Cloudflare Secure Tunnel public exposure

set -e

# Load environment variables if .env file exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "============================================="
echo "☁️  Initializing Cloudflare Secure Tunnel"
echo "============================================="

# 1. Verify cloudflared binary is installed
if ! command -v cloudflared &> /dev/null; then
  echo "❌ Error: 'cloudflared' daemon is not installed on this host."
  echo "Please run 'scripts/setup-tunnel.sh' or install via cloudflared repository first."
  exit 1
fi

# 2. Check for configuration file in user home or local path
CONF_FILE="$HOME/.cloudflared/config.yml"
if [ ! -f "$CONF_FILE" ]; then
  echo "⚠️  Configuration file not found in $CONF_FILE"
  echo "Checking local path: ./nginx/tunnel-config.yml..."
  if [ -f "./nginx/tunnel-config.yml" ]; then
    CONF_FILE="./nginx/tunnel-config.yml"
  else
    echo "❌ Error: Cloudflare config.yml could not be resolved."
    exit 1
  fi
fi

echo "✓ Using configuration file: $CONF_FILE"

# 3. Startup the tunnel daemon
echo "Launching tunnel daemon process..."
if systemctl is-active --quiet cloudflared; then
  echo "✓ cloudflared is already active as a systemd service!"
  echo "To view tunnel logs: journalctl -u cloudflared -f"
else
  echo "Starting cloudflared in the background..."
  # Start the tunnel with the resolved configuration
  nohup cloudflared --config "$CONF_FILE" tunnel run > /var/log/cloudflared-tunnel.log 2>&1 &
  echo "✓ Tunnel spawned in background (PID: $!)."
  echo "Logs redirected to /var/log/cloudflared-tunnel.log."
fi

echo "============================================="
