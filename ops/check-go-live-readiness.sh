#!/usr/bin/env bash
# Read-only production readiness audit for HappyClass.
# Does not change .env, Docker, systemd, Cloudflare, payment mode, or legal text.
source "$(dirname "$0")/lib.sh"
require_root

PASS=0; WARN=0; BLOCK=0
pass() { PASS=$((PASS+1)); ok "$*"; }
warn_check() { WARN=$((WARN+1)); warn "$*"; }
block() { BLOCK=$((BLOCK+1)); printf '    \033[31m✗\033[0m %s\n' "$*"; }
check_eq() {
  local key="$1" expected="$2" actual
  actual="$(env_value "$key" || true)"
  if [ "$actual" = "$expected" ]; then pass "$key đã đúng"
  else block "$key chưa đạt yêu cầu (cần $expected; hiện tại ${actual:-chưa đặt})"; fi
}
check_present() {
  local key="$1" actual
  actual="$(env_value "$key" || true)"
  if [ -n "$actual" ]; then pass "$key đã được cấu hình"
  else block "$key chưa được cấu hình"; fi
}
status_age() {
  local file="$1" max_hours="$2" label="$3" result
  if [ ! -f "$file" ]; then block "$label: chưa có trạng thái ghi nhận"; return; fi
  if ! command -v python3 >/dev/null 2>&1; then warn_check "$label: thiếu python3 để kiểm tra thời điểm"; return; fi
  result="$(python3 - "$file" "$max_hours" <<'PY'
import datetime, json, sys
try:
    with open(sys.argv[1], encoding="utf-8") as f: data = json.load(f)
    value = data.get("lastSuccess")
    if not isinstance(value, str): raise ValueError("missing lastSuccess")
    stamp = datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if stamp.tzinfo is None: stamp = stamp.replace(tzinfo=datetime.timezone.utc)
    age = (datetime.datetime.now(datetime.timezone.utc) - stamp).total_seconds() / 3600
    print("fresh" if 0 <= age <= float(sys.argv[2]) else "stale")
except Exception:
    print("invalid")
PY
)"
  case "$result" in
    fresh) pass "$label còn mới (≤ ${max_hours} giờ)" ;;
    stale) block "$label đã cũ hơn ${max_hours} giờ; cần chạy tác vụ tương ứng" ;;
    *) block "$label thiếu hoặc sai định dạng lastSuccess" ;;
  esac
}

[ -f .env ] || die "Không tìm thấy .env trong $REPO_DIR."
log "Kiểm tra an toàn cấu hình (chỉ đọc)"
mode="$(stat -c '%a' .env 2>/dev/null || true)"
[ "$mode" = "600" ] && pass ".env có quyền 600" || block ".env có quyền ${mode:-không rõ}; yêu cầu chmod 600 .env"
compose config --quiet && pass "Docker Compose config hợp lệ" || block "Docker Compose config không hợp lệ"

log "Chế độ production và email"
check_eq API_NODE_ENV production
check_eq COOKIE_SECURE true
check_eq MAIL_TRANSPORT smtp
check_present SMTP_HOST

log "Thanh toán (không bật Live)"
payment="$(env_value PAYMENT_MODE || echo disabled)"
case "$payment" in
  sandbox) pass "Thanh toán vẫn ở Sandbox; không có thay đổi chế độ" ;;
  live) warn_check "PAYMENT_MODE=live: hệ thống đang nhận tiền thật; xác nhận đây là quyết định có chủ đích" ;;
  *) block "Thanh toán đang tắt; cần hoàn tất nghiệm thu Sandbox trước khi mở bán" ;;
esac
check_present PAYMENT_BANK_ACCOUNT
check_present PAYMENT_BANK_ACCOUNT_NAME
key="$(env_value SEPAY_WEBHOOK_KEY || true)"
[ "${#key}" -ge 24 ] && pass "Khóa webhook đủ độ dài (không hiển thị)" || block "Khóa webhook chưa đạt độ dài tối thiểu 24 ký tự"
unset key

log "Khóa offline, liên hệ và sao lưu"
check_present OFFLINE_SIGNING_KEY
check_present CONTACT_ZALO
data_dir="${HC_DATA_DIR:-/data/education-games-platform}"
status_age "$data_dir/status/backup.json" 48 "Sao lưu offsite"
status_age "$data_dir/status/restore-test.json" 192 "Diễn tập khôi phục"
if command -v systemctl >/dev/null 2>&1; then
  systemctl is-active --quiet happyclass-backup.timer && pass "Timer sao lưu hằng ngày đang active" || block "Timer happyclass-backup.timer chưa active"
  systemctl is-active --quiet happyclass-restore-test.timer && pass "Timer diễn tập khôi phục hằng tuần đang active" || block "Timer happyclass-restore-test.timer chưa active"
else warn_check "Không có systemctl; cần xác minh lịch sao lưu thủ công"; fi

log "Điều khoản và chính sách"
legal_file="$REPO_DIR/apps/web/src/components/legal.tsx"
if [ ! -f "$legal_file" ]; then block "Không tìm thấy legal.tsx"
elif grep -Eqi 'Bản dự thảo|Draft terms|will be added before public launch|do chủ sở hữu bổ sung trước khi mở công khai' "$legal_file"; then
  block "Điều khoản/chính sách vẫn còn nội dung dự thảo; chủ dự án phải bổ sung pháp nhân, địa chỉ và chính sách hoàn tiền"
else pass "Không phát hiện nhãn/nội dung dự thảo trong legal.tsx"; fi

log "Những mục không thể tự xác minh bằng máy"
warn_check "Cloudflare: xác minh WAF Managed Rules, Bot Fight Mode, SSL Full và rate limit /api/auth/*"
warn_check "Cloudflare Access: website English/Vietnamese công khai đúng chủ đích; admin.happyclass.asia vẫn được bảo vệ"
warn_check "Nội dung: duyệt hết game ở trạng thái Chờ duyệt và kiểm tra trải nghiệm trên desktop/mobile"
warn_check "Email: thử đăng ký, gửi lại xác thực và quên mật khẩu bằng hộp thư thật"
warn_check "Thanh toán: kiểm tra lịch sử webhook SePay, chuyển thiếu/đúng tiền và webhook gửi lặp; chỉ chủ dự án mới quyết định bật Live"

log "Kết quả"
printf '  Đạt: %d  Cần xem thủ công: %d  Chặn go-live: %d\n' "$PASS" "$WARN" "$BLOCK"
if [ "$BLOCK" -gt 0 ]; then
  printf '\nHappyClass CHƯA ĐỦ ĐIỀU KIỆN mở công khai. Xử lý các mục ✗ và chạy lại script.\n'
  exit 1
fi
printf '\nKhông phát hiện blocker tự động. Các mục cần xem thủ công vẫn phải được xác nhận trước khi mở công khai.\n'
printf 'Script chỉ đọc; không bật Live, không thay đổi .env, Docker, systemd hoặc Cloudflare.\n'
