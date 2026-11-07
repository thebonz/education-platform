# Bảng giá (áp dụng từ giai đoạn 6 – thanh toán)

Đã chốt ngày 07/11/2026:

| Gói | Giá | Ghi chú |
| --- | --- | --- |
| Năm | 599.000 đ / 12 tháng | Giá gốc |
| Tháng | 55.000 đ / tháng | Đắt hơn gói năm 10%: 599.000 × 1,1 ÷ 12 = 54.908 đ, làm tròn lên 55.000 đ |

Còn chờ chốt:

- Giá áp dụng cho **từng sản phẩm** (English Games hoặc Vietnamese Games) hay **cả hai**; có gói kết hợp không.
- Giá gói trọn đời (đã có trong quyết định số 9).

## Tài khoản nhận tiền

Số tài khoản **không** nằm trong mã nguồn (repo công khai). Ở giai đoạn 6, script cài đặt sẽ hỏi và lưu vào
`.env` trên máy chủ (quyền 600), các biến `PAYMENT_BANK_*`. Trang thanh toán đọc từ cấu hình máy chủ.
Thanh toán thật chỉ bật sau khi kiểm thử Sandbox (SePay) thành công.
