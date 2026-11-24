# Cloudflare hardening cho HappyClass

Tài liệu này dành cho kiến trúc đang dùng trên DL380:

```text
Internet
  └─ Cloudflare Edge (HTTPS, Access, WAF)
       └─ Cloudflare Tunnel riêng "happyclass"
            └─ http://web:3000 (mạng Docker nội bộ)
                 └─ API http://api:4000 (mạng Docker nội bộ)
                      └─ PostgreSQL
```

## 1. Những điều không được thay đổi

- Không mở cổng 3100, 3101 hoặc PostgreSQL ra Internet. Web/API chỉ bind vào `127.0.0.1` trên host; Tunnel đi ra ngoài và chuyển tiếp tới `http://web:3000`.
- Không thay Service URL của Tunnel thành `https://web:3000`: web container đang phục vụ HTTP trong mạng Docker. Không bật `noTLSVerify` để chữa lỗi kết nối HTTP.
- Không xóa Cloudflare Access trong giai đoạn hiện tại. English, Tiếng Việt và Admin tiếp tục được giới hạn người được mời. Admin phải luôn giữ Access.
- Webhook SePay chỉ bypass Access tại `english.happyclass.asia/api/webhooks/`; endpoint vẫn bắt buộc API Key. Không bypass toàn bộ hostname hoặc `/api/*`.
- Không bật Under Attack Mode toàn zone khi chưa có sự cố được xác minh.
- Không bật Cache Everything cho site hoặc API.

## 2. TLS và Cloudflare Tunnel

Trong Cloudflare Dashboard → chọn zone `happyclass.asia` → SSL/TLS:

1. Giữ **Automatic SSL/TLS (recommended)** nếu đang dùng. Nếu cần chọn thủ công, chọn chế độ phù hợp với cấu hình origin; không chọn Flexible chỉ để sửa lỗi Tunnel.
2. Kiểm tra Edge Certificates có Universal SSL hoạt động và trình duyệt truy cập bằng HTTPS.
3. Trong Zero Trust → Networks → Tunnels → tunnel `happyclass` → Published application routes, xác nhận:

| Public hostname | Service URL |
| --- | --- |
| `english.happyclass.asia` | `http://web:3000` |
| `tiengviet.happyclass.asia` | `http://web:3000` |
| `admin.happyclass.asia` | `http://web:3000` |

Kết nối từ Cloudflare tới `cloudflared` được mã hóa độc lập với SSL/TLS zone mode. `http://web:3000` chỉ là chặng origin nội bộ Docker; không thay nó bằng HTTPS nếu web container chưa có HTTPS listener và chứng chỉ tương ứng.

## 3. WAF Managed Rules

Mở Security → Settings (hoặc Security → WAF → Managed rules, tùy giao diện):

- Với Cloudflare Free: xác nhận **Cloudflare Free Managed Ruleset** đang bật. Free Managed Ruleset có thể được bật mặc định; kiểm tra trạng thái thay vì tạo ruleset trùng.
- Với gói trả phí có Cloudflare Managed Ruleset: dùng ruleset đó theo cấu hình mặc định trước, theo dõi Security Events rồi mới điều chỉnh.
- Không bật OWASP Core Ruleset ở mức nghiêm ngặt ngay trong lần đầu. Ruleset này có thể tạo false positive; chỉ triển khai sau khi theo dõi traffic và có kế hoạch kiểm thử.
- Sau khi bật hoặc đổi rule, thử đăng nhập, đăng ký, gọi API, thanh toán sandbox và webhook. Nếu có request hợp lệ bị chặn, xem Security Events và tạo ngoại lệ hẹp cho đúng rule/path; không tắt toàn bộ WAF.

## 4. Rate limit bổ sung cho endpoint xác thực

API đã có giới hạn nội bộ: tối đa 10 request/phút/IP cho các endpoint xác thực và 300 request/phút/IP cho giới hạn chung. Cloudflare rate limit là lớp chặn burst bổ sung, không thay thế giới hạn trong API.

Trong Security → Security rules → Create rule → Rate limiting rules, tạo một rule:

- **Tên:** `HappyClass - Auth burst protection`
- **Expression:**

```text
http.request.uri.path in {
  "/api/auth/login"
  "/api/auth/register"
  "/api/auth/forgot-password"
  "/api/auth/reset-password"
  "/api/auth/verify-email"
  "/api/auth/resend-verification"
  "/api/auth/change-password"
}
```

- **Counting characteristic:** IP address.
- **Requests:** 30 requests.
- **Period:** 10 seconds.
- **Action:** Block.
- **Mitigation timeout:** 10 seconds (nếu giao diện cho chọn).

Ngưỡng này chỉ nhằm chặn burst rất lớn; API vẫn áp dụng giới hạn 10/phút. Nếu nhiều giáo viên cùng dùng chung một IP trường học và gặp chặn nhầm, tăng ngưỡng hoặc điều chỉnh rule sau khi xem dữ liệu thực tế. Không đưa `/api/webhooks/sepay` vào rule xác thực.

Giới hạn tính năng và số rule tùy gói Cloudflare. Gói Free chỉ có số rule và chu kỳ đếm giới hạn; nếu giao diện không hỗ trợ các trường trên, không cố tạo rule sai — giữ giới hạn ở API và ghi nhận cần nâng gói hoặc cấu hình theo lựa chọn được dashboard cho phép.

## 5. Bot protection và cache

- Bot Fight Mode là tùy chọn, không phải điều kiện bắt buộc để HappyClass chạy. Nếu bật, kiểm thử các request POST từ trình duyệt (login, register, checkout) và webhook ngay sau đó. Không để challenge HTML thay response JSON của API.
- Không bật Under Attack Mode toàn zone trong điều kiện bình thường.
- Không tạo Cache Everything. Nếu đã có Cache Rules tùy chỉnh, bảo đảm các đường dẫn động `/api/*` không bị cache; đặc biệt `/api/auth/*`, `/api/billing/*`, `/api/webhooks/*`, `/api/admin/*`.

## 6. Cloudflare Access

Trong giai đoạn hiện tại:

- Giữ Access cho `english.happyclass.asia` và `tiengviet.happyclass.asia`; chưa mở public.
- Giữ ứng dụng Access riêng cho `admin.happyclass.asia`; chỉ email quản trị/nhân sự được mời mới vào được.
- Giữ ứng dụng Bypass dành riêng cho SePay tại hostname `english.happyclass.asia`, path `api/webhooks/`, action `Bypass`, Include `Everyone`. API Key trong HappyClass vẫn là lớp xác thực bắt buộc.
- Không xóa wildcard Access application cho tới khi đã tạo và kiểm thử các application cụ thể cho từng hostname. Chỉ gỡ Access khỏi English/Tiếng Việt khi có quyết định mở public riêng; Admin không gỡ.

## 7. Kiểm tra origin trên DL380

Sau khi cập nhật source, chạy:

```bash
cd /data/education-games-platform/source
sudo bash ops/check-edge-local.sh
```

Script chỉ đọc và kiểm tra:
- API health và kết nối PostgreSQL.
- Port web/API chỉ publish trên loopback.
- HTTP 200 và 7 security headers trên cả English, Tiếng Việt, Admin tại origin nội bộ.
- Container Tunnel đang chạy nếu đã cấu hình tunnel token.

Script không thể đọc trạng thái WAF, Access, DNS hoặc Edge TLS trong tài khoản Cloudflare. Những mục đó phải kiểm tra trực tiếp trong Dashboard.

## 8. Tài liệu Cloudflare chính thức

- [Cloudflare WAF Managed Rules](https://developers.cloudflare.com/waf/managed-rules/)
- [Cloudflare Rate Limiting Rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Cloudflare Tunnel origin parameters](https://developers.cloudflare.com/tunnel/reference/origin-parameters/)
- [Cloudflare Tunnel HTTPS origin troubleshooting](https://developers.cloudflare.com/tunnel/troubleshooting/https-origins/)
