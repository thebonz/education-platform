#!/usr/bin/env bash
# =============================================================================
# Đặt số Zalo liên hệ (gói trường học, hỗ trợ thanh toán). Lưu trong .env – không đưa vào Git.
# Cách chạy:  sudo bash ops/set-contact.sh            (hỏi số)
#             sudo bash ops/set-contact.sh 0912345678 (không hỏi)
#             sudo bash ops/set-contact.sh --clear    (ẩn nút Zalo)
# =============================================================================
source "$(dirname "$0")/lib.sh"
require_root
[ -f .env ] || die "Chưa có .env. Hãy chạy sudo bash ops/deploy-test.sh trước."

value="${1:-}"
if [ "$value" = "--clear" ]; then
  value=""
elif [ -z "$value" ]; then
  [ -t 0 ] || die "Truyền số Zalo làm tham số khi chạy không tương tác."
  read -rp "Số Zalo (ví dụ 0912345678) hoặc link https://zalo.me/...: " value
fi
value="$(printf '%s' "$value" | tr -d ' .')"
if [ -n "$value" ] && ! [[ "$value" =~ ^0[0-9]{9,10}$ || "$value" =~ ^https://zalo\.me/[A-Za-z0-9._-]{3,64}$ ]]; then
  die "Không đúng định dạng: cần số điện thoại 10–11 chữ số bắt đầu bằng 0, hoặc https://zalo.me/..."
fi

backup=".env.bak-$(date +%Y%m%d-%H%M%S)"
cp -p .env "$backup"; chmod 600 "$backup"
set_env CONTACT_ZALO "$value"
chmod 600 .env
compose config --quiet
compose up -d api web
wait_healthy api 120
wait_healthy web 120
[ -n "$value" ] && ok "Đã đặt Zalo liên hệ" || ok "Đã ẩn nút Zalo"
echo "Hoàn tác: sudo cp ${backup} .env && sudo docker compose up -d api web"
