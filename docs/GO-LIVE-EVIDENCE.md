# HappyClass – Bảng bằng chứng trước khi mở công khai (Phase 9)

Mục đích: tổng hợp **bằng chứng kỹ thuật đã xác minh được** và tách rõ những bước **bắt buộc phải nghiệm thu thủ công** trước khi mở English Games, Tiếng Việt hoặc bật SePay Live.

Hệ thống đang chạy thử sau Cloudflare Access. **Không có script nào tại đây tự phê duyệt go-live.**

## Chạy trên DL380 (chỉ đọc)

~~~bash
cd /data/education-games-platform/source
sudo bash ops/check-go-live-evidence.sh
~~~

Nếu cần JSON để lưu kết quả trên máy riêng (không gửi JSON lên dịch vụ ngoài):

~~~bash
sudo bash ops/check-go-live-evidence.sh --json
~~~

Script **không** thay đổi file, Docker, systemd, cấu hình Cloudflare, `.env`, trạng thái SePay hoặc cơ sở dữ liệu. Không tạo đơn hoặc gửi email thử. Không hiển thị mật khẩu SMTP, khóa webhook, nội dung `.env` hay số tài khoản ngân hàng.

## Những gì kiểm tra tự động

- Quyền `.env` chính xác 0600, `API_NODE_ENV=production`, `COOKIE_SECURE=true`.
- Cấu hình SMTP cơ bản (`MAIL_TRANSPORT=smtp`, host, cổng, người gửi và cặp username/password). **Chỉ kiểm tra hình thức, không xác nhận email đến Inbox**.
- Thanh toán vẫn ở `sandbox`, cấu hình tài khoản có định dạng hợp lệ, khóa webhook tối thiểu 24 ký tự (chỉ đọc độ dài, không in giá trị).
- Khóa offline và liên hệ Zalo đã được đặt.
- Hai mốc sao lưu và diễn tập khôi phục có `lastSuccess` còn mới (48/192 giờ). **Không chứng minh thông tin đã có mặt trong kho R2/B2**; việc đó cần nghiệm thu riêng.
- Timer `happyclass-backup.timer` và `happyclass-restore-test.timer` ở trạng thái enabled + active. **Không cài hay khởi động timer**.
- File `legal.tsx` không còn các dấu nháp đã biết. **Không thay thế duyệt pháp lý**.

Script không thực hiện đo tải hoặc truy cập công khai qua Cloudflare; dùng `ops/check-operational-alerts.sh` để xem runtime và `ops/check-edge-local.sh` để xem cấu hình origin riêng.

## Cách đọc kết quả

| Trạng thái | Ý nghĩa |
| --- | --- |
| `pass` | Chỉ điều kiện **kỹ thuật tương ứng** đã qua kiểm tra hiện tại. |
| `block` | Điều kiện chưa đạt hoặc không thể xác minh; script đề xuất hành động tiếp theo. |
| `manual` | Không được suy diễn từ cấu hình – cần người phụ trách thử nghiệm, kiểm tra chứng cứ và xác nhận. |

Trong cả hai trường hợp (có blocker hoặc không), JSON luôn có `public_release_allowed=false` và `requires_owner_approval=true`.

Mã thoát: `2` nếu có `block`, `1` nếu không có blocker nhưng vẫn cần nghiệm thu thủ công. **Không có exit 0 cho việc tự động cấp quyền go-live.** Khi chạy trong CI với cấu hình mẫu, expect exit code 2 là bình thường vì môi trường chưa phải production.

Những mục luôn cần nghiệm thu thực tế:

- Email tới hộp thư thật; đăng ký, gửi lại xác thực, quên mật khẩu.
- SePay Test Mode: đúng tiền/đúng mã, thiếu tiền/sai mã, webhook lặp, quyền gói sau khi thanh toán giả lập.
- Cloudflare Access, WAF, TLS, rate limit, webhook Bypass chỉ đúng đường dẫn.
- Chủ thể pháp lý, địa chỉ, chính sách hoàn tiền và quyền riêng tư **được chủ dự án duyệt**.
- Tài khoản nhân sự, phân quyền và các trò chơi đã được giáo viên duyệt.
- **Phê duyệt cuối cùng** của chủ dự án đối với việc mở public và thay đổi SePay Live.

Những mục trên không được đánh dấu `pass` tự động ngay cả khi các thông số kỹ thuật đều xanh.

## Kết quả dự kiến với hiện trạng

Bản ghi vận hành gần đây trên DL380 có 16/16 tín hiệu khỏe, PostgreSQL 8/100 kết nối, không có deadlock/rollback mới, backup/restore cách đó 17,9 giờ. Các thông số đó **chỉ chứng minh runtime hiện tại**, không thể suy ra SMTP thật, hồ sơ pháp lý hoặc SePay Test Mode đã nghiệm thu. Do đó trước khi có bằng chứng và quyết định riêng, **giữ Cloudflare Access và SePay Sandbox như hiện tại**.

## Dành cho kiểm thử ngoại tuyến

Chạy `python3 ops/go-live-evidence.py --env-file path/to/sample.env --data-dir path/to/sample-data --legal-file path/to/legal.tsx --no-systemd --json` để kiểm tra trên fixtures. Trong chế độ `--no-systemd`, timer được gán `manual` thay vì `pass`; điều đó không phải bằng chứng trạng thái timer trên DL380.

Giữ các văn bản hiện có: [GO-LIVE.md](GO-LIVE.md), [MAIL.md](MAIL.md), [PAYMENTS.md](PAYMENTS.md), [CLOUDFLARE-HARDENING.md](CLOUDFLARE-HARDENING.md). Không công khai kết quả JSON nếu có thêm chú thích nội bộ của nhân sự.
