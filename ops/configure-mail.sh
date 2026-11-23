#!/usr/bin/env bash
# Configure real SMTP for HappyClass without exposing credentials in shell history.
# Usage: sudo bash ops/configure-mail.sh
source "$(dirname "$0")/lib.sh"
require_root

[ -f .env ] || die "Chưa có .env. Hãy chạy sudo bash ops/deploy-test.sh trước."
[ -t 0 ] || die "Hãy chạy trực tiếp trong Terminal để nhập mật khẩu SMTP an toàn."

log "Cấu hình email SMTP cho HappyClass"
echo "Thông tin này chỉ được lưu trong .env của HappyClass (quyền 600), không đưa vào Git."
echo "Mật khẩu sẽ được nhập ẩn và không hiển thị trên màn hình."

current_port="$(env_value SMTP_PORT || echo 587)"

read -rp "SMTP host (ví dụ smtp.gmail.com): " host
[[ "$host" =~ ^[A-Za-z0-9.-]+$ && "$host" != .* && "$host" != *. && "$host" != *..* ]] || die "SMTP host không hợp lệ."

read -rp "SMTP port [${current_port:-587}]: " port
port="${port:-${current_port:-587}}"
[[ "$port" =~ ^[0-9]{1,5}$ ]] && [ "$port" -ge 1 ] && [ "$port" -le 65535 ] || die "SMTP port phải từ 1 đến 65535."

secure_default=false
[ "$port" = 465 ] && secure_default=true
read -rp "Dùng TLS ngay khi kết nối? true/false [${secure_default}]: " secure
secure="${secure:-$secure_default}"
case "$secure" in true|false) ;; *) die "Chỉ nhập true hoặc false."; esac

read -rp "SMTP username (để trống nếu máy chủ không cần xác thực): " smtp_user
smtp_password=""
if [ -n "$smtp_user" ]; then
  read -rsp "SMTP password / app password (nhập ẩn): " smtp_password; echo
  [ -n "$smtp_password" ] || die "Đã nhập SMTP username thì cần có SMTP password."
fi

read -rp "Địa chỉ người gửi [HappyClass <no-reply@happyclass.asia>]: " mail_from
mail_from="${mail_from:-HappyClass <no-reply@happyclass.asia>}"
[[ "$mail_from" =~ [A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,} ]] || die "MAIL_FROM phải chứa một địa chỉ email hợp lệ."
[[ "$mail_from" != *$'\n'* && "$mail_from" != *$'\r'* ]] || die "MAIL_FROM không được chứa xuống dòng."

read -rp "Email nhận thư kiểm tra: " recipient
[[ "$recipient" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die "Email nhận kiểm tra không hợp lệ."

# Double-quoted Compose .env value: escape backslash, quote and dollar so credentials
# containing $, spaces, #, or quotes are passed literally to the container.
quote_compose() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//\$/\$\$}"
  printf '"%s"' "$value"
}
set_env_quoted() {
  local key="$1" value="$2" encoded tmp found=0 line
  encoded="$(quote_compose "$value")"
  tmp="$(mktemp "$REPO_DIR/.env.XXXXXX")"
  chmod 600 "$tmp"
  while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" == "$key="* ]]; then
      printf '%s=%s\n' "$key" "$encoded" >> "$tmp"
      found=1
    else
      printf '%s\n' "$line" >> "$tmp"
    fi
  done < .env
  if [ "$found" -eq 0 ]; then printf '%s=%s\n' "$key" "$encoded" >> "$tmp"; fi
  cat "$tmp" > .env
  rm -f "$tmp"
}

backup=".env.bak-mail-$(date +%Y%m%d-%H%M%S)"
cp -p .env "$backup"
chmod 600 "$backup"
ok "Đã sao lưu cấu hình hiện tại: $backup"

set_env MAIL_TRANSPORT smtp
set_env SMTP_PORT "$port"
set_env SMTP_SECURE "$secure"
set_env_quoted SMTP_HOST "$host"
set_env_quoted SMTP_USER "$smtp_user"
set_env_quoted SMTP_PASSWORD "$smtp_password"
set_env_quoted MAIL_FROM "$mail_from"
chmod 600 .env

if ! compose config --quiet; then
  cp -p "$backup" .env
  die "Cấu hình Compose không hợp lệ. Đã khôi phục .env cũ."
fi

log "Kiểm tra kết nối SMTP và gửi thư thử"
if ! bash "$REPO_DIR/ops/test-mail.sh" "$recipient"; then
  cp -p "$backup" .env
  chmod 600 .env
  die "Kiểm tra SMTP thất bại. Đã khôi phục .env cũ; API/Web chưa bị khởi động lại. Kiểm tra host, port, TLS và app password rồi thử lại."
fi

log "Khởi động lại API và Web để nhận cấu hình SMTP"
compose up -d api web
wait_healthy api 120
wait_healthy web 120
ok "Đã cấu hình SMTP và gửi email kiểm tra thành công."
echo "Nếu cần hoàn tác: sudo cp $backup .env && sudo docker compose up -d api web"
