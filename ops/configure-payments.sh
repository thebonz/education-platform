#!/usr/bin/env bash
# =============================================================================
# Bật/tắt thanh toán chuyển khoản (VietQR + SePay) cho HappyClass.
#
# Script CHỈ sửa .env của HappyClass (có sao lưu) và khởi động lại api/web. Số tài khoản và khóa
# webhook chỉ nằm trong .env (quyền 600) – KHÔNG đưa vào Git, chat hay ảnh chụp màn hình.
#
# Cách chạy:
#   sudo bash ops/configure-payments.sh            # chế độ thử nghiệm (sandbox) – mặc định
#   sudo bash ops/configure-payments.sh --live     # thanh toán thật (chỉ sau khi sandbox đã chạy đúng)
#   sudo bash ops/configure-payments.sh --disable  # tắt bán hàng
#   sudo bash ops/configure-payments.sh --show-key # in lại khóa webhook để dán vào SePay
# Không tương tác (CI): đặt PAYMENT_BANK_ACCOUNT, PAYMENT_BANK_ACCOUNT_NAME trong môi trường.
# Hướng dẫn đầy đủ: docs/PAYMENTS.md
# =============================================================================
source "$(dirname "$0")/lib.sh"
require_root
[ -f .env ] || die "Chưa có .env. Hãy chạy sudo bash ops/deploy-test.sh trước."

mode="sandbox"
case "${1:-}" in
  "") ;;
  --live) mode="live" ;;
  --disable) mode="disabled" ;;
  --show-key)
    key="$(env_value SEPAY_WEBHOOK_KEY || true)"
    [ -n "$key" ] || die "Chưa có khóa webhook. Chạy script không kèm tham số trước."
    printf 'Khóa webhook SePay (chỉ dán vào cấu hình webhook của SePay):\n%s\n' "$key"; exit 0 ;;
  *) die "Tham số không hợp lệ: $1" ;;
esac

log "Sao lưu .env"
backup=".env.bak-$(date +%Y%m%d-%H%M%S)"
cp -p .env "$backup"; chmod 600 "$backup"
ok "Đã sao lưu: $backup"

if [ "$mode" = "disabled" ]; then
  set_env PAYMENT_MODE disabled
else
  account="${PAYMENT_BANK_ACCOUNT:-$(env_value PAYMENT_BANK_ACCOUNT || true)}"
  name="${PAYMENT_BANK_ACCOUNT_NAME:-$(env_value PAYMENT_BANK_ACCOUNT_NAME || true)}"
  if [ -t 0 ]; then
    log "Tài khoản nhận tiền (VietinBank)"
    read -rp "    Số tài khoản [${account:+đã có, Enter để giữ}]: " a; account="${a:-$account}"
    read -rp "    Tên chủ tài khoản, viết HOA không dấu (ví dụ NGUYEN THI THUY) [${name:-}]: " n; name="${n:-$name}"
  fi
  [[ "$account" =~ ^[0-9]{6,19}$ ]] || die "Số tài khoản phải gồm 6–19 chữ số."
  name="$(printf '%s' "$name" | tr '[:lower:]' '[:upper:]')"
  [[ "$name" =~ ^[A-Z\ ]{3,60}$ ]] || die "Tên chủ tài khoản: chữ HOA không dấu, 3–60 ký tự."

  if [ "$mode" = "live" ]; then
    current="$(env_value PAYMENT_MODE || true)"
    [ "$current" = "sandbox" ] || [ "$current" = "live" ] || die "Phải chạy chế độ sandbox và kiểm thử trước khi bật live."
    if [ -t 0 ]; then
      echo "    Bật thanh toán THẬT: khách sẽ chuyển tiền vào tài khoản trên. Gõ LIVE để xác nhận."
      read -rp "    > " confirm; [ "$confirm" = "LIVE" ] || die "Đã huỷ."
    fi
  fi

  key="$(env_value SEPAY_WEBHOOK_KEY || true)"
  if [ "${#key}" -lt 24 ]; then
    key="$(openssl rand -hex 24)"
    new_key=1
  fi
  set_env PAYMENT_BANK_BIN 970415
  set_env PAYMENT_BANK_NAME VietinBank
  set_env PAYMENT_BANK_ACCOUNT "$account"
  set_env PAYMENT_BANK_ACCOUNT_NAME "$name"
  set_env SEPAY_WEBHOOK_KEY "$key"
  set_env PAYMENT_MODE "$mode"
fi
chmod 600 .env
compose config --quiet

log "Khởi động lại API và Web"
compose up -d api web
wait_healthy api 120
wait_healthy web 120
WEB="http://127.0.0.1:$(env_value HC_WEB_HOST_PORT || echo 3100)"
enabled="$(curl -fsS "$WEB/api/billing/plans?product=english" | grep -o '"paymentsEnabled":[a-z]*' || true)"
ok "Chế độ thanh toán: $mode ($enabled)"

if [ "$mode" != "disabled" ]; then
  domain_url="$(env_value SITE_ENGLISH_URL || echo "https://english.happyclass.asia")"
  cat <<MSG

Cấu hình webhook trong SePay (my.sepay.vn → Tích hợp WebHooks → Thêm):
  - URL nhận:        ${domain_url%/}/api/webhooks/sepay
  - Kiểu chứng thực: API Key
  - Sự kiện:         Có tiền vào
MSG
  if [ "${new_key:-0}" = 1 ]; then
    printf '  - API Key (mới tạo, chỉ hiện lần này; xem lại: sudo bash ops/configure-payments.sh --show-key):\n    %s\n' "$key"
  else
    echo "  - API Key: giữ nguyên khóa cũ (xem lại: sudo bash ops/configure-payments.sh --show-key)"
  fi
  cat <<MSG

Nhớ thêm quy tắc Bypass trong Cloudflare Access cho đường dẫn /api/webhooks/ (docs/PAYMENTS.md),
nếu không SePay sẽ bị chặn ở màn đăng nhập email.
Hoàn tác: sudo cp ${backup} .env && sudo docker compose up -d api web
MSG
fi
