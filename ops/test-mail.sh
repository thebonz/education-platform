#!/usr/bin/env bash
# Verify SMTP credentials and send one real test message using the deployed API image.
# Usage: sudo bash ops/test-mail.sh recipient@example.com
source "$(dirname "$0")/lib.sh"
require_root

recipient="${1:-}"
[[ "$recipient" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die "Cách dùng: sudo bash ops/test-mail.sh email-nhan@example.com"
[ -f .env ] || die "Không tìm thấy .env."
[ "$(env_value MAIL_TRANSPORT || echo log)" = smtp ] || die "MAIL_TRANSPORT chưa phải smtp. Chạy ops/configure-mail.sh trước."

node_script='
const nodemailer = require("nodemailer");
const e = process.env;
const to = process.argv[1];
(async () => {
  if (!e.SMTP_HOST) throw new Error("Thiếu SMTP_HOST");
  if (Boolean(e.SMTP_USER) !== Boolean(e.SMTP_PASSWORD)) throw new Error("SMTP_USER và SMTP_PASSWORD phải cùng được đặt hoặc cùng để trống");
  const transport = nodemailer.createTransport({
    host: e.SMTP_HOST,
    port: Number(e.SMTP_PORT || 587),
    secure: e.SMTP_SECURE === "true" || e.SMTP_SECURE === "1",
    auth: e.SMTP_USER ? { user: e.SMTP_USER, pass: e.SMTP_PASSWORD } : undefined,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
  });
  try {
    await transport.verify();
    const result = await transport.sendMail({
      from: e.MAIL_FROM,
      to,
      subject: "Kiểm tra email HappyClass",
      text: "Đây là email kiểm tra cấu hình SMTP của HappyClass. Nếu anh/chị nhận được thư này, kết nối gửi email đã hoạt động.",
      html: "<p>Đây là email kiểm tra cấu hình SMTP của <strong>HappyClass</strong>.</p><p>Nếu anh/chị nhận được thư này, kết nối gửi email đã hoạt động.</p>"
    });
    if (!result.accepted || result.accepted.length === 0) throw new Error("SMTP không xác nhận người nhận");
    console.log("SMTP_OK: máy chủ đã chấp nhận email kiểm tra.");
  } finally {
    transport.close();
  }
})().catch((error) => {
  const code = error && error.code ? "[" + error.code + "] " : "";
  const message = String(error && error.message ? error.message : error).replace(/[\r\n]/g, " ").slice(0, 400);
  console.error("SMTP_TEST_FAILED: " + code + message);
  process.exit(1);
});
'

log "Gửi email kiểm tra qua container API (không in thông tin bí mật)"
compose run --rm -T --no-deps api node -e "$node_script" "$recipient"
ok "Máy chủ SMTP đã xác thực và chấp nhận email gửi tới $recipient."
