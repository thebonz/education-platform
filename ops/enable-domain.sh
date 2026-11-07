#!/usr/bin/env bash
# =============================================================================
# Chuyển HappyClass sang chạy theo tên miền (subdomain) qua Cloudflare Tunnel RIÊNG.
#
# Script CHỈ sửa file .env của HappyClass (có sao lưu .env.bak-<thời gian>) và khởi động lại
# container api, web, tunnel của project "happyclass". KHÔNG đụng cloudflared, Caddy, DNS,
# firewall hay dự án khác trên máy chủ. Bản ghi DNS do Cloudflare tự tạo khi khai báo
# "Public hostname" trong Tunnel (xem docs/DOMAIN.md).
#
# Cách chạy:   sudo bash ops/enable-domain.sh
# Tùy chọn:    --domain happyclass.asia  --vi-subdomain tiengviet  --no-tunnel
# Hoàn tác:    sudo cp .env.bak-<thời gian> .env && sudo docker compose --profile tunnel stop tunnel
#              && sudo docker compose up -d api web
# =============================================================================
source "$(dirname "$0")/lib.sh"
require_root

DOMAIN="happyclass.asia"
VI_SUB="tiengviet"
USE_TUNNEL=1
while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --vi-subdomain) VI_SUB="$2"; shift 2 ;;
    --no-tunnel) USE_TUNNEL=0; shift ;;
    *) die "Tham số không hợp lệ: $1" ;;
  esac
done
[[ "$DOMAIN" =~ ^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$ ]] || die "Tên miền không hợp lệ: $DOMAIN"
[[ "$VI_SUB" =~ ^[a-z0-9-]{1,40}$ ]] || die "Subdomain không hợp lệ: $VI_SUB"
[ -f .env ] || die "Chưa có .env. Hãy chạy sudo bash ops/deploy-test.sh trước."

EN_URL="https://english.${DOMAIN}"
VI_URL="https://${VI_SUB}.${DOMAIN}"
ADMIN_URL="https://admin.${DOMAIN}"

set_env() { # set_env KEY VALUE – thay hoặc thêm một dòng trong .env, không in giá trị bí mật
  local key="$1" value="$2" tmp
  tmp="$(mktemp)"
  if grep -qE "^${key}=" .env; then
    awk -v k="$key" -v v="$value" 'BEGIN{FS=OFS="="} $1==k {print k "=" v; next} {print}' .env > "$tmp"
  else
    cat .env > "$tmp"; printf '%s=%s\n' "$key" "$value" >> "$tmp"
  fi
  cat "$tmp" > .env; rm -f "$tmp"
}

log "Sao lưu .env"
backup=".env.bak-$(date +%Y%m%d-%H%M%S)"
cp -p .env "$backup"; chmod 600 "$backup"
ok "Đã sao lưu: $backup"

log "Cấu hình chế độ tên miền"
set_env SITE_ENGLISH_URL "$EN_URL"
set_env SITE_VIETNAMESE_URL "$VI_URL"
set_env SITE_ADMIN_URL "$ADMIN_URL"
set_env COOKIE_DOMAIN ".${DOMAIN}"
set_env COOKIE_SECURE true
# Chuỗi proxy: Cloudflare → cloudflared → web (Next.js) → api. API tin 1 bước (web);
# địa chỉ thật của người dùng lấy từ X-Forwarded-For do Cloudflare thêm vào.
set_env TRUST_PROXY_HOPS 1
ok "English:    $EN_URL"
ok "Vietnamese: $VI_URL"
ok "Admin:      $ADMIN_URL"
ok "Cookie dùng chung: .${DOMAIN} (Secure)"

if [ "$USE_TUNNEL" = 1 ] && [ -z "$(env_value CLOUDFLARE_TUNNEL_TOKEN || true)" ]; then
  log "Token Cloudflare Tunnel"
  [ -t 0 ] || die "Thiếu CLOUDFLARE_TUNNEL_TOKEN trong .env (chạy script ở terminal để nhập ẩn)."
  echo "    Dán token của tunnel 'happyclass' (Zero Trust → Networks → Tunnels). Ký tự sẽ không hiện ra."
  read -rsp "    Token: " token; echo
  [[ "$token" =~ ^[A-Za-z0-9_=+/.-]{40,}$ ]] || die "Token không đúng định dạng."
  set_env CLOUDFLARE_TUNNEL_TOKEN "$token"
  unset token
  ok "Đã lưu token vào .env (quyền 600)"
fi
chmod 600 .env
compose config --quiet

log "Khởi động lại API và Web với cấu hình mới"
compose up -d api web
wait_healthy api 120
wait_healthy web 120

WEB="http://127.0.0.1:$(env_value HC_WEB_HOST_PORT || echo 3100)"
for host in "english.${DOMAIN}" "${VI_SUB}.${DOMAIN}" "admin.${DOMAIN}"; do
  path=/; [[ "$host" == admin.* ]] && path=/login
  code="$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $host" "$WEB$path")"
  [ "$code" = "200" ] && ok "$host$path → 200 (định tuyến theo tên miền)" || die "$host$path → $code"
done

if [ "$USE_TUNNEL" = 1 ]; then
  log "Khởi động Cloudflare Tunnel riêng của HappyClass"
  compose --profile tunnel up -d tunnel
  for _ in $(seq 1 60); do
    if compose --profile tunnel logs tunnel 2>&1 | grep -q "Registered tunnel connection"; then
      ok "Tunnel đã kết nối tới Cloudflare"; break
    fi
    sleep 2
  done
  compose --profile tunnel logs tunnel 2>&1 | grep -q "Registered tunnel connection" || {
    compose --profile tunnel logs --tail 30 tunnel || true
    die "Tunnel chưa kết nối được. Kiểm tra token và mạng ra Internet."
  }
fi

cat <<MSG

Hoàn tất. Kiểm tra trong Cloudflare (docs/DOMAIN.md):
  1. Tunnel "happyclass" có 3 Public hostname trỏ về http://web:3000:
       english.${DOMAIN}, ${VI_SUB}.${DOMAIN}, admin.${DOMAIN}
  2. Ứng dụng Cloudflare Access chặn cả *.${DOMAIN} (chỉ email được mời mới vào được).
Sau đó mở ${EN_URL}

Lưu ý: từ giờ đăng nhập qua tên miền; SSH tunnel tới localhost:3100 không còn dùng để đăng nhập được.
Hoàn tác: sudo cp ${backup} .env && sudo docker compose --profile tunnel stop tunnel && sudo docker compose up -d api web
MSG
