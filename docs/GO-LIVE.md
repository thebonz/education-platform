# Trước khi mở công khai

Hiện HappyClass chạy thử sau Cloudflare Access: chỉ email được mời mới vào được. Trước khi tắt Access, cần làm xong danh sách dưới đây.

## Bắt buộc

- [ ] **Sao lưu:**
  - chạy `ops/configure-backup.sh`, cất mật khẩu mã hoá ở hai nơi;
  - chạy `ops/install-backup-timer.sh`;
  - có ít nhất một lần `restore-test.sh` thành công (`docs/BACKUP.md`).
- [ ] **Email:**
  - chạy `sudo bash ops/configure-mail.sh` để nhập SMTP và gửi email kiểm tra;
  - nhận được email kiểm tra trong Inbox (hoặc xác minh Spam/Quảng cáo);
  - thử đăng ký, gửi lại xác thực và quên mật khẩu để xác nhận nhận được email thật (`docs/MAIL.md`).
- [ ] **Thanh toán (chưa bật Live cho đến khi hoàn tất toàn bộ mục này):**
  - SePay **Test Mode** đang bật; tài khoản ngân hàng trong Test Mode phải khớp `PAYMENT_BANK_ACCOUNT` của HappyClass. Ưu tiên sao chép tài khoản Live sang Test Mode.
  - Tạo webhook ngay trong **Test Mode**, đúng URL `https://english.happyclass.asia/api/webhooks/sepay`, xác thực bằng API Key của HappyClass và đã bỏ bộ lọc “chỉ gửi khi có mã”.
  - Mô phỏng ít nhất một giao dịch tiền vào đúng mã đơn/đúng số tiền: SePay webhook history trả HTTP 200; đơn HappyClass thành **PAID** và entitlement được cấp. Đây là giao dịch mô phỏng, không cần chuyển tiền thật.
  - Kiểm thử giao dịch thiếu tiền và nội dung không khớp: không cấp entitlement; giao dịch xuất hiện trong mục đối soát tương ứng.
  - Gửi lại cùng một webhook/giao dịch: không tạo bank transaction trùng và không cấp entitlement lần hai.
  - Chỉ sau khi các ca trên đạt, người vận hành mới chủ động xác nhận và chạy `sudo bash ops/configure-payments.sh --live`; không bật Live tự động.
  - Giữ Cloudflare Access Bypass giới hạn đúng endpoint `/api/webhooks/sepay` (hoặc prefix đã cấu hình), không bypass toàn site. Xem `docs/PAYMENTS.md`.
- [ ] **Chế độ production:**
  - đặt `API_NODE_ENV=production`, `COOKIE_SECURE=true` (`enable-domain.sh` đã đặt) trong `.env`;
  - chỉ chuyển production sau khi SMTP thật hoạt động; chạy `sudo bash ops/deploy-test.sh`.
- [ ] **Pháp lý:**
  - bổ sung tên pháp nhân và địa chỉ vận hành, chính sách hoàn tiền vào `apps/web/src/components/legal.tsx`;
  - bỏ dòng "Bản dự thảo";
  - khi nội dung đổi, tăng `LEGAL_VERSION` và `TERMS_VERSION`.
- [ ] **Liên hệ:** đặt số Zalo (`ops/set-contact.sh`).
- [ ] **Tài khoản quản trị:**
  - mỗi người một tài khoản, đúng vai trò (`ops/create-admin.sh --role …`);
  - xoá hoặc khoá tài khoản thử.
- [ ] **Nội dung:** giáo viên phụ trách duyệt hết game ở trạng thái *Chờ duyệt* trước khi mở công khai.

## Nên làm

- [ ] Cloudflare:
  - bật WAF Managed Rules và Bot Fight Mode;
  - thêm rule giới hạn tần suất cho `/api/auth/*`;
  - đặt SSL mode **Full**.
- [ ] Theo dõi:
  - Uptime check cho `https://english.happyclass.asia/api/health`;
  - kiểm tra `backup/last-success` không cũ quá 2 ngày.
- [ ] **Giọng đọc:** kiểm tra nghe thực tế trên máy tính và điện thoại; xác nhận âm thanh Piper giọng Bắc đã cache đủ cho game tiếng Việt và gói offline (xem `docs/VOICE.md`).

## Mở công khai

1. Cloudflare Zero Trust → Access → Applications: gỡ application của `*.happyclass.asia`, nhưng **giữ** application của `admin.happyclass.asia`.
2. Thử từ một máy không đăng nhập Cloudflare: vào trang chủ, đăng ký, chơi game, mua gói.
