# Giọng đọc tiếng Việt

Game tiếng Việt không dùng giọng đọc của trình duyệt nữa. Trước đây, máy nào không cài giọng tiếng Việt (ví dụ Chrome trên Windows) sẽ đọc chữ Việt bằng giọng tiếng Anh, nghe sai hoàn toàn.

## Cách hoạt động

1. Game gọi `GET /api/tts?lang=vi&text=<câu>`.
2. API tìm file WAV đã tạo trong `HC_DATA_DIR/media/tts`. Tên file là SHA-256 của tên giọng cộng với câu.
3. Chưa có file thì API nhờ container `tts` tạo. Container này chạy [Piper](https://github.com/rhasspy/piper) trên CPU, không gọi dịch vụ ngoài và không mở cổng ra máy chủ. File tạo xong được lưu lại.
4. Trình duyệt và service worker lưu file lâu dài, nên khi chơi offline vẫn nghe được những câu đã từng phát.
5. Nếu dịch vụ `tts` không chạy, trình duyệt dùng giọng tiếng Việt cài trên máy (nếu có). Không có giọng Việt thì game báo rõ, **không** đọc bằng giọng tiếng Anh.

## Giọng

| | |
| --- | --- |
| Mô hình | `vi_VN-vais1000-medium` ([piper-voices](https://huggingface.co/rhasspy/piper-voices)) |
| Dữ liệu huấn luyện | [VAIS-1000](https://ieee-dataport.org/documents/vais-1000-vietnamese-speech-synthesis-corpus): giọng Bắc, một người đọc |
| Giấy phép | Piper: MIT. Dữ liệu VAIS-1000: CC BY 4.0, đã ghi công ở trang Điều khoản |
| Tốc độ | Chậm hơn bình thường 15% cho trẻ nhỏ (`TTS_LENGTH_SCALE=1.15`) |

Piper và mô hình đều được kiểm tra SHA-256 khi build image. Khi build còn đọc thử một câu, nên image nào tạo được cũng đã đọc được tiếng Việt.

## Vận hành

- Cập nhật như thường lệ: `sudo bash ops/deploy-test.sh`. Lệnh này build và chạy thêm container `tts`, chiếm khoảng 700 MB RAM khi đang đọc.
- Thư mục đệm `media/tts` tạo lại được nên không cần sao lưu. Muốn tạo lại toàn bộ thì xoá nội dung thư mục này.
- Đổi giọng: thay mô hình trong `services/tts/Dockerfile` và đổi `TTS_VOICE` trong `apps/api/src/tts/tts.controller.ts`, để file cũ không bị dùng lại.

## Giới hạn

- Giọng tổng hợp vẫn chưa tự nhiên bằng người thu âm. Với các mục nghe quan trọng, sau này nên tải file thu âm của giáo viên qua thư viện media.
- Câu chưa từng phát khi có mạng thì chưa có trong bộ nhớ máy, nên lúc offline sẽ dùng giọng của máy.
