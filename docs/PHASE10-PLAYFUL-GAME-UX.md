# Phase 10.4 — Nâng trải nghiệm game HappyClass (Bingo Carnival, Word Garden, poster)

## Mục tiêu và tham chiếu

Anh muốn nâng HappyClass theo trải nghiệm trò chơi tiếng Anh thú vị như Easy Peasy English. Đối chiếu trang công khai [Easy Peasy English](https://easypeasyenglish.asia/): tập trung vào poster nhiều màu sắc, lựa chọn game dễ hiểu, Bingo luyện nghe, bộ sưu tập theo kỹ năng và trải nghiệm chơi trọn một vòng.

**Phạm vi:** mô phỏng **loại tương tác/chức năng**; không sao chép code, ảnh, poster, nhân vật, biểu tượng độc quyền, bố cục chi tiết hay học liệu gốc của website tham khảo. Các phần đồ họa bên dưới là CSS/text/emoji độc lập của HappyClass.

## Đã triển khai (PR)

| Hạng mục | Thay đổi | Đường dẫn |
| --- | --- | --- |
| Poster game | Chuyển thẻ emoji đơn thành poster gốc CSS gồm nhãn game, chữ nổi, icon, nền riêng và hiệu ứng nhẹ | `apps/web/src/components/game-card.tsx` |
| Nội dung chưa kiểm duyệt | Thể hiện nhãn `Teacher review pending` / `Đang chờ giáo viên duyệt` trong thẻ nếu `reviewStatus !== APPROVED` | GameCard |
| Bingo Carnival | Chọn bảng 3×3 / 4×4 / 5×5 khi đủ dữ liệu, mục tiêu một hàng/toàn bảng, trộn bảng mới, nghe lại, xem/ẩn chữ, tiến độ thắng và phản hồi BINGO | `apps/web/src/games/templates/bingo.tsx` |
| Word Garden | Chọn khu vườn, thước tiến độ từng từ, khu vực hình ảnh/trợ nghe nổi bật, thông báo khi hoàn thành từ | `apps/web/src/games/templates/bubble-spelling.tsx` |
| Responsive/A11y | Thẻ trên điện thoại, bàn Bingo nhỏ, nút phím chạm, focus keyboard, giảm chuyển động khi thiết bị yêu cầu | `apps/web/src/app/globals.css` |
| Kiểm thử | Playwright 3×3 full-board, 5×5, trộn bảng, ô sai, lời gọi, poster và Bubble Garden | `apps/web/e2e/games.spec.ts` |

### Không thay đổi phần đã hoạt động tốt

- Không thay bảng game, không sửa `GamePack`, nội dung câu hỏi, phiên bản seed, quyền truy cập hoặc schema PostgreSQL.
- Không thay giọng đọc, API TTS, SePay Sandbox/Live hoặc Cloudflare Access.
- Không tạo game mới hoặc duyệt 31 game hiện có. Bản kiểm toán gần nhất có **31 PENDING / 29 published**, vẫn cần giáo viên nghiệm thu.
- Không cập nhật máy chủ DL380 tự động. Merge mã nguồn **không phải deploy**; thay đổi Web cần một lần build riêng có kiểm soát.
- Trên DL380 còn CMMS/Airdrop; thao tác triển khai chỉ giới hạn HappyClass, cần sao lưu/kiểm tra sau deploy.

## Game mới: Mystery House (mã nguồn giai đoạn kế tiếp)

Đã phát triển template `mystery-doors`: các cửa tạo bằng CSS che tranh, học sinh mở từng cửa rồi chọn đáp án từ vựng. Game Builder dùng được ảnh thư viện hoặc emoji, hỗ trợ 4/6/9 cửa và 3–12 vòng, audio câu hỏi và gợi ý. Mẫu English gồm bốn vòng gốc (cat/apple/ball/bus), luôn **ẩn + PENDING** để giáo viên chơi thử. Không sao chép asset/code/nội dung từ website khác.

## Mục tiêu chất lượng giai đoạn kế tiếp

1. **Nội dung:** giáo viên chấm rubric từng game English/VI (mục tiêu học, câu hỏi/đáp án, âm thanh, mức độ, chất lượng hình).
2. **Gameplay sâu:** thêm bài tập phonics có âm thanh được giáo viên duyệt, bộ câu hỏi theo Unit, phần thưởng gắn tiến trình thật — không tặng huy hiệu giả.
3. **Thư viện học liệu:** tách Question Bank và Game Template để một Unit chạy được Bingo, Picture Match, Bubble Garden, Quiz; cần thiết kế migration/rollback ở PR riêng.
4. **Đồ họa:** poster minh họa riêng cho từng game thực tế, tối ưu 3 kích thước và nhận diện HappyClass; không lấy ảnh của Easy Peasy.
5. **Âm thanh:** kiểm tra chất lượng English Web Speech trên Windows/Android/iOS; mô hình âm thanh đã thẩm định và cơ chế offline ở PR riêng.

## Nghiệm thu trên môi trường nội bộ

Sau khi PR đã qua CI và được merge, người vận hành có thể `sudo git pull --ff-only` trước; **chưa chạy lại deploy** nếu chưa có kế hoạch backup/khởi động lại Web. Mở site nội bộ sau một đợt deploy có kiểm soát để kiểm thử trò Bingo, thẻ game, Garden trên desktop/máy chiếu/điện thoại.

Các game chưa được giáo viên phê duyệt vẫn không đủ điều kiện mở công khai. Hồ sơ pháp lý cần phê duyệt riêng.
