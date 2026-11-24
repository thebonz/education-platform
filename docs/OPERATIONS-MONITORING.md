# Giám sát vận hành HappyClass trên DL380

HappyClass dùng chung máy chủ HPE ProLiant DL380 với các dịch vụ khác. Để tránh tác động lên CMMS/Airdrop, chỉ dùng kiểm tra không can thiệp: đọc Docker, HTTP localhost, dung lượng ổ đĩa, RAM và trạng thái sao lưu.

## Kiểm tra một lần, hoàn toàn chỉ đọc

Tại Ubuntu:

~~~bash
cd /data/education-games-platform/source
sudo bash ops/check-runtime-health.sh
~~~

Báo cáo bao gồm:

- Trạng thái `running/healthy` của `postgres`, `api`, `web` và trạng thái `tts`, `tunnel`; số lần restart tích lũy (không phải số lần restart trong ngày).
- `GET http://127.0.0.1:<HC_API_HOST_PORT>/api/health` và phản hồi kết nối PostgreSQL.
- Tỷ lệ dung lượng đã dùng trên ổ chứa `HC_DATA_DIR` (thường là `/data`) và phần trăm RAM khả dụng **toàn máy chủ**.
- Một lần chụp `docker stats --no-stream` của **chỉ năm container HappyClass**: CPU % và RAM % theo giới hạn container.
- Độ mới `status/backup.json` (mục tiêu <48 giờ) và `status/restore-test.json` (mục tiêu <192 giờ).

**Không có thao tác ghi, không gửi email/Telegram, không tự restart container, không chạy load test, không đăng nhập và không gửi webhook.** Không đọc/in mật khẩu SMTP, token Tunnel, khóa SePay. Nếu cần gom kết quả runtime và PostgreSQL dạng JSON, dùng `sudo bash ops/check-operational-alerts.sh --json` (xem [INCIDENT-MONITORING.md](INCIDENT-MONITORING.md)); lệnh này vẫn chỉ chạy một lần. Việc bật lịch tự động/cảnh báo chủ động chưa được triển khai, cần quyết định vận hành riêng.

## Cách hiểu trạng thái

| Trạng thái | Ý nghĩa |
| --- | --- |
| ✓ Đạt | Kiểm tra một lần nằm trong ngưỡng theo dõi |
| ! Cảnh báo | Cần xem lại, ví dụ RAM container ≥85% giới hạn, ổ dữ liệu ≥85%, RAM toàn host còn <10% |
| ✗ Lỗi | Container chủ chốt unhealthy, health API lỗi, sao lưu >48 giờ hoặc không có, ổ dữ liệu ≥97%, RAM toàn host còn <5% |

Các ngưỡng CPU một lần lấy mẫu mang tính định hướng: cảnh báo khi CPU gần sát giới hạn đã gán trong Compose (API/TTS 90%, Web/Postgres 180%, Tunnel 45%). **CPU 42% của TTS trong một lần chụp không phải lỗi**, vì container TTS có `cpus: 1`; phải theo dõi nhiều thời điểm và xem log nếu mức cao kéo dài hoặc âm thanh bị chậm.

Kết quả thoát: `0` nếu không lỗi/cảnh báo, `1` khi có cảnh báo, `2` khi có lỗi. Cảnh báo không tự sửa cấu hình.

## Lưu ý về thông số hiện tại

Các số liệu thực tế của lần smoke test gần đây trên DL380:

| Mục | Kết quả | Nhận xét |
| --- | --- | --- |
| API health | 12/12, p50 4ms, p95 16ms | Tốt với tải nhẹ nội bộ |
| English | 12/12, p50 54ms, p95 140ms | Chưa đánh giá độ trễ qua Cloudflare |
| Vietnamese | 12/12, p50 55ms, p95 79ms | Chưa đánh giá cùng nhiều học viên |
| RAM toàn host | 55GiB khả dụng / 62GiB | Nhiều dư địa ở thời điểm đo |
| Swap | 0B sử dụng | Không thấy áp lực hoán đổi |
| `/data` | 1% sử dụng, ~1.1TB trống | Dư địa còn lớn |
| TTS | CPU 42.08% (một lần chụp) | Không đủ căn cứ kết luận lỗi |

Đây là baseline từ **một bài kiểm tra 36 GET nội bộ**, không phải cam kết chịu tải hay đo tốc độ website từ Internet.

## Khi có lỗi

1. Chạy lại `sudo bash ops/check-runtime-health.sh` để xem cảnh báo có lặp lại hay không.
2. Xem `sudo docker compose ps` và `sudo docker compose logs --tail=80 api web postgres tts` (không đăng log có bí mật).
3. Nếu sao lưu cũ: kiểm tra `systemctl status happyclass-backup.timer` và lịch sử `/data/education-games-platform/logs/backup.log`. Không chạy restore thật để xử lý lỗi monitoring.
4. Nếu TTS dùng CPU cao liên tục: kiểm tra số request âm thanh, hàng đợi/cached TTS, rồi mới cân nhắc tối ưu.

Vì bài kiểm tra không truy cập Cloudflare Dashboard, các mục **WAF, Access, TLS và webhook Bypass** vẫn phải được kiểm tra riêng theo `docs/CLOUDFLARE-HARDENING.md`.
