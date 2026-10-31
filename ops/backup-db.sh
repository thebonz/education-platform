#!/usr/bin/env bash
# Sao lưu database HappyClass ra $HC_DATA_DIR/backups (định dạng pg_dump custom).
# Giữ 14 bản gần nhất. Cách chạy: sudo bash ops/backup-db.sh [nhãn]
source "$(dirname "$0")/lib.sh"
require_root
label="${1:-manual}"
ts="$(date +%Y%m%d-%H%M%S)"
out="$DATA_DIR/backups/happyclass-${ts}-${label}.dump"
mkdir -p "$DATA_DIR/backups"
compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$out.partial"
mv "$out.partial" "$out"
chmod 600 "$out"
sha256sum "$out" > "$out.sha256"
# Kiểm tra file đọc được (liệt kê nội dung, không khôi phục)
compose exec -T postgres pg_restore --list < "$out" > /dev/null
ok "Đã sao lưu: $out ($(du -h "$out" | cut -f1))"
ls -1t "$DATA_DIR"/backups/happyclass-*.dump 2>/dev/null | tail -n +15 | while read -r old; do rm -f "$old" "$old.sha256"; done
