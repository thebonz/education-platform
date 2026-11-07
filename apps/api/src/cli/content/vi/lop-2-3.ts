import type { GamePack } from '../types';
import { e, viPack } from './common';

/** Lớp 2: từ chỉ sự vật, hoạt động, đặc điểm; câu giới thiệu / nêu hoạt động / nêu đặc điểm; dấu câu. */
export const LOP_2: GamePack[] = [
  viPack({
    slug: 'su-vat-hoat-dong-dac-diem', title: 'Sự vật, hoạt động hay đặc điểm?', templateKey: 'word-sort',
    summary: 'Xếp mỗi từ vào nhóm: từ chỉ sự vật, từ chỉ hoạt động, từ chỉ đặc điểm.',
    category: 'luyen-tu-va-cau', level: 'lop-2', sortOrder: 20, revision: 1,
    data: {
      instructions: 'Đọc từ trên thẻ rồi chạm vào nhóm phù hợp.',
      groups: [
        { id: 'su-vat', label: 'Từ chỉ sự vật', hint: 'người, con vật, đồ vật, cây cối' },
        { id: 'hoat-dong', label: 'Từ chỉ hoạt động', hint: 'việc làm của người, con vật' },
        { id: 'dac-diem', label: 'Từ chỉ đặc điểm', hint: 'màu sắc, hình dáng, tính nết' },
      ],
      items: [
        { id: 'a1', text: 'quyển vở', group: 'su-vat', picture: e('📒') },
        { id: 'a2', text: 'cây bàng', group: 'su-vat', picture: e('🌳') },
        { id: 'a3', text: 'cô giáo', group: 'su-vat', picture: e('👩‍🏫') },
        { id: 'a4', text: 'con mèo', group: 'su-vat', picture: e('🐱') },
        { id: 'a5', text: 'cái bảng', group: 'su-vat' },
        { id: 'b1', text: 'nhảy dây', group: 'hoat-dong' },
        { id: 'b2', text: 'quét nhà', group: 'hoat-dong', picture: e('🧹') },
        { id: 'b3', text: 'viết', group: 'hoat-dong', picture: e('✍️') },
        { id: 'b4', text: 'bơi', group: 'hoat-dong', picture: e('🏊') },
        { id: 'b5', text: 'hát', group: 'hoat-dong', picture: e('🎤') },
        { id: 'c1', text: 'xanh', group: 'dac-diem', explain: '“xanh” chỉ màu sắc.' },
        { id: 'c2', text: 'chăm chỉ', group: 'dac-diem', explain: '“chăm chỉ” chỉ tính nết.' },
        { id: 'c3', text: 'cao', group: 'dac-diem', explain: '“cao” chỉ hình dáng.' },
        { id: 'c4', text: 'tròn', group: 'dac-diem' },
        { id: 'c5', text: 'ngoan', group: 'dac-diem' },
      ],
    },
  }),
  viPack({
    slug: 'xep-cau-lop-2', title: 'Xếp thành câu hoàn chỉnh', templateKey: 'sentence-order',
    summary: 'Sắp xếp các cụm từ thành câu giới thiệu, câu nêu hoạt động, câu nêu đặc điểm.',
    category: 'cau-va-dau-cau', level: 'lop-2', sortOrder: 21, revision: 1,
    data: {
      instructions: 'Chạm các cụm từ theo thứ tự đúng để tạo thành câu.',
      items: [
        { id: 'c1', sentence: 'Em là học sinh lớp Hai.', chunks: ['Em', 'là', 'học sinh', 'lớp Hai'] },
        { id: 'c2', sentence: 'Bạn Lan đang tưới hoa.', chunks: ['Bạn Lan', 'đang', 'tưới', 'hoa'], picture: e('🌷') },
        { id: 'c3', sentence: 'Bầu trời hôm nay rất trong xanh.', chunks: ['Bầu trời', 'hôm nay', 'rất', 'trong xanh'], alternatives: ['Hôm nay bầu trời rất trong xanh.'] },
        { id: 'c4', sentence: 'Chú mèo nhà em rất lười.', chunks: ['Chú mèo', 'nhà em', 'rất', 'lười'], picture: e('🐈') },
        { id: 'c5', sentence: 'Các bạn nhỏ chơi kéo co.', chunks: ['Các bạn nhỏ', 'chơi', 'kéo co'] },
        { id: 'c6', sentence: 'Bố em là bác sĩ.', chunks: ['Bố em', 'là', 'bác sĩ'], picture: e('🩺') },
      ],
    },
  }),
  viPack({
    slug: 'chon-dau-cau-lop-2', title: 'Chọn dấu câu', templateKey: 'quiz',
    summary: 'Chọn dấu chấm, dấu chấm hỏi hay dấu chấm than cho cuối câu.',
    category: 'cau-va-dau-cau', level: 'lop-2', sortOrder: 22, revision: 1,
    data: {
      instructions: 'Đọc câu và chọn dấu câu thích hợp đặt ở cuối câu.',
      mode: 'solo',
      shuffleChoices: false,
      questions: [
        { id: 'q1', prompt: 'Bạn đã làm bài tập chưa …', choices: ['.', '?', '!'], answer: '?' },
        { id: 'q2', prompt: 'Hôm nay em được điểm mười …', choices: ['.', '?', '!'], answer: '.' },
        { id: 'q3', prompt: 'Ôi, bông hoa đẹp quá …', choices: ['.', '?', '!'], answer: '!' },
        { id: 'q4', prompt: 'Nhà bạn ở đâu …', choices: ['.', '?', '!'], answer: '?' },
        { id: 'q5', prompt: 'Mẹ em đi làm về muộn …', choices: ['.', '?', '!'], answer: '.' },
        { id: 'q6', prompt: 'Chao ôi, biển rộng quá …', choices: ['.', '?', '!'], answer: '!' },
        { id: 'q7', prompt: 'Bạn thích ăn quả gì …', choices: ['.', '?', '!'], answer: '?' },
        { id: 'q8', prompt: 'Sân trường em có nhiều cây xanh …', choices: ['.', '?', '!'], answer: '.' },
      ],
    },
  }),
];

/** Lớp 3: kiểu câu; so sánh; từ có nghĩa giống nhau và trái ngược nhau. */
export const LOP_3: GamePack[] = [
  viPack({
    slug: 'kieu-cau-lop-3', title: 'Câu kể, câu hỏi, câu cảm, câu khiến', templateKey: 'word-sort',
    summary: 'Đọc câu và xếp vào đúng kiểu câu.', difficulty: 'medium',
    category: 'cau-va-dau-cau', level: 'lop-3', sortOrder: 30, revision: 1,
    data: {
      instructions: 'Đọc câu trên thẻ, chạm vào kiểu câu phù hợp. Chú ý các từ như “hãy, đừng”, “ôi, chà” và dấu cuối câu.',
      groups: [
        { id: 'ke', label: 'Câu kể' },
        { id: 'hoi', label: 'Câu hỏi' },
        { id: 'cam', label: 'Câu cảm' },
        { id: 'khien', label: 'Câu khiến' },
      ],
      items: [
        { id: 'k1', text: 'Lớp em có ba mươi bạn.', group: 'ke' },
        { id: 'k2', text: 'Em thích đọc truyện cổ tích.', group: 'ke' },
        { id: 'h1', text: 'Bạn đi học bằng gì?', group: 'hoi' },
        { id: 'h2', text: 'Vì sao lá cây có màu xanh?', group: 'hoi' },
        { id: 'm1', text: 'Ôi, cánh đồng lúa đẹp quá!', group: 'cam', explain: 'Câu bộc lộ cảm xúc, có từ “ôi”.' },
        { id: 'm2', text: 'Chà, bạn vẽ giỏi thật!', group: 'cam', explain: 'Câu bộc lộ cảm xúc, có từ “chà”.' },
        { id: 't1', text: 'Các em hãy giữ trật tự.', group: 'khien', explain: 'Câu yêu cầu, có từ “hãy”.' },
        { id: 't2', text: 'Đừng vứt rác ra sân trường!', group: 'khien', explain: 'Câu yêu cầu, có từ “đừng”.' },
        { id: 't3', text: 'Bạn hãy cho mình mượn bút nhé!', group: 'khien', explain: 'Câu đề nghị, có từ “hãy”.' },
      ],
    },
  }),
  viPack({
    slug: 'so-sanh-lop-3', title: 'Tìm hình ảnh so sánh', templateKey: 'quiz',
    summary: 'Nhận ra sự vật được so sánh, từ so sánh và kiểu so sánh.', difficulty: 'medium',
    category: 'luyen-tu-va-cau', level: 'lop-3', sortOrder: 31, revision: 1,
    data: {
      instructions: 'Đọc kỹ câu văn trong ngoặc kép rồi chọn đáp án đúng.',
      mode: 'solo',
      questions: [
        { id: 'q1', prompt: 'Trong câu “Mặt trăng tròn như cái đĩa bạc.”, mặt trăng được so sánh với gì?', choices: ['cái đĩa bạc', 'bầu trời', 'ngôi sao'], answer: 'cái đĩa bạc' },
        { id: 'q2', prompt: 'Từ nào dùng để so sánh trong câu “Đôi mắt bé sáng như sao.”?', choices: ['sáng', 'như', 'sao'], answer: 'như' },
        { id: 'q3', prompt: 'Câu nào có hình ảnh so sánh?', choices: ['Hoa phượng nở đỏ rực.', 'Hoa phượng đỏ như lửa.', 'Hoa phượng nở vào mùa hè.'], answer: 'Hoa phượng đỏ như lửa.' },
        { id: 'q4', prompt: 'Trong câu “Cây bàng già như một chiếc ô khổng lồ.”, sự vật nào được so sánh?', choices: ['cây bàng', 'chiếc ô', 'khổng lồ'], answer: 'cây bàng' },
        { id: 'q5', prompt: 'Chọn từ thích hợp: “Dòng sông uốn quanh … một dải lụa.”', choices: ['như', 'và', 'nhưng'], answer: 'như' },
        { id: 'q6', prompt: 'Câu “Bé chạy nhanh hơn chú mèo.” là kiểu so sánh nào?', choices: ['so sánh ngang bằng', 'so sánh hơn kém'], answer: 'so sánh hơn kém' },
        { id: 'q7', prompt: 'Từ nào thường dùng trong so sánh ngang bằng?', choices: ['như', 'hơn', 'kém'], answer: 'như' },
      ],
    },
  }),
  viPack({
    slug: 'giong-nghia-trai-nghia-lop-3', title: 'Từ giống nghĩa, từ trái nghĩa', templateKey: 'quiz',
    summary: 'Tìm từ có nghĩa giống nhau và từ có nghĩa trái ngược nhau.', difficulty: 'medium',
    category: 'luyen-tu-va-cau', level: 'lop-3', sortOrder: 32, revision: 1,
    data: {
      instructions: 'Đọc câu hỏi và chọn đáp án đúng.',
      mode: 'solo',
      questions: [
        { id: 'q1', prompt: 'Từ nào có nghĩa giống “to lớn”?', choices: ['khổng lồ', 'bé nhỏ', 'xinh xắn'], answer: 'khổng lồ' },
        { id: 'q2', prompt: 'Từ trái nghĩa với “chăm chỉ” là:', choices: ['lười biếng', 'cần cù', 'siêng năng'], answer: 'lười biếng' },
        { id: 'q3', prompt: 'Từ trái nghĩa với “nhanh” là:', choices: ['chậm', 'vội', 'gấp'], answer: 'chậm' },
        { id: 'q4', prompt: 'Từ nào có nghĩa giống “xinh đẹp”?', choices: ['xinh xắn', 'xấu xí', 'to lớn'], answer: 'xinh xắn' },
        { id: 'q5', prompt: 'Cặp từ nào có nghĩa trái ngược nhau?', choices: ['sáng – tối', 'to – lớn', 'vui – mừng'], answer: 'sáng – tối' },
        { id: 'q6', prompt: 'Từ trái nghĩa với “dũng cảm” là:', choices: ['hèn nhát', 'gan dạ', 'can đảm'], answer: 'hèn nhát' },
        { id: 'q7', prompt: 'Từ nào có nghĩa giống “hiền lành”?', choices: ['hiền hậu', 'dữ tợn', 'nóng nảy'], answer: 'hiền hậu' },
      ],
    },
  }),
];
