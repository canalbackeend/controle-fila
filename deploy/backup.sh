#!/bin/sh
set -eu

interval="${BACKUP_INTERVAL_SECONDS:-86400}"
retention="${BACKUP_RETENTION_DAYS:-14}"

case "$interval:$retention" in
  *[!0-9:]* | :* | *:) echo 'Invalid backup interval or retention' >&2; exit 1 ;;
esac
if [ "$interval" -lt 60 ] || [ "$retention" -lt 1 ]; then
  echo 'Backup interval must be at least 60 seconds and retention at least one day' >&2
  exit 1
fi

mkdir -p /backups
backup() {
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  database="/backups/db-$stamp.dump"
  media="/backups/media-$stamp.tar.gz"
  if pg_dump --format=custom --no-owner --file="$database.partial" &&
     tar -czf "$media.partial" -C /uploads . &&
     mv "$database.partial" "$database" &&
     mv "$media.partial" "$media"; then
    find /backups -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'media-*.tar.gz' \) -mtime "+$retention" -delete
    echo "Backup completed at $stamp"
  else
    rm -f "$database.partial" "$media.partial"
    echo "Backup failed at $stamp" >&2
    return 1
  fi
}

while true; do
  backup || true
  sleep "$interval" &
  wait $!
done
