# Trước khi mở công khai

Hiện HappyClass chạy thử sau Cloudflare Access: chỉ email được mời mới vào được. Trước khi tắt Access, cần làm xong danh sách dưới đây.

## Bắt buộc

Trước khi xử lý checklist, chạy audit chỉ đọc trên DL380:

~~~bash
sudo bash ops/check-go-live-readiness.sh
~~~

Script kiểm tra `.env`, production/cookie/SMTP, trạng thái thanh toán, khóa offline, liên hệ, backup/restore, systemd timers và nội dung dự thảo pháp lý. Script không bật thanh toán Live và không thay đổi cấu hình. Các mục Cloudflare, nội dung, email thật và quyết định mở bán vẫn cần người vận hành xác nhận.

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
  - chính sách hoàn tiền song ngữ và email hỗ trợ đã được bổ sung trong `apps/web/src/components/legal.tsx`;
  - thông tin chủ thể vận hành và địa chỉ công bố vẫn chưa được cung cấp; vì vậy giữ nhãn **Bản dự thảo**, không gỡ Access và không mở public;
  - chỉ bỏ nhãn dự thảo sau khi chủ dự án tự hoàn thiện thông tin bắt buộc và duyệt nội dung pháp lý; khi đổi nội dung, tăng `LEGAL_VERSION` và `TERMS_VERSION`.
- [ ] **Liên hệ:** đặt số Zalo (`ops/set-contact.sh`).
- [ ] **Tài khoản quản trị:**
  - mỗi người một tài khoản, đúng vai trò (`ops/create-admin.sh --role …`);
  - xoá hoặc khoá tài khoản thử.
- [ ] **Nội dung:** giáo viên phụ trách duyệt hết game ở trạng thái *Chờ duyệt* trước khi mở công khai.

## Nên làm

- [ ] Cloudflare (làm theo `docs/CLOUDFLARE-HARDENING.md`):
  - xác nhận Tunnel routes trỏ `http://web:3000`, không mở port origin ra Internet;
  - xác nhận Free Managed Ruleset hoặc Managed Ruleset phù hợp gói đang dùng;
  - thêm rate limit cho burst ở các endpoint `/api/auth/*`, sau đó kiểm thử đăng nhập/đăng ký;
  - Bot Fight Mode chỉ bật sau khi thử API POST và checkout, không bật Under Attack Mode toàn zone;
  - giữ Automatic SSL/TLS (recommended) nếu đang dùng Tunnel HTTP origin; không chọn Flexible và không đổi Service URL sang HTTPS khi origin chưa phục vụ HTTPS;
  - giữ Access cho English/Tiếng Việt trong giai đoạn hiện tại; Admin luôn giữ Access; webhook chỉ bypass đúng `/api/webhooks/` theo `docs/PAYMENTS.md`.
- [ ] Origin security: chạy `sudo bash ops/check-edge-local.sh` và xử lý mọi mục chưa đạt.
- [ ] Theo dõi:
  - Uptime check cho `https://english.happyclass.asia/api/health`;
  - kiểm tra `backup/last-success` không cũ quá 2 ngày.
- [ ] **Giọng đọc:** kiểm tra nghe thực tế trên máy tính và điện thoại; xác nhận âm thanh Piper giọng Bắc đã cache đủ cho game tiếng Việt và gói offline (xem `docs/VOICE.md`).

## Mở công khai — CHƯA ĐƯỢC THỰC HIỆN

Chỉ thực hiện khi tất cả mục bắt buộc đã đạt và chủ dự án đã duyệt hồ sơ pháp lý. Hiện thông tin chủ thể vận hành/địa chỉ chưa được cung cấp nên giữ các trang English và Tiếng Việt sau Cloudflare Access. **Không gỡ wildcard Access, không bật SePay Live và không coi CI xanh là phê duyệt mở bán.** Admin luôn giữ Access.

Khi đã đủ điều kiện và có phê duyệt riêng, tạo/kiểm thử Access application cụ thể cho từng hostname trước; sau đó mới gỡ wildcard application để chỉ English/Tiếng Việt công khai. Không thay đổi policy webhook Bypass đã giới hạn đúng path.
