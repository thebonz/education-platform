# Trước khi mở công khai

Hiện HappyClass chạy thử sau Cloudflare Access: chỉ email được mời mới vào được. Trước khi tắt Access, cần làm xong danh sách dưới đây.

## Bắt buộc

- [ ] **Sao lưu:**
  - chạy `ops/configure-backup.sh`, cất mật khẩu mã hoá ở hai nơi;
  - chạy `ops/install-backup-timer.sh`;
  - có ít nhất một lần `restore-test.sh` thành công (`docs/BACKUP.md`).
- [ ] **Email:**
  - có tài khoản SMTP, đặt `MAIL_TRANSPORT=smtp` và `SMTP_*` trong `.env`;
  - thử đăng ký và quên mật khẩu nhận được email.
- [ ] **Thanh toán:**
  - sandbox đã thử với một giao dịch thật nhỏ (`docs/PAYMENTS.md`);
  - rồi chạy `ops/configure-payments.sh --live`;
  - kiểm tra Cloudflare Access bypass cho `/api/webhooks/`.
- [ ] **Chế độ production:**
  - đặt `API_NODE_ENV=production`, `COOKIE_SECURE=true` (`enable-domain.sh` đã đặt) trong `.env`;
  - chạy `sudo bash ops/deploy-test.sh`.
- [ ] **Pháp lý:**
  - bổ sung tên pháp nhân và địa chỉ vận hành, chính sách hoàn tiền vào `apps/web/src/components/legal.tsx`;
  - bỏ dòng "Bản dự thảo";
  - khi nội dung đổi, tăng `LEGAL_VERSION` và `TERMS_VERSION`.
- [ ] **Liên hệ:** đặt số Zalo (`ops/set-contact.sh`).
- [ ] **Tài khoản quản trị:**
  - mỗi người một tài khoản, đúng vai trò (`ops/create-admin.sh --role …`);
  - xoá hoặc khoá tài khoản thử.
- [ ] **Nội dung:** cô Thúy duyệt hết game ở trạng thái *Chờ duyệt*.

## Nên làm

- [ ] Cloudflare:
  - bật WAF Managed Rules và Bot Fight Mode;
  - thêm rule giới hạn tần suất cho `/api/auth/*`;
  - đặt SSL mode **Full**.
- [ ] Theo dõi:
  - Uptime check cho `https://english.happyclass.asia/api/health`;
  - kiểm tra `backup/last-success` không cũ quá 2 ngày.
- [ ] Thu âm giọng Bắc cho các mục nghe (hiện dùng giọng đọc của trình duyệt).

## Mở công khai

1. Cloudflare Zero Trust → Access → Applications: gỡ application của `*.happyclass.asia`, nhưng **giữ** application của `admin.happyclass.asia`.
2. Thử từ một máy không đăng nhập Cloudflare: vào trang chủ, đăng ký, chơi game, mua gói.
