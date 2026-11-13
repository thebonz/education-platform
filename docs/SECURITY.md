# Bảo mật HappyClass

Tài liệu này ghi lại những gì cần bảo vệ, các biện pháp đã có, cách các biện pháp được kiểm thử tự động trên mỗi PR, và những rủi ro còn lại.

## Tài sản cần bảo vệ

| Tài sản | Rủi ro chính | Biện pháp |
| --- | --- | --- |
| Tài khoản người lớn (email, mật khẩu) | Đoán mật khẩu, dò email, chiếm phiên | Argon2id; giới hạn 10 lần/phút/IP; cùng một lỗi cho sai email và sai mật khẩu; cookie `HttpOnly`, `SameSite=Lax`, `Secure`; thu hồi phiên khi đổi mật khẩu hoặc bị khoá |
| Dữ liệu học sinh (biệt danh, kết quả) | Lộ cho người ngoài lớp | Không có email/tài khoản; chỉ chủ lớp xem (404 với người khác); mã lớp 6 ký tự, có giới hạn tần suất, đổi được |
| Nội dung game trả phí | Lấy nội dung không trả tiền | Nội dung chỉ trả qua `/play` sau khi `AccessService` kiểm quyền; gói offline ký số ECDSA, có hạn |
| Thanh toán | Webhook giả, cấp gói hai lần | Khoá API so sánh timing-safe; giao dịch duy nhất theo mã ngân hàng; `SELECT … FOR UPDATE`; số tài khoản chỉ ở `.env` |
| Quản trị | Leo thang quyền | Mọi route `/api/admin/*` đòi `admin.access` + một quyền cụ thể; chỉ Super Admin cấp được Super Admin |
| Máy chủ dùng chung (CMMS, Airdrop) | Ảnh hưởng chéo | Project Docker và network riêng; container chạy user `node`, `no-new-privileges`; cổng chỉ bind `127.0.0.1`; PostgreSQL không publish cổng |
| Bản sao lưu | Lộ dữ liệu, mất dữ liệu | Mã hoá trước khi gửi (restic); khoá chỉ có quyền trên một bucket; diễn tập khôi phục hằng tuần |

## Header và trình duyệt

- **Web:**
  - `Content-Security-Policy`: chỉ tải script và kết nối từ chính site, `object-src 'none'`, `frame-ancestors 'self'`.
  - Các header khác: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy` (tắt camera, micro, vị trí), `Cross-Origin-Opener-Policy`.
- **API:** dùng helmet (HSTS, nosniff, chống nhúng, `Referrer-Policy: no-referrer`) và không gửi `X-Powered-By`.
- **File media:** kiểm tra định dạng bằng magic byte (SVG/HTML bị từ chối); trả kèm `nosniff` và `Content-Security-Policy: sandbox`.

## Kiểm thử tự động trên mỗi PR

| Kiểm thử | Nội dung |
| --- | --- |
| `apps/api/test/security.e2e.ts` | Tự quét **toàn bộ** route của API (không liệt kê tay). Kiểm tra bốn điều: (1) chỉ các route trong danh sách công khai mới không cần đăng nhập; (2) mọi route `/api/admin/*` đòi quyền; (3) khách gọi route cần đăng nhập luôn nhận 401, thành viên thường gọi route quản trị luôn nhận 403; (4) mọi request thay đổi dữ liệu từ origin lạ hoặc không có Origin bị chặn 403. Ngoài ra kiểm tra header, lỗi không lộ stack trace, giới hạn JSON 100 KB, không dò được email khi đăng nhập |
| `apps/api/test/*.e2e.ts` khác | Phân quyền admin, khoá tài khoản, IDOR lớp học/đơn hàng, webhook sai khoá, gói offline, xoá tài khoản |
| `apps/web/e2e/security.spec.ts` | Header của Web; 17 trang chính và một game chạy không vi phạm CSP, không lỗi JavaScript; tự xoá tài khoản qua giao diện |
| `npm audit` | Lỗ hổng trong dependency production: lỗi *critical* làm CI đỏ; *high* hiện cảnh báo |
| deploy-smoke | Container không chạy root; cổng chỉ ở `127.0.0.1`; PostgreSQL không publish; cookie domain `Secure`; sao lưu mã hoá và khôi phục khớp số liệu |

Thêm một route công khai mới thì phải thêm có chủ đích vào `PUBLIC_ROUTES` trong `security.e2e.ts`. Nếu không, CI sẽ đỏ.

## Rủi ro còn lại

- CSP vẫn cho phép `'unsafe-inline'` cho script vì Next.js cần, khi chưa dùng nonce. Rủi ro XSS được giảm vì React tự escape và mã không dùng `dangerouslySetInnerHTML` với dữ liệu người dùng (chỉ dùng cho QR do máy chủ tạo và JSON-LD đã escape).
- Ảnh trong game có thể là đường dẫn `https://` bên ngoài do người soạn dán vào. Máy chủ ảnh bên ngoài sẽ thấy IP người chơi. Nên dùng thư viện media.
- Email: `MAIL_TRANSPORT=log` cho tới khi có tài khoản SMTP, nên người dùng chưa nhận được email xác thực hay đặt lại mật khẩu.
- `API_NODE_ENV=development` trong giai đoạn chạy thử. Phải chuyển sang `production` trước khi mở công khai (xem `docs/GO-LIVE.md`).

## Lỗ hổng thư viện còn lại (npm audit, 11/2026)

Các bản vá cùng major đã được áp tự động: multer 2.5.0, Next.js 15.5.29, @nestjs/platform-express 11.2.9. nodemailer đã nâng lên 10.5 để vá lỗi chèn lệnh SMTP/header, và có test gửi mail qua SMTP giả. Còn lại bốn mục, đều cần nâng cấp major:

| Gói | Vì sao chưa nâng | Mức phơi nhiễm thực tế |
| --- | --- | --- |
| zod 3 → 4 | Đổi API, dùng khắp schema game và trình soạn | Thấp: request JSON bị giới hạn 100 KB, mảng trong schema đều có giới hạn độ dài |
| prisma 6 → 7 (`@prisma/config`, `deepmerge-ts`) | Đổi cách cấu hình và chạy migrate | Thấp: lỗi nằm ở phần đọc cấu hình của CLI, không xử lý dữ liệu người dùng |
| postcss (qua Next.js 15 → 16) | Next 16 là major | Thấp: chỉ dùng lúc build CSS của chính dự án |

Nên nâng cấp các mục này thành một PR riêng sau khi mở công khai ổn định.

## Báo lỗ hổng

Gửi cho chủ dự án qua Zalo (số ở trang Bảng giá). Không thử khai thác trên hệ thống thật.
