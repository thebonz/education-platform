# Bảng giá (áp dụng từ giai đoạn 6 – thanh toán)

Đã chốt ngày 08/11/2026:

| Gói | Giá mặc định | Phạm vi |
| --- | --- | --- |
| Năm | 599.000 đ / 12 tháng | **Mỗi sản phẩm** (English Games hoặc Vietnamese Games) |
| Tháng | 55.000 đ / tháng | Mỗi sản phẩm; đắt hơn gói năm 10%: 599.000 × 1,1 ÷ 12 = 54.908 đ, làm tròn lên 55.000 đ |

- **Không có gói trọn đời** (thay cho quyết định số 9 trước đây). Offline Player vẫn kiểm tra giấy phép mỗi 30 ngày, theo thời hạn gói đang có.
- **Giá không viết cứng trong mã nguồn.** Giai đoạn 6 có trang quản trị *Gói và giá*: Super Admin đổi giá, bật/tắt gói. Giá mới chỉ áp dụng cho đơn tạo sau khi đổi; đơn cũ giữ giá lúc đặt. Mỗi lần đổi giá ghi nhật ký thao tác.
- Các giá ở bảng trên là giá nạp sẵn lần đầu.

## Tài khoản nhận tiền

Số tài khoản **không** nằm trong mã nguồn (repo công khai). Ở giai đoạn 6, script cài đặt sẽ hỏi và lưu vào
`.env` trên máy chủ (quyền 600), các biến `PAYMENT_BANK_*`. Trang thanh toán đọc từ cấu hình máy chủ.
Thanh toán thật chỉ bật sau khi kiểm thử Sandbox (SePay) thành công.
