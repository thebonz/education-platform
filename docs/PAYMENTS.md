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

## Bước 3 – Cấu hình webhook trong SePay

my.sepay.vn → **Tích hợp WebHooks** → **Thêm webhooks**:

| Mục | Giá trị |
| --- | --- |
| Sự kiện | Có tiền vào |
| Tài khoản | VietinBank vừa liên kết |
| URL | `https://english.happyclass.asia/api/webhooks/sepay` |
| Kiểu chứng thực | API Key – dán khóa script vừa in |
| Bỏ qua nếu không có code thanh toán | **Không** (để giao dịch ghi sai nội dung vẫn về cho kế toán gán tay) |

## Bước 4 – Cho SePay đi qua Cloudflare Access

Khi site đang chặn bằng Cloudflare Access, SePay sẽ bị chặn ở màn đăng nhập. Thêm một ứng dụng Access riêng:

1. Zero Trust → **Access → Applications → Add an application → Self-hosted**.
2. Application domain: `english.happyclass.asia`, Path: `api/webhooks/`.
3. Policy: Action **Bypass**, Include **Everyone**.

Đường dẫn này vẫn được bảo vệ bằng khóa API (sai khóa → 401).

## Bước 5 – Kiểm thử (sandbox)

1. Đăng nhập site bằng tài khoản thường → **Bảng giá** → mua gói tháng → trang thanh toán hiện QR.
2. Trong SePay, dùng chức năng **giả lập giao dịch** (tài khoản sandbox của SePay) với nội dung là mã đơn và đúng số tiền.
3. Trang thanh toán tự chuyển sang "Thanh toán thành công"; Admin → Thanh toán thấy đơn *Đã thanh toán (tự động)*.
4. Thử thêm: chuyển thiếu tiền, ghi sai nội dung → kiểm tra mục *Giao dịch ngân hàng* và gán tay.

## Bước 6 – Bật thanh toán thật

Chỉ khi bước 5 chạy đúng:

```bash
sudo bash ops/configure-payments.sh --live    # gõ LIVE để xác nhận
```

Tắt bán hàng bất cứ lúc nào: `sudo bash ops/configure-payments.sh --disable` (game đã mua vẫn dùng được đến hết hạn).

## Đổi giá

Admin → Thanh toán → **Gói và giá**: sửa giá, tên, bật/tắt gói. Đơn đã tạo giữ giá lúc đặt. Giá hiện tại xem `docs/PRICING.md`.
