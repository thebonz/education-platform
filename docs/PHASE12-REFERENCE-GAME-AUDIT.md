# Phase 12 – Phân rã từng game Easy Peasy English công khai và tái xây dựng độc lập trên HappyClass

Nghiên cứu trực tiếp từ trang công khai, ngày 26/11/2026:
- [Trang chủ](https://easypeasyenglish.asia/), [Free demos](https://easypeasyenglish.asia/demo), [Member Library](https://easypeasyenglish.asia/member-library)
- Các trang demo dẫn trong bảng dưới. Chúng là nguồn tham khảo **luồng tương tác**, không phải nguồn mã, ảnh, tên hoặc học liệu để sao chép.
- Web crawler đọc được cấu trúc text / các nút của một số game, **không thực hiện được đầy đủ click, drag, camera, audio JavaScript trên trình duyệt thực**. Nếu chỉ thấy nhãn trên trang thì đánh dấu là *quan sát giao diện* chứ không đoán những luật ẩn.
- Website hiển thị số khác nhau: trang chủ nói 11 demos nhưng danh sách có 13 mục, My Library nói 51 game trong catalogue, trang chủ nói 50 member games / 41 results. Không dùng bộ đếm này làm khẳng định số game đã xem, không suy diễn mọi file bên trong Membership.
- Giao diện 50+ game và học liệu Member bị **quyền truy cập hạn chế**. Không sử dụng tool vượt login/paywall, không giải nén game độc quyền. Nên chưa thể cam kết **clone chính xác toàn bộ**.
- Quy tắc: HappyClass xây **tương đương luồng trải nghiệm**, UI pastel riêng, tranh vector tự vẽ, nội dung tự biên, bảo vệ quyền sở hữu trí tuệ. Không đưa branding Easy Peasy vào web sản phẩm.

## Ma trận từng demo thực sự quan sát được

| Demo và nguồn | Quan sát được từ trang public | Tương ứng HappyClass | Khoảng trống còn lại / độ chắc chắn |
|---|---|---|---|
| [Alphabet Bingo](https://easypeasyenglish.asia/demos/alphabet-bingo) | Bắt đầu → mode → cỡ bảng → tập từ; tên chữ A–Z/âm chữ A–Z; thắng hàng/cột/chéo, giấu gợi ý, album mèo. | Bingo Carnival có bảng 3×3–5×5, giấu chữ/nghe lại, tính BINGO. | Chưa có phần thưởng mèo, thư viện bản thu phoneme chuẩn; chỉ các bước trên trang được xác nhận. |
| [Mochi Merge 2](https://easypeasyenglish.asia/demos/mochi-merge-2) | Giới thiệu nhóm vần, ví dụ cat/hat, nghe, kéo-thả-ghép, tiến độ 1/12, 3 tim. | **Mới:** Sound Family Village `phonics-family`: 3 nhóm vần -at/-og/-an, 9 từ/6 mỗi lượt, click/tap/drag với tranh gốc, chấm điểm. | Không sử dụng thiết kế/hình mochi; âm đọc nguyên từ qua giọng English hiện có, chưa có audio phoneme đã thẩm định. |
| [Board Quest](https://easypeasyenglish.asia/demos/board-quest) | Trang demo trả về ít nội dung, trang listing mô tả quay vòng, đi bảng, trả lời câu hỏi theo đội. | Star Trail Adventure: xúc xắc và bảng sao cho 2–4 đội. | Chưa xác minh cơ chế quay vòng, hình bảng hay mọi trạng thái gameplay bởi nội dung JS không hiển thị. |
| [Sneaky Spotlight](https://easypeasyenglish.asia/demos/sneaky-spotlight) | Chọn cửa; 8 cửa; giáo viên EDIT thay hình/đáp án; reset, fullscreen. | Mystery House: 6 cửa, ảnh và câu hỏi soạn trong Game Builder, mở ô và đoán. | Chưa có cùng số cửa 8; không dùng lại ảnh gốc hoặc popup editor của site tham khảo. |
| [Little Classroom Quest](https://easypeasyenglish.asia/demos/little-classroom-quest) | Nhìn tranh trong lớp, chọn A/B/C, random, voice, hint, replay, 17 mục + 2 mục luyện thêm; có voice setting. | **Mới:** Little Learning Classroom `classroom-explore`: ảnh lớp học gốc 9 từ, 6/lượt, click vật thể, nghe, câu trả lời A/B/C, tiến trình, random, gợi ý và replay. | Chưa đủ 17 đồ vật/2 extra; vật thể bố trí theo layout riêng để tránh copy artwork. |
| [Peekaboo Pals](https://easypeasyenglish.asia/demos/peekaboo-pals) | Hình bóng đoán từ 13 mục, giới hạn sai 3; editor upload ảnh và Excel. | **Mới:** Shadow Safari `shadow-guess`: 8 silhouette SVG trong suốt và tranh màu, 6/lượt, 3 lựa chọn, 4 lượt sai, hint, reveal. | Chưa hỗ trợ upload đa ảnh + Excel riêng cho chế độ này; không dùng mã thuật toán tách nền của vendor. |
| [Shadow Fusion](https://easypeasyenglish.asia/demos/shadow-fusion) | Hướng dẫn in 2 bản pattern vuông 145mm, mảnh A/B với dấu căn, A4 ngang, ghép lộ hình. | Hiện Picture Puzzle (tráo ô) là game khác. | **Chưa thực hiện tính năng in mảnh ghép/overlay**; phải tự thiết kế thuật toán và kiểm thử bằng máy in. |
| [Picture Puzzle](https://easypeasyenglish.asia/demos/picture-puzzle) | Bộ ảnh do giáo viên thêm; có mode 3D Ring, nút place 1/ place all, speed, nhiều lựa chọn mode; text ghi 11 style, tối đa 100 ảnh cho Member. | Picture Puzzle riêng: 2×2/3×3/4×4 mảnh, đổi 2 mảnh, 2–12 tranh, xem trước & fullscreen. | Không phải 11 mode 3D/tái tạo vòng xoay; không nhận vơ hoàn thành toàn bộ. |
| [Global Success 1 Bubble Garden](https://easypeasyenglish.asia/demos/bubble-word-garden-gs1) | Trang cho thấy chọn Unit, tổng tiến độ, giao diện JavaScript; Unit 1 free. | Bubble Word Garden 5 unit tự biên, có vòng từ thay đổi khi chơi lại. | Không sao chép nội dung sách Global Success/âm thanh gốc. Chưa kiểm chứng tương tác GS1 từ HTML text tối giản. |
| [Global Success 2 Bubble Garden](https://easypeasyenglish.asia/demos/bubble-word-garden-gs2) | Chọn Unit, nghe/hint/try again/choose word, chạm từng chữ, lưu tiến trình, teacher editor, Excel/CSV, Save HTML. | Bubble Word Garden có ghép bong bóng, các Unit, nghe, hint, undo và Play Again. | Chưa có từng bài theo chương trình và Excel/CSV cho game tương đương, chưa bảo đảm pronunciation thu âm. |
| [Global Success 3 Bubble Garden](https://easypeasyenglish.asia/demos/bubble-word-garden-gs3) | Hướng dẫn 3 bước: xem tranh, chạm chữ đúng thứ tự, ←→ đổi từ. | Bubble Word Garden có ảnh vector và bài từ; chọn Unit và tiến trình. | Khác chế độ chuyển từ tùy ý, đang sử dụng cơ chế đổi lượt đã thiết kế riêng. |
| [Global Success 4 Bubble Garden](https://easypeasyenglish.asia/demos/bubble-word-garden-gs4) | Cấu trúc như GS2, Unit, lời nói, editor, import Excel. | Bubble Word Garden và Builder. | Chưa có nội dung GS4 và tính năng biên tập riêng trực tiếp trong game. |
| [Global Success 5 Bubble Garden](https://easypeasyenglish.asia/demos/bubble-word-garden-gs5) | Cấu trúc như GS2/4, Unit, editor, nghe, import Excel. | Bubble Word Garden và Builder. | Chưa có nội dung GS5 và tính năng biên tập riêng trực tiếp trong game. |

## Danh mục Member chưa thể khảo sát từng game

Landing page và Member Library liệt kê các *nhóm* chứ không cung cấp toàn bộ game/luật chơi cho người không được quyền: BINGO, BUBBLE WORD GARDEN, ALPHABETS, STARTERS, SOLO, TEAM, HIDDEN, BUILDING, RANDOM PICKER, FLYERS, GRAMMAR, CAMERA, MOVERS. Phải có tài khoản hợp lệ hoặc video/ảnh do chủ sở hữu game cho phép xem trước, và không sao chép mã/asset/học liệu độc quyền. **Không tự tuyên bố 51/51 game đã nghiên cứu hoặc tái tạo.**

## Bản triển khai mã nguồn trong Phase 12

- Thêm 3 template mới độc lập `phonics-family`, `classroom-explore`, `shadow-guess`.
- Dữ liệu kiểm soát bằng Zod shared schema; Game Builder tự sinh form và có starter content. Cả 3 template **chỉ cho English**, không ảnh hưởng game tiếng Việt.
- Thêm **7 ảnh vector phonics gốc và 8 silhouette vector trong suốt**. Các hình hiện có từ Phase 11.2 phục vụ 9 đồ vật lớp học và tranh 8 con vật.
- Nội dung thực tế: Sound Family Village 9 từ/3 nhóm, Little Learning Classroom 9 đồ vật, Shadow Safari 8 con vật. Chọn **6 mục/lượt**, Play Again quay vòng sang nhóm mới, vẫn dùng voice Anh-Mỹ Kid-friendly theo thiết bị.
- Hai phương thức cho phonics: **tap (điện thoại, bàn phím)** và drag/drop (máy tính).
- Trong API seed có 3 game mới, **`published:false` và review `PENDING`**, không công khai. Dự kiến sau seed sạch tổng 38 game, 29 đang đánh dấu published và 9 ẩn (khác thực tế nếu chủ dự án sửa nội dung).
- Bổ sung asset whitelist cho `/illustrations/phonics/*`, `/illustrations/silhouettes/*` để hoạt động trong gói PWA offline.
- Kiểm thử: schema, seed idempotence, Game Builder Preview E2E trên trang quản trị, chơi đủ lượt, Play Again đổi nhóm từ, nội dung vẫn ẩn.

## Tiêu chuẩn tiếp theo cho từng game mới

1. Xác minh cơ chế chơi thực bằng bản demo do phép truy cập: click/touch/drag/audio/keyboard/bật chế độ lớp/tổng kết.
2. Mô tả state machine (intro → chọn Unit / cấp độ → câu → thắng/thua → đổi round/Play Again), chỉ dùng ảnh/âm thanh/chữ đã được phép sử dụng.
3. Kiểm chứng trên điện thoại, PC và máy chiếu; không chỉ kiểm thử ảnh tĩnh.
4. Tách **ngân hàng nội dung từ game engine** và cung cấp editor cho giáo viên; mỗi lần chơi phải thay nội dung thực chứ không chỉ đảo vị trí nút.
5. Giáo viên duyệt nội dung và giọng đọc, Admin duyệt trạng thái game trước khi mở cho học sinh; không tự bỏ Cloudflare Access hoặc bật thanh toán Live.
6. Nếu thiết kế đòi camera/trẻ em, đánh giá riêng quyền riêng tư và permission; không thêm chức năng camera chỉ để chạy theo số lượng.

**Độ hoàn thành:** Đây là vòng phát triển 3 mẫu bổ sung và ma trận khảo sát công khai. Không phải bản sao toàn bộ website hoặc 51/51 game; không chép pixel-perfect giao diện độc quyền của bên thứ ba. `git pull` không triển khai hay seed. Chỉ chạy trên DL380 sau khi chủ dự án quyết định triển khai HappyClass và đã kiểm tra an toàn.
