# PostgreSQL Trend – so sánh 2 lần đo an toàn cho HappyClass

## Kết quả ban đầu (24/11/2026)

Từ hai lần chạy `ops/check-postgres.sh` trên DL380:

| Chỉ số | Quan sát |
| --- | --- |
| Kích thước database | 9359 kB (dưới 10 MB) |
| Kết nối | 8/100, trong đó 1 active và 7 idle |
| Transaction `idle in transaction` / đợi lock | 0 / 0 |
| Commit tích lũy | 567350 → 567354 (thêm 4 giữa hai lần kiểm tra) |
| Rollback / deadlock / temp file | 12 / 0 / 0, không đổi |
| Cache hit | 99,99% **tích lũy**, không phải tỷ lệ tức thời |
| Autovacuum | bật |
| Dead tuples | Ước lượng: roles 36, user_sessions 18, games 13 (quy mô rất nhỏ) |

**Kết luận:** Chưa có bằng chứng về tắc nghẽn kết nối, khóa, bộ nhớ hay nhu cầu VACUUM thủ công/tăng `max_connections`. Hai ảnh chụp gần nhau **không** chứng minh hệ thống sẽ chịu tải cao; cần quan sát theo thời gian và test tải riêng trên staging.

## Lần đo có lưu mốc

Chạy tại `/data/education-games-platform/source`:

~~~bash
sudo bash ops/check-postgres-trend.sh
~~~

- Lần đầu tạo **mốc metadata** (không đủ dữ liệu để tính tỷ lệ phát sinh). Dòng xác nhận màu xanh ở lần đầu chỉ đánh giá **chỉ số tức thời**, chưa đánh giá được xu hướng; cần ít nhất hai mẫu hợp lệ (không reset bộ đếm/khởi động lại).
- Lần sau đọc **cùng một database HappyClass** rồi so sánh với mốc vừa lưu. Có thể chạy lại cách vài giờ/ngày hoặc khi xuất hiện sự cố. Không có cron, systemd timer hay agent nền được tự cài.
- File chỉ chứa thời gian, OID database, kích thước, số lượng kết nối và bộ đếm PostgreSQL; lưu tại `HC_DATA_DIR/status/postgres-trend.json` (mặc định `/data/education-games-platform/status/postgres-trend.json`), ghi nguyên tử với quyền file `0600`. **Không đưa file vào Git hoặc chia sẻ ngoài đội vận hành.**
- Truy vấn `ops/postgres-trend.sql` chạy trong `BEGIN READ ONLY`, timeout truy vấn 5 giây, timeout lock 1 giây; kết nối bằng `docker compose exec -T postgres` của riêng project **happyclass**.
- Không chạm schema, bản ghi người học, lệnh SQL đang hoạt động, password, truy vấn người dùng, cấu hình PostgreSQL, dịch vụ CMMS/Airdrop hoặc các container khác.
- Không sửa `.env`, không thực hiện backup/migration/restart, không đổi cổng, không có quyền bật Live hay mở Cloudflare Access.

### Ý nghĩa số liệu

Trên hai lần đo liên tiếp, công cụ hiển thị delta commit/rollback/deadlock/temp files/temp bytes và tỷ lệ `blks_hit/(blks_hit + blks_read)` **riêng trong khoảng đo** nếu có hoạt động. Không chia bộ đếm tích lũy theo một khoảng đo chưa được xác lập.

Nếu `stats_reset`, thời điểm khởi động PostgreSQL hoặc OID database thay đổi, đồng hồ đi ngược hoặc bộ đếm giảm, công cụ **không tính delta âm/sai**: tự xác lập mốc mới và thông báo. `stats_reset = NULL` là giá trị có thể xảy ra, không có nghĩa là hệ thống đã lỗi.

Những ngưỡng chỉ dùng để **cảnh báo, không tự xử lý**:

- Connection ≥ 80% giới hạn: cảnh báo; ≥ 95%: lỗi.
- Có `idle in transaction` hoặc connection chờ lock: cảnh báo xem lại nếu lặp lại.
- `autovacuum` tắt: cảnh báo.
- Deadlock mới xuất hiện: cảnh báo.
- Trong khoảng có ≥ 20 transaction và tỷ lệ rollback ≥ 5%: cảnh báo để điều tra nguyên nhân.

Mã thoát `0` khi bình thường, `1` khi có cảnh báo, `2` khi lỗi/không thể đọc hoặc ghi mốc. Nếu file mốc bị hỏng, công cụ không tự xóa; phải điều tra trước khi chủ động đổi/tạo lại. Việc đổi nội dung mốc không tác động đến database.

**Không nên kết luận cần tăng CPU/RAM, chỉnh `shared_buffers`, `work_mem`, `max_connections` hay chạy `VACUUM` chỉ vì có dead tuples nhỏ hoặc một lần cảnh báo.** Cần đo nhiều lần, xem truy vấn/index và kiểm thử staging riêng trước khi thay đổi cấu hình.

Dùng `ops/check-postgres.sh` cho báo cáo đầy đủ tên bảng/tình trạng autovacuum; dùng công cụ này khi cần so sánh hai thời điểm mà không sao chép dữ liệu nhạy cảm.
