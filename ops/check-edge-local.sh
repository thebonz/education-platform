#!/usr/bin/env bash
# Read-only local-origin security check for HappyClass behind Cloudflare Tunnel.
# Checks API health, loopback-only published ports, and web security headers.
# Does not modify .env, Docker, Cloudflare, Access, payment mode, or containers.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_root

PASS=0; WARN=0; FAIL=0
pass() { PASS=$((PASS+1)); ok "$*"; }
warn_check() { WARN=$((WARN+1)); warn "$*"; }
fail_check() { FAIL=$((FAIL+1)); printf '    \033[31m✗\033[0m %s\n' "$*"; }

[ -f .env ] || die "Không tìm thấy .env."
command -v curl >/dev/null 2>&1 || die "Cần curl."
command -v python3 >/dev/null 2>&1 || die "Cần python3."

site_info() {
  python3 - "$1" "$2" <<'PY'
import sys
from urllib.parse import urlsplit
u = urlsplit(sys.argv[1])
if not u.hostname:
    raise SystemExit("URL không có hostname")
path = u.path.rstrip("/") or "/"
if sys.argv[2] == "admin" and path == "/":
    path = "/login"
print(u.hostname)
print(path)
PY
}

check_loopback_binding() {
  local service="$1" port="$2" binding
  binding="$(compose port "$service" "$port" 2>/dev/null || true)"
  case "$binding" in
    127.0.0.1:*) pass "$service chỉ publish trên loopback ($binding)" ;;
    "") fail_check "Không đọc được port mapping của $service" ;;
    *) fail_check "$service đang publish ngoài loopback ($binding); cần giữ origin đóng với Internet" ;;
  esac
}

check_header() {
  local file="$1" header="$2"
  grep -Eiq "^${header}:" "$file"
}

log "Kiểm tra API và ánh xạ cổng"
api_port="$(env_value HC_API_HOST_PORT || echo 3101)"
web_port="$(env_value HC_WEB_HOST_PORT || echo 3100)"
api_health="$(curl -fsS --max-time 8 "http://127.0.0.1:${api_port}/api/health" 2>/dev/null || true)"
if [ -n "$api_health" ] && printf '%s' "$api_health" | python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get("status")=="ok" and d.get("database")=="connected" else 1)' 2>/dev/null; then
  pass "API health và kết nối PostgreSQL bình thường"
else
  fail_check "API health không trả status=ok và database=connected"
fi
check_loopback_binding api 4000
check_loopback_binding web 3000

log "Kiểm tra HTTP security headers tại origin nội bộ"
tmp_headers="$(mktemp)"
trap 'rm -f "$tmp_headers"' EXIT
for item in english vietnamese admin; do
  case "$item" in
    english) url="$(env_value SITE_ENGLISH_URL || true)" ;;
    vietnamese) url="$(env_value SITE_VIETNAMESE_URL || true)" ;;
    admin) url="$(env_value SITE_ADMIN_URL || true)" ;;
  esac
  if [ -z "$url" ]; then fail_check "Thiếu URL cấu hình cho site $item"; continue; fi
  if ! info="$(site_info "$url" "$item" 2>/dev/null)"; then fail_check "URL $item không hợp lệ"; continue; fi
  host="$(printf '%s\n' "$info" | sed -n '1p')"
  path="$(printf '%s\n' "$info" | sed -n '2p')"
  code="$(curl -sS --max-time 12 -D "$tmp_headers" -o /dev/null -w '%{http_code}' -H "Host: $host" "http://127.0.0.1:${web_port}${path}" 2>/dev/null || true)"
  if [ "$code" != "200" ]; then
    fail_check "$item origin trả HTTP ${code:-không phản hồi}, mong đợi 200"
    continue
  fi
  missing=""
  for h in Content-Security-Policy Strict-Transport-Security Cross-Origin-Opener-Policy X-Content-Type-Options Referrer-Policy X-Frame-Options Permissions-Policy; do
    check_header "$tmp_headers" "$h" || missing="${missing} ${h}"
  done
  if [ -z "$missing" ]; then pass "$item trả HTTP 200 và đủ 7 security headers"
  else fail_check "$item thiếu security headers:${missing}"; fi
done

log "Kiểm tra Cloudflare Tunnel"
token="$(env_value CLOUDFLARE_TUNNEL_TOKEN || true)"
if [ -n "$token" ]; then
  tunnel_id="$(compose --profile tunnel ps -q tunnel 2>/dev/null || true)"
  if [ -n "$tunnel_id" ] && [ "$(docker inspect -f '{{.State.Status}}' "$tunnel_id" 2>/dev/null || true)" = "running" ]; then
    pass "Container Cloudflare Tunnel đang chạy"
  else
    fail_check "Đã có tunnel token nhưng container tunnel không chạy"
  fi
else
  warn_check "Chưa có CLOUDFLARE_TUNNEL_TOKEN; bỏ qua kiểm tra tunnel (có thể đang chạy local)"
fi
unset token

log "Kết quả"
printf '  Đạt: %d  Cần xem thủ công: %d  Chưa đạt: %d\n' "$PASS" "$WARN" "$FAIL"
if [ "$FAIL" -gt 0 ]; then
  printf '\nKiểm tra origin chưa đạt. Chưa thay đổi cấu hình nào.\n'
  exit 1
fi
printf '\nKiểm tra origin hoàn tất. WAF, Access, DNS/Tunnel route và TLS edge vẫn phải xác minh trong Cloudflare Dashboard.\n'
printf 'Script chỉ đọc; không thay đổi cấu hình hoặc khởi động lại dịch vụ.\n'
