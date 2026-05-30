#!/bin/bash
# -----------------------------------------------------------------------------
# Rajshree Jewels — Cron Job Installer (Daily 2 AM Backups Scheduling)
# -----------------------------------------------------------------------------
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup.sh"

echo "====================================================================="
echo "⏰ Cron Schedule Installer for Rajshree Jewels Backups"
echo "====================================================================="
echo "Target Backup Script: $BACKUP_SCRIPT"

# Verify backup script is executable
chmod +x "$BACKUP_SCRIPT"
echo "✓ Verified backup script is executable."

# Check if cron service is active/running
if ! command -v crontab &> /dev/null; then
    echo "⚠️ Cron daemon not found. Installing cron..."
    sudo apt-get update
    sudo apt-get install -y cron
    sudo systemctl enable cron
    sudo systemctl start cron
fi

# Define cron entry: run daily at 2 AM
CRON_ENTRY="0 2 * * * /bin/bash $BACKUP_SCRIPT"

# Read existing crontab
CURRENT_CRON=$(crontab -l 2>/dev/null || echo "")

# Prevent duplicates
if echo "$CURRENT_CRON" | grep -Fq "$BACKUP_SCRIPT"; then
    echo "ℹ️ Backup cron schedule already registered in crontab. No changes made."
else
    # Append new cron job to existing crontab
    (echo "$CURRENT_CRON"; echo "$CRON_ENTRY") | crontab -
    echo "✅ Success! Registered daily backup schedule in crontab (2:00 AM daily)."
fi

echo "---------------------------------------------------------------------"
echo "Active crontab schedule list:"
crontab -l
echo "====================================================================="
