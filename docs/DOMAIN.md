# Gắn tên miền happyclass.asia qua Cloudflare Tunnel

Mục tiêu giai đoạn này: **chạy thử nội bộ**. Trang chạy trên tên miền thật, có HTTPS, nhưng toàn bộ site bị chặn bằng Cloudflare Access; chỉ những email anh/chị cho phép mới vào được.

```text
Người dùng ──HTTPS──▶ Cloudflare (DNS, HTTPS, Access) ──Tunnel──▶ container "tunnel" ──▶ web:3000 ──▶ api:4000 ──▶ PostgreSQL
```

- Tunnel do máy chủ **chủ động kết nối ra ngoài**: không mở cổng nào trên router hay máy chủ, không cần IP tĩnh.
- Đây là **tunnel riêng của HappyClass**, chạy trong Docker project `happyclass`. `cloudflared` đang chạy sẵn trên máy chủ (của dự án khác) không bị đụng tới.
- **Không cần tự tạo bản ghi DNS.** Khi khai báo tên miền trong tunnel (bước 2), Cloudflare tự tạo bản ghi CNAME cho từng subdomain.

## Bước 1 – Tạo tunnel (trên Cloudflare)

1. Vào [Cloudflare Zero Trust](https://one.dash.cloudflare.com/). Lần đầu, Cloudflare yêu cầu đặt tên nhóm (team name) và chọn gói. Gói **Free** dùng tối đa 50 người, đủ cho giai đoạn thử.
2. **Networks → Tunnels → Create a tunnel → Cloudflared**, đặt tên `happyclass`.
3. Ở màn hình cài connector, chọn **Docker**. Cloudflare hiện một lệnh có dạng `docker run cloudflare/cloudflared ... --token eyJ...`.
   - **Không chạy lệnh đó.** Chỉ sao chép phần token phía sau `--token`.
   - Giữ token như mật khẩu: không gửi qua chat, không đưa vào Git.

## Bước 2 – Khai báo tên miền cho tunnel

Trong tunnel `happyclass`, mục **Public hostnames** (giao diện mới gọi là *Published application routes*), thêm 3 dòng:

| Subdomain | Domain | Service type | URL |
| --- | --- | --- | --- |
| `english` | happyclass.asia | HTTP | `web:3000` |
| `tiengviet` | happyclass.asia | HTTP | `web:3000` |
| `admin` | happyclass.asia | HTTP | `web:3000` |

Có thể thêm dòng thứ 4 cho trang giới thiệu chung: để trống Subdomain, Domain `happyclass.asia`, URL `web:3000`.

`web:3000` là tên container trong mạng nội bộ Docker của HappyClass; cổng này không mở ra máy chủ.

## Bước 3 – Chặn truy cập bằng Cloudflare Access (thử nội bộ)

1. **Access → Applications → Add an application → Self-hosted** (giao diện mới: *Access controls → Applications*).
2. Application domain: thêm `*.happyclass.asia` và `happyclass.asia`.
3. Policy: Action **Allow**, Include **Emails**, nhập email của anh/chị và các giáo viên thử.
4. Lưu. Từ giờ, người mở trang phải nhập email và mã gửi qua email mới vào được.

Từ giai đoạn 6, đường dẫn webhook thanh toán (`/api/webhooks/*`) sẽ cần policy **Bypass** riêng, để SePay gọi vào được. Phần này sẽ làm cùng giai đoạn thanh toán.

## Bước 4 – Bật trên máy chủ

```bash
cd /data/education-games-platform/source
sudo git pull
sudo bash ops/enable-domain.sh          # dán token khi được hỏi (ký tự không hiện ra)
```

Script sẽ:

1. Sao lưu `.env`.
2. Chuyển sang chế độ tên miền: `SITE_*_URL=https://...`, cookie dùng chung `.happyclass.asia` có cờ Secure.
3. Khởi động lại web/api, kiểm tra định tuyến từng tên miền.
4. Bật container `tunnel` và chờ tunnel kết nối được tới Cloudflare.

Sau khi bật, mở `https://english.happyclass.asia`. Cloudflare Access sẽ hỏi email trước.

## Hoàn tác

```bash
sudo cp .env.bak-<thời-gian> .env
sudo docker compose --profile tunnel stop tunnel
sudo docker compose up -d api web
```

Muốn tắt hẳn tên miền: xóa tunnel `happyclass` trong Cloudflare. Các bản ghi DNS do tunnel tạo cũng xóa trong mục DNS của happyclass.asia.

## Khi mở công khai (sau này)

Trước khi bỏ Cloudflare Access ở `english.` và `tiengviet.`, cần có:

- trang Điều khoản và Chính sách quyền riêng tư;
- SMTP gửi email thật, và đặt `API_NODE_ENV=production`;
- kiểm thử bảo mật của giai đoạn 8.

`admin.happyclass.asia` nên **giữ Cloudflare Access vĩnh viễn**.
