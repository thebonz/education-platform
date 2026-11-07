import { emoji, GamePack } from './types';

/**
 * Game tiếng Việt chuyển từ Sprint 1 sang template mới. Nội dung đầy đủ cho lớp 1–5
 * (bám chương trình Kết nối tri thức với cuộc sống) sẽ có ở giai đoạn 4, sau khi giáo viên duyệt.
 */
export const VIETNAMESE_GAMES: GamePack[] = [
  {
    product: 'vietnamese', slug: 'bingo-chu-cai', title: 'Bingo chữ cái', templateKey: 'bingo',
    summary: 'Nghe gọi chữ cái, tìm trên bảng và hoàn thành một hàng để thắng.',
    category: 'chu-cai', level: 'lop-1', difficulty: 'easy', accessLevel: 'FREE', sortOrder: 1, revision: 2, published: true,
    data: {
      instructions: 'Tìm chữ cái được gọi trên bảng và chạm vào. Đủ một hàng ngang, dọc hoặc chéo là BINGO!',
      boardSize: 3, win: 'line', showCallText: true,
      items: ['a', 'ă', 'â', 'b', 'c', 'd', 'đ', 'e', 'ê', 'g', 'h', 'i', 'k', 'l', 'm'].map((c, i) => ({ id: `c${i + 1}`, text: c })),
    },
  },
  {
    product: 'vietnamese', slug: 'ghep-chu-va-hinh', title: 'Ghép chữ và hình', templateKey: 'picture-match',
    summary: 'Nối mỗi từ với hình minh họa phù hợp.',
    category: 'tu-vung', level: 'lop-1', difficulty: 'easy', accessLevel: 'FREE', sortOrder: 2, revision: 2, published: true,
    data: {
      instructions: 'Chạm vào một từ, sau đó chạm vào hình phù hợp.',
      pairs: [
        { id: 'meo', word: 'mèo', picture: emoji('🐱') },
        { id: 'ca', word: 'cá', picture: emoji('🐟') },
        { id: 'hoa', word: 'hoa', picture: emoji('🌸') },
        { id: 'nha', word: 'nhà', picture: emoji('🏠') },
        { id: 'ga', word: 'gà', picture: emoji('🐔') },
        { id: 'bo', word: 'bò', picture: emoji('🐄') },
      ],
    },
  },
  {
    product: 'vietnamese', slug: 'tim-dau-thanh', title: 'Tìm dấu thanh', templateKey: 'quiz',
    summary: 'Nhận biết các thanh sắc, huyền, hỏi, ngã, nặng.',
    category: 'dau-thanh', level: 'lop-1', difficulty: 'easy', accessLevel: 'FREE', sortOrder: 3, revision: 2, published: true,
    data: {
      instructions: 'Đọc câu hỏi và chọn đáp án đúng.',
      mode: 'solo',
      questions: [
        { id: 'q1', prompt: 'Tiếng nào chỉ con vật sống dưới nước?', choices: ['ca', 'cá', 'cà'], answer: 'cá' },
        { id: 'q2', prompt: 'Tiếng nào có thanh huyền?', choices: ['má', 'mà', 'mã'], answer: 'mà' },
        { id: 'q3', prompt: 'Tiếng “ngã” mang thanh gì?', choices: ['thanh hỏi', 'thanh ngã', 'thanh nặng'], answer: 'thanh ngã' },
        { id: 'q4', prompt: 'Tiếng nào có thanh hỏi?', choices: ['cỏ', 'cọ', 'có'], answer: 'cỏ' },
        { id: 'q5', prompt: 'Tiếng nào có thanh nặng?', choices: ['lá', 'lạ', 'là'], answer: 'lạ' },
        { id: 'q6', prompt: 'Tiếng “bé” mang thanh gì?', choices: ['thanh sắc', 'thanh huyền', 'thanh ngang'], answer: 'thanh sắc' },
      ],
    },
  },
  {
    product: 'vietnamese', slug: 'ghep-van', title: 'Ghép vần', templateKey: 'bubble-spelling',
    summary: 'Ghép âm đầu với vần để tạo thành tiếng.',
    category: 'van-va-tieng', level: 'lop-1', difficulty: 'easy', accessLevel: 'FREE', sortOrder: 4, revision: 2,
    // Tạm ẩn: cần template ghép vần đúng phương pháp (âm đầu + vần + thanh) ở giai đoạn 4.
    published: false,
    data: {
      units: [{ id: 'van-eo', title: 'Vần eo', words: [{ id: 'meo', word: 'mèo', segments: ['m', 'èo'], picture: emoji('🐱') }] }],
    },
  },
  {
    product: 'vietnamese', slug: 'tro-choi-chinh-ta', title: 'Trò chơi chính tả', templateKey: 'quiz',
    summary: 'Chọn cách viết đúng chính tả.',
    category: 'chinh-ta', level: 'lop-2', difficulty: 'medium', accessLevel: 'FREE', sortOrder: 5, revision: 2, published: true,
    data: {
      instructions: 'Chọn từ viết đúng chính tả.',
      mode: 'solo',
      questions: [
        { id: 'q1', prompt: 'Chọn từ viết đúng.', choices: ['chăm chỉ', 'trăm chỉ', 'châm chỉ'], answer: 'chăm chỉ' },
        { id: 'q2', prompt: 'Chọn từ viết đúng.', choices: ['sinh nhật', 'xinh nhật', 'sinh nhậc'], answer: 'sinh nhật' },
        { id: 'q3', prompt: 'Chọn từ viết đúng.', choices: ['trường học', 'chường học', 'trườn học'], answer: 'trường học' },
        { id: 'q4', prompt: 'Chọn từ viết đúng.', choices: ['con sâu', 'con xâu'], answer: 'con sâu' },
        { id: 'q5', prompt: 'Chọn từ viết đúng.', choices: ['nấu cơm', 'lấu cơm'], answer: 'nấu cơm' },
        { id: 'q6', prompt: 'Chọn từ viết đúng.', choices: ['giữ gìn', 'dữ gìn', 'giữ dìn'], answer: 'giữ gìn' },
      ],
    },
  },
  {
    product: 'vietnamese', slug: 'do-vui-tieng-viet', title: 'Đố vui tiếng Việt', templateKey: 'quiz',
    summary: 'Ôn từ chỉ sự vật, hoạt động, từ trái nghĩa và kiểu câu.',
    category: 'do-vui', level: 'lop-3', difficulty: 'medium', accessLevel: 'FREE', sortOrder: 6, revision: 2, published: true,
    data: {
      instructions: 'Đọc câu hỏi và chọn đáp án đúng.',
      mode: 'solo',
      questions: [
        { id: 'q1', prompt: 'Từ nào dưới đây là từ chỉ hoạt động?', choices: ['chạy', 'xanh', 'cái bàn'], answer: 'chạy' },
        { id: 'q2', prompt: 'Từ trái nghĩa với “cao” là gì?', choices: ['dài', 'thấp', 'rộng'], answer: 'thấp' },
        { id: 'q3', prompt: 'Câu nào là câu hỏi?', choices: ['Bạn tên là gì?', 'Hôm nay trời đẹp.', 'Ôi, đẹp quá!'], answer: 'Bạn tên là gì?' },
        { id: 'q4', prompt: 'Từ nào chỉ sự vật?', choices: ['cái bàn', 'nhảy dây', 'xanh biếc'], answer: 'cái bàn' },
        { id: 'q5', prompt: 'Từ nào cùng nghĩa với “siêng năng”?', choices: ['chăm chỉ', 'lười biếng', 'vui vẻ'], answer: 'chăm chỉ' },
        { id: 'q6', prompt: 'Câu “Mẹ em là giáo viên.” là kiểu câu gì?', choices: ['câu giới thiệu', 'câu hỏi', 'câu cảm'], answer: 'câu giới thiệu' },
      ],
    },
  },
];
