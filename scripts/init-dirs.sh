#!/bin/bash
# init-dirs.sh - Scaffolds persistent docker mount directories with proper permissions for Rajshree Jewels platform.

set -e

echo "🚀 Scaffolding persistent mount directories..."

# Define directories to create
DIRS=(
  "./data/postgres"
  "./data/redis"
  "./data/images"
  "./data/invoices"
  "./data/uptime-kuma"
)

# Create each directory and set permissions to 755
for DIR in "${DIRS[@]}"; do
  if [ ! -d "$DIR" ]; then
    echo "📁 Creating directory: $DIR"
    mkdir -p "$DIR"
  else
    echo "✅ Directory already exists: $DIR"
  fi
  
  echo "🔒 Setting permissions (755) for: $DIR"
  chmod 755 "$DIR"
done

echo "🎉 All persistent directories initialized successfully!"
