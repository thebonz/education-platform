import type { GamePack } from '../types';
import { viPack } from './common';

/** Lớp 4: danh từ, động từ, tính từ; danh từ chung / riêng; nhân hoá; chủ ngữ, vị ngữ, trạng ngữ. */
export const LOP_4: GamePack[] = [
  viPack({
    slug: 'danh-dong-tinh-tu-lop-4', title: 'Danh từ, động từ, tính từ', templateKey: 'word-sort',
    summary: 'Xếp từ vào đúng nhóm danh từ, động từ, tính từ.', difficulty: 'medium',
    category: 'luyen-tu-va-cau', level: 'lop-4', sortOrder: 40, revision: 1,
    data: {
      instructions: 'Đọc từ trên thẻ rồi chạm vào từ loại phù hợp.',
      groups: [
        { id: 'danh', label: 'Danh từ', hint: 'chỉ người, vật, hiện tượng, thời gian' },
        { id: 'dong', label: 'Động từ', hint: 'chỉ hoạt động, trạng thái' },
        { id: 'tinh', label: 'Tính từ', hint: 'chỉ đặc điểm, tính chất' },
      ],
      items: [
        { id: 'd1', text: 'học sinh', group: 'danh' },
        { id: 'd2', text: 'dòng sông', group: 'danh' },
        { id: 'd3', text: 'quyển sách', group: 'danh' },
        { id: 'd4', text: 'mùa xuân', group: 'danh', explain: '“mùa xuân” là danh từ chỉ thời gian.' },
        { id: 'd5', text: 'cơn mưa', group: 'danh', explain: '“cơn mưa” là danh từ chỉ hiện tượng.' },
        { id: 'g1', text: 'lắng nghe', group: 'dong' },
        { id: 'g2', text: 'trò chuyện', group: 'dong' },
        { id: 'g3', text: 'viết', group: 'dong' },
        { id: 'g4', text: 'bơi lội', group: 'dong' },
        { id: 'g5', text: 'chạy', group: 'dong' },
        { id: 't1', text: 'xanh biếc', group: 'tinh' },
        { id: 't2', text: 'thông minh', group: 'tinh' },
        { id: 't3', text: 'rộng lớn', group: 'tinh' },
        { id: 't4', text: 'ngọt ngào', group: 'tinh' },
        { id: 't5', text: 'chăm chỉ', group: 'tinh' },
      ],
    },
  }),
  viPack({
    slug: 'danh-tu-chung-rieng-lop-4', title: 'Danh từ chung, danh từ riêng', templateKey: 'word-sort',
    summary: 'Phân biệt danh từ chung và danh từ riêng; nhớ viết hoa tên riêng.', difficulty: 'medium',
    category: 'luyen-tu-va-cau', level: 'lop-4', sortOrder: 41, revision: 1,
    data: {
      instructions: 'Chạm vào nhóm phù hợp với từ trên thẻ.',
      groups: [
        { id: 'chung', label: 'Danh từ chung', hint: 'tên gọi chung của một loại sự vật' },
        { id: 'rieng', label: 'Danh từ riêng', hint: 'tên riêng, phải viết hoa' },
      ],
      items: [
        { id: 'c1', text: 'sông', group: 'chung' },
        { id: 'c2', text: 'thành phố', group: 'chung' },
        { id: 'c3', text: 'hòn đảo', group: 'chung' },
        { id: 'c4', text: 'dãy núi', group: 'chung' },
        { id: 'c5', text: 'nhà thơ', group: 'chung' },
        { id: 'c6', text: 'bờ biển', group: 'chung' },
        { id: 'r1', text: 'Hà Nội', group: 'rieng', explain: 'Tên riêng của một thành phố.' },
        { id: 'r2', text: 'Việt Nam', group: 'rieng', explain: 'Tên riêng của một đất nước.' },
        { id: 'r3', text: 'Phú Quốc', group: 'rieng', explain: 'Tên riêng của một hòn đảo.' },
        { id: 'r4', text: 'Trường Sơn', group: 'rieng', explain: 'Tên riêng của một dãy núi.' },
        { id: 'r5', text: 'Nguyễn Trãi', group: 'rieng', explain: 'Tên riêng của một người.' },
        { id: 'r6', text: 'Đà Nẵng', group: 'rieng', explain: 'Tên riêng của một thành phố.' },
      ],
    },
  }),
  viPack({
    slug: 'nhan-hoa-thanh-phan-cau-lop-4', title: 'Nhân hoá và các thành phần câu', templateKey: 'quiz',
    summary: 'Nhận biết nhân hoá, chủ ngữ, vị ngữ và trạng ngữ.', difficulty: 'hard',
    category: 'luyen-tu-va-cau', level: 'lop-4', sortOrder: 42, revision: 1,
    data: {
      instructions: 'Đọc kỹ câu văn trong ngoặc kép rồi chọn đáp án đúng.',
      mode: 'solo',
      questions: [
        { id: 'q1', prompt: 'Câu nào có sử dụng biện pháp nhân hoá?', choices: ['Chị gió nhẹ nhàng ru lá ngủ.', 'Gió thổi mạnh làm lá rơi.', 'Hôm nay trời có gió.'], answer: 'Chị gió nhẹ nhàng ru lá ngủ.' },
        { id: 'q2', prompt: 'Trong câu “Ông mặt trời thức dậy, vươn vai chào buổi sáng.”, sự vật nào được nhân hoá?', choices: ['mặt trời', 'buổi sáng', 'bầu trời'], answer: 'mặt trời' },
        { id: 'q3', prompt: 'Trạng ngữ trong câu “Sáng nay, lớp em đi tham quan bảo tàng.” là:', choices: ['Sáng nay', 'lớp em', 'đi tham quan bảo tàng'], answer: 'Sáng nay' },
        { id: 'q4', prompt: 'Trạng ngữ trong câu “Vì trời mưa, trận đấu bị hoãn.” chỉ điều gì?', choices: ['thời gian', 'nguyên nhân', 'nơi chốn'], answer: 'nguyên nhân' },
        { id: 'q5', prompt: 'Trạng ngữ trong câu “Trên cành cây, chim hót líu lo.” chỉ điều gì?', choices: ['nơi chốn', 'thời gian', 'mục đích'], answer: 'nơi chốn' },
        { id: 'q6', prompt: 'Chủ ngữ của câu “Những bông hoa hồng nở rộ trong vườn.” là:', choices: ['Những bông hoa hồng', 'nở rộ', 'trong vườn'], answer: 'Những bông hoa hồng' },
        { id: 'q7', prompt: 'Vị ngữ của câu “Bạn Minh rất thích vẽ tranh.” là:', choices: ['Bạn Minh', 'rất thích vẽ tranh', 'vẽ tranh'], answer: 'rất thích vẽ tranh' },
        { id: 'q8', prompt: 'Từ nào là động từ trong câu “Đàn chim bay về phương nam.”?', choices: ['đàn chim', 'bay', 'phương nam'], answer: 'bay' },
      ],
    },
  }),
];

/** Lớp 5: từ đồng nghĩa, từ đa nghĩa, đại từ, kết từ, câu ghép, liên kết câu. */
export const LOP_5: GamePack[] = [
  viPack({
    slug: 'tu-dong-nghia-lop-5', title: 'Nhóm từ đồng nghĩa', templateKey: 'word-sort',
    summary: 'Xếp các từ đồng nghĩa vào cùng một nhóm.', difficulty: 'medium',
    category: 'luyen-tu-va-cau', level: 'lop-5', sortOrder: 50, revision: 1,
    data: {
      instructions: 'Mỗi nhóm gồm các từ có nghĩa giống hoặc gần giống nhau. Chạm vào nhóm phù hợp với từ trên thẻ.',
      groups: [
        { id: 'cham', label: 'Cùng nghĩa với “chăm chỉ”' },
        { id: 'lon', label: 'Cùng nghĩa với “to lớn”' },
        { id: 'vui', label: 'Cùng nghĩa với “vui vẻ”' },
      ],
      items: [
        { id: 'c1', text: 'siêng năng', group: 'cham' },
        { id: 'c2', text: 'cần cù', group: 'cham' },
        { id: 'c3', text: 'chịu khó', group: 'cham' },
        { id: 'c4', text: 'chuyên cần', group: 'cham' },
        { id: 'l1', text: 'khổng lồ', group: 'lon' },
        { id: 'l2', text: 'vĩ đại', group: 'lon' },
        { id: 'l3', text: 'đồ sộ', group: 'lon' },
        { id: 'l4', text: 'to tướng', group: 'lon' },
        { id: 'v1', text: 'hân hoan', group: 'vui' },
        { id: 'v2', text: 'phấn khởi', group: 'vui' },
        { id: 'v3', text: 'vui mừng', group: 'vui' },
        { id: 'v4', text: 'tươi vui', group: 'vui' },
      ],
    },
  }),
  viPack({
    slug: 'tu-va-cau-lop-5', title: 'Đại từ, kết từ, từ đa nghĩa', templateKey: 'quiz',
    summary: 'Ôn đại từ, kết từ, cặp từ hô ứng, từ đa nghĩa, câu ghép và liên kết câu.', difficulty: 'hard',
    category: 'luyen-tu-va-cau', level: 'lop-5', sortOrder: 51, revision: 1,
    data: {
      instructions: 'Đọc kỹ câu văn trong ngoặc kép rồi chọn đáp án đúng.',
      mode: 'solo',
      questions: [
        { id: 'q1', prompt: 'Từ nào là kết từ trong câu “Trời mưa nhưng chúng em vẫn đến trường.”?', choices: ['nhưng', 'vẫn', 'đến'], answer: 'nhưng' },
        { id: 'q2', prompt: 'Chọn cặp kết từ phù hợp: “… bạn Nam bị ốm … bạn vẫn đi học đầy đủ.”', choices: ['Tuy – nhưng', 'Vì – nên', 'Nếu – thì'], answer: 'Tuy – nhưng' },
        { id: 'q3', prompt: 'Trong đoạn “Con mèo nhà em rất ngoan. Nó thường nằm sưởi nắng.”, từ “nó” là:', choices: ['đại từ', 'danh từ', 'tính từ'], answer: 'đại từ' },
        { id: 'q4', prompt: 'Câu nào là câu ghép?', choices: ['Mặt trời mọc, sương tan dần.', 'Buổi sáng, sương phủ trắng cánh đồng.', 'Những giọt sương long lanh.'], answer: 'Mặt trời mọc, sương tan dần.' },
        { id: 'q5', prompt: 'Từ “chân” trong câu nào được dùng với nghĩa gốc?', choices: ['Bé bị đau chân.', 'Chân bàn bị gãy.', 'Dưới chân núi có ngôi làng.'], answer: 'Bé bị đau chân.' },
        { id: 'q6', prompt: 'Trong đoạn “Lan rất chăm học. Bạn ấy luôn làm bài đầy đủ.”, cụm từ “bạn ấy” thay thế cho từ nào?', choices: ['Lan', 'bài', 'học'], answer: 'Lan' },
        { id: 'q7', prompt: 'Từ “mắt” trong câu “Quả na đã mở mắt.” được dùng với nghĩa nào?', choices: ['nghĩa gốc', 'nghĩa chuyển'], answer: 'nghĩa chuyển' },
        { id: 'q8', prompt: 'Chọn cặp từ hô ứng phù hợp: “Trời … sáng, chim … hót.”', choices: ['vừa – đã', 'tuy – nhưng', 'vì – nên'], answer: 'vừa – đã' },
      ],
    },
  }),
  viPack({
    slug: 'xep-cau-ghep-lop-5', title: 'Sắp xếp câu ghép', templateKey: 'sentence-order',
    summary: 'Ghép các vế câu với kết từ, cặp từ hô ứng để tạo thành câu ghép đúng.', difficulty: 'hard',
    category: 'cau-va-dau-cau', level: 'lop-5', sortOrder: 52, revision: 1,
    data: {
      instructions: 'Chạm các mảnh theo thứ tự đúng để tạo thành câu ghép.',
      items: [
        { id: 'c1', sentence: 'Vì trời mưa to nên chúng em ở trong lớp.', chunks: ['Vì', 'trời mưa to', 'nên', 'chúng em ở trong lớp'] },
        { id: 'c2', sentence: 'Tuy nhà xa nhưng Hoa chưa bao giờ đi học muộn.', chunks: ['Tuy', 'nhà xa', 'nhưng', 'Hoa chưa bao giờ đi học muộn'] },
        { id: 'c3', sentence: 'Nếu em chăm luyện tập thì em sẽ bơi giỏi.', chunks: ['Nếu', 'em chăm luyện tập', 'thì', 'em sẽ bơi giỏi'] },
        { id: 'c4', sentence: 'Mưa càng to, gió càng mạnh.', chunks: ['Mưa', 'càng to,', 'gió', 'càng mạnh'] },
        { id: 'c5', sentence: 'Mặt trời vừa lên, sương đã tan.', chunks: ['Mặt trời', 'vừa lên,', 'sương', 'đã tan'] },
      ],
    },
  }),
];
