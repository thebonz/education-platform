#!/usr/bin/env bash
# Read-only preflight for the SePay sandbox integration.
# Does not create orders, bank transactions, payments, or change .env.
source "$(dirname "$0")/lib.sh"
require_root

[ -f .env ] || die "Chưa có .env. Hãy chạy deploy-test.sh trước."
command -v curl >/dev/null 2>&1 || die "Thiếu curl."
command -v stat >/dev/null 2>&1 || die "Thiếu stat."

log "Kiểm tra cấu hình SePay sandbox (chỉ đọc)"
mode="$(env_value PAYMENT_MODE || echo disabled)"
[ "$mode" = sandbox ] || die "PAYMENT_MODE hiện là '$mode'. Script này chỉ chạy khi cấu hình đúng sandbox; không bật/tắt chế độ thanh toán."

account="$(env_value PAYMENT_BANK_ACCOUNT || true)"
account_name="$(env_value PAYMENT_BANK_ACCOUNT_NAME || true)"
key="$(env_value SEPAY_WEBHOOK_KEY || true)"
[[ "$account" =~ ^[0-9]{6,19}$ ]] || die "Thiếu hoặc sai PAYMENT_BANK_ACCOUNT."
[[ -n "$account_name" ]] || die "Thiếu PAYMENT_BANK_ACCOUNT_NAME."
[ "${#key}" -ge 24 ] || die "SEPAY_WEBHOOK_KEY chưa có hoặc ngắn hơn 24 ký tự."

env_mode="$(stat -c '%a' .env)"
[ "$env_mode" = "600" ] || die ".env đang có quyền $env_mode; yêu cầu quyền 600. Chạy: sudo chmod 600 .env"
ok "PAYMENT_MODE=sandbox; tài khoản nhận và khóa webhook đã có (không hiển thị bí mật)."
ok ".env có quyền 600."

log "Kiểm tra cấu hình Docker và dịch vụ"
compose config --quiet || die "Docker Compose config không hợp lệ."
wait_healthy postgres 60
wait_healthy api 120
wait_healthy web 120

web_port="$(env_value HC_WEB_HOST_PORT || echo 3100)"
api_port="$(env_value HC_API_HOST_PORT || echo 3101)"
web="http://127.0.0.1:$web_port"
api="http://127.0.0.1:$api_port"

log "Kiểm tra API và bảng giá nội bộ"
curl -fsS --max-time 10 "$api/api/health" >/dev/null || die "API health không phản hồi."
ok "API health phản hồi."
plans="$(curl -fsS --max-time 10 "$web/api/billing/plans?product=english")" || die "Không tải được bảng giá English."
printf '%s' "$plans" | grep -Eq '"paymentsEnabled"[[:space:]]*:[[:space:]]*true' || die "Bảng giá chưa báo paymentsEnabled=true."
ok "Bảng giá English đã bật thanh toán."
plans_vi="$(curl -fsS --max-time 10 "$web/api/billing/plans?product=vietnamese")" || die "Không tải được bảng giá Vietnamese."
printf '%s' "$plans_vi" | grep -Eq '"paymentsEnabled"[[:space:]]*:[[:space:]]*true' || die "Bảng giá Vietnamese chưa báo paymentsEnabled=true."
ok "Bảng giá Vietnamese đã bật thanh toán."

log "Kiểm tra khóa webhook (không gửi giao dịch)"
local_code="$(curl -sS --max-time 10 -o /dev/null -w '%{http_code}' -X POST "$api/api/webhooks/sepay" -H 'Content-Type: application/json' -d '{}')" || die "Không kết nối được webhook API nội bộ."
[ "$local_code" = "401" ] || die "Webhook nội bộ trả HTTP $local_code, kỳ vọng 401 khi không có API Key."
ok "Webhook nội bộ từ chối request không có API Key (HTTP 401)."

site_url="$(env_value SITE_ENGLISH_URL || true)"
site_url="${site_url%/}"
if [[ "$site_url" == https://* ]]; then
  public_code="$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' -X POST "$site_url/api/webhooks/sepay" -H 'Content-Type: application/json' -d '{}')" || die "Không kết nối được webhook công khai."
  [ "$public_code" = "401" ] || die "Webhook công khai trả HTTP $public_code, kỳ vọng 401. Nếu là 302/403, kiểm tra Cloudflare Access Bypass cho /api/webhooks/."
  ok "Webhook công khai đi tới API và từ chối request thiếu API Key (HTTP 401). Cloudflare Access không chặn endpoint."
else
  warn "SITE_ENGLISH_URL chưa phải HTTPS domain; bỏ qua kiểm tra webhook công khai. Cần chạy lại sau khi bật domain."
fi

cat <<'MSG'

Kiểm tra kỹ thuật sandbox hoàn tất.
Script không tạo đơn, không ghi giao dịch, không chuyển tiền và không thay đổi cấu hình.
Bước tiếp theo: cấu hình webhook trong SePay theo docs/PAYMENTS.md rồi dùng chức năng giả lập giao dịch của SePay.
MSG
