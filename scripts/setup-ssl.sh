#!/bin/bash
# -----------------------------------------------------------------------------
# Rajshree Jewels — Production SSL Setup Script (Certbot & Let's Encrypt)
# -----------------------------------------------------------------------------
set -e

# Load environment variables if available
if [ -f ../.env ]; then
  export $(grep -v '^#' ../.env | xargs)
fi

DOMAIN=${STORE_DOMAIN:-"rajshreejewels.com"}
EMAIL=${SMTP_USER:-"admin@rajshreejewels.com"}

echo "====================================================================="
echo "🔒 OPTION 1: Automatic Certbot Let's Encrypt Installation"
echo "====================================================================="
echo "Target Domain: $DOMAIN"
echo "Admin Email: $EMAIL"
echo "--------------------------------------------------------------------="

# Check if Certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "⚠️ Certbot not found. Installing certbot..."
    sudo apt-get update
    sudo apt-get install -y certbot python3-certbot-nginx
fi

# Requesting Certificate
echo "🔄 Initiating Certbot request for $DOMAIN and api.$DOMAIN..."
# Adjust Nginx configuration path or run in standalone/webroot mode
sudo certbot --nginx -d "$DOMAIN" -d "api.$DOMAIN" --non-interactive --agree-tos --email "$EMAIL" --redirect

echo "====================================================================="
echo "🔑 OPTION 2: Cloudflare Origin Certificates (Recommended for Tunnels)"
echo "====================================================================="
echo "If utilizing Cloudflare Tunnels (setup-tunnel.sh), you do NOT need to"
echo "run Certbot locally. Cloudflare manages SSL automatically at the edge."
echo ""
echo "However, if you want full End-to-End SSL encryption (Strict Mode),"
echo "generate an Origin Certificate from Cloudflare Dashboard:"
echo "  1. Go to SSL/TLS > Origin Server"
echo "  2. Click 'Create Certificate'"
echo "  3. Save private key as: /etc/ssl/certs/rajshree-origin.key"
echo "  4. Save certificate as: /etc/ssl/certs/rajshree-origin.pem"
echo "  5. Ensure proper ownership permissions:"
echo "     sudo chmod 600 /etc/ssl/certs/rajshree-origin.key"
echo "====================================================================="

echo "✅ SSL Configuration check completed successfully!"
