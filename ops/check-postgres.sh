#!/usr/bin/env bash
# HappyClass PostgreSQL diagnostics (read-only).
# Uses postgres container's own local credentials; no password is printed or copied.
# No restarts, schema changes, row contents, VACUUM or EXPLAIN ANALYZE.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_root

[ -f .env ] || die "Không tìm thấy .env."
[ -f "$REPO_DIR/ops/postgres-diagnostics.sql" ] || die "Không tìm thấy tệp SQL kiểm tra."
command -v docker >/dev/null 2>&1 || die "Cần Docker."

log "Kiểm tra PostgreSQL HappyClass (chỉ đọc)"
compose config --quiet || die "Docker Compose config không hợp lệ."
cid="$(compose ps -q postgres)"
[ -n "$cid" ] || die "PostgreSQL HappyClass chưa chạy."
health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid")"
[ "$health" = "healthy" ] || die "PostgreSQL chưa healthy ($health)."

log "Thông số kết nối, thống kê tích lũy và kích thước bảng"
# SQL runs inside the EXISTING HappyClass PostgreSQL container.
# -X: ignore psqlrc; -v ON_ERROR_STOP: fail on SQL errors; no secrets in argv/log.
# The SQL file begins BEGIN READ ONLY and sets statement/lock timeouts.
if ! compose exec -T postgres sh -c 'exec psql -X -v ON_ERROR_STOP=1 -P pager=off -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
      < "$REPO_DIR/ops/postgres-diagnostics.sql"; then
  die "Không đọc được thống kê PostgreSQL; không thực hiện thay đổi nào."
fi
ok "Đã thu thập thông số PostgreSQL dạng chỉ đọc."
printf '\nChưa đề xuất thay đổi max_connections, work_mem, shared_buffers hoặc VACUUM khi chưa có bằng chứng cần thiết.\n'
printf 'Các bộ đếm pg_stat_database là số tích lũy (từ stats_reset), không phải mức sử dụng tức thời.\n'
printf 'Không chạm database của CMMS/Airdrop và không thay đổi container.\n'
