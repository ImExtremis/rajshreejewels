#!/bin/bash
# -----------------------------------------------------------------------------
# Rajshree Jewels — Cloudflare Tunnel Setup (Securing Nginx & Storefront)
# -----------------------------------------------------------------------------
set -e

# Load environment variables
if [ -f ../.env ]; then
  export $(grep -v '^#' ../.env | xargs)
fi

TUNNEL_NAME=${CF_TUNNEL_NAME:-"rajshree-jewels-tunnel"}
DOMAIN=${STORE_DOMAIN:-"rajshreejewels.com"}

echo "====================================================================="
echo "☁️ Cloudflare Tunnel Automation & DNS Config"
echo "====================================================================="
echo "Tunnel Name: $TUNNEL_NAME"
echo "Public Domain: $DOMAIN"
echo "---------------------------------------------------------------------"

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "📥 Installing cloudflared daemon..."
    curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i cloudflared.deb
    rm cloudflared.deb
fi

echo "🔑 Step 1: Logging in to Cloudflare..."
echo "Please click the link in your terminal to authorise cloudflared."
cloudflared tunnel login

echo "🛠️ Step 2: Creating Tunnel: $TUNNEL_NAME..."
# Check if tunnel already exists or create new
if cloudflared tunnel list | grep -q "$TUNNEL_NAME"; then
    echo "ℹ️ Tunnel $TUNNEL_NAME already exists."
else
    cloudflared tunnel create "$TUNNEL_NAME"
fi

TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
echo "✅ Resolved Tunnel ID: $TUNNEL_ID"

echo "📝 Step 3: Configuring Local Ingress Rules..."
# Create configuration directory
mkdir -p ~/.cloudflared

cat <<EOF > ~/.cloudflared/config.yml
tunnel: $TUNNEL_ID
credentials-file: /home/$USER/.cloudflared/$TUNNEL_ID.json

ingress:
  # Route Storefront Traffic to Nginx (Port 80/443 SSL termination)
  - hostname: $DOMAIN
    service: http://localhost:80
  
  # Route API Traffic to Nginx Port 80 / backend directly
  - hostname: api.$DOMAIN
    service: http://localhost:4000

  # Default Catch-all (Respond with 404 to non-matching hostnames)
  - service: http_status:404
EOF

echo "✓ Local ingress configuration written to ~/.cloudflared/config.yml"

echo "🌐 Step 4: Routing DNS records..."
cloudflared tunnel route dns "$TUNNEL_NAME" "$DOMAIN"
cloudflared tunnel route dns "$TUNNEL_NAME" "api.$DOMAIN"

echo "⚙️ Step 5: Installing Tunnel as a Linux Systemd Service..."
sudo cloudflared --config ~/.cloudflared/config.yml service install

echo "🚀 Step 6: Starting systemd service..."
sudo systemctl enable cloudflared
sudo systemctl start cloudflared

echo "====================================================================="
echo "🔒 ADMIN PANEL NOTICE:"
echo "As per security rules, the admin panel is NOT exposed on the public"
echo "Cloudflare Tunnel. It operates exclusively on port 3001 via local"
echo "Nginx server subnet guards."
echo "====================================================================="
echo "✅ Cloudflare Tunnel setup successfully completed!"
