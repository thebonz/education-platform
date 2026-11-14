#!/usr/bin/env bash
# =============================================================================
# Sao lưu mã hoá ra ngoài máy chủ: database + thư viện ảnh/âm thanh + bản sao .env.
#   1. pg_dump (qua ops/backup-db.sh, bản cục bộ vẫn giữ 14 bản trong $HC_DATA_DIR/backups)
#   2. restic backup (mã hoá AES-256 phía máy chủ trước khi gửi) lên R2/B2
#   3. Giữ: 14 bản theo ngày, 8 theo tuần, 12 theo tháng; xoá bản cũ hơn
#   4. Chủ nhật (hoặc --check): đọc lại 10% dữ liệu trên kho để phát hiện hỏng
# Chỉ ĐỌC dữ liệu HappyClass; không đụng CMMS/Airdrop. Cách chạy: sudo bash ops/backup-offsite.sh [--check]
# =============================================================================
source "$(dirname "$0")/lib.sh"
require_root
load_backup_env
mkdir -p "$DATA_DIR/logs"
exec > >(tee -a "$DATA_DIR/logs/backup.log") 2>&1
echo "---- $(date -Is) backup-offsite bắt đầu"

[ -n "$(compose ps -q postgres)" ] || die "PostgreSQL của HappyClass chưa chạy."
stage="$BACKUP_DIR/staging"
rm -rf "$stage"; mkdir -p "$stage/db" "$stage/config"; chmod 700 "$stage"

log "Dump database"
bash "$REPO_DIR/ops/backup-db.sh" offsite
dump="$(ls -1t "$DATA_DIR"/backups/happyclass-*-offsite.dump | head -n1)"
cp "$dump" "$stage/db/happyclass.dump"
(cd "$stage/db" && sha256sum happyclass.dump > happyclass.dump.sha256)
db_counts > "$stage/db/counts.txt"
cp "$REPO_DIR/.env" "$stage/config/env"
git -C "$REPO_DIR" rev-parse HEAD > "$stage/config/git-commit" 2>/dev/null || true
media_files="$(find "$DATA_DIR/media/assets" -type f 2>/dev/null | wc -l)"
echo "media_files $media_files" >> "$stage/db/counts.txt"
ok "Database $(du -h "$stage/db/happyclass.dump" | cut -f1), media $media_files file"

log "Gửi lên kho mã hoá"
export RESTIC_MOUNTS="-v $stage:/backup/stage:ro -v $DATA_DIR/media/assets:/backup/media:ro"
restic backup --host happyclass --tag auto --one-file-system /backup/stage /backup/media
ok "Đã sao lưu"

log "Dọn bản cũ (14 ngày, 8 tuần, 12 tháng)"
restic forget --host happyclass --keep-daily 14 --keep-weekly 8 --keep-monthly 12 --prune > /dev/null
ok "Đã áp chính sách giữ bản sao lưu"

if [ "${1:-}" = "--check" ] || [ "$(date +%u)" = 7 ]; then
  log "Kiểm tra toàn vẹn kho (đọc lại 10% dữ liệu)"
  restic check --read-data-subset=10% > /dev/null
  ok "Kho toàn vẹn"
fi

rm -rf "$stage"
date -Is > "$BACKUP_DIR/last-success"
echo "---- $(date -Is) backup-offsite xong"
