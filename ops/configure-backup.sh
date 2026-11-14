#!/usr/bin/env bash
# =============================================================================
# Cấu hình sao lưu mã hoá ra ngoài máy chủ (Cloudflare R2 hoặc Backblaze B2) bằng restic.
#   - Thông tin đăng nhập kho lưu trữ và mật khẩu mã hoá chỉ nằm ở $HC_DATA_DIR/backup/backup.env (chmod 600).
#   - Mật khẩu mã hoá (RESTIC_PASSWORD) được sinh ngẫu nhiên một lần, KHÔNG BAO GIỜ bị ghi đè.
#     MẤT MẬT KHẨU NÀY = KHÔNG KHÔI PHỤC ĐƯỢC BẢN SAO LƯU. Hãy lưu nó ở nơi an toàn ngoài máy chủ
#     (trình quản lý mật khẩu): sudo bash ops/configure-backup.sh --show-password
#   - restic chạy trong container dùng một lần (image restic/restic), không cài phần mềm lên máy chủ.
#
# Cách dùng:
#   sudo bash ops/configure-backup.sh                 # hỏi từng bước (R2 hoặc B2)
#   sudo bash ops/configure-backup.sh --show-password # in mật khẩu mã hoá ra màn hình để cất giữ
#   sudo bash ops/configure-backup.sh --check         # kiểm tra kết nối và liệt kê bản sao lưu
# Không tương tác (CI): BACKUP_PROVIDER=r2|b2|s3 BACKUP_ENDPOINT=… BACKUP_BUCKET=… BACKUP_ACCESS_KEY_ID=… BACKUP_SECRET_ACCESS_KEY=…
# =============================================================================
source "$(dirname "$0")/lib.sh"
require_root
mode="${1:-}"

if [ "$mode" = "--show-password" ]; then
  load_backup_env
  printf '\nMật khẩu mã hoá bản sao lưu (lưu vào trình quản lý mật khẩu, không gửi qua chat/email):\n\n  %s\n\n' "$RESTIC_PASSWORD"
  exit 0
fi
if [ "$mode" = "--check" ]; then
  load_backup_env
  restic snapshots --compact
  exit 0
fi

ask() { # ask <biến> <câu hỏi> [ẩn]
  local var="$1" q="$2" hidden="${3:-}" val="${!1:-}"
  [ -n "$val" ] && return 0
  [ -t 0 ] || die "Thiếu $var (chạy không tương tác)."
  if [ -n "$hidden" ]; then read -rsp "$q: " val; echo; else read -rp "$q: " val; fi
  [ -n "$val" ] || die "Không được để trống."
  printf -v "$var" '%s' "$val"
}

mkdir -p "$BACKUP_DIR" && chmod 700 "$BACKUP_DIR"
old_password=""
if [ -f "$BACKUP_ENV" ]; then
  old_password="$(grep -E '^RESTIC_PASSWORD=' "$BACKUP_ENV" | cut -d= -f2- || true)"
  warn "Đã có cấu hình sao lưu – cập nhật kho lưu trữ, GIỮ NGUYÊN mật khẩu mã hoá."
fi

log "Kho lưu trữ"
if [ -z "${BACKUP_PROVIDER:-}" ] && [ -t 0 ]; then
  echo "  1) Cloudflare R2   2) Backblaze B2"
  read -rp "  Chọn (1/2): " c
  case "$c" in 1) BACKUP_PROVIDER=r2 ;; 2) BACKUP_PROVIDER=b2 ;; *) die "Lựa chọn không hợp lệ." ;; esac
fi
region=""
case "${BACKUP_PROVIDER:-}" in
  r2)
    if [ -z "${BACKUP_ENDPOINT:-}" ]; then
      ask R2_ACCOUNT_ID "Cloudflare Account ID (32 ký tự, ở trang R2)"
      [[ "$R2_ACCOUNT_ID" =~ ^[0-9a-f]{32}$ ]] || die "Account ID không đúng dạng."
      BACKUP_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    fi
    region=auto ;;
  b2)
    if [ -z "${BACKUP_ENDPOINT:-}" ]; then
      ask B2_REGION "Vùng của bucket B2 (ví dụ us-west-004, ở trang chi tiết bucket: Endpoint s3.<vùng>.backblazeb2.com)"
      [[ "$B2_REGION" =~ ^[a-z]+-[a-z]+-[0-9]{3}$ ]] || die "Vùng không đúng dạng."
      BACKUP_ENDPOINT="https://s3.${B2_REGION}.backblazeb2.com"; region="$B2_REGION"
    fi ;;
  s3) ask BACKUP_ENDPOINT "Địa chỉ S3 (https://…)"; region="${BACKUP_REGION:-us-east-1}" ;;
  *) die "BACKUP_PROVIDER phải là r2, b2 hoặc s3." ;;
esac
[[ "$BACKUP_ENDPOINT" =~ ^https?://[A-Za-z0-9.:-]+$ ]] || die "Địa chỉ kho không hợp lệ."
ask BACKUP_BUCKET "Tên bucket (tạo sẵn, để riêng cho HappyClass)"
[[ "$BACKUP_BUCKET" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] || die "Tên bucket không hợp lệ."
ask BACKUP_ACCESS_KEY_ID "Access Key ID (khoá chỉ có quyền trên bucket này)"
ask BACKUP_SECRET_ACCESS_KEY "Secret Access Key (nhập ẩn)" hidden

password="${old_password:-$(openssl rand -base64 36 | tr -d '\n')}"
tmp="$(mktemp "$BACKUP_DIR/.env.XXXXXX")"; chmod 600 "$tmp"
{
  echo "# Cấu hình sao lưu HappyClass – tạo bởi ops/configure-backup.sh. KHÔNG đưa file này vào Git/chat."
  echo "BACKUP_PROVIDER=$BACKUP_PROVIDER"
  echo "RESTIC_REPOSITORY=s3:${BACKUP_ENDPOINT}/${BACKUP_BUCKET}/happyclass"
  echo "AWS_ACCESS_KEY_ID=$BACKUP_ACCESS_KEY_ID"
  echo "AWS_SECRET_ACCESS_KEY=$BACKUP_SECRET_ACCESS_KEY"
  echo "AWS_DEFAULT_REGION=${region:-auto}"
  echo "RESTIC_PASSWORD=$password"
} > "$tmp"
mv "$tmp" "$BACKUP_ENV"
ok "Đã lưu cấu hình vào $BACKUP_ENV (chmod 600)"

log "Kết nối kho lưu trữ (restic $RESTIC_IMAGE)"
docker pull -q "$RESTIC_IMAGE" > /dev/null
if restic cat config > /dev/null 2>&1; then
  ok "Kho đã có sẵn và mở được bằng mật khẩu hiện tại"
else
  [ -z "$old_password" ] || warn "Không mở được kho bằng mật khẩu cũ – thử khởi tạo kho mới (nếu kho đã có dữ liệu với mật khẩu khác, lệnh sẽ báo lỗi)."
  restic init > /dev/null || die "Không khởi tạo được kho. Kiểm tra bucket, khoá truy cập và quyền ghi."
  ok "Đã khởi tạo kho mã hoá mới"
fi
cat <<MSG

  Xong. Bước tiếp theo:
    1. Cất mật khẩu mã hoá:      sudo bash ops/configure-backup.sh --show-password
    2. Sao lưu thử:              sudo bash ops/backup-offsite.sh
    3. Diễn tập khôi phục:       sudo bash ops/restore-test.sh
    4. Chạy tự động hằng ngày:   sudo bash ops/install-backup-timer.sh
MSG
