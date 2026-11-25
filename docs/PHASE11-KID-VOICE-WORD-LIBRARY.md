# Phase 11.2 – Giọng Anh-Mỹ gần gũi trẻ em và kho từ vựng có hình minh họa

## Yêu cầu thực tế

Người vận hành nhận thấy các game English hiện dùng emoji/sticker để đoán từ, và khi bấm **Play again** thường gặp đúng một bộ từ/câu. Giọng tiếng Anh cần **Anh-Mỹ, phù hợp trẻ nhỏ, nghe rõ**.

Đây là nâng cấp bằng **mã nguồn và hình minh họa do HappyClass tự xây**, không nhập/copy câu hỏi, tranh, thương hiệu hoặc âm thanh của Easy Peasy English.

## 1. Voice EN-US kid-friendly

- Mặc định `en-US` trên các game English. Một lần di chuyển tùy chọn cũ sang mặc định Mỹ; sau đó tôn trọng lựa chọn Anh-Mỹ/Anh-Anh do người học đổi.
- Nếu Web Speech API **thực sự liệt kê** giọng Mỹ dành cho trẻ, ưu tiên (ví dụ Microsoft **en-US-AnaNeural**, hãng Microsoft gọi là **Female, Child**). Không tải giọng trái phép hoặc tự nhận tên `Ana` nếu thiết bị không có.
- Nếu thiếu giọng trẻ, dùng giọng Mỹ tự nhiên đang có trên thiết bị và pitch **1.07** (rất nhẹ, tránh tiếng chipmunk); tốc độ mặc định 0.85 và vẫn có các mức chỉnh 0.75/0.95.
- Nút nghe thử và bảng chọn giọng cũ vẫn hoạt động. Hiển thị cảnh báo rõ khi máy chưa cung cấp một giọng trẻ thực sự.
- Đây **không phải** một giọng trẻ cố định trên mọi thiết bị. Cần nguồn TTS/giọng thu âm **có bản quyền và đã giáo viên nghe duyệt** nếu muốn phát âm EN-US Kid đồng nhất. Tích hợp cloud voice phải chốt chi phí/bảo mật trước, không tự bật Azure hoặc gửi dữ liệu ra bên ngoài.
- Tham khảo kỹ thuật: [Microsoft voice support](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support), [Web Speech voice list](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices).

## 2. Hình ảnh thay emoji

- Tạo **27 hình SVG vector gốc** với phong cách hoạt hình pastel từ chính repo HappyClass; cùng 3 ảnh vector gốc đã có (cat, apple, bus), phủ **30 từ** tiếng Anh qua 3 chủ đề.
- **Animals (12):** cat, dog, fish, bird, rabbit, duck, cow, pig, frog, bee, lion, turtle.
- **Fruit (9):** apple, banana, orange, pear, lemon, grape, strawberry, watermelon, cherry.
- **School (9):** book, pen, pencil, bag, ruler, chair, eraser, clock, bus.
- Các hình là file tĩnh SVG từ `apps/web/public/illustrations`; không cần tải từ nguồn ngoài, không gửi dữ liệu người học ra bên thứ ba. Alt text mô tả từng đối tượng.
- Game Animal Match, Hidden Picture và Bubble Word Garden dùng ảnh thật của dự án thay vì emoji. Một số game English/Vietnamese khác vẫn có emoji theo nội dung cũ; không tuyên bố đã thay toàn bộ 33 game.

## 3. Chơi lại phải có từ/câu khác

- GameShell truyền **số lượt chơi** cho các template.
- `sessionSelection()` chọn nhóm nội dung kế tiếp theo số lượt chơi (theo vòng), rồi xáo thứ tự. Ví dụ thư viện 12 từ, 6 từ/lượt: lần 1 và lần 2 **không trùng từ**; lần 3 bắt đầu chu kỳ mới. Không dùng lựa chọn ngẫu nhiên có thể tạo đúng cùng một nhóm ngay lượt kế tiếp.
- **Animal Match**: 12 tranh động vật, 6 từ/lượt; nút Play Again cho 6 từ khác, có đếm từ trong kho.
- **Bubble Word Garden**: 5 unit, tổng **30 từ phân biệt**; mỗi lượt 6 từ/unit, chơi lại unit đó gặp nhóm tiếp theo. Unit Farm/Pets dùng lại từ trong nhóm Animals để ôn luyện có chủ đích.
- **Hidden Picture**: 6 ảnh động vật luân phiên, 12 câu hỏi chọn 6 câu/lượt. Không còn đoán cùng một hình sư tử qua mọi lượt.
- **Team Quiz**: mở rộng 20 câu hỏi, 10 câu/lượt, lượt 2 lấy 10 câu còn lại.
- Cơ chế có unit-test và Playwright để kiểm tra học liệu thay đổi thật khi chơi lại, không chỉ đổi vị trí đáp án.

## 4. Hai trò chơi English mới (ẩn, chờ duyệt)

- `fruit-market-match` — Fruit Market Match, 9 ảnh, 6 từ/lượt.
- `school-treasure-match` — School Treasure Match, 9 ảnh, 6 từ/lượt.

Cả hai **`isPublished=false`, `PENDING`**. Mỗi hình/từ cần giáo viên nghe và duyệt trước khi phát hành. Tên game và nội dung đều tự biên soạn.

## 5. Seed, tương thích và vận hành

- Gói nội dung seed-managed **Animal Match / Hidden Picture / Bubble Word Garden / Team Quiz** được nâng từ `revision:2` → `revision:3`. Quy trình seed chỉ cập nhật game còn `managedBySeed=true`, giữ bản GameVersion cũ, yêu cầu giáo viên duyệt lại và không sửa nội dung do admin đã tự biên tập. **Việc triển khai/seed có ghi dữ liệu**, không tự thực hiện.
- Trên cơ sở dữ liệu thử mới, sau seed dự kiến **35 game**, trong đó **29 game đã đánh dấu xuất bản**, **6 game nháp chưa xuất bản**, nếu các game cũ chưa bị chỉnh/sửa. Kết quả DL380 thực tế có thể khác và cần chạy script aggregate để xác minh.
- Không sửa TTS Piper tiếng Việt, API thanh toán, Cloudflare Access, chế độ SePay Sandbox, pháp lý hay các container CMMS/Airdrop.
- GitHub PR merge **không phải triển khai vào web đang chạy**. Khi có lệnh triển khai từ chủ dự án, dùng quy trình HappyClass được kiểm thử kèm backup/rollback và nghe thử giọng Anh-Mỹ trên Windows, Android, iOS. Việc phê duyệt nội dung vẫn là bước bắt buộc trước khi mở public.

## 6. Tiêu chí nghiệm thu

1. Vào Animal Match: thấy **6 hình minh họa SVG**, không phải emoji. Chơi thắng, xem điểm 6/6, bấm Play again và nhìn thấy **6 từ còn lại**.
2. Vào Hidden Picture: lần đầu thấy một ảnh, sau khi hoàn thành và Play again chuyển ảnh khác + câu hỏi mới, audio đọc rõ.
3. Bubble Garden: chọn Fruit Market thấy 6 từ trong 9; hoàn thành và chơi lại cùng unit để thấy các từ tiếp theo.
4. Team Quiz: mỗi lượt 10 trong 20 câu; lượt tiếp theo lấy nhóm câu khác.
5. Ở game English intro: mặc định **American English – Kid-friendly**. Nếu thiết bị có Microsoft Ana (US Child), giọng đó được chọn trước các giọng Mỹ trưởng thành. Nếu không có, hiển thị fallback trung thực và cho người học so sánh các giọng thực có.
6. Admin Preview kiểm tra đủ nội dung/cách đọc của từng từ. Không tự động approve/publish.

## Các mục chưa hoàn thành

- **Chưa có một giọng EN-US trẻ em phát như nhau trên mọi máy.** Cần tích hợp nguồn có quyền sử dụng (ví dụ Azure Speech en-US-AnaNeural) với chi phí, thông tin đăng ký và bảo vệ dữ liệu, hoặc thu âm giáo viên.
- **Chưa xây ngân hàng học liệu toàn bộ chương trình tiểu học** và không thể tự bảo đảm chất lượng sư phạm chỉ bằng CI. Gói 30 từ là nền tảng mở rộng nội dung theo Unit.
