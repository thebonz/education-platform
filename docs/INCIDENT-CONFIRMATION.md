# HappyClass – Xác nhận sự cố, chống lặp và phát hiện hồi phục (Phase 9)

Đây là **bước bổ sung** cho [giám sát sự cố thủ công](INCIDENT-MONITORING.md), sau khi trên DL380 xuất hiện kết quả 16/16 OK, không cảnh báo, không lỗi. Công cụ không cài cron/systemd, **không gửi thông báo**, không khởi động lại Docker, không điều chỉnh PostgreSQL và không thao tác các dịch vụ CMMS/Airdrop.

## Sử dụng sau khi PR được merge và CI đạt

Trên DL380, tại `/data/education-games-platform/source`:

~~~bash
# Xem trước — chỉ đọc, tuyệt đối không lưu trạng thái
sudo bash ops/check-incident-confirmation.sh

# Xem trước có cấu trúc — chỉ in JSON, không lưu
sudo bash ops/check-incident-confirmation.sh --json

# Chủ động xác nhận lưu một mẫu metadata trong thư mục trạng thái HappyClass
sudo bash ops/check-incident-confirmation.sh --record

# Ghi mẫu và lấy JSON để kiểm tra thủ công
sudo bash ops/check-incident-confirmation.sh --record --json
~~~

**Quan trọng:** Nếu chỉ chạy lệnh không có `--record`, các lần chạy không tích lũy thành chuỗi cảnh báo, vì không có file trạng thái được ghi. `--record` là hành động thủ công có chủ đích, tạo/cập nhật file `HC_DATA_DIR/status/incident-confirmation.json` với quyền `0600`. File chỉ chứa key tín hiệu, mức độ và timestamp/counter; được ghi nguyên tử, lock chống hai lần ghi đồng thời, không ghi dữ liệu người dùng hay giao dịch. Không đưa file lên GitHub.

## Quy tắc xác nhận

- **Cảnh báo (warning):** cần ít nhất **hai lần ghi mẫu** có cùng sự cố, cách nhau tối thiểu 60 giây, tối đa 24 giờ (nếu chưa xác nhận) mới chuyển thành *confirmed*. Các lần chạy sát nhau không tạo xác nhận giả.
- **Lỗi nghiêm trọng (critical):** được xác nhận ngay ở lần ghi đầu tiên vì không nên trì hoãn phản ứng với API/PostgreSQL down hoặc backup lỗi.
- **Chống lặp:** một sự cố đã được xác nhận mà vẫn cùng mức độ không tạo sự kiện *confirmed* mới. Tăng mức *warning → critical* sinh *escalated* một lần; giảm mức sinh *deescalated* một lần.
- **Hồi phục:** cần **hai lần ghi mẫu tốt** cách nhau ít nhất 60 giây. Một lần xanh chỉ ở trạng thái *recovering*; lần xanh thứ hai mới sinh sự kiện *recovered* và bỏ sự cố khỏi trạng thái.
- **Không tự tuyên bố hồi phục nếu không kiểm tra được:** khi monitor tổng bị lỗi hoặc PostgreSQL unavailable, tín hiệu cũ được giữ ở *held_unverified*; khi probe không được chạy, sự cố cũ cũng không tự mất.
- **Không phát báo:** mọi `transitions` (*confirmed, escalated, deescalated, recovered*) chỉ in ra màn hình hoặc JSON cho người vận hành; `notifications_sent=false`, `scheduled=false`.

Output `--json` giữ các trường nguồn từ `ops/check-operational-alerts.sh --json` và thêm `confirmation`, bao gồm `recorded`, `active_confirmed`, `pending`, `recovering`, `held_unverified` và `transitions`. Các mục dùng key ổn định như `container.postgres`, `api.health`, `backup.offsite`, `postgres.lock_wait`, không lấy giá trị CPU/RAM hay số phút đưa vào danh tính sự cố.

## Mã thoát và giới hạn

Giữ mã thoát của kết quả hiện tại: `0=OK`, `1=warning`, `2=critical/lỗi nội bộ`. Một sự cố đã *confirmed* không làm thay đổi kết quả health tức thời. Trạng thái không phải là cam kết chịu tải, không thay thế hệ thống cảnh báo 24/7. Các lần `--record` phải do người vận hành chủ động thực hiện; chỉ khi có yêu cầu riêng và review bảo mật mới cân nhắc lịch chạy và kênh gửi thông báo.

**Không chạy thử bằng cách tắt container thật, khóa database hay chỉnh quyền backup trên máy DL380 dùng chung.** CI có unit tests mô phỏng mọi tình huống (lỗi, cảnh báo, hồi phục, cạnh tranh ghi và trường hợp probe mất) và smoke test trên container cách ly.
