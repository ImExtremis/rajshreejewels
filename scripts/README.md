# Operations & Automation Utilities Directory

This directory contains shell scripts used to initialize, maintain, secure, backup, and monitor the self-hosted production jewellery store environment.

---

## Script Index & Command Reference

| Script Filename | Execution Scope | Description |
| :--- | :--- | :--- |
| **`maintain.sh`** | Operations | All-in-one Docker maintenance script. Handles quick restarts, builds, logs, cleanups, migrations, status checks, and resets. |
| **`cleanup-stale-users.sh`** | Dev Utility | Database utility to automatically purge unverified test accounts that registered > 24 hours ago. |
| **`backup.sh`** | Cron Service | Daily database backup utility. Dumps PostgreSQL rows and rotates/retains the last 14 days of backups. |
| **`go-live-checklist.sh`** | Admin Prep | Performs automated pre-flight checks (KYC flags, rate limits, production mode, SSL variables) before go-live. |
| **`init-dirs.sh`** | First Launch | Creates local storage partitions on external HDDs and scaffolding folder layouts for product media. |
| **`install-cron.sh`** | Host System | Registers the database backup task to execute automatically every day at 2:00 AM. |
| **`load-test.sh`** | Performance | Generates high-velocity simulated traffic using `wrk` to load-test static pages and REST endpoints. |
| **`setup-ssl.sh`** | Security | Coordinates certbot verification to fetch SSL certificates for secure HTTPS. |
| **`setup-tunnel.sh`** | Public Proxy | Downloads, configures, and binds Cloudflare Tunnels for secure WAN port exposure. |
| **`setup-uptime-kuma.sh`** | Monitoring | Spawns Uptime Kuma containers to run visual heartbeat checks on endpoints. |
| **`run-migrations.sh`** | DB Update | Syncs PostgreSQL rows with the active Prisma schema via `prisma migrate deploy`. |
| **`health-check.sh`** | Diagnostic | Queries all system ports (Postgres, Redis, API, Storefront, Admin) to verify status. |
| **`tunnel-start.sh`** | WAN Proxy | Starts or verifies the running daemon for Cloudflare public exposure. |
| **`reset-admin-password.sh`** | Console Recovery | Emergency admin password reset. Hashes password using bcryptjs and updates Postgres immediately. |

---

## Operations Guide

### `scripts/maintain.sh` ← START HERE FOR ANY ISSUE
**What:** All-in-one Docker maintenance. Handles restarts, rebuilds, migrations, logs, cleanup.
**The script to run for almost any operational task.**

| Command | When to use |
|---|---|
| `bash scripts/maintain.sh` | Quick restart after config change |
| `bash scripts/maintain.sh --rebuild` | After code changes |
| `bash scripts/maintain.sh --rebuild --no-cache` | After dependency changes or weird build errors |
| `bash scripts/maintain.sh --migrate` | After pulling schema changes |
| `bash scripts/maintain.sh --status` | Check if everything is healthy |
| `bash scripts/maintain.sh --logs` | Debug — see all container logs live |
| `bash scripts/maintain.sh --stop` | Shut everything down |
| `bash scripts/maintain.sh --clean` | Free up disk space |
| `bash scripts/maintain.sh --full-reset` | Nuclear option — something is deeply broken |

---

## Quick Start Guide

### 1. Synchronize the Database Schema
Whenever updates are pulled from repository releases:
```bash
./scripts/run-migrations.sh
```

### 2. Verify System Port Status
To confirm that PostgreSQL, Redis, Next.js storefront, Next.js Admin, and the API are correctly running and serviceable:
```bash
./scripts/health-check.sh
```

### 3. Expose Server to WAN
Expose your local server securely through Cloudflare (without public IP configuration or port-forwarding):
```bash
./scripts/tunnel-start.sh
```

---

## Administrative Recovery

### `scripts/reset-admin-password.sh`
**What:** Emergency admin password reset via console. Use when locked out of admin dashboard.
**When:** Only in emergencies — forgotten owner password, compromised account.
**How:** `bash scripts/reset-admin-password.sh owner@store.com newpassword123`
**Requires:** Docker containers running (postgres and backend).
**Warning:** Resets password immediately. Tell the user to change it again after logging in.

