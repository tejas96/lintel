#!/usr/bin/env bash
# Daily PostgreSQL backup for the production compose stack.
# Keeps 14 daily and 8 weekly dumps in BACKUP_DIR; copy that folder off-host.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/lintel/backups}"
COMPOSE_FILE="${COMPOSE_FILE:-infrastructure/docker/compose.production.yaml}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"

for database in "${POSTGRES_DB:?POSTGRES_DB is required}" temporal temporal_visibility; do
  target="$BACKUP_DIR/daily/${database}-${STAMP}.dump"
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    pg_dump -U "${POSTGRES_USER:?POSTGRES_USER is required}" -Fc "$database" > "$target"
  echo "wrote $target ($(du -h "$target" | cut -f1))"
done

if [ "$(date -u +%u)" = "7" ]; then
  cp "$BACKUP_DIR"/daily/*-"$STAMP".dump "$BACKUP_DIR/weekly/"
fi
find "$BACKUP_DIR/daily" -name '*.dump' -mtime +14 -delete
find "$BACKUP_DIR/weekly" -name '*.dump' -mtime +56 -delete
