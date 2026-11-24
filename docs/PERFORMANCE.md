# Kiểm tra hiệu năng an toàn trên HPE DL380

HappyClass chạy cùng máy chủ với những dịch vụ khác. Tuyệt đối không benchmark không giới hạn hoặc chạy thử DDoS/stress lên DL380 đang vận hành. Bước này chỉ đo **smoke performance rất nhẹ** để phát hiện lỗi hiển nhiên sau khi triển khai.

## Chạy kiểm tra

Tại Ubuntu Terminal:

~~~bash
cd /data/education-games-platform/source
sudo bash ops/check-performance.sh
~~~

Script:
1. Xác nhận PostgreSQL, API và Web của HappyClass healthy.
2. Gửi **GET nội bộ tới 127.0.0.1** với header Host tương ứng, không gọi domain công khai:
   - `/api/health` trên API (kiểm tra PostgreSQL thực sự kết nối).
   - Trang chủ English.
   - Trang chủ Tiếng Việt.
3. Mặc định gửi 12 GET mỗi đích (**tổng cộng 36**), tối đa **2 yêu cầu đồng thời trên từng đích**. Các đích được chạy lần lượt, không chạy chồng tải.
4. Hiển thị số request thành công, p50/p95/max latency (ms). Nếu p95 vượt 2.500 ms thì cảnh báo để kiểm tra, không tự kết luận có lỗi hiệu năng.
5. In số liệu RAM, dung lượng lưu trữ và `docker stats` của **chỉ những container HappyClass** sau khi kiểm tra. Đây là ảnh chụp sau thử nghiệm, **không phải peak usage**.

Những hạn chế an toàn được hard-code: tối đa 20 GET/đích, tối đa 3 yêu cầu đồng thời, timeout 8 giây mỗi request. Chỉ dùng HTTP tới loopback `127.0.0.1`; redirect bị chặn, không thể vô tình đánh vào hệ thống bên ngoài. Không đăng nhập, không thay đổi dữ liệu, không tạo đơn hàng, không gửi webhook, không thay đổi cấu hình Docker hay `.env`.

**Chạy script này không đủ để xác nhận hệ thống chịu được 100/1.000 người dùng đồng thời.** Cần thiết kế bài benchmark riêng dựa trên kịch bản học, đọc/ghi, tỷ lệ cache, âm thanh TTS, trang game, cấu hình CPU/RAM thực tế và tải đang chạy của các ứng dụng khác. Chỉ thực hiện kiểm thử tải lớn trên staging riêng hoặc trong cửa sổ bảo trì đã được phê duyệt.

## Đọc kết quả

Ví dụ:

~~~text
✓ API health: 12/12 HTTP 200 | p50 20ms | p95 44ms | max 48ms
✓ English: 12/12 HTTP 200 | p50 35ms | p95 75ms | max 90ms
✓ Vietnamese: 12/12 HTTP 200 | p50 34ms | p95 78ms | max 93ms
~~~

Các giá trị trên là **ví dụ minh họa, không phải kết quả trên DL380**. Nếu có lỗi HTTP, timeout hoặc p95 tăng cao so với lần đo trước, kiểm tra `sudo docker compose ps`, `sudo docker compose logs --tail=80 api web postgres`, `free -h` và `df -h /data`. Không tự tăng CPU/memory limits nếu chưa tìm ra nguyên nhân.

## Cách kiểm tra tùy chọn

Nếu cần giảm số request còn 3 mỗi đích (dành cho server đang bận):

~~~bash
sudo python3 ops/smoke-load-local.py --requests 3 --concurrency 1
~~~

Lệnh này vẫn chỉ gọi localhost và không tác động dữ liệu. Không sử dụng công cụ tạo tải lớn trực tiếp từ Internet.

## Tiêu chí hoàn thành giai đoạn kiểm tra tải nhẹ

- 3/3 endpoint có 100% request HTTP 200 và health API báo DB `connected`.
- Không thấy lỗi hoặc dấu hiệu container restart.
- P95 được ghi nhận làm baseline để so sánh ở các lần cập nhật sau.
- Chủ dự án xác nhận WAF/Access/TLS trên Cloudflare **riêng**; kiểm tra nội bộ không thể thay cho nghiệm thu Cloudflare.
