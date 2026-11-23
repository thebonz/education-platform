# HappyClass trên Ubuntu Server / HPE ProLiant DL380

Tài liệu bổ sung cho README, GO-LIVE và DOMAIN. DL380 được xem là máy chủ Ubuntu x86_64; RAID, NIC, iLO và BIOS phải được kiểm tra trên đúng máy, không suy đoán theo tên model.

## Nguyên tắc an toàn

- HappyClass dùng Docker Compose project riêng tên happyclass và network riêng.
- PostgreSQL không publish port ra host. Web/API chỉ bind loopback; truy cập Internet đi qua Cloudflare Tunnel.
- Dữ liệu bền vững nằm dưới /data/education-games-platform.
- Không chạy docker system prune, docker volume prune hoặc docker compose down -v trên máy chủ dùng chung.
- Không tự ý thay đổi firewall, Caddy, tunnel hoặc container của CMMS/Airdrop.
- Không commit .env, tunnel token, SMTP password, SePay key hoặc backup encryption password.

## Preflight

Chạy từ thư mục mã nguồn:

~~~bash
sudo bash ops/preflight-ubuntu-dl380.sh
~~~

Script chỉ đọc thông tin hệ thống: Ubuntu/version/architecture, CPU/RAM, block devices, mount và dung lượng /data, NTP, DNS/HTTPS outbound, Docker/Compose, cổng 3100/3101 và công cụ triển khai. Script không cài gói, không sửa firewall, không mount ổ đĩa và không khởi động/dừng container.

Khuyến nghị Ubuntu Server 22.04 hoặc 24.04 LTS, x86_64, Docker Engine và Compose v2. Trước triển khai cần xác nhận RAID controller đã tạo logical drive phù hợp; filesystem được mount ổn định tại /data (ưu tiên UUID trong /etc/fstab); có UPS/shutdown an toàn; NTP, DNS và outbound HTTPS hoạt động. Nếu cổng 3100/3101 đang được dùng, phải xác định chủ sở hữu trước, không tự dừng dịch vụ.

## Docker và triển khai

Cài Docker Engine cùng Compose plugin theo tài liệu chính thức của Docker dành cho Ubuntu. Nếu Docker đang phục vụ dự án khác, đánh giá tác động trước khi thay đổi daemon settings.

Làm theo README hiện hành:

~~~bash
sudo mkdir -p /data/education-games-platform
sudo git clone https://github.com/thebonz/education-platform.git /data/education-games-platform/source
cd /data/education-games-platform/source
sudo bash ops/deploy-test.sh
sudo bash ops/create-admin.sh
~~~

Mở thử nội bộ qua SSH tunnel, không mở 3100/3101 ra Internet:

~~~bash
ssh -L 3100:127.0.0.1:3100 <user>@<server-ip>
~~~

Sau đó truy cập http://localhost:3100.

## Kiểm tra sau triển khai

~~~bash
cd /data/education-games-platform/source
sudo docker compose ps
sudo docker compose logs --tail=150 api web postgres tts
curl -fsS http://127.0.0.1:3101/api/health
sudo bash ops/backup-db.sh manual-check
~~~

Kiểm tra đăng ký/đăng nhập, email theo transport đã cấu hình, game, phân quyền admin, upload media, giọng đọc và offline sync. Không để log chứa bí mật.

## Backup và go-live

RAID không thay thế backup; snapshot cùng máy cũng không thay thế bản offsite. Cấu hình backup mã hóa, cất encryption password tách khỏi máy chủ, chạy restore test và cài systemd timer theo docs/BACKUP.md.

Chỉ chuyển domain/production sau khi hoàn thành docs/GO-LIVE.md. Giữ Admin sau Cloudflare Access. SMTP, pháp lý, backup/restore, thanh toán sandbox, cookie Secure và API_NODE_ENV=production phải được xác minh riêng. CI xanh không phải điều kiện đủ để bật thanh toán live hoặc mở công khai.

## Hồ sơ nghiệm thu nội bộ

Ghi nhận Ubuntu/kernel, model DL380/generation và BIOS, RAID controller/mức RAID/logical drive, filesystem/UUID/dung lượng /data, CPU/RAM/NIC, UPS/iLO, Docker/Compose version, port map/firewall, tunnel ID (không lưu token), nơi lưu backup offsite, người giữ encryption password và kết quả restore test. Không commit hồ sơ chứa thông tin nhạy cảm.
