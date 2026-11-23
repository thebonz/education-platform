# Cấu hình SMTP và kiểm tra email

HappyClass cần SMTP thật để gửi liên kết xác thực email, đặt lại mật khẩu và thông báo tài khoản. Ở chế độ `MAIL_TRANSPORT=log`, nội dung chỉ được ghi vào log của API; người dùng không nhận được email. Production bắt buộc `MAIL_TRANSPORT=smtp`.

## Cấu hình dễ dàng trên Ubuntu

Chạy tại Terminal của server:

~~~bash
cd /data/education-games-platform/source
sudo bash ops/configure-mail.sh
~~~

Script sẽ hỏi:
- SMTP host (ví dụ `smtp.gmail.com` hoặc máy chủ SMTP do nhà cung cấp email cấp).
- SMTP port: thường 587 cho STARTTLS hoặc 465 cho TLS ngay khi kết nối.
- TLS: chọn `false` cho 587; `true` cho 465, trừ khi nhà cung cấp hướng dẫn khác.
- SMTP username và app password/mật khẩu SMTP (mật khẩu nhập ẩn).
- Địa chỉ người gửi, ví dụ `HappyClass <no-reply@happyclass.asia>`.
- Email nhận thư kiểm tra.

Script sao lưu `.env` với quyền 600, ghi thông tin SMTP đã escape đúng định dạng Docker Compose, xác thực SMTP và gửi email thử bằng container API. Chỉ sau khi gửi thử thành công, script mới khởi động lại API và Web. Nếu kiểm tra SMTP thất bại, cấu hình `.env` cũ được khôi phục và API/Web không bị khởi động lại.

Không gửi SMTP password qua chat, không đưa vào Git, không chụp màn hình terminal có chứa bí mật. Nếu dùng Gmail hoặc nhà cung cấp có MFA, thường phải tạo app password hoặc SMTP credential riêng; không dùng mật khẩu đăng nhập thông thường nếu nhà cung cấp không hỗ trợ.

## Gửi email kiểm tra lại

Sau khi cấu hình, có thể gửi email kiểm tra bất kỳ lúc nào:

~~~bash
cd /data/education-games-platform/source
sudo bash ops/test-mail.sh email-cua-anh@example.com
~~~

Lệnh này xác thực kết nối SMTP, gửi đúng một email kiểm tra và không thay đổi cấu hình.

## Kiểm tra trạng thái

Vào Admin → Tình trạng hệ thống → Email. Trạng thái xanh chỉ xác nhận HappyClass đã cấu hình SMTP; để xác nhận nhà cung cấp chấp nhận gửi thư, phải nhận được email kiểm tra trong Inbox (kiểm tra cả Spam/Quảng cáo).

## Hoàn tác

Script cấu hình in ra tên file `.env.bak-mail-...` đã tạo. Để quay lại cấu hình trước đó:

~~~bash
cd /data/education-games-platform/source
sudo cp .env.bak-mail-YYYYMMDD-HHMMSS .env
sudo chmod 600 .env
sudo docker compose up -d api web
~~~

Thay tên file mẫu bằng đúng tên bản sao lưu được in ra trên Terminal.
