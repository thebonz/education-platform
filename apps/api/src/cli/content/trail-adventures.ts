import type { GamePack } from './types';

/**
 * Nhiệm vụ gốc HappyClass: các đội cùng đi trên đường sao.
 * Game mới ẨN theo mặc định; giáo viên kiểm nội dung và giọng Việt trước khi phát hành.
 * Không sử dụng code, tên game, hình ảnh, nội dung câu hỏi từ nền tảng tham khảo.
 */
export const TRAIL_ADVENTURES: GamePack[] = [
  {
    product: 'english', slug: 'star-trail-adventure', title: 'Star Trail Adventure',
    summary: 'Roll the dice, answer simple English questions, and help your team reach the stars.',
    templateKey: 'trail-board', category: 'team-games', level: 'pre-a1',
    difficulty: 'easy', accessLevel: 'FREE', sortOrder: 7, revision: 1, published: false,
    data: {
      instructions: 'Take turns. Roll the dice, listen to the question and choose an answer. Correct answers move your team along the star path!',
      boardLength: 12, diceSides: 4, defaultTeams: 2,
      questions: [
        { id: 'e1', prompt: 'Which animal says meow?', choices: ['cat', 'duck', 'fish'], answer: 'cat', picture: { kind: 'emoji', value: '🐱' } },
        { id: 'e2', prompt: 'Which one is a fruit?', choices: ['banana', 'desk', 'sock'], answer: 'banana', picture: { kind: 'emoji', value: '🍌' } },
        { id: 'e3', prompt: 'What colour is a ripe tomato?', choices: ['red', 'purple', 'blue'], answer: 'red', picture: { kind: 'emoji', value: '🍅' } },
        { id: 'e4', prompt: 'Which animal can fly?', choices: ['bird', 'cow', 'dog'], answer: 'bird', picture: { kind: 'emoji', value: '🐦' } },
        { id: 'e5', prompt: 'What is the opposite of big?', choices: ['small', 'long', 'fast'], answer: 'small' },
        { id: 'e6', prompt: 'Which one can we read?', choices: ['book', 'shoe', 'spoon'], answer: 'book', picture: { kind: 'emoji', value: '📖' } },
        { id: 'e7', prompt: 'How many days are in a week?', choices: ['seven', 'five', 'three'], answer: 'seven' },
        { id: 'e8', prompt: 'What do you use to write?', choices: ['pencil', 'plate', 'hat'], answer: 'pencil', picture: { kind: 'emoji', value: '✏️' } },
        { id: 'e9', prompt: 'Which one is a body part?', choices: ['hand', 'house', 'tree'], answer: 'hand', picture: { kind: 'emoji', value: '✋' } },
        { id: 'e10', prompt: 'What animal lives in water?', choices: ['fish', 'rabbit', 'hen'], answer: 'fish', picture: { kind: 'emoji', value: '🐟' } },
      ],
    },
  },
  {
    product: 'vietnamese', slug: 'duong-sao-dau-thanh', title: 'Đường sao dấu thanh',
    summary: 'Tung xúc xắc, nghe câu hỏi và luyện phân biệt sáu thanh tiếng Việt theo lượt cùng bạn.',
    templateKey: 'trail-board', category: 'dau-thanh', level: 'lop-1',
    difficulty: 'easy', accessLevel: 'FREE', sortOrder: 26, revision: 1, published: false,
    data: {
      instructions: 'Hai đội thay phiên tung xúc xắc. Nghe và chọn tiếng đúng. Trả lời đúng, đội sẽ tiến trên đường sao!',
      boardLength: 12, diceSides: 4, defaultTeams: 2,
      questions: [
        { id: 'v1', prompt: 'Tiếng nào có dấu sắc?', choices: ['má', 'mà', 'ma'], answer: 'má' },
        { id: 'v2', prompt: 'Tiếng nào có dấu huyền?', choices: ['cà', 'cá', 'ca'], answer: 'cà' },
        { id: 'v3', prompt: 'Tiếng nào có dấu hỏi?', choices: ['mả', 'mã', 'mạ'], answer: 'mả' },
        { id: 'v4', prompt: 'Tiếng nào có dấu ngã?', choices: ['mã', 'mả', 'má'], answer: 'mã' },
        { id: 'v5', prompt: 'Tiếng nào có dấu nặng?', choices: ['mạ', 'mà', 'má'], answer: 'mạ' },
        { id: 'v6', prompt: 'Tiếng nào mang thanh ngang?', choices: ['ba', 'bà', 'bá'], answer: 'ba' },
        { id: 'v7', prompt: 'Tiếng nào chỉ đồ vật đội trên đầu?', choices: ['mũ', 'mủ', 'mù'], answer: 'mũ', picture: { kind: 'emoji', value: '🧢' } },
        { id: 'v8', prompt: 'Tiếng nào chỉ con vật có đôi tai dài?', choices: ['thỏ', 'thọ', 'thò'], answer: 'thỏ', picture: { kind: 'emoji', value: '🐰' } },
        { id: 'v9', prompt: 'Tiếng nào chỉ người sinh ra mẹ hoặc bố của em?', choices: ['bà', 'bá', 'ba'], answer: 'bà', picture: { kind: 'emoji', value: '👵' } },
        { id: 'v10', prompt: 'Tiếng nào chỉ con vật nuôi thường kêu meo meo?', choices: ['mèo', 'méo', 'mẹo'], answer: 'mèo', picture: { kind: 'emoji', value: '🐱' } },
      ],
    },
  },
];
