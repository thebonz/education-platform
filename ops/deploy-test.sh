#!/usr/bin/env bash
# =============================================================================
# Triển khai / cập nhật môi trường CHẠY THỬ NỘI BỘ HappyClass (project "happyclass").
#
# Script CHỈ tạo/sửa:
#   - thư mục $HC_DATA_DIR (mặc định /data/education-games-platform)
#   - file .env cạnh docker-compose.yml (chỉ tạo khi chưa có, không ghi đè)
#   - image, container, network của project "happyclass"
# KHÔNG đụng container, network, volume, Caddy, firewall, DNS của dự án khác.
#
# Cách chạy (trong thư mục mã nguồn):  sudo bash ops/deploy-test.sh
# Chạy lại nhiều lần được (cập nhật phiên bản mới sau khi git pull).
# =============================================================================
source "$(dirname "$0")/lib.sh"
require_root

log "Kiểm tra điều kiện"
docker compose version >/dev/null || die "Thiếu Docker Compose v2."
[ -f docker-compose.yml ] || die "Không thấy docker-compose.yml trong $REPO_DIR."
BEFORE="$(snapshot_other_projects)"
ok "Đã ghi trạng thái CMMS/Airdrop trước khi triển khai ($(printf '%s\n' "$BEFORE" | grep -c . || true) container)"

log "Thư mục dữ liệu: $DATA_DIR"
mkdir -p "$DATA_DIR"/{database/postgres,backups,logs,media/english,media/vietnamese}
chmod 700 "$DATA_DIR/backups"
ok "Đã có thư mục database, backups, logs, media"

log "File cấu hình .env"
if [ -f .env ]; then
  ok ".env đã tồn tại – giữ nguyên"
else
  pw="$(openssl rand -hex 24)"
  sed -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${pw}|" \
      -e "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://happyclass:${pw}@postgres:5432/happyclass?schema=public|" \
      -e "s|^HC_DATA_DIR=.*|HC_DATA_DIR=${DATA_DIR}|" \
      .env.example > .env
  unset pw
  chmod 600 .env
  ok "Đã tạo .env với mật khẩu PostgreSQL ngẫu nhiên (quyền 600, không in ra màn hình)"
fi
grep -q '^POSTGRES_PASSWORD=change-me$' .env && die ".env còn mật khẩu mặc định change-me. Hãy đổi trước."
port_free_or_ours "$(env_value HC_WEB_HOST_PORT || echo 3100)"
port_free_or_ours "$(env_value HC_API_HOST_PORT || echo 3101)"
compose config --quiet
ok "docker-compose.yml hợp lệ"

log "Build image (có thể mất vài phút lần đầu)"
compose build api web
ok "Build xong"

log "PostgreSQL riêng của HappyClass"
compose up -d postgres
wait_healthy postgres 120

has_schema="$(compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT to_regclass('"'"'public._prisma_migrations'"'"') IS NOT NULL"')"
if [ "$has_schema" = "t" ]; then
  log "Sao lưu database trước khi áp migration"
  bash "$REPO_DIR/ops/backup-db.sh" pre-migrate
fi

log "Áp migration (prisma migrate deploy)"
compose run --rm migrate
log "Nạp dữ liệu nền (idempotent, không ghi đè dữ liệu đã sửa)"
compose run --rm seed

log "Khởi động API và Web"
compose up -d api web
wait_healthy api 120
wait_healthy web 120

log "Kiểm tra từ máy chủ"
WEB="http://127.0.0.1:$(env_value HC_WEB_HOST_PORT || echo 3100)"
API="http://127.0.0.1:$(env_value HC_API_HOST_PORT || echo 3101)"
curl -fsS "$API/api/health" >/dev/null && ok "API health OK ($API/api/health)"
for path in / /english /vietnamese /english/games /vietnamese/games /admin/login; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$WEB$path")"
  [ "$code" = "200" ] && ok "$path → 200" || die "$path → $code"
done
games="$(curl -fsS "$API/api/catalog/products/vietnamese/games" | grep -o '"slug"' | wc -l)"
ok "Thư viện Vietnamese có $games game"

log "So sánh CMMS/Airdrop trước và sau"
AFTER="$(snapshot_other_projects)"
if [ "$BEFORE" = "$AFTER" ]; then
  ok "Không thay đổi:"; printf '%s\n' "$AFTER" | sed 's/^/      /'
else
  warn "Trạng thái khác trước khi triển khai – kiểm tra ngay:"
  diff <(printf '%s\n' "$BEFORE") <(printf '%s\n' "$AFTER") || true
fi

compose ps
cat <<MSG

Hoàn tất. Bước tiếp theo:
  1. Tạo Super Admin:        sudo bash ops/create-admin.sh
  2. Mở từ máy tính của bạn: ssh -L 3100:127.0.0.1:3100 <user>@<IP máy chủ>  rồi vào http://localhost:3100
  3. Sao lưu thủ công:       sudo bash ops/backup-db.sh
  Gỡ môi trường (giữ dữ liệu trên $DATA_DIR): sudo docker compose down
MSG
