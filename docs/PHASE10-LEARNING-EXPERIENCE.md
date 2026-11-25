# Phase 10 – Trải nghiệm học tập HappyClass (nội dung, giọng Việt, UX)

## Trải nghiệm pastel và trò chơi gốc

Đã phát triển thêm [Star Trail Adventure / Đường sao dấu thanh và giao diện pastel](PHASE10-REFERENCE-GAMEPLAY.md). Hai game được nạp ở trạng thái **ẩn, PENDING** để giáo viên xem trước và kiểm tra tiếng Việt. Không lấy asset, nội dung hay source từ website tham khảo.

## Mục đích

Sau khi phần hạ tầng, thanh toán Sandbox và bảo mật origin đã ổn định, chuyển trọng tâm sang **trẻ thích chơi, nghe đúng, học đúng và giáo viên dễ chọn game**.

Phạm vi được đối chiếu trên code HappyClass và bài giới thiệu công khai về website tham khảo ngày 10/11/2026: [VniTeach – Easy Peasy English](https://www.vniteach.com/2026/11/10/easy-peasy-english-hoc-tieng-anh-qua-tro-choi-tuong-tac-thu-vi/). **Không khẳng định đã truy cập/chụp trực tiếp mọi màn hình của website tham khảo**; bài giới thiệu mô tả loại game, nhóm chủ đề, chơi thử, phiên bản thành viên và hoạt động lớp. Chỉ lấy cảm hứng **kiến trúc trải nghiệm**, không sao chép thương hiệu, hình ảnh, asset, câu hỏi hay mã nguồn.

### Hiện trạng đã xác minh

- DL380: 29 game, 29 đã đặt `isPublished=true`, **29 `PENDING`, 0 `APPROVED`**, không thiếu phiên bản nội dung xuất bản. Đó là **blocker chất lượng**; Cloudflare Access vẫn phải giữ trong giai đoạn kiểm thử.
- Bộ 29 seed: 6 game tiếng Anh, 23 game tiếng Việt. Có 10 game template (bingo, match, hidden-picture, bubble-spelling, spelling, quiz, syllable-builder, tone-finder, word-sort, sentence-order).
- Giọng tiếng Việt có Piper `vi_VN-vais1000-medium` trên CPU, ưu tiên WAV cache ở `/api/tts?lang=vi`, fallback chỉ khi trình duyệt có giọng Việt thực sự. **Chưa có nghiệm thu chất lượng nghe thực tế trên nhiều thiết bị**.
- HappyClass đã có Game Builder, vai trò `content_reviewer`, xem trước, thành viên, offline và lớp học. Không xây lại các phần đã hoạt động chỉ để giống hình thức của bên thứ ba.

## Đã triển khai ở PR Phase 10 đầu tiên (không tự deploy)

1. **Kiểm tra giọng trước khi chơi:** game Việt có nút `Nghe thử giọng Việt` ở intro, phát câu kiểm tra 6 thanh: `Bé nghe sáu thanh: ma, má, mà, mả, mã, mạ.` Không phát tự động trước thao tác trẻ; không tạo tệp âm thanh trong Git.
2. **Lỗi âm thanh có thể phục hồi:** khi audio máy chủ thực sự bắt đầu phát, ẩn thông báo lỗi đã cũ; chặn sự kiện audio quá hạn từ câu trước hoặc sau khi tắt tiếng. Không giả định rằng tải được WAV đồng nghĩa phát âm đúng.
3. **Tìm game theo hoạt động:** trên thư viện English có *Listen & discover, Build & spell, Team challenges*; tiếng Việt có *Nghe & nhận diện, Ghép tiếng & dấu thanh, Từ & câu*. Mỗi thẻ chỉ trỏ tới các template thực tế đang có; lưu bộ lọc bằng `?skill=` để giáo viên chia sẻ. Có bộ đếm, thông báo không có kết quả và nút xóa lọc.
4. **Thiết kế:** thẻ nhóm hoạt động lớn, responsive điện thoại/máy chiếu, nút ≥44px và trạng thái focus bàn phím. Không dùng ảnh hay logo của Easy Peasy English.

## Hỗ trợ giáo viên kiểm duyệt game (PR tiếp theo)

Trong Admin → Nội dung game → mở chi tiết game tiếng Việt:
- Hiển thị tối đa **12 mẫu câu/tiếng có thể nghe thử**, tự lấy từ phiên bản đang phát hành; bấm nút để nghe bằng đường âm thanh Việt hiện có. Không tự phát khi mở trang, không gửi câu sang dịch vụ ngoài.
- Nút **Duyệt** chỉ bật trên giao diện sau khi giáo viên chủ động xác nhận đã đọc đáp án/hình minh họa, chơi thử trên thiết bị và nghe âm thanh quan trọng. Nếu thấy sai, chọn **Yêu cầu sửa** kèm ghi chú.
- Đây là checklist hỗ trợ thao tác; quyền duyệt vẫn do API/RBAC kiểm soát và giao diện không thể thay thế sự thẩm định của con người. Không tự đổi trạng thái của 29 game.

## Giai đoạn nội dung: cần giáo viên nghiệm thu, không tự duyệt

| Ưu tiên | Công việc | Điều kiện hoàn thành |
| --- | --- | --- |
| P0 | Duyệt từng game trong 29 game `PENDING` | Giáo viên đọc/chơi thử mỗi game, ghi rõ sửa hay duyệt. Không batch approve. |
| P0 | Nghe thử sáu thanh tiếng Việt và các câu thật trong các game `tone-finder`, `syllable-builder` | Nghe ở Chrome Windows, Android và một trình duyệt iOS; xác nhận âm / dấu không sai, người học có thể bấm nghe lại. |
| P0 | Đối chiếu câu hỏi, đáp án, giải thích sai, chỉ dẫn | Có checklist lỗi riêng: sai chính tả, trùng đáp án, ảnh không tương ứng, đáp án mơ hồ, độ khó không phù hợp lớp. |
| P1 | Hệ thống game có tiến trình và gợi ý dễ hiểu hơn | Rõ mục tiêu, lượt chơi, phản hồi, thành tích, chơi lại. Phân biệt học lớp và học tại nhà. |
| P1 | Thư viện cải thiện lựa chọn theo kỹ năng, tuổi/lớp, nhóm | Dễ chọn game trên điện thoại/máy chiếu; URL bộ lọc chia sẻ được. |
| P2 | Thêm cơ chế game gốc (board adventure, random picker, thử thách theo chủ đề) | Luật chơi và câu hỏi mới, có kiểm thử E2E, không sao chép sản phẩm bên thứ ba. |
| P2 | Bộ câu hỏi theo bài học/lộ trình chương trình | Có thẩm định giáo viên và rà soát bản quyền học liệu; không sao chép nguyên sách hoặc trò chơi khác. |

### Bộ tiêu chuẩn tối thiểu cho từng game

- **Giá trị học tập:** 1 mục tiêu rõ (nghe, nhận mặt chữ, ghép vần, chọn dấu, sắp câu...); tránh lặp câu hỏi chỉ để kéo dài.
- **Đúng tiếng Việt:** chính tả, Unicode NFC, thanh điệu, phương ngữ đã chọn, âm đọc không dùng giọng Anh. Với các chữ `i/y`, `d/gi/r`, `l/n` và từ đa nghĩa, kiểm tra cả ngữ cảnh; TTS có thể đọc tự nhiên nhưng vẫn sai mục tiêu sư phạm.
- **Phản hồi:** đúng/sai dễ nhận biết, gợi ý có tính giáo dục, không phạt trẻ quá mức.
- **Đa thiết bị:** màn 375px và máy chiếu; thao tác bằng chạm và bàn phím, không chỉ dựa trên màu, nút nghe lại dễ bấm.
- **Minh bạch:** game đang chờ duyệt phải được phân biệt rõ trong giai đoạn thử; không dùng `isPublished` thay cho `APPROVED` để suy ra chất lượng.

### Các bước nghiệm thu có thể chạy

Sau khi mã nguồn mới được merge và cập nhật trên DL380:

~~~bash
cd /data/education-games-platform/source
sudo bash ops/check-prelaunch-content-accounts.sh
sudo bash ops/check-runtime-health.sh
~~~

Vào site Vietnamese qua Cloudflare Access → chọn một game dấu thanh → nhấn **Nghe thử giọng Việt** trước khi chơi, sau đó nghe câu đọc trong từng lượt. Trường hợp phát sai, ghi lại **slug game, từ/câu, trình duyệt, loại thiết bị**, không gửi credential.

**Không có công cụ nào tự duyệt game, cấp tài khoản mới, chỉnh PostgreSQL, thay TTS model, rebuild Docker, sửa Cloudflare hoặc mở SePay Live.** Sau khi kết quả nội dung được giáo viên duyệt thật, có thể ghi tự xác nhận `content.review` theo `docs/MANUAL-ACCEPTANCE.md`. Hồ sơ pháp lý vẫn cần chủ dự án phê duyệt riêng.
