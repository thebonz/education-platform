#!/usr/bin/env bash
# =============================================================================
# Read-only production readiness gate for HappyClass.
# Checks local configuration, service health, backup/restore freshness and safe
# public webhook routing. Never changes .env, restarts services, enables Live
# payments, or changes Cloudflare Access.
#
# Run: sudo bash ops/check-production-readiness.sh
# =============================================================================
source "$(dirname "$0")/lib.sh"
require_root

[ -f .env ] || die "Chưa có .env. Hãy triển khai HappyClass trước."
command -v curl >/dev/null 2>&1 || die "Thiếu curl."
command -v stat >/dev/null 2>&1 || die "Thiếu stat."

PASS=0
WARN=0
FAIL=0

pass() { PASS=$((PASS + 1)); ok "$*"; }
warning() { WARN=$((WARN + 1)); warn "$*"; }
failure() { FAIL=$((FAIL + 1)); printf '    ✗ %s\n' "$*" >&2; }

check_env() { # check_env KEY expected description
  local key="$1" expected="$2" label="$3" value
  value="$(env_value "$key" || true)"
  if [ "$value" = "$expected" ]; then pass "$label"; else failure "$label (hiện chưa đạt)"; fi
}

check_https() { # check_https KEY description
  local value
  value="$(env_value "$1" || true)"
  if [[ "$value" == https://* ]]; then pass "$2"; else failure "$2 phải dùng HTTPS"; fi
}

check_fresh_file() { # check_fresh_file path max_age_seconds description
  local file="$1" max_age="$2" label="$3" raw stamp now age
  if [ ! -f "$file" ]; then failure "$label: chưa có bản ghi"; return; fi
  raw="$(cat "$file" 2>/dev/null || true)"
  stamp="$(date -d "$raw" +%s 2>/dev/null || echo 0)"
  now="$(date +%s)"
  if [ "$stamp" -le 0 ]; then failure "$label: thời gian không hợp lệ"; return; fi
  age=$((now - stamp))
  if [ "$age" -ge 0 ] && [ "$age" -le "$max_age" ]; then pass "$label"; else failure "$label đã quá hạn"; fi
}

log "Kiểm tra cấu hình an toàn"
env_mode="$(stat -c '%a' .env)"
[ "$env_mode" = "600" ] && pass ".env quyền 600" || failure ".env đang có quyền $env_mode; yêu cầu 600"
check_env API_NODE_ENV production "API_NODE_ENV=production"
check_env COOKIE_SECURE true "Cookie Secure đã bật"
check_env COOKIE_DOMAIN .happyclass.asia "Cookie dùng chung domain HappyClass"
check_env MAIL_TRANSPORT smtp "Email dùng SMTP thật"

smtp_host="$(env_value SMTP_HOST || true)"
smtp_user="$(env_value SMTP_USER || true)"
smtp_password="$(env_value SMTP_PASSWORD || true)"
if [ -n "$smtp_host" ] && [ -n "$smtp_user" ] && [ -n "$smtp_password" ]; then
  pass "Thông tin SMTP đã được cấu hình (không hiển thị bí mật)"
else
  failure "Thiếu SMTP host, username hoặc password"
fi

contact="$(env_value CONTACT_ZALO || true)"
[ -n "$contact" ] && pass "Đã cấu hình kênh liên hệ Zalo" || failure "Chưa cấu hình CONTACT_ZALO"

check_https SITE_ENGLISH_URL "English Web"
check_https SITE_VIETNAMESE_URL "Vietnamese Web"
check_https SITE_ADMIN_URL "Admin Web"

log "Kiểm tra dịch vụ"
if compose config --quiet; then pass "Docker Compose hợp lệ"; else failure "Docker Compose không hợp lệ"; fi
for service in postgres api web; do
  cid="$(compose ps -q "$service" 2>/dev/null || true)"
  if [ -z "$cid" ]; then
    failure "$service chưa chạy"
    continue
  fi
  state="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid" 2>/dev/null || true)"
  [ "$state" = "healthy" ] && pass "$service healthy" || failure "$service chưa healthy ($state)"
done

log "Kiểm tra sao lưu và khôi phục"
backup_env="$DATA_DIR/backup/backup.env"
if [ -f "$backup_env" ]; then
  backup_mode="$(stat -c '%a' "$backup_env")"
  [ "$backup_mode" = "600" ] && pass "Cấu hình backup quyền 600" || failure "backup.env đang có quyền $backup_mode; yêu cầu 600"
else
  failure "Chưa cấu hình backup ngoài máy chủ"
fi
check_fresh_file "$DATA_DIR/backup/last-success" 172800 "Sao lưu ngoài máy chủ thành công trong 48 giờ"
check_fresh_file "$DATA_DIR/backup/last-restore-test" 604800 "Diễn tập khôi phục thành công trong 7 ngày"

if command -v systemctl >/dev/null 2>&1; then
  systemctl is-active --quiet happyclass-backup.timer && pass "Timer sao lưu đang hoạt động" || failure "Timer happyclass-backup.timer chưa hoạt động"
  systemctl is-active --quiet happyclass-restore-test.timer && pass "Timer diễn tập khôi phục đang hoạt động" || failure "Timer happyclass-restore-test.timer chưa hoạt động"
else
  failure "Không tìm thấy systemctl để xác nhận lịch backup"
fi

log "Kiểm tra thanh toán và nội dung"
payment_mode="$(env_value PAYMENT_MODE || echo disabled)"
case "$payment_mode" in
  live) pass "Thanh toán đang ở chế độ Live (không thay đổi cấu hình)" ;;
  sandbox) warning "Thanh toán vẫn ở Sandbox; chưa nhận tiền thật. Chỉ bật Live sau khi chủ dự án xác nhận" ;;
  disabled) warning "Thanh toán đang tắt" ;;
  *) failure "PAYMENT_MODE không hợp lệ" ;;
esac

site_url="$(env_value SITE_ENGLISH_URL || true)"
if [[ "$site_url" == https://* ]]; then
  webhook_code="$(curl -sS --max-time 20 -o /dev/null -w '%{http_code}' -X POST "${site_url%/}/api/webhooks/sepay" -H 'Content-Type: application/json' -d '{}' 2>/dev/null || true)"
  [ "$webhook_code" = "401" ] && pass "Webhook công khai đi qua Cloudflare và từ chối request thiếu API Key (HTTP 401)" || failure "Webhook công khai trả HTTP ${webhook_code:-không kết nối được}; cần kiểm tra Access Bypass"
else
  warning "Bỏ qua kiểm tra webhook công khai vì English URL chưa phải HTTPS"
fi

if grep -Eiq "draft:[[:space:]]*'(Bản dự thảo|Draft terms)" apps/web/src/components/legal.tsx; then
  failure "Trang pháp lý vẫn còn nội dung 'Bản dự thảo/Draft'; cần bổ sung pháp nhân, địa chỉ và chính sách hoàn tiền"
else
  pass "Không tìm thấy nhãn bản dự thảo trong nội dung pháp lý"
fi

if compose ps -q postgres >/dev/null 2>&1; then
  pending="$(compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT count(*) FROM games WHERE review_status = '\''PENDING'\''"' 2>/dev/null | tr -d '[:space:]' || true)"
  if [[ "$pending" =~ ^[0-9]+$ ]]; then
    [ "$pending" = "0" ] && pass "Không còn game chờ duyệt" || failure "Còn $pending game ở trạng thái Chờ duyệt"
  else
    warning "Không đọc được số game chờ duyệt; kiểm tra trong Admin → Nội dung game"
  fi
fi

printf '\n'
log "Tổng kết kiểm tra"
printf '    Đạt: %s | Cảnh báo: %s | Việc cần xử lý: %s\n' "$PASS" "$WARN" "$FAIL"
cat <<'MSG'

Các mục bắt buộc vẫn cần người vận hành xác nhận thủ công:
  - Đã nhận email SMTP thật khi đăng ký, xác thực lại và quên mật khẩu.
  - Đã mô phỏng đủ tiền, thiếu tiền, sai mã và webhook gửi lặp trong SePay Test Mode.
  - Cloudflare WAF/Bot Fight Mode, SSL Full và Access policy đã được rà soát.
  - Từng tài khoản quản trị là tài khoản cá nhân, đúng vai trò; đã khóa/xóa tài khoản thử.
  - Đã kiểm tra game, âm thanh, offline và trải nghiệm trên máy tính/điện thoại.

Script này chỉ đọc. Nó KHÔNG bật thanh toán Live, KHÔNG gỡ Cloudflare Access,
KHÔNG sửa .env và KHÔNG khởi động lại dịch vụ.
MSG

[ "$FAIL" -eq 0 ] || exit 1
