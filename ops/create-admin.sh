#!/usr/bin/env bash
# Tạo tài khoản Super Admin đầu tiên. Mật khẩu nhập ẩn, không lưu vào lịch sử shell.
# Cách chạy: sudo bash ops/create-admin.sh
# Không tương tác: ADMIN_EMAIL=... ADMIN_NAME=... và truyền mật khẩu qua stdin.
source "$(dirname "$0")/lib.sh"
require_root
email="${ADMIN_EMAIL:-}"; name="${ADMIN_NAME:-}"
if [ -t 0 ]; then
  [ -n "$email" ] || read -rp "Email quản trị: " email
  [ -n "$name" ] || read -rp "Tên hiển thị: " name
  read -rsp "Mật khẩu (ít nhất 12 ký tự): " pw; echo
  read -rsp "Nhập lại mật khẩu: " pw2; echo
  [ "$pw" = "$pw2" ] || die "Hai lần nhập không khớp."
else
  IFS= read -r pw || true
fi
[ -n "$email" ] || die "Thiếu email."
printf '%s' "$pw" | compose run --rm -T api node dist/cli/create-admin.js "$email" "${name:-Quản trị viên}"
unset pw pw2
