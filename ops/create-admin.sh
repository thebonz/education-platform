#!/usr/bin/env bash
# Tạo tài khoản quản trị / nhân sự. Mật khẩu nhập ẩn, không lưu vào lịch sử shell.
#
# Cách chạy:
#   sudo bash ops/create-admin.sh                          # Super Admin
#   sudo bash ops/create-admin.sh --role content_reviewer  # giáo viên duyệt nội dung
#   sudo bash ops/create-admin.sh --role content_reviewer --promote   # cấp thêm vai trò cho tài khoản có sẵn
#
# Không tương tác: ADMIN_EMAIL=... ADMIN_NAME=... và truyền mật khẩu qua stdin.
source "$(dirname "$0")/lib.sh"
require_root
role="super_admin"; promote=""
while [ $# -gt 0 ]; do
  case "$1" in
    --role) role="$2"; shift 2 ;;
    --promote) promote="--promote"; shift ;;
    *) die "Tham số không hợp lệ: $1" ;;
  esac
done
[[ "$role" =~ ^[a-z_]{3,40}$ ]] || die "Vai trò không hợp lệ: $role"

email="${ADMIN_EMAIL:-}"; name="${ADMIN_NAME:-}"; pw=""
if [ -t 0 ]; then
  [ -n "$email" ] || read -rp "Email: " email
  if [ -z "$promote" ]; then
    [ -n "$name" ] || read -rp "Tên hiển thị: " name
    read -rsp "Mật khẩu (ít nhất 12 ký tự): " pw; echo
    read -rsp "Nhập lại mật khẩu: " pw2; echo
    [ "$pw" = "$pw2" ] || die "Hai lần nhập không khớp."
  fi
else
  IFS= read -r pw || true
fi
[ -n "$email" ] || die "Thiếu email."
printf '%s' "$pw" | compose run --rm -T api node dist/cli/create-admin.js "$email" "${name:-Quản trị viên}" "--role=$role" $promote
unset pw pw2
