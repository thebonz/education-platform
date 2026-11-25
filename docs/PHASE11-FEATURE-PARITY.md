# Phase 11 — Mục tiêu tính năng tương đương Easy Peasy English, phát triển độc lập

Đầu vào từ các trang **công khai** (xem ngày 25/11/2026):
- https://easypeasyenglish.asia/
- https://easypeasyenglish.asia/demo
- https://easypeasyenglish.asia/worksheets

Phạm vi này **không có quyền truy cập source, file trò chơi thành viên, dữ liệu hoặc dashboard nội bộ** của Easy Peasy English. Không thể xác nhận mọi luật chơi và tính năng của các game sau paywall. Số game demo/thành viên trên chính site tham khảo có các bộ đếm khác nhau; không dùng những số đó làm mục tiêu nghiệm thu bắt buộc.

## Nguyên tắc

**Tương đương chức năng, không sao chép nguyên bản.** HappyClass tự viết mã, tự xây Game Builder, tự thiết kế UX/ảnh SVG, tự biên tập bộ từ vựng và nội dung phù hợp học sinh Việt Nam. Không tải hàng loạt nội dung, không trích xuất trò chơi, không sao chép ảnh/logo/giọng/âm thanh/text độc quyền, và không đặt tên gây nhầm lẫn thương hiệu.

## Ma trận khoảng trống và nghiệm thu

| Nhóm chức năng tham khảo | HappyClass đã có | Cần bổ sung độc lập |
| --- | --- | --- |
| Pastel game discovery / free demos | Trang chủ, filter skill/category/level, poster CSS, 6 game English published | Trang **Free Demos** riêng, bộ sưu tập phong phú hơn, hình đại diện game gốc theo từng hoạt động |
| Alphabet Bingo | Bingo Carnival: 3×3–5×5, giấu đáp án, nghe lại, tiến độ, một hàng/toàn bảng | Phân biệt đọc tên chữ và *phoneme*, ngân hàng âm chuẩn, phần thưởng học tập có giá trị |
| Phonics / word families | Bubble Word Garden, Spelling | **Phonics Adventure** có âm chuẩn đã kiểm duyệt, các nhóm vần và bài tập nghe |
| Board / team games | Star Trail Adventure, Team Quiz | Bản đồ và nhiệm vụ khác nhau, công cụ chiếu lớp, nhiều phiên đội |
| Hidden picture | Hidden Picture và Mystery House | Thêm thử thách suy luận riêng, số lượng ảnh phong phú đã được cấp quyền |
| Picture Puzzle | **Đã lập trình Picture Puzzle**: giáo viên dùng emoji/ảnh thư viện, xáo mảnh và đổi vị trí 2×2/3×3/4×4, nghe câu tiếng Anh, 3 ảnh minh họa SVG do HappyClass tự tạo | Giáo viên nghiệm thu, tối ưu hình minh họa và chơi nhiều vòng, thêm mô hình ghép/snap khác nếu có ích |
| Classroom picker | Random Student Picker trong browser, không tải tên học sinh | Các thử thách lớp học theo nhóm; dữ liệu học sinh luôn tối thiểu và riêng tư |
| Grade/Unit-based game collections | Taxonomy 6 cấp English, chủ đề; một số game unit | **Question Bank** độc lập game; Unit theo mục tiêu học; quyền demo ở cấp Unit |
| Printable Worksheets | Chưa có phân hệ tương ứng | Trang in A4, tiêu chuẩn bản quyền, thẩm định sư phạm, giới hạn PDF theo gói nếu cần |
| Camera interactive games | Chưa có | Rà soát rủi ro trẻ em; chỉ xây khi có thiết kế quyền riêng tư và cơ chế xin phép rõ ràng |
| Member collection / offline | Có tài khoản, thành viên, offline player, VietQR Sandbox | Giáo viên thử toàn bộ gameplay offline, kiểm soát quyền theo Unit, tài liệu hướng dẫn |
| TTS English | **PR #51**: chọn giọng English sẵn trên máy, ưu tiên Natural/Neural khi có, nút nghe thử, chỉnh tốc độ | Ngân hàng WAV English do người đọc/giọng được cấp phép và giáo viên xác nhận; không dựa vào giọng OS cho kiểm tra phonics chính thức |
| Teacher game edit | Game Builder, preview, content review, media library | Bài mẫu dễ dùng, question-bank drag/drop và hướng dẫn thao tác chuẩn lớp |

## Đã triển khai trong Phase 11.1: Picture Puzzle gốc

- Tách logic hoán đổi mảnh và xáo trộn có thể kiểm thử độc lập.
- Trò chơi có 2×2/3×3/4×4 mảnh, 2–12 ảnh/lượt; người chơi chọn hai vị trí để tráo. Khi hoàn thiện, đọc tên tranh theo lựa chọn giọng Anh-Anh/Anh-Mỹ và chuyển lượt.
- Nút gợi ý xem hình nguyên vẹn trong 1,2 giây; bộ đếm lượt đổi, tiến trình game, responsive cho điện thoại, bàn phím và máy chiếu.
- Ba ảnh **vector gốc** được viết cho HappyClass: mèo, táo và xe buýt (`apps/web/public/illustrations/puzzle-*.svg`); không dùng ảnh bất kỳ bên thứ ba.
- Một game mẫu `happyclass-picture-puzzle` được seed ở trạng thái `published:false`, `reviewStatus:PENDING`; các game trước đó không đổi nội dung hay trạng thái.
- Việc đánh giá phát âm thật, tính đúng/sai trong lớp và quyết định xuất bản thuộc giáo viên. CI kiểm tra logic/khả năng chạy nhưng không chứng minh chất lượng giọng thật.

## Nguyên tắc vận hành HappyClass

- **Không tự deploy:** GitHub merge không đổi container web/API đang chạy. Những lần build/deploy trên DL380 cần quyết định có chủ đích để tránh ảnh hưởng hệ thống CMMS/Airdrop.
- **Không duyệt tự động:** 29 game hiện xuất bản nhưng `PENDING` vẫn cần thẩm định; các game mới bị ẩn.
- Không đổi hoặc tắt Cloudflare Access, không bật SePay Live, không làm trái quy trình phê duyệt pháp lý.
- Trước khi mở công khai, chất lượng giọng và học liệu cần được nghiệm thu trên Android, iOS, Windows, máy chiếu bằng người thật.

## Ưu tiên tiếp theo

1. **Audio English nhất quán:** gói voice thu âm được phê duyệt, fallback phù hợp thiết bị và offline.
2. **Question Bank & Unit:** tách nội dung khỏi cơ chế game; nhiều template dùng một bộ từ vựng.
3. **Phonics Adventure:** nguyên tắc âm vị phù hợp phát triển đọc, không đọc tên chữ thay âm chữ.
4. **Printable Worksheets** do giáo viên tạo từ nội dung tự biên soạn.
5. **Nâng Star Trail** thành nhiều vòng phiêu lưu, bảng nhiệm vụ trên máy chiếu.
6. **Thư viện game phong phú hơn** sau khi có thẩm định nội dung, thay vì ép số lượng đạt một mốc tùy ý.
