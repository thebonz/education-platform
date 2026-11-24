# Thanh toán chuyển khoản (VietQR + SePay)

Khách mua gói → hệ thống tạo **đơn có mã riêng** (ví dụ `HC7K2P9QAB`) → khách quét **mã VietQR** (ứng dụng ngân hàng tự điền
số tài khoản, số tiền, nội dung) → tiền vào tài khoản VietinBank → **SePay** báo về HappyClass qua webhook → hệ thống tìm mã đơn
trong nội dung chuyển khoản, kiểm tra số tiền, **cấp gói ngay** (trang thanh toán tự chuyển sang "Thanh toán thành công").

```text
Khách ──quét VietQR──▶ Ngân hàng của khách ──▶ VietinBank (tài khoản nhận) ──▶ SePay ──webhook + API Key──▶ HappyClass
```

- Mã QR do máy chủ HappyClass tự tạo (chuẩn VietQR/NAPAS), không gửi thông tin đơn cho dịch vụ bên ngoài.
- Tiền chuyển thẳng vào tài khoản của anh/chị; SePay chỉ **đọc** biến động số dư để báo về.
- Số tài khoản và khóa webhook chỉ nằm trong `.env` trên máy chủ (quyền 600), **không** có trong mã nguồn.

## Quy tắc đối soát

| Tình huống | Hệ thống xử lý |
| --- | --- |
| Đúng mã đơn, đủ hoặc dư tiền | Đơn → *Đã thanh toán*, cấp gói ngay |
| Đúng mã, thiếu tiền | Không cấp gói; giao dịch vào mục *Sai số tiền* để kế toán xử lý |
| Không có mã đơn / ghi sai mã | Giao dịch vào mục *Chưa khớp*; kế toán **gán vào đơn** trong admin |
| SePay gửi lại cùng giao dịch | Bỏ qua (không cấp gói hai lần) |
| Khách chuyển 2 lần cho một đơn | Lần 2 vào *Chưa khớp* để hoàn tiền / xử lý tay |
| Đơn đã hết hạn 24 giờ nhưng tiền vẫn về | Vẫn ghi nhận và cấp gói (khách đã trả tiền) |
| Còn gói mà mua thêm | Cộng nối tiếp từ ngày hết hạn hiện tại |

Kế toán (vai trò *Kế toán*) xem và xử lý ở Admin → **Thanh toán**. Mọi thao tác (xác nhận tay, gán giao dịch, tặng gói, đổi giá) đều
bắt buộc ghi chú và được ghi vào nhật ký thao tác.

## Bước 1 – Đăng ký SePay và liên kết tài khoản

1. Đăng ký tại <https://my.sepay.vn>, thêm tài khoản ngân hàng **VietinBank** nhận tiền (theo hướng dẫn của SePay).
2. Gói SePay miễn phí giới hạn số giao dịch mỗi tháng; chọn gói phù hợp khi bán thật.

## Bước 2 – Bật chế độ thử nghiệm trên máy chủ

```bash
cd /data/education-games-platform/source
sudo bash ops/configure-payments.sh
```

Script hỏi số tài khoản và tên chủ tài khoản (viết HOA không dấu), tạo **khóa webhook** ngẫu nhiên và in ra **một lần**.
Ở chế độ thử nghiệm, trang thanh toán có dải vàng "CHẾ ĐỘ THỬ NGHIỆM – vui lòng KHÔNG chuyển tiền".

Sau khi bật sandbox, chạy script kiểm tra chỉ đọc:

~~~bash
sudo bash ops/check-payment-sandbox.sh
~~~

Script xác nhận cấu hình sandbox, quyền `.env`, trạng thái PostgreSQL/API/Web, bảng giá và việc webhook từ chối request không có API Key. Nếu domain HTTPS đã cấu hình, script còn kiểm tra Cloudflare Access có cho webhook đi tới API hay không. Script **không tạo đơn, không ghi giao dịch, không chuyển tiền và không thay đổi cấu hình**. Nếu script báo HTTP 302/403 ở webhook công khai, kiểm tra lại Access Bypass cho `/api/webhooks/`.

## Bước 3 – Tạo webhook trong SePay Test Mode

**Quan trọng:** Test Mode của SePay là môi trường tách biệt với Live. Bật Test Mode trong SePay, rồi tạo tài khoản ngân hàng và webhook ngay trong môi trường Test Mode; webhook Live không nhận giao dịch mô phỏng.

1. Mở `my.sepay.vn` và bật **Test Mode**. Xác nhận dashboard hiển thị banner Test Mode.
2. Vào **Test mode → Tài khoản ngân hàng**.
   - **Ưu tiên chọn “Sao chép từ Live”** cho tài khoản VietinBank đang dùng. HappyClass kiểm tra `accountNumber` của webhook phải trùng `PAYMENT_BANK_ACCOUNT` trong `.env`; tài khoản Test Mode tạo mới sẽ được SePay tự sinh số tài khoản khác và giao dịch sẽ bị HappyClass đánh dấu *ignored* nếu chưa đồng bộ số tài khoản.
   - Nếu chưa có tài khoản Live để sao chép, có thể tạo tài khoản Test Mode mới. Khi đó phải chạy lại `sudo bash ops/configure-payments.sh` và nhập đúng số tài khoản/tên chủ tài khoản Test Mode vừa tạo trước khi kiểm thử. Trước khi bật Live, phải đổi lại tài khoản nhận tiền thật.
3. Vào **Test mode → Tích hợp Webhook → Thêm webhook** và cấu hình:

| Mục | Giá trị |
| --- | --- |
| Tên webhook | `HappyClass Sandbox` |
| URL nhận webhook | `https://english.happyclass.asia/api/webhooks/sepay` |
| Loại giao dịch | **Tiền vào** |
| Định dạng dữ liệu | **JSON** |
| Tự động gửi lại khi server trả lỗi | Bật (nếu có) |
| Tài khoản | Chọn đúng tài khoản Test Mode đã sao chép/tạo ở bước 2 |
| Dùng để xác thực thanh toán / Chỉ gửi khi có mã | Để tắt bộ lọc “Chỉ gửi khi có mã” để giao dịch sai/thiếu mã vẫn được gửi về cho kế toán đối soát |
| Phương thức xác thực | **API Key** |
| API Key | Khóa do HappyClass tạo ở bước 2 (xem lại bằng lệnh bên dưới) |
| Định dạng request | **JSON** |

Xem lại khóa trên server nếu cần (không gửi khóa qua chat hoặc chụp ảnh có khóa):

~~~bash
sudo bash ops/configure-payments.sh --show-key
~~~

SePay gửi API Key trong header `Authorization: Apikey <API_KEY>`. Không chọn “Không xác thực”, không dùng API Token SePay ở đây.

### Quy tắc riêng của VietinBank và mã đơn HappyClass

VietinBank cá nhân/hộ kinh doanh yêu cầu nội dung chuyển khoản có tiền tố `SEVQR`. HappyClass tự tạo nội dung theo dạng:

~~~text
SEVQR HCXXXXXXXX
~~~

Trong đó `HCXXXXXXXX` là mã đơn của HappyClass. Trang thanh toán hiển thị và cho phép sao chép **đầy đủ cả tiền tố SEVQR**, đồng nhất với dữ liệu được mã hoá trong QR. Không xoá tiền tố này khi giả lập hoặc chuyển khoản. Nếu SePay báo “Thiếu SEVQR”, không gửi giao dịch; hãy tải lại trang thanh toán sau khi cập nhật phiên bản có bản sửa này.

Để SePay tự điền trường `code` của webhook (không bắt buộc với bộ phân tích phía HappyClass, nhưng giúp nhìn thấy mã được nhận diện trong Test Mode), vào **Test mode → Cấu hình → Nhận diện mã thanh toán** và tạo cấu trúc:

| Trường | Giá trị |
|---|---|
| Nhận diện mã thanh toán | Bật |
| Tiền tố | `HC` |
| Độ dài hậu tố tối thiểu | `8` |
| Độ dài hậu tố tối đa | `8` |
| Kiểu ký tự | Số và chữ (alphanumeric) |
| Trạng thái | Đang hoạt động |

Lưu cấu hình. Vẫn để bộ lọc webhook **“Chỉ gửi khi có mã thanh toán” tắt** để các giao dịch sai mã/thiếu mã vẫn tới HappyClass và được lưu cho kế toán đối soát. `SEVQR` là tiền tố bắt buộc của nội dung VietinBank; `HC` mới là tiền tố mã đơn HappyClass.

## Bước 4 – Cho SePay đi qua Cloudflare Access

Khi site đang chặn bằng Cloudflare Access, SePay sẽ bị chặn ở màn đăng nhập. Thêm một ứng dụng Access riêng:

1. Zero Trust → **Access → Applications → Add an application → Self-hosted**.
2. Application domain: `english.happyclass.asia`, Path: `api/webhooks/`.
3. Policy: Action **Bypass**, Include **Everyone**.

Đường dẫn này vẫn được bảo vệ bằng khóa API (sai khóa → 401).

## Bước 5 – Kiểm thử end-to-end trong SePay Test Mode

1. Trên HappyClass, đăng nhập bằng tài khoản học viên thử nghiệm → **Bảng giá** → chọn gói tháng. Không chuyển tiền thật. Ghi lại **mã đơn** và **đúng số tiền** đang hiển thị trên đơn.
2. Trong SePay, giữ Test Mode đang bật → **Giao dịch → Mô phỏng giao dịch**.
3. Chọn đúng tài khoản Test Mode đã dùng cho webhook; nhập số tiền đúng bằng đơn HappyClass và nội dung chuyển khoản chính xác là `SEVQR <mã đơn>` (ví dụ `SEVQR HC7K2P9QAB`), sau đó gửi giao dịch thử.
4. Mở lại đơn HappyClass: trạng thái phải chuyển thành **Đã thanh toán**. Vào Admin → **Thanh toán** để xác nhận đơn *Đã thanh toán (tự động)* và giao dịch ngân hàng được ghi nhận.
5. Nếu chưa cập nhật, kiểm tra **Test mode → Tích hợp Webhook → Lịch sử gửi**. Payload phải tới đúng URL, HTTP response phải là 200 và body có `{"success":true}`. Kiểm tra cả log chi tiết của lần gửi; không đăng API Key hoặc thông tin tài khoản lên chat.
6. Sau khi ca đúng tiền thành công, có thể tạo một đơn thử khác để kiểm tra thiếu tiền hoặc sai mã. Các ca này phải không cấp gói và xuất hiện trong danh sách giao dịch chờ đối soát.

Giao dịch mô phỏng của SePay Test Mode không làm thay đổi số dư Live. Tuy vậy, tuyệt đối không bật `PAYMENT_MODE=live` cho tới khi hoàn tất kiểm thử.

## Bước 6 – Bật thanh toán thật

Chỉ khi bước 5 chạy đúng:

```bash
sudo bash ops/configure-payments.sh --live    # gõ LIVE để xác nhận
```

Tắt bán hàng bất cứ lúc nào: `sudo bash ops/configure-payments.sh --disable` (game đã mua vẫn dùng được đến hết hạn).

## Đổi giá

Admin → Thanh toán → **Gói và giá**: sửa giá, tên, bật/tắt gói. Đơn đã tạo giữ giá lúc đặt. Giá hiện tại xem `docs/PRICING.md`.
