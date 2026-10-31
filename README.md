# HappyClass – English Games & Vietnamese Games

Một nền tảng lõi dùng chung (Modular Monolith) cho hai sản phẩm game giáo dục:

| Site | Chế độ domain (production) | Chế độ đường dẫn (chạy thử) |
| --- | --- | --- |
| English Games | `https://english.happyclass.asia` | `http://localhost:3100/english` |
| Vietnamese Games | `https://tiengviet.happyclass.asia` | `http://localhost:3100/vietnamese` |
| Admin | `https://admin.happyclass.asia` | `http://localhost:3100/admin` |

Tên miền **không nằm trong code**: đặt bằng biến môi trường `SITE_*_URL`.

## Trạng thái

**Giai đoạn 3 – English Games và hệ template game.**

- Đã có (giai đoạn 2): tài khoản dùng chung, đăng ký tự do + xác thực email, phiên dùng chung giữa các subdomain, phân quyền (RBAC), admin cơ bản, nhật ký thao tác.
- Mới (giai đoạn 3):
  - Game Shell: âm thanh đọc to (giọng Anh-Anh hoặc Anh-Mỹ), hiệu ứng, đồng hồ, chế độ đội, toàn màn hình (phím F), chơi lại, màn kết quả có sao.
  - 6 template: bingo, picture-match, quiz, hidden-picture, bubble-spelling, spelling.
  - 6 game tiếng Anh viết lại; 5 game tiếng Việt chuyển sang template mới ("Ghép vần" tạm ẩn chờ giai đoạn 4).
  - Thư viện lọc theo cấp độ, danh mục và loại miễn phí/trả phí; tìm kiếm không dấu.
  - Lưu kết quả chơi, game gần đây, game yêu thích; SEO gồm metadata, JSON-LD, sitemap và robots theo tên miền.
- Chưa có:
  - Vietnamese Games lớp 1–5 (giai đoạn 4);
  - Game Builder (giai đoạn 5);
  - membership và thanh toán (giai đoạn 6);
  - trường học và Offline Player (giai đoạn 7).

## Thêm game mới

- **Cùng kiểu chơi (template có sẵn):** thêm một gói vào `apps/api/src/cli/content/english.ts` hoặc `vietnamese.ts`. Mỗi gói gồm slug, tiêu đề, template, danh mục, cấp độ, `revision` và dữ liệu.
  - Dữ liệu được kiểm tra bằng schema trong `packages/game-core/src/templates.ts`. Seed từ chối gói sai và báo rõ vị trí lỗi.
  - Muốn phát hành nội dung mới cho một game đã có: tăng `revision`. Seed tạo phiên bản mới và giữ bản cũ; game đã được admin sửa thì seed không đụng tới.
  - Trên máy chủ: `sudo git pull && sudo bash ops/deploy-test.sh`.
- **Kiểu chơi mới:** thêm schema vào `game-core/src/templates.ts` và component vào `apps/web/src/games/templates/`, rồi đăng ký trong `apps/web/src/games/registry.ts`. Không cần sửa Game Shell.
- **Từ giai đoạn 5:** admin tạo game trong Game Builder, dùng chính các schema trên.

## Cấu trúc

```text
packages/
  game-core/   schema template (zod), RNG có seed, logic bingo/chấm điểm – dùng chung API và Web
apps/
  api/   NestJS + Prisma + PostgreSQL
    src/auth       đăng ký, đăng nhập, phiên (cookie HttpOnly), token email
    src/rbac       ma trận vai trò → quyền (review qua Git)
    src/admin      quản trị người dùng, sản phẩm, tên miền, nhật ký
    src/catalog    thư viện game + AccessService (điểm quyết định quyền chơi duy nhất)
    src/cli        seed.ts, create-admin.ts, content/ (gói nội dung game)
    prisma         schema.prisma, migrations/
    test           unit + e2e với PostgreSQL thật
  web/   Next.js 15 (App Router)
    src/middleware.ts        định tuyến theo tên miền
    src/app/api/[...path]    proxy cùng origin tới API
    src/app/[product]        trang English / Vietnamese
    src/app/admin            trang quản trị
    src/games                Game Shell + 6 template game
    e2e/                     Playwright: đăng nhập dùng chung giữa subdomain
docker-compose.yml           môi trường chạy thử cách ly trên DL380
.github/workflows/ci.yml     build, test, e2e, build Docker image
```

## Bảo mật đã áp dụng

- **Mật khẩu:** băm bằng Argon2id. Database chỉ lưu hash SHA-256 của token phiên và token email; token email chỉ dùng được một lần và có hạn (xác thực email 24 giờ, đặt lại mật khẩu 1 giờ).
- **Cookie phiên `hc_session`:** `HttpOnly`, `SameSite=Lax`, `Secure` (bắt buộc ở production), domain `.happyclass.asia` để dùng chung giữa các subdomain.
- **Chống CSRF:** request thay đổi dữ liệu phải có `Origin`/`Referer` thuộc danh sách site.
- **Giới hạn tần suất:** đăng nhập, đăng ký và quên mật khẩu bị giới hạn 10 lần/phút/IP (cấu hình được).
- **Không lộ email đã đăng ký:** đăng ký, đăng nhập và quên mật khẩu trả về cùng kết quả dù email có tồn tại hay không.
- **Phân quyền ở backend:** dùng `@RequirePermissions`.
  - Chỉ Super Admin cấp được quyền Super Admin, và hệ thống luôn giữ ít nhất một Super Admin.
  - Khóa tài khoản sẽ đăng xuất mọi thiết bị của người đó.
- **Nội dung game:** API danh sách không bao giờ trả nội dung game. Nội dung chỉ trả qua `/play` sau khi `AccessService` cho phép.
- **Dữ liệu trẻ em:** tài khoản do người lớn (giáo viên/phụ huynh) tạo; hệ thống lưu bằng chứng đồng ý (bảng `consents`); học sinh không cần email.
- **Bí mật:** chỉ đặt trong `.env`, không có trong Git. PostgreSQL không publish cổng ra máy chủ.

## Chạy trên máy chủ (chạy thử nội bộ)

Yêu cầu: Docker Engine + Compose v2, quyền `sudo`. Script **chỉ** tạo project Docker `happyclass` và thư mục `/data/education-games-platform`; không đụng các dự án khác. Script tự so sánh trạng thái CMMS/Airdrop trước và sau khi chạy.

```bash
sudo mkdir -p /data/education-games-platform
sudo git clone https://github.com/thebonz/education-platform.git /data/education-games-platform/source
cd /data/education-games-platform/source
sudo bash ops/deploy-test.sh      # tạo .env (mật khẩu ngẫu nhiên), build, migrate, seed, chạy, kiểm tra
sudo bash ops/create-admin.sh     # tạo Super Admin (mật khẩu nhập ẩn)
```

Cập nhật phiên bản mới: `sudo git pull && sudo bash ops/deploy-test.sh`. Script tự sao lưu database trước khi áp migration.

| Script | Việc làm |
| --- | --- |
| `ops/deploy-test.sh` | Triển khai/cập nhật, idempotent; tạo `.env` nếu chưa có (không ghi đè); kiểm tra cổng, health, các trang chính |
| `ops/create-admin.sh` | Tạo Super Admin đầu tiên |
| `ops/backup-db.sh [nhãn]` | `pg_dump` vào `/data/education-games-platform/backups`, kèm SHA-256, giữ 14 bản |

Mở thử từ máy tính cá nhân qua SSH tunnel (không mở cổng ra Internet): `ssh -L 3100:127.0.0.1:3100 rootx@<IP-máy-chủ>`, rồi vào `http://localhost:3100`.

Ở chế độ `MAIL_TRANSPORT=log`, email xác thực được in ra log: `sudo docker compose logs api | grep "DEV MAIL" -A6`.

Gỡ môi trường mà vẫn giữ dữ liệu: `sudo docker compose down`. **Không** dùng `-v`, `docker system prune` hay `docker volume prune`.

CI chạy chính các script này trên một máy mới (job `deploy-smoke`) ở mỗi pull request.

## Phát triển trên máy cá nhân

Cần Node.js 22 và PostgreSQL 16 (tên database test phải chứa chữ `test`).

```bash
npm ci
cp .env.example .env    # sửa DATABASE_URL trỏ tới localhost
(cd apps/api && npx prisma migrate deploy && npm run seed)
npm run dev:api         # http://localhost:4000/api/health
npm run dev:web         # http://localhost:3100
DATABASE_URL=postgresql://.../happyclass_test npm run test:api
```

## API chính

| Nhóm | Endpoint |
| --- | --- |
| Auth | `POST /api/auth/register`, `verify-email`, `resend-verification`, `login`, `logout`, `logout-all`, `forgot-password`, `reset-password`, `change-password`; `GET /api/auth/me` |
| Tài khoản | `GET/PATCH /api/account/profile`, `GET /api/account/sessions`, `DELETE /api/account/sessions/:id` |
| Thư viện | `GET /api/catalog/products[/:slug[/games[/:game[/play]]]]` |
| Admin | `GET /api/admin/stats`, `GET /api/admin/users`, `GET /api/admin/users/:id`, `POST …/lock`, `…/unlock`, `…/revoke-sessions`, `PUT …/roles`, `GET/PATCH /api/admin/products`, `POST /api/admin/products/:id/domains`, `DELETE /api/admin/domains/:id`, `GET /api/admin/audit-logs` |
| Hệ thống | `GET /api/health` |

## Vai trò

| Vai trò | Quyền chính |
| --- | --- |
| `member` | Tự quản lý tài khoản (Free Member; Premium = member + entitlement, từ giai đoạn 6) |
| `teacher`, `school_admin` | Như member; quyền lớp/trường bổ sung ở giai đoạn 7 |
| `support` | Xem và khóa người dùng, thu hồi phiên |
| `content_editor`, `content_reviewer` | Vào admin, xem trước game trả phí |
| `product_manager` | Sửa sản phẩm, theme, tên miền |
| `accountant` | Xem thống kê (doanh thu từ giai đoạn 6) |
| `super_admin` | Toàn quyền, gán vai trò, xem nhật ký thao tác |

## CI

Workflow `.github/workflows/ci.yml` chạy trên mỗi pull request:

1. Kiểm tra Prisma: validate schema và phát hiện lệch giữa migration với schema.
2. Typecheck và build cả API lẫn Web.
3. Chạy test API (unit + e2e) trên PostgreSQL 16 thật.
4. Chạy test Playwright đăng nhập dùng chung giữa các subdomain `*.happyclass.test`.
5. Build Docker image và kiểm tra `docker-compose.yml`.

Phiên bản đang dùng (theo `package-lock.json`): Next.js 15.5.28, NestJS 11.2.8, Prisma 6.19.3. Thay đổi schema phải đi kèm migration mới (`npx prisma migrate dev --name <tên>`); CI sẽ báo lỗi nếu migration lệch schema.
