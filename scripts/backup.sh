#!/bin/bash
# -----------------------------------------------------------------------------
# Rajshree Jewels — Automated Database & Asset Backup Script (Cron Rotated)
# -----------------------------------------------------------------------------
set -e

# Configuration
BACKUP_DIR="/data/backups"
DB_CONTAINER="postgres" # Name of Postgres service in docker-compose
DB_NAME="jewellery_store"
DB_USER="postgres"
ASSETS_DIR="/data/images/products"
RETENTION_DAYS=7
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$BACKUP_DIR/backup_log.txt"

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "🏁 Starting scheduled database and asset volume backups..."

# 1. PostgreSQL Database Backup
DB_BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql.gz"
log "📦 Dumping PostgreSQL database '$DB_NAME' from container '$DB_CONTAINER'..."

if docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$DB_BACKUP_FILE"; then
    # Verify backup is not empty / size > 0
    if [ -s "$DB_BACKUP_FILE" ]; then
        log "✅ Database backup successful: $DB_BACKUP_FILE ($(du -sh "$DB_BACKUP_FILE" | awk '{print $1}'))"
    else
        log "❌ ERROR: Database backup file size is 0 bytes! Backup is empty."
        exit 1
    fi
else
    log "❌ ERROR: PostgreSQL pg_dump failed!"
    exit 1
fi

# 2. Asset Volumes Backup (Processed Images)
ASSETS_BACKUP_FILE="$BACKUP_DIR/assets_backup_$TIMESTAMP.tar.gz"
log "📦 Compressing product images volume '$ASSETS_DIR'..."

if [ -d "$ASSETS_DIR" ]; then
    if tar -czf "$ASSETS_BACKUP_FILE" -C "$(dirname "$ASSETS_DIR")" "$(basename "$ASSETS_DIR")"; then
        if [ -s "$ASSETS_BACKUP_FILE" ]; then
            log "✅ Assets backup successful: $ ASSETS_BACKUP_FILE ($(du -sh "$ASSETS_BACKUP_FILE" | awk '{print $1}'))"
        else
            log "❌ ERROR: Asset backup file size is 0 bytes! Backup is empty."
            exit 1
        fi
    else
        log "❌ ERROR: Tar compression of assets folder failed!"
        exit 1
    fi
else
    log "⚠️ Warning: Assets directory '$ASSETS_DIR' not found. Skipping asset backup."
fi

# 3. Apply Backup Retention & Rotation Policy (Keep last 7 days)
log "🧹 Applying backup rotation policy (Retaining last $RETENTION_DAYS days of backups)..."

# Find and delete DB backups older than RETENTION_DAYS
find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -mtime +"$RETENTION_DAYS" -type f -print -delete | while read -r deleted_file; do
    log "🗑️ Deleted old database backup: $deleted_file"
done

# Find and delete Asset backups older than RETENTION_DAYS
find "$BACKUP_DIR" -name "assets_backup_*.tar.gz" -mtime +"$RETENTION_DAYS" -type f -print -delete | while read -r deleted_file; do
    log "🗑️ Deleted old assets backup: $deleted_file"
done

log "🎉 Scheduled backup operations completed successfully!"
echo "---------------------------------------------------------------------" >> "$LOG_FILE"
