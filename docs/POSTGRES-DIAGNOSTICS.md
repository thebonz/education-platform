# Kiểm tra PostgreSQL an toàn – HappyClass

Sau khi hoàn thành các bài kiểm tra trên DL380 ngày 24/11/2026, HappyClass có kết quả tốt ở mức tải nhẹ:

- API: 12/12 request thành công, p95 16 ms.
- Ba dịch vụ cốt lõi PostgreSQL/API/Web đều healthy, không khởi động lại.
- RAM toàn máy còn 89,7% khả dụng và ổ dữ liệu gần như chưa sử dụng.
- Sao lưu offsite/diễn tập khôi phục mới khoảng 12,3 giờ.

**Không nên tăng RAM, CPU, max_connections hoặc thay đổi tham số PostgreSQL chỉ dựa vào những kết quả trên.** Bước tiếp theo là đọc chỉ số PostgreSQL thực tế trước khi đề xuất tối ưu.

## Chạy trên DL380

~~~bash
cd /data/education-games-platform/source
sudo bash ops/check-postgres.sh
~~~

Lệnh này:

1. Xác nhận PostgreSQL **của riêng HappyClass** đang healthy.
2. Dùng `docker compose exec -T postgres` chạy tệp `ops/postgres-diagnostics.sql` trong một **transaction READ ONLY**.
3. Giới hạn mỗi truy vấn tối đa 5 giây, thời gian chờ lock tối đa 1 giây.
4. Đọc: kích thước database, `max_connections`, `shared_buffers`, `work_mem`, tình trạng `autovacuum`.
5. Đếm connection active, idle, idle in transaction, chờ khóa; đọc bộ đếm cache/rollback/deadlock/temp file.
6. Xem **tối đa 10 bảng lớn nhất** và **10 bảng có số dead tuple ước tính cao nhất** (chỉ tên bảng/thống kê; không đọc bản ghi cá nhân).

Không chạy `VACUUM`, `ANALYZE`, `EXPLAIN ANALYZE`, `ALTER SYSTEM`, migration, backup/restore hay ghi dữ liệu. Không in mật khẩu database.

## Diễn giải số liệu

| Chỉ số | Cách diễn giải |
| --- | --- |
| `total_connections`, `max_connections` | So số connection thực tế với giới hạn, nhưng đừng tăng giới hạn khi chưa có lỗi chạm trần. |
| `idle_in_transaction` | Nếu cao hoặc tồn tại lâu, xem ứng dụng giữ transaction/connection mở. |
| `waiting_for_lock` | Giá trị lớn lặp lại có thể phản ánh tranh chấp khóa; một lần đo không kết luận. |
| `cache_hit_pct` | Tỷ lệ truy cập cache PostgreSQL **tích lũy** từ `stats_reset`, không phải đo riêng 36 request vừa chạy. |
| `deadlocks`, `xact_rollback` | Bộ đếm tích lũy; cần hai lần đo cách nhau để đánh giá tốc độ phát sinh. |
| `n_dead_tup` | Thống kê *ước lượng*. Không phải chứng cứ phải chạy VACUUM ngay. |
| `last_autovacuum` | NULL có thể bình thường khi bảng nhỏ/chưa đủ hoạt động. |
| `pg_total_relation_size` | Dung lượng gồm bảng, TOAST, chỉ mục; không có dữ liệu bản ghi. |

Để đánh giá xu hướng, lưu các kết quả *không chứa bí mật* của hai hoặc nhiều lần chạy cách nhau. Không được công khai thông tin nhạy cảm từ `.env`, câu SQL do người dùng nhập, tài khoản ngân hàng hoặc nội dung giao dịch.

## Sau khi thu kết quả

Nếu không thấy nghẽn connection, lock, disk, bảng lớn hoặc autovacuum có vấn đề, **giữ nguyên cấu hình PostgreSQL 16**. Bước tiếp theo mới là rà soát query/index cụ thể hoặc triển khai cảnh báo từ hệ thống monitoring được phê duyệt. Mọi benchmark số lượng người dùng lớn phải thực hiện trên staging riêng, không tạo tải lên DL380 chung với CMMS/Airdrop.
