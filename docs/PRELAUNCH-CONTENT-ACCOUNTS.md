# HappyClass – kiểm toán nội dung và vai trò trước công khai (chỉ đọc)

Bước tiếp theo sau các bằng chứng đã được người vận hành xác nhận: **13 mục kỹ thuật đạt**, **3 mục kiểm thử SMTP/SePay được tự xác nhận**, **1 mục pháp lý còn chặn**, các hạng mục duyệt nội dung và nhân sự vẫn cần chủ dự án rà soát.

Công cụ mới kiểm tra **số đếm** trực tiếp từ PostgreSQL của **duy nhất Docker Compose project `happyclass`**, trong giao dịch `BEGIN TRANSACTION READ ONLY`. Không đọc hay xuất email, tên tài khoản, mật khẩu, IP, token, nội dung game, mã đơn, số tiền giao dịch hoặc payload thanh toán.

## Chạy khi PR đã merge và CI hoàn tất

~~~bash
cd /data/education-games-platform/source
sudo bash ops/check-prelaunch-content-accounts.sh
# Nếu muốn kết quả JSON (chỉ các tổng số)
sudo bash ops/check-prelaunch-content-accounts.sh --json
~~~

**Không cần redeploy**: đây là script chạy một lần từ source trên host; không thay đổi ứng dụng, cấu hình, database, container hoặc lịch systemd. Không tự tạo/tạm khóa/xóa user, không tự duyệt game.

## Các số liệu trả về

| Trường | Ý nghĩa |
| --- | --- |
| `games_total` | Tổng số game |
| `games_published` | Game đang được đánh dấu xuất bản |
| `games_pending_review` | Game chờ duyệt |
| `games_changes_requested` | Game được yêu cầu sửa |
| `games_approved` | Game ở trạng thái duyệt |
| `published_not_approved` | Game đang xuất bản nhưng trạng thái review không được duyệt – **block** |
| `published_without_published_version` | Game xuất bản không có phiên bản nội dung được xuất bản – **block** |
| `users_total`, `users_active`, `users_inactive` | Tổng số tài khoản chưa bị xóa và số đang hoạt động/không hoạt động |
| `active_super_admins` | Số Super Admin hoạt động – 0 là **block** |
| `active_content_reviewers` | Số tài khoản giáo viên duyệt chuyên trách đang hoạt động |
| `staff_role_assignments` | Tổng lượt cấp các vai trò nhân sự trong hệ thống; không phải số người duy nhất |

Số game `PENDING` hay `CHANGES_REQUESTED` được gắn cờ **manual** để giáo viên xem trong giao diện Admin, không tự kết luận game lỗi hoặc phải xóa hết. Không tự suy diễn một tài khoản là “test” từ email/tên; việc rà soát người dùng thử và vai trò vẫn là bước **manual**.

## Diễn giải tình trạng

- `block` – có lỗi nhất quán dữ liệu công bố hoặc không còn Super Admin, cần xem xét trước go-live.
- `manual` – người phụ trách phải xem cụ thể trong giao diện quản trị, kể cả khi số liệu tổng hợp sạch.
- `pass` – điều kiện tự động riêng lẻ đạt, **không có nghĩa chủ dự án đã phê duyệt**.

Mã thoát `1` khi không có blocker nhưng vẫn cần nghiệm thu con người, `2` khi có blocker hoặc không truy vấn được PostgreSQL. Không dùng mã 0 để ra quyết định mở public. JSON luôn mang `public_release_allowed=false`, `content_review_approved=false` và `admin_accounts_approved=false`.

## Hành động tiếp theo

Nếu còn game chờ duyệt, người có quyền `content_reviewer` vào Admin → Nội dung game → kiểm tra và duyệt từng game. Nếu Super Admin vắng mặt hoặc vai trò nhân sự chưa được rà soát, xử lý thủ công trong Admin, không sửa SQL trực tiếp. Sau khi xác minh, người vận hành có thể chạy `check-manual-acceptance.sh --attest content.review --confirm I_VERIFIED` hoặc `--attest admin.accounts` **chỉ khi đã thực hiện đúng bước tương ứng**.

**Chặn pháp lý chưa được giải quyết:** vẫn phải cung cấp chủ thể vận hành, địa chỉ và phê duyệt điều khoản/chính sách song ngữ. Giữ Cloudflare Access và `PAYMENT_MODE=sandbox`. Xem [GO-LIVE.md](GO-LIVE.md) và [MANUAL-ACCEPTANCE.md](MANUAL-ACCEPTANCE.md).
