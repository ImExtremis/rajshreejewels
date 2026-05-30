#!/bin/bash
# After running docker-compose up, visit http://localhost:3002 to set up Uptime Kuma
# Create the following monitors:

# 1. Storefront
#    Type: HTTP(s)
#    URL: https://yourdomain.com
#    Interval: 60s
#    Alert: Email when down

# 2. Backend Health
#    Type: HTTP(s)
#    URL: https://yourdomain.com/api/v1/health
#    Expected status: 200
#    Interval: 60s

# 3. Admin Dashboard
#    Type: HTTP(s) — internal
#    URL: http://localhost:3001
#    Interval: 60s

# 4. Database (via health endpoint)
#    Type: HTTP(s)
#    URL: https://yourdomain.com/api/v1/health
#    Check response body contains: "db":"ok"
#    Interval: 120s

echo "Visit http://localhost:3002 to configure Uptime Kuma monitors"
echo "Default credentials: set on first visit"
