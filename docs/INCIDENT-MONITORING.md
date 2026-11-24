# HappyClass – Kiểm tra dấu hiệu sự cố theo yêu cầu (Phase 9)

Đây là bước **chuẩn bị dữ liệu cho cảnh báo vận hành**, chưa phải giám sát 24/7. Công cụ chỉ kiểm tra một lần, không tự lên lịch, không gửi thông báo, không khởi động lại dịch vụ và không ghi vào database. Máy chủ DL380 đang dùng chung với CMMS/Airdrop, vì vậy mọi kiểm tra chỉ hướng vào Compose project `happyclass` và cổng localhost.

## Chạy trên DL380

~~~bash
cd /data/education-games-platform/source
sudo bash ops/check-operational-alerts.sh
~~~

Nếu cần kết quả có cấu trúc để xem xét tích hợp hệ thống cảnh báo sau này:

~~~bash
sudo bash ops/check-operational-alerts.sh --json
~~~

Lệnh `--json` in **duy nhất một object JSON** qua stdout với các trường `schema_version`, `captured_at`, `status`, `counts`, `checks`, `postgres`, `notes`, `scope`, `scheduled` và `notifications_sent`. JSON chỉ chứa thông điệp kiểm tra/metadata được tạo từ các probe có sẵn, không chứa nội dung bảng học viên/giao dịch, truy vấn SQL đang chạy hay secret trong `.env`. Không tự gửi JSON đến URL bên ngoài.

Mức trạng thái và mã thoát:

| Trạng thái | Exit code | Ý nghĩa |
| --- | --- | --- |
| `ok` | 0 | Không phát hiện tín hiệu bất thường trong lần kiểm tra. |
| `warning` | 1 | Có điểm cần theo dõi (ví dụ backup/restore cũ, lock wait, RAM thấp). |
| `critical` | 2 | Cần kiểm tra ngay (ví dụ PostgreSQL/API unhealthy, backup offsite lỗi, disk gần đầy). |

**Các số liệu chỉ là ảnh chụp**, không phải sự cố được xác nhận, và không chứng minh hiệu năng khi tải lớn. Cảnh báo một lần không đồng nghĩa phải tăng CPU/RAM hoặc điều chỉnh PostgreSQL.

## Tín hiệu kiểm tra

- **Container HappyClass:** trạng thái, `health`, restart count của `postgres`, `api`, `web`, `tts`, `tunnel`. Không liệt kê hay thao tác container ngoài project.
- **API + database:** GET `/api/health` qua `127.0.0.1` và kiểm tra kết nối PostgreSQL.
- **Tài nguyên:** sử dụng đĩa chứa dữ liệu, RAM khả dụng toàn host và một ảnh chụp `docker stats` của container HappyClass.
- **Sao lưu:** độ mới `status/backup.json` và `status/restore-test.json` theo ngưỡng của `ops/runtime-health.py`.
- **PostgreSQL:** truy vấn `ops/postgres-trend.sql` bên trong `BEGIN READ ONLY`, tính mức dùng kết nối, lock wait, idle transaction và deadlock/rollback phát sinh so với mốc trước **nếu có**.

Công cụ **chỉ đọc** `status/postgres-trend.json` (mốc do `ops/check-postgres-trend.sh` tạo), không ghi mốc và không thay thế công cụ trend. Nếu mốc thiếu, lỗi hoặc không hợp lệ để so sánh, công cụ chỉ đánh giá chỉ số PostgreSQL tức thời và ghi chú lý do. Nếu PostgreSQL đang down, công cụ sẽ báo `critical` mà không cố chạy truy vấn vào cơ sở dữ liệu.

## Giới hạn bảo mật và vận hành

- Không có timer/cron/daemon; không gửi email, Zalo, Telegram, webhooks hoặc request ra Internet.
- Không đọc dữ liệu người dùng, mật khẩu, khóa SePay, Cloudflare token hoặc nội dung đơn hàng.
- Không tạo đơn, không viết transaction, không thay đổi cổng, Docker, systemd, backup, SePay Live hoặc Cloudflare Access.
- Không thay đổi dịch vụ CMMS/Airdrop. Lệnh shell xác minh tên Compose project trước khi chạy.
- Chưa triển khai cơ chế xác nhận cảnh báo liên tiếp, chống lặp, ca trực hoặc chuyển cấp. Những tính năng đó cần thiết kế và phê duyệt riêng trước khi có lịch chạy thực tế.
- Kiểm tra này không bao gồm đường đi qua Cloudflare, TLS/WAF, tình trạng gửi SMTP thật hoặc mô phỏng thanh toán SePay.

## Khi xuất hiện cảnh báo

Chạy lại công cụ để kiểm tra xem tín hiệu có tái diễn. Dùng `sudo bash ops/check-runtime-health.sh` để xem chi tiết, `sudo bash ops/check-postgres.sh` hoặc `sudo bash ops/check-postgres-trend.sh` để đánh giá PostgreSQL, và `docs/OPERATIONS-MONITORING.md` để xử lý các tình huống thường gặp. Không gửi log thô hoặc `.env` vào chat/công khai vì có thể chứa bí mật. Không tự VACUUM, reboot, sửa giới hạn bộ nhớ hoặc bật thanh toán Live để xử lý cảnh báo.

## Quy trình triển khai an toàn

Sau khi PR được review và CI xanh, chỉ cần cập nhật mã nguồn và chạy lệnh theo yêu cầu trên. **Không cần `deploy-test.sh` hoặc restart container** vì PR này chỉ bổ sung script/tài liệu. Nếu triển khai timer/alerts chủ động trong tương lai, phải có PR, thông số tần suất, điểm nhận thông báo, kiểm thử fail-closed và quyết định vận hành riêng.
