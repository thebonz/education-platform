# Sao lưu và khôi phục

HappyClass có hai lớp sao lưu:

| Lớp | Nơi lưu | Nội dung | Giữ |
| --- | --- | --- | --- |
| Cục bộ | `/data/education-games-platform/backups` | Bản dump database (`pg_dump -Fc`) | 14 bản gần nhất |
| Ngoài máy chủ | Cloudflare R2 hoặc Backblaze B2 | Database + thư viện ảnh/âm thanh + bản sao `.env`, **mã hoá trước khi gửi** (restic, AES-256) | 14 ngày, 8 tuần, 12 tháng |

restic chạy trong container dùng một lần (`restic/restic:0.17.3`). Không cài phần mềm nào lên máy chủ. Các script chỉ đọc dữ liệu HappyClass và không đụng CMMS hay Airdrop.

## 1. Chuẩn bị kho lưu trữ (làm một lần)

**Cloudflare R2:**
1. Vào R2 → Create bucket, đặt tên ví dụ `happyclass-backup`. Không bật public access.
2. Vào R2 → Manage API tokens → Create API token, chọn quyền **Object Read & Write** và **chỉ** bucket vừa tạo.
3. Ghi lại Access Key ID, Secret Access Key và Account ID (hiện ở trang R2).

**Backblaze B2:**
1. Tạo bucket loại Private, ví dụ `happyclass-backup`. Ghi lại vùng trong Endpoint, ví dụ `s3.us-west-004.backblazeb2.com` thì vùng là `us-west-004`.
2. Vào Application Keys → Add a New Application Key, chọn quyền Read and Write và chỉ bucket này.

## 2. Cấu hình trên máy chủ

```bash
cd /data/education-games-platform/source
sudo bash ops/configure-backup.sh                  # chọn R2/B2, nhập thông tin (secret nhập ẩn)
sudo bash ops/configure-backup.sh --show-password  # in mật khẩu mã hoá → cất vào trình quản lý mật khẩu
```

> **Mật khẩu mã hoá là chìa khoá duy nhất.** Mất nó thì không ai, kể cả HappyClass hay Cloudflare/Backblaze, khôi phục được bản sao lưu. Hãy cất ở ít nhất hai nơi ngoài máy chủ, ví dụ trình quản lý mật khẩu và giấy niêm phong. Script không bao giờ ghi đè mật khẩu này.

Cấu hình nằm ở `/data/education-games-platform/backup/backup.env` (chmod 600), không nằm trong Git.

## 3. Chạy thử và lên lịch

```bash
sudo bash ops/backup-offsite.sh          # sao lưu ngay
sudo bash ops/restore-test.sh            # diễn tập khôi phục (không đụng database đang chạy)
sudo bash ops/install-backup-timer.sh    # 02:30 hằng ngày sao lưu, 04:00 thứ Hai diễn tập khôi phục
```

`install-backup-timer.sh` là thay đổi duy nhất trên máy chủ: thêm 4 file unit `happyclass-backup.*` và `happyclass-restore-test.*` vào `/etc/systemd/system`. Gỡ bằng `--remove`.

Theo dõi:
- `tail -n 50 /data/education-games-platform/logs/backup.log`
- `cat /data/education-games-platform/backup/last-success` (lần sao lưu thành công gần nhất)
- `cat /data/education-games-platform/backup/last-restore-test` (lần diễn tập gần nhất)
- `sudo bash ops/configure-backup.sh --check` (danh sách bản sao lưu trên kho)

Mỗi Chủ nhật, script đọc lại 10% dữ liệu trên kho để phát hiện file hỏng.

## 4. Diễn tập khôi phục làm gì

1. Tải bản mới nhất về thư mục tạm và kiểm tra checksum file database.
2. Kiểm tra **từng** file media: tên file là mã SHA-256 nên so được nội dung.
3. Khởi động một PostgreSQL tạm (`--network none`, không mở cổng), khôi phục vào đó và đối chiếu số dòng của 11 bảng quan trọng với số đếm lúc sao lưu.
4. Xoá container tạm và thư mục tạm.

## 5. Khôi phục thật (khi mất dữ liệu)

Chỉ làm khi đã chắc chắn cần. Trước đó phải sao lưu trạng thái hiện tại: `sudo bash ops/backup-db.sh before-restore`.

```bash
cd /data/education-games-platform/source
sudo bash ops/restore-test.sh --keep                 # tải về và kiểm tra, GIỮ thư mục
R=$(ls -d /data/education-games-platform/backup/restore-test-* | tail -n1)/backup/stage

# Database: khôi phục đè vào database HappyClass (dừng api/web trước)
sudo docker compose stop web api
sudo docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' < "$R/db/happyclass.dump"

# Media
sudo rsync -a "$R/../media/" /data/education-games-platform/media/assets/
sudo chown -R 1000:1000 /data/education-games-platform/media/assets

sudo docker compose up -d api web
```

Khi cài lại trên **máy chủ mới**, file `$R/config/env` là bản `.env` cũ: chép về `source/.env` trước khi chạy `ops/deploy-test.sh` để giữ khoá ký offline, khoá webhook và cấu hình thanh toán.
