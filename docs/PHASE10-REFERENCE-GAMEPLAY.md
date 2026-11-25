# HappyClass Phase 10 – Học hỏi trải nghiệm Easy Peasy English, không sao chép nội dung

Tham khảo công khai **https://easypeasyenglish.asia/** (ngày 25/11/2026) và [giới thiệu các hình thức trò chơi](https://www.vniteach.com/2026/11/10/easy-peasy-english-hoc-tieng-anh-qua-tro-choi-tuong-tac-thu-vi/). Đây là phân tích **tính năng và nguyên lý UX**, không cho phép tải/copy source, bộ asset, tranh poster, nhân vật, audio, thương hiệu hoặc bộ câu hỏi có bản quyền của website khác. HappyClass có thiết kế và game riêng.

## Ma trận đối chiếu để phát triển, không tuyên bố tương đương toàn bộ

| Điều quan sát từ site tham khảo | HappyClass hiện có / triển khai | Trạng thái |
| --- | --- | --- |
| Không gian trẻ em vui tươi, pastel, poster bo góc, minh họa hấp dẫn | Hero và thẻ game trang English/Vietnamese thay bằng tông pastel, chữ nổi, mảng màu và hình biểu tượng CSS/emoji nguyên bản, có 2 CTA | Mã nguồn PR Phase 10.2 |
| Bộ sưu tập game và tìm theo chủ đề | Đã có library tìm kiếm, filter cấp độ/danh mục, nhóm kỹ năng; trang chủ dùng các liên kết trò chơi thật | Đã có |
| Alphabet Bingo / ghép hình, ghép từ | Có Bingo, picture-match, bubble-spelling, spelling và Game Builder | Đã có |
| Trò chơi bảng đi và trả lời theo đội | **Star Trail Adventure / Đường sao dấu thanh**: cơ chế do HappyClass tự phát triển, tung xúc xắc rồi chọn đáp án; đúng mới tiến, 2–4 đội, điểm và xếp hạng | Game mới, **ẩn khi nạp seed**, chờ giáo viên duyệt |
| Nhìn hình bí mật để đoán | Có Hidden Picture, khác luật và hình của site tham khảo | Đã có |
| Bộ game theo từng Unit/khối lớp | Có hệ taxonomy và level, các unit ví dụ ban đầu; **chưa có lộ trình Global Success 1–5 hoàn chỉnh**, không sao chép sách | Cần phát triển học liệu gốc, kiểm tra quyền sử dụng |
| Giáo viên biên soạn / nhân bản nội dung | Có Game Builder, nhân bản, phân quyền `content_reviewer`, checklist chất lượng | Đã có |
| Offline cho thành viên | Có offline package/Player và SePay Sandbox | Đã có; chưa mở live |
| Random Student Picker / building/camera | Chưa triển khai trong PR này; sẽ phát triển riêng sau khi hoàn thành chất lượng 29 game | Kế hoạch, không gắn nhãn đã có |

## Triển khai gameplay mới

Đăng ký template `trail-board` trong `packages/game-core`; frontend `trail-board.tsx` dùng GameShell sẵn có. Schema giới hạn **8–24 ô, xúc xắc 2–6 mặt, 2–4 đội và 4–40 câu hỏi**. Câu hỏi có đáp án nằm trong lựa chọn, không lặp ID, Unicode NFC. Đội trả lời đúng tiến số ô vừa tung, trả lời sai đứng yên, không có đội đi qua đích. Sau lượt cuối, xếp hạng theo vị trí trên bảng; bảng điểm kết quả cá nhân lưu theo số câu đúng.

Hai game nháp tự soạn, **không có game nào được duyệt tự động**:

1. **Star Trail Adventure** – Pre-A1, English, 10 câu về con vật, màu sắc, từ vựng; `isPublished=false`, `reviewStatus=PENDING`.
2. **Đường sao dấu thanh** – Lớp 1, Vietnamese, 10 câu về sáu thanh và từ thông dụng; `isPublished=false`, `reviewStatus=PENDING`. TTS tiếng Việt sử dụng Piper hiện có; cần **nghe thử thực tế** trước khi phát hành.

**Không dùng câu hỏi/ảnh/sound của Easy Peasy English**. Các asset trang chủ và bảng sao được tạo bằng CSS/emoji phổ biến, không tải ảnh từ site tham khảo.

## Lộ trình kiểm tra chất lượng

- Giai đoạn 1: Tập trung sửa 29 game hiện tại theo checklist câu hỏi, đáp án, UI, voice và mức độ phù hợp. Giữ Cloudflare Access.
- Giai đoạn 2: Thử bản nháp Star Trail qua **Admin → Nội dung game → Mở game → Soạn nội dung → Xem trước**. Chạy đội 2, 3, 4 và phát âm Việt trên máy Windows/Android/iOS; báo lỗi bằng slug, câu hỏi và môi trường, không gửi credential.
- Giai đoạn 3: Giáo viên kiểm tra từng game, mới nhấn **Duyệt**; người có quyền xuất bản quyết định bật `isPublished` theo từng game. Không batch approve/batch publish.
- Giai đoạn 4: Bổ sung các loại trò chơi hoàn toàn mới như bốc thăm học sinh, ghép hình, thám hiểm từ mới, nhưng phải có gameplay/UX và giáo trình riêng.

## Ranh giới vận hành

Chỉ **GitHub PR + CI** trong lượt thay đổi này. Không sửa dữ liệu hoặc .env sản xuất, không seed vào máy chủ trước khi có lệnh triển khai có kiểm soát, không bật thanh toán SePay Live, không thay đổi Cloudflare Access, không thay đổi hệ thống CMMS/Airdrop trên DL380. **Git pull không cập nhật frontend đang chạy.** Hướng dẫn triển khai có ở `ops/deploy-test.sh`; chỉ thực hiện với sự cho phép rõ ràng và có phương án backup/rollback. Blocker pháp lý vẫn còn.
