#!/usr/bin/env bash
# =============================================================================
# Diễn tập khôi phục: tải bản sao lưu mới nhất từ kho về thư mục tạm, kiểm tra checksum,
# khôi phục database vào một PostgreSQL TẠM (container riêng, --network none, không cổng),
# đối chiếu số dòng với lúc sao lưu, kiểm tra từng file media đúng mã SHA-256 trong tên.
# KHÔNG đụng database đang chạy. Dọn sạch container và thư mục tạm khi xong (trừ khi --keep).
# Cách chạy: sudo bash ops/restore-test.sh [--keep]
# =============================================================================
source "$(dirname "$0")/lib.sh"
require_root
load_backup_env
keep="${1:-}"
ts="$(date +%Y%m%d-%H%M%S)"
work="$BACKUP_DIR/restore-test-$ts"
pg="happyclass-restore-test-$ts"
cleanup() {
  docker rm -f "$pg" > /dev/null 2>&1 || true
  [ "$keep" = "--keep" ] || rm -rf "$work"
}
trap cleanup EXIT
mkdir -p "$work" && chmod 700 "$work"

log "Tải bản sao lưu mới nhất về $work"
RESTIC_MOUNTS="-v $work:/restore" restic restore latest --host happyclass --target /restore > /dev/null
db="$work/backup/stage/db"
[ -f "$db/happyclass.dump" ] || die "Bản sao lưu không có file database."
(cd "$db" && sha256sum -c --quiet happyclass.dump.sha256) || die "Checksum database không khớp."
ok "Database tải về đúng checksum ($(du -h "$db/happyclass.dump" | cut -f1)); có bản .env: $([ -f "$work/backup/stage/config/env" ] && echo có || echo KHÔNG)"

log "Kiểm tra media"
bad=0; n=0
while IFS= read -r f; do
  n=$((n + 1)); name="$(basename "$f")"
  [ "$(sha256sum "$f" | cut -c1-64)" = "${name%%.*}" ] || { warn "Hỏng: $name"; bad=$((bad + 1)); }
done < <(find "$work/backup/media" -type f 2>/dev/null)
expected="$(awk '$1=="media_files"{print $2}' "$db/counts.txt")"
[ "$bad" = 0 ] || die "$bad file media không khớp SHA-256."
[ "$n" = "$expected" ] || die "Số file media $n khác lúc sao lưu ($expected)."
ok "$n file media, tất cả khớp SHA-256"

log "Khôi phục vào PostgreSQL tạm ($pg, không mạng, không cổng)"
pw="$(openssl rand -hex 16)"
docker run -d --name "$pg" --network none -e POSTGRES_USER=restore -e POSTGRES_PASSWORD="$pw" -e POSTGRES_DB=restore \
  --label happyclass.restore-test=1 postgres:16-alpine > /dev/null
# Entrypoint chạy postgres tạm để khởi tạo rồi khởi động lại: chờ thông báo "ready" lần thứ hai
for _ in $(seq 1 90); do
  [ "$(docker logs "$pg" 2>&1 | grep -c 'database system is ready to accept connections')" -ge 2 ] && break; sleep 1
done
docker exec "$pg" pg_isready -U restore -d restore > /dev/null || die "PostgreSQL tạm không khởi động được."
docker exec -i "$pg" pg_restore -U restore -d restore --no-owner --no-acl < "$db/happyclass.dump" 2> "$work/pg_restore.err" \
  || warn "pg_restore báo $(grep -c . "$work/pg_restore.err") dòng cảnh báo (xem đối chiếu số dòng bên dưới)"
fail=0
while read -r table want; do
  [ "$table" = media_files ] && continue
  got="$(docker exec "$pg" psql -U restore -d restore -tAc "SELECT count(*) FROM $table" | tr -d ' ')"
  if [ "$got" = "$want" ]; then ok "$table: $got"; else warn "$table: khôi phục $got, lúc sao lưu $want"; fail=1; fi
done < "$db/counts.txt"
[ "$fail" = 0 ] || die "Số dòng sau khôi phục không khớp."

snap="$(restic snapshots --host happyclass --latest 1 --json | tr -d '\n' | grep -o '"time":"[^"]*"' | head -n1 | cut -d'"' -f4)"
date -Is > "$BACKUP_DIR/last-restore-test"
ok "Diễn tập khôi phục thành công (bản sao lưu lúc ${snap:-?})"
