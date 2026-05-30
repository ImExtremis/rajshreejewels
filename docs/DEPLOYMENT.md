# Production Deployment & Hosting Guide

This guide details the steps required to deploy and maintain the self-hosted **Rajshree Jewels** e-commerce platform in a production environment. The target architecture is designed to run efficiently on low-cost hardware such as a mini PC or Raspberry Pi 4 (4GB+) running **Ubuntu Server 22.04 LTS**.

---

## 1. Network & Public Exposure Architecture

To avoid exposing your home IP address or requiring a static IP from your ISP, we utilize **Cloudflare Tunnels**. 

```mermaid
graph TD
    Client[Web Browser / Phone] -->|HTTPS| Cloudflare[Cloudflare Edge]
    Cloudflare -->|Secure Tunnel| CFTunnel[cloudflared daemon on host]
    CFTunnel -->|HTTP| Nginx[Nginx Reverse Proxy: Port 80/443]
    Nginx -->|Proxy| FE[Next.js Storefront: Port 3000]
    Nginx -->|Proxy| BE[Express API: Port 4000]
    Nginx -->|Static Serve| HDD[/mnt/hdd/jewellery-images]
```

### Cloudflare Tunnel Setup

1. **Install cloudflared on host:**
   ```bash
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
   sudo dpkg -i cloudflared.deb
   ```

2. **Authenticate with Cloudflare:**
   ```bash
   cloudflared tunnel login
   ```

3. **Create the tunnel:**
   ```bash
   cloudflared tunnel create rajshree-store
   ```
   *(Note down the outputted Tunnel ID)*

4. **Configure the tunnel (`~/.cloudflared/config.yml`):**
   ```yaml
   tunnel: <TUNNEL_ID>
   credentials-file: /home/ubuntu/.cloudflared/<TUNNEL_ID>.json

   ingress:
     - hostname: rajshreejewels.com
       service: http://localhost:80
     - hostname: admin.rajshreejewels.com
       service: http://localhost:3001
     - service: http_status:404
   ```

5. **Install and run as a systemd service:**
   ```bash
   sudo cloudflared service install
   sudo systemctl enable --now cloudflared
   ```

---

## 2. Nginx Reverse Proxy & SSL Setup

Nginx acts as the primary SSL terminator, static asset server, and rate limiter.

### SSL Certificate via Certbot (Let's Encrypt)
Run Certbot to obtain free SSL certificates:
```bash
sudo apt update && sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d rajshreejewels.com -d admin.rajshreejewels.com
```

### Production Nginx Configuration (`/etc/nginx/nginx.conf`)
Modify your configuration to enable static image caching, custom rate-limiting, and compression.

```nginx
events { worker_connections 1024; }

http {
  include       mime.types;
  default_type  application/octet-stream;
  gzip on;
  gzip_types text/plain text/css application/json application/javascript image/svg+xml;

  # Rate limiting zones
  limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
  limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;

  server {
    listen 80;
    server_name rajshreejewels.com admin.rajshreejewels.com;
    return 301 https://$host$request_uri;
  }

  server {
    listen 443 ssl;
    server_name rajshreejewels.com;

    ssl_certificate /etc/letsencrypt/live/rajshreejewels.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rajshreejewels.com/privkey.pem;

    # Statically serve jewellery photographs directly from external HDD (Bypasses Node.js)
    location /images/products/ {
      root /mnt/hdd/jewellery-images;
      expires 30d;
      add_header Cache-Control "public, immutable";
    }

    # Backend API endpoints
    location /api/ {
      limit_req zone=api burst=10 nodelay;
      proxy_pass http://localhost:4000;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Auth endpoints (stricter rate limit)
    location /api/v1/auth/ {
      limit_req zone=auth burst=5 nodelay;
      proxy_pass http://localhost:4000;
      proxy_set_header Host $host;
    }

    # Storefront Next.js App
    location / {
      proxy_pass http://localhost:3000;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }
}
```

---

## 3. PM2 Process Management

PM2 is used to run, monitor, and auto-restart the application servers.

### Configuration (`ecosystem.config.js`)
Create this in your root folder:
```javascript
module.exports = {
  apps: [
    {
      name: 'rajshree-backend',
      script: './backend/dist/index.js',
      cwd: '/home/ubuntu/rajshree-jewels',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      }
    },
    {
      name: 'rajshree-storefront',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: '/home/ubuntu/rajshree-jewels/frontend',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'rajshree-admin',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      cwd: '/home/ubuntu/rajshree-jewels/admin',
      instances: 1,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

### Start & Persist Processes
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 4. Payment Integration (Razorpay Setup)

To process transactions natively in India (UPI, cards, netbanking), you must configure Razorpay:

> [!IMPORTANT]
> All initial development and staging deployment should remain in **Razorpay Test Mode**. Switch to **Live Mode** only after submitting KYC documents and receiving approval.

1. **API Keys:** Retrieve `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` from the Razorpay Dashboard under **Settings > API Keys**.
2. **Webhooks:** Navigate to **Settings > Webhooks** and add your endpoint:
   `https://rajshreejewels.com/api/v1/orders/webhook`
3. **Webhook Events:** Select the following active triggers:
   - `payment.captured`
   - `payment.failed`
   - `refund.processed`
4. **Secret:** Secure the webhook with a custom string set as `RAZORPAY_WEBHOOK_SECRET` in your `.env`.

---

## 5. Courier Integration (Shiprocket Setup)

For automated shipping label generation and shipping serviceability:

1. **Credentials:** Set `SHIPROCKET_EMAIL` and `SHIPROCKET_PASSWORD` in your production environment.
2. **API Auth Token:** The backend dynamically handles login and token rotation using these credentials.
3. **Pickup Address:** 
   > [!WARNING]
   > You **must** configure a physical Pickup Address inside your Shiprocket Dashboard under **Settings > Pickup Address** before booking your first shipment. The name of the pickup location must match the value configured in the backend settings.
4. **HSN Code:** Physical jewellery requires HSN code **7113** (articles of precious or imitation metal).
