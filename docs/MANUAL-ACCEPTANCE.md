# HappyClass – Ghi nhận nghiệm thu thủ công (Phase 9)

Kết quả thực tế DL380 hiện có: `check-incident-confirmation.sh --record` trả **16 OK, 0 cảnh báo, 0 lỗi**; `check-edge-local.sh` trả **7 OK, 0 lỗi**; `check-payment-sandbox.sh` xác nhận cấu hình, webhook không có API Key bị HTTP 401. Người vận hành cũng cho biết đã hoàn thành các bài kiểm thử. Các kết quả ấy **không tự chứng minh** SMTP được nhận ở hộp thư thật, giao dịch mô phỏng SePay đã khớp đúng và WAF/Access edge được duyệt: đây là các mốc riêng cần người đã thực hiện xác nhận.

Công cụ bổ sung **ghi lời tự xác nhận trong phạm vi HappyClass**, không phải bản log hay chứng chỉ kiểm thử độc lập. Không bao giờ tự chuyển trạng thái go-live, không phát hành website, không bật SePay Live.

## 1. Xem báo cáo hiện tại — tuyệt đối chỉ đọc

~~~bash
cd /data/education-games-platform/source
sudo bash ops/check-manual-acceptance.sh
sudo bash ops/check-go-live-evidence.sh
~~~

Mặc định không tạo hay chỉnh sửa bất kỳ file nào. JSON: thêm `--json`.

## 2. Người đã kiểm thử xác nhận đúng mục đã hoàn thành

Chỉ chạy dòng tương ứng sau khi **thực sự quan sát được kết quả**, ví dụ email đến Inbox và SePay Test Mode đã gửi webhook trả HTTP 200, đơn thành PAID, quyền gói được cấp đúng một lần. `I_VERIFIED` là xác nhận có chủ đích, không phải khóa mật khẩu.

~~~bash
# Đã nhận email thử ở hộp thư thật:
sudo bash ops/check-manual-acceptance.sh --attest smtp.delivery --confirm I_VERIFIED

# Đã thử đầy đủ đăng ký / xác thực / gửi lại / quên mật khẩu:
sudo bash ops/check-manual-acceptance.sh --attest smtp.auth_flows --confirm I_VERIFIED

# Đã thử SePay TEST MODE: đúng tiền, thiếu tiền, sai mã, webhook lặp:
sudo bash ops/check-manual-acceptance.sh --attest payment.sandbox_acceptance --confirm I_VERIFIED
~~~

Các mục còn có thể tự xác nhận sau khi thực hiện đầy đủ: `cloudflare.security` (WAF/Access/TLS và path bypass), `content.review` (duyệt game), `admin.accounts` (rà soát RBAC). Ví dụ:

~~~bash
sudo bash ops/check-manual-acceptance.sh --attest cloudflare.security --confirm I_VERIFIED
~~~

**Không thể** ghi tự xác nhận cho `legal.owner_approval`, `operator.signoff` hay bật `PAYMENT_MODE=live` qua công cụ này. Hai quyết định đó vẫn yêu cầu chủ dự án duyệt riêng.

## 3. Kiểm tra, hiệu lực và hủy

~~~bash
sudo bash ops/check-manual-acceptance.sh --json
sudo bash ops/check-go-live-evidence.sh --json
# Thu hồi khi phát hiện kết quả kiểm thử sai hoặc không còn hợp lệ:
sudo bash ops/check-manual-acceptance.sh --revoke smtp.delivery --confirm REVOKE
~~~

- Ghi `HC_DATA_DIR/status/manual-acceptance.json`, chế độ `0600` và ghi nguyên tử với khóa ghi chống đồng thời. Chỉ chứa tên kiểm thử, thời gian tự xác nhận và hạn hiệu lực. **Không** chứa email người nhận, số tài khoản, mã đơn, API Key, log ngân hàng hay mật khẩu.
- Mốc hết hiệu lực **sau 7 ngày**. Khi hết hạn, báo cáo chỉ hiển thị `expired_manual_attestation_keys`; cần kiểm thử lại trước khi ghi nhận lần mới.
- `check-go-live-evidence.sh` vẫn trả về `manual` ở các hạng mục được tự xác nhận, chỉ bổ sung cờ `attested=true` và `counts.attested`. Tự xác nhận **không** đổi `manual` thành `pass`.
- File thiếu là bình thường. File sai schema, symlink hoặc có quyền quá rộng làm audit báo `acceptance.integrity=block`; không được tự động xóa hoặc ghi đè.
- Báo cáo luôn có `public_release_allowed=false` và `requires_owner_approval=true`, kể cả 6/6 mục có tự xác nhận.

## 4. Chặn go-live còn lại

Bản báo cáo vận hành đã ghi nhận `legal.draft` là một **blocker thực sự**. Người vận hành cần cung cấp thông tin chủ thể và địa chỉ chính thức, duyệt điều khoản/chính sách riêng tư và hoàn tiền bằng cả tiếng Việt và tiếng Anh. Không đoán pháp nhân, không tự xóa nhãn `Bản dự thảo`, không sửa cam kết hoàn tiền khi chưa được phê duyệt.

Bằng chứng Cloudflare có được từ `check-edge-local.sh` chỉ bao gồm origin trên DL380. Việc xác minh các mục Cloudflare edge (WAF/Access/TLS/DNS) vẫn phải thực hiện riêng trên Cloudflare Dashboard.

## 5. Ranh giới an toàn

Các script **không** gửi email, không tạo hoặc mô phỏng giao dịch SePay, không truy cập Internet, không khởi động lại Docker, không thay đổi PostgreSQL, Cloudflare Access, WAF hay dịch vụ CMMS/Airdrop. Việc ghi trạng thái chỉ xảy ra khi người vận hành cố ý chạy `--attest` hoặc `--revoke`.

Tiếp tục theo dõi các tài liệu [GO-LIVE.md](GO-LIVE.md), [GO-LIVE-EVIDENCE.md](GO-LIVE-EVIDENCE.md), [PAYMENTS.md](PAYMENTS.md) và [CLOUDFLARE-HARDENING.md](CLOUDFLARE-HARDENING.md).
