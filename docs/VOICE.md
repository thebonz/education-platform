# Giọng đọc HappyClass: tiếng Việt và tiếng Anh

Game tiếng Việt không dùng giọng đọc của trình duyệt nữa. Trước đây, máy nào không cài giọng tiếng Việt (ví dụ Chrome trên Windows) sẽ đọc chữ Việt bằng giọng tiếng Anh, nghe sai hoàn toàn.

## Cách hoạt động

1. Game gọi `GET /api/tts?lang=vi&text=<câu>`.
2. API tìm file WAV đã tạo trong `HC_DATA_DIR/media/tts`. Tên file là SHA-256 của tên giọng cộng với câu.
3. Chưa có file thì API nhờ container `tts` tạo. Container này chạy [Piper](https://github.com/rhasspy/piper) trên CPU, không gọi dịch vụ ngoài và không mở cổng ra máy chủ. File tạo xong được lưu lại.
4. Trình duyệt và service worker lưu file lâu dài.
5. **Tạo sẵn:** 20 giây sau khi API khởi động, rồi cứ 6 giờ một lần, API tạo trước âm thanh cho mọi câu của game tiếng Việt đã xuất bản. Mỗi lần chỉ tạo một câu để không chiếm CPU; câu đã có thì bỏ qua.
6. **Offline:** gói tải về ở trang `/offline` có kèm file giọng đọc của các game, nên khi mất mạng vẫn nghe giọng Bắc.
7. Nếu dịch vụ `tts` không chạy, trình duyệt dùng giọng tiếng Việt cài trên máy (nếu có). Không có giọng Việt thì game báo rõ, **không** đọc bằng giọng tiếng Anh.

## Giọng

| | |
| --- | --- |
| Mô hình | `vi_VN-vais1000-medium` ([piper-voices](https://huggingface.co/rhasspy/piper-voices)) |
| Dữ liệu huấn luyện | [VAIS-1000](https://ieee-dataport.org/documents/vais-1000-vietnamese-speech-synthesis-corpus): giọng Bắc, một người đọc |
| Giấy phép | Piper: MIT. Dữ liệu VAIS-1000: CC BY 4.0, đã ghi công ở trang Điều khoản |
| Tốc độ | Chậm hơn bình thường 15% cho trẻ nhỏ (`TTS_LENGTH_SCALE=1.15`) |

Piper và mô hình đều được kiểm tra SHA-256 khi build image. Khi build còn đọc thử một câu, nên image nào tạo được cũng đã đọc được tiếng Việt.

## Tự kiểm tra bằng tai trước khi chơi

Trong trang game tiếng Việt, màn **Bắt đầu** có nút **Nghe thử giọng Việt**, đọc lần lượt các thanh: `ma, má, mà, mả, mã, mạ`. Nút chỉ gọi sau khi người dùng chủ động nhấn; cho phép kiểm tra loa, dấu thanh và khả năng nghe rõ trước khi bắt đầu. Nếu máy chủ TTS lỗi và trình duyệt không có giọng Việt, game vẫn báo không khả dụng; sau khi âm thanh phát trở lại thì bỏ cảnh báo đã lỗi thời. Đây là kiểm tra **thủ công**, không có nghĩa mô hình Piper được tự động đánh giá đúng phát âm.

Xem [định hướng chất lượng nội dung, âm thanh, thư viện và gameplay](PHASE10-LEARNING-EXPERIENCE.md).

## Vận hành

- Cập nhật như thường lệ: `sudo bash ops/deploy-test.sh`. Lệnh này build và chạy thêm container `tts`, chiếm khoảng 700 MB RAM khi đang đọc.
- Thư mục đệm `media/tts` tạo lại được nên không cần sao lưu. Muốn tạo lại toàn bộ thì xoá nội dung thư mục này.
- Đổi giọng: thay mô hình trong `services/tts/Dockerfile` và đổi `TTS_VOICE` trong `apps/api/src/tts/tts.controller.ts`, để file cũ không bị dùng lại.

## Giới hạn

- Giọng tổng hợp vẫn chưa tự nhiên bằng người thu âm. Với các mục nghe quan trọng, sau này nên tải file thu âm của giáo viên qua thư viện media.
- Câu giáo viên vừa sửa trong lớp học có âm thanh ở lần phát đầu tiên khi có mạng. Lần tạo sẵn chỉ quét game đã xuất bản, không quét bản sao của lớp.

## Giọng đọc tiếng Anh – nâng cấp lựa chọn trong game

Trước đây HappyClass chỉ đặt `speechSynthesis.lang = en-GB / en-US` và dùng giọng do trình duyệt chọn, thường nghe máy móc trên một số thiết bị.

Trên màn **Start** của mỗi trò chơi tiếng Anh, người học giờ có thể:
- Nghe câu mẫu tiếng Anh trước khi bắt đầu.
- Chọn **Recommended English voice** hoặc một giọng tiếng Anh được thiết bị/trình duyệt liệt kê; hệ thống ưu tiên giọng có nhãn `Natural`, `Neural`, giọng Google/Microsoft phổ biến khi có.
- Chọn tốc độ **Slow (0.75), Clear (0.85), Natural pace (0.95)**.
- Tiếp tục chọn Anh-Anh/Anh-Mỹ trên thanh công cụ (đổi vùng sẽ đặt lại lựa chọn giọng thủ công để tránh sai vùng).
- Lưu cài đặt trên trình duyệt hiện tại (không tải lên server).

**Giới hạn quan trọng:** Chất lượng vẫn phụ thuộc vào giọng đã được cài/hỗ trợ trên thiết bị. Tên `Natural` không đồng nghĩa đã được kiểm định sư phạm, và giọng trực tuyến của thiết bị có thể sử dụng dịch vụ của nhà cung cấp hệ điều hành. Trình duyệt không có giọng phù hợp sẽ hiện gợi ý; phiên bản này **không tải mô hình TTS tiếng Anh lên DL380**, không gọi API TTS bên ngoài. Không khẳng định tất cả trẻ đều nghe cùng một giọng.

**Bước chất lượng tiếp theo:** với phonics và bài kiểm tra nghe, xây dựng kho âm thanh từ người thu âm/giọng được cấp phép và giáo viên duyệt (theo en-US/en-GB), có phiên bản, cache và cơ chế offline. Thử nghiệm riêng trước khi thêm model TTS server vì máy DL380 dùng chung nhiều dịch vụ.

