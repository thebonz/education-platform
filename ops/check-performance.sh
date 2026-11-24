#!/usr/bin/env bash
# Lightweight, GET-only HappyClass performance smoke on localhost.
# No writes, no stress traffic, no payment requests, no changes to Docker or .env.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_root

[ -f .env ] || die "Không tìm thấy .env."
command -v python3 >/dev/null 2>&1 || die "Cần python3."
command -v docker >/dev/null 2>&1 || die "Cần Docker."

log "Xác minh dịch vụ HappyClass"
compose config --quiet || die "Docker Compose config không hợp lệ."
for service in postgres api web; do
  wait_healthy "$service" 45
done

log "Kiểm tra tải nhẹ (GET nội bộ, không tạo đơn hoặc giao dịch)"
result=0
python3 "$REPO_DIR/ops/smoke-load-local.py" --env-file "$REPO_DIR/.env" || result=$?

log "Ảnh chụp tài nguyên sau kiểm tra (không phải mức tải đỉnh)"
if command -v free >/dev/null 2>&1; then free -h | head -n 3; fi
if command -v df >/dev/null 2>&1; then df -h "$DATA_DIR" 2>/dev/null || warn "Không đọc được dung lượng $DATA_DIR"; fi

ids=()
for service in postgres api web tts tunnel; do
  id="$(compose --profile tunnel ps -q "$service" 2>/dev/null || true)"
  [ -n "$id" ] && ids+=("$id")
done
if [ "${#ids[@]}" -gt 0 ]; then
  docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}' "${ids[@]}" \
    || warn "Không đọc được docker stats."
else
  warn "Không tìm thấy container HappyClass để đọc tài nguyên."
fi

if [ "$result" -ne 0 ]; then
  die "Smoke test chưa đạt (exit $result); đã thu thập tài nguyên, chưa thay đổi dịch vụ."
fi

ok "Smoke test tải nhẹ đạt. Đây không phải stress test hay đo tải tối đa."
echo "Không thay đổi .env, Docker, Cloudflare, SePay hoặc các dự án khác trên DL380."
