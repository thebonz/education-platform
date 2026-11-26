/**
 * Nội dung mẫu nhỏ nhất (hợp lệ) cho từng template, dùng khi tạo game mới trong Game Builder.
 * Người soạn sửa tiếp từ đây; mẫu chỉ để có điểm bắt đầu chơi thử được ngay.
 */
import type { TemplateKey } from './templates';

type Locale = 'en' | 'vi';
const e = (value: string) => ({ kind: 'emoji' as const, value });

const STARTERS: Partial<Record<TemplateKey, Partial<Record<Locale, unknown>>>> = {
  bingo: {
    en: { instructions: 'Listen and tap the word you hear.', boardSize: 3, items: ['cat', 'dog', 'sun', 'pen', 'hat', 'bus', 'cup', 'map', 'egg'].map((t) => ({ id: t, text: t })) },
    vi: { instructions: 'Nghe đọc và chạm vào chữ em nghe được.', boardSize: 3, items: ['a', 'ă', 'â', 'b', 'c', 'd', 'đ', 'e', 'ê'].map((t, i) => ({ id: `c${i + 1}`, text: t })) },
  },
  'picture-puzzle': {
    en: {
      instructions: 'Tap two pieces to swap them. Match the picture, then hear its English name.',
      size: 3,
      rounds: [
        { id: 'cat', picture: e('🐱'), label: 'cat' },
        { id: 'sun', picture: e('☀️'), label: 'sun' },
      ],
    },
    vi: {
      instructions: 'Chạm hai mảnh để đổi vị trí, ghép thành hình và nghe từ đúng.',
      size: 3,
      rounds: [
        { id: 'meo', picture: e('🐱'), label: 'con mèo' },
        { id: 'hoa', picture: e('🌻'), label: 'bông hoa' },
      ],
    },
  },
  'fusion-reveal': {
    en: {
      instructions: 'Slide decoder B until both patterns align. Guess the hidden picture. Teachers can print sheets A and B at 145 mm.',
      stripeCount: 40, cardsPerRound: 3,
      items: [
        { id: 'cat', word: 'cat', picture: { kind: 'image', src: '/illustrations/puzzle-cat.svg', alt: 'Original HappyClass illustration of a cat' },
          choices: ['cat', 'dog', 'apple'] },
        { id: 'dog', word: 'dog', picture: { kind: 'image', src: '/illustrations/vocab/dog.svg', alt: 'Original HappyClass illustration of a dog' },
          choices: ['cat', 'dog', 'apple'] },
        { id: 'apple', word: 'apple', picture: { kind: 'image', src: '/illustrations/puzzle-apple.svg', alt: 'Original HappyClass illustration of an apple' },
          choices: ['cat', 'dog', 'apple'] },
      ],
    },
  },
  'phonics-family': {
    en: { instructions: 'Listen to a word, then choose the house with the same ending.',
      wordsPerRound: 6, families: [
        { id: 'at', ending: 'at', words: [
          { id: 'cat', word: 'cat', picture: e('🐱') }, { id: 'hat', word: 'hat', picture: e('🎩') },
          { id: 'mat', word: 'mat', picture: e('🟫') },
        ] },
        { id: 'og', ending: 'og', words: [
          { id: 'dog', word: 'dog', picture: e('🐶') }, { id: 'log', word: 'log', picture: e('🪵') },
          { id: 'fog', word: 'fog', picture: e('🌫️') },
        ] },
      ] },
  },
  'classroom-explore': {
    en: { instructions: 'Tap an object, listen and choose A, B or C.',
      wordsPerRound: 3,
      items: [
        { id: 'book', word: 'book', picture: e('📖'), choices: ['book', 'bag', 'pen'] },
        { id: 'pen', word: 'pen', picture: e('🖊️'), choices: ['book', 'pen', 'bag'] },
        { id: 'bag', word: 'bag', picture: e('🎒'), choices: ['pen', 'book', 'bag'] },
      ],
    },
  },
  'shadow-guess': {
    en: { instructions: 'Name the dark silhouette before it reveals the picture.',
      wordsPerRound: 3, maxMistakes: 3,
      items: [
        { id: 'cat', word: 'cat', picture: e('🐱'), silhouette: e('🐈'), choices: ['cat', 'dog', 'fish'] },
        { id: 'dog', word: 'dog', picture: e('🐶'), silhouette: e('🐕'), choices: ['dog', 'bird', 'cat'] },
        { id: 'fish', word: 'fish', picture: e('🐟'), silhouette: e('🐠'), choices: ['fish', 'dog', 'rabbit'] },
      ],
    },
  },
  'picture-match': {
    en: { pairs: [{ id: 'cat', word: 'cat', picture: e('🐱') }, { id: 'dog', word: 'dog', picture: e('🐶') }, { id: 'fish', word: 'fish', picture: e('🐟') }] },
    vi: { pairs: [{ id: 'meo', word: 'con mèo', picture: e('🐱') }, { id: 'cho', word: 'con chó', picture: e('🐶') }, { id: 'ca', word: 'con cá', picture: e('🐟') }] },
  },
  quiz: {
    en: {
      questions: [
        { id: 'q1', prompt: 'Which one is a fruit?', choices: ['apple', 'chair', 'car'], answer: 'apple' },
        { id: 'q2', prompt: 'What colour is the sky on a sunny day?', choices: ['blue', 'green', 'black'], answer: 'blue' },
        { id: 'q3', prompt: 'How many legs does a cat have?', choices: ['two', 'four', 'six'], answer: 'four' },
      ],
    },
    vi: {
      questions: [
        { id: 'q1', prompt: 'Từ nào chỉ con vật?', choices: ['con mèo', 'cái bàn', 'quyển vở'], answer: 'con mèo' },
        { id: 'q2', prompt: 'Tiếng “bà” mang dấu thanh gì?', choices: ['dấu huyền', 'dấu sắc', 'dấu hỏi'], answer: 'dấu huyền' },
        { id: 'q3', prompt: 'Chữ nào đúng: “… ẻ vở”?', choices: ['k', 'c'], answer: 'k' },
      ],
    },
  },
  'trail-board': {
    en: {
      instructions: 'Roll the dice, answer a question, and move your team along the star path when you get it right.',
      boardLength: 12, defaultTeams: 2, diceSides: 4,
      questions: [
        { id: 's1', prompt: 'Which one is a fruit?', choices: ['pear', 'chair', 'boat'], answer: 'pear' },
        { id: 's2', prompt: 'What colour is grass?', choices: ['green', 'purple', 'orange'], answer: 'green' },
        { id: 's3', prompt: 'What is the opposite of hot?', choices: ['cold', 'small', 'fast'], answer: 'cold' },
        { id: 's4', prompt: 'What animal says meow?', choices: ['cat', 'duck', 'frog'], answer: 'cat' },
      ],
    },
    vi: {
      instructions: 'Tung xúc xắc, trả lời câu hỏi. Trả lời đúng thì cả đội tiến lên theo số bước đã tung.',
      boardLength: 12, defaultTeams: 2, diceSides: 4,
      questions: [
        { id: 's1', prompt: 'Tiếng nào có dấu sắc?', choices: ['má', 'mà', 'ma'], answer: 'má' },
        { id: 's2', prompt: 'Tiếng nào có dấu huyền?', choices: ['cá', 'cà', 'ca'], answer: 'cà' },
        { id: 's3', prompt: 'Tiếng nào có dấu nặng?', choices: ['mạ', 'má', 'mả'], answer: 'mạ' },
        { id: 's4', prompt: 'Tiếng nào có dấu hỏi?', choices: ['ngã', 'ngả', 'nga'], answer: 'ngả' },
      ],
    },
  },
  'mystery-doors': {
    en: {
      instructions: 'Open one or more doors to see a picture. Look carefully, then choose the English word.',
      doorCount: 6,
      rounds: [
        { id: 'cat', picture: e('🐱'), question: 'Which animal is behind the doors?', choices: ['cat', 'dog', 'duck'], answer: 'cat' },
        { id: 'apple', picture: e('🍎'), question: 'What fruit can you see?', choices: ['orange', 'apple', 'pear'], answer: 'apple' },
        { id: 'bus', picture: e('🚌'), question: 'What vehicle is this?', choices: ['bus', 'bike', 'boat'], answer: 'bus' },
      ],
    },
    vi: {
      instructions: 'Mở từng cánh cửa để xem hình, sau đó chọn từ phù hợp với hình.',
      doorCount: 6,
      rounds: [
        { id: 'meo', picture: e('🐱'), question: 'Con vật nào sau cánh cửa?', choices: ['con mèo', 'con chó', 'con cá'], answer: 'con mèo' },
        { id: 'tao', picture: e('🍎'), question: 'Đây là loại quả gì?', choices: ['quả táo', 'quả cam', 'quả lê'], answer: 'quả táo' },
        { id: 'xe', picture: e('🚌'), question: 'Hình này chỉ phương tiện nào?', choices: ['xe buýt', 'xe đạp', 'thuyền'], answer: 'xe buýt' },
      ],
    },
  },
  'hidden-picture': {
    en: {
      picture: e('🦁'), pictureAnswer: 'lion', pictureChoices: ['lion', 'cat', 'dog'],
      questions: ['red', 'blue', 'green', 'yellow'].map((c, i) => ({ id: `q${i + 1}`, prompt: `Tap the word “${c}”.`, choices: [c, 'tree'], answer: c })),
    },
    vi: {
      picture: e('🐘'), pictureAnswer: 'con voi', pictureChoices: ['con voi', 'con gà', 'con cá'],
      questions: ['bà', 'bé', 'cá', 'cờ'].map((c, i) => ({ id: `q${i + 1}`, prompt: `Chạm vào tiếng “${c}”.`, choices: [c, 'mẹ'], answer: c })),
    },
  },
  'bubble-spelling': {
    en: { units: [{ id: 'u1', title: 'Animals', words: [{ id: 'cat', word: 'cat', picture: e('🐱') }] }] },
    vi: { units: [{ id: 'u1', title: 'Con vật', words: [{ id: 'meo', word: 'mèo', segments: ['m', 'èo'], picture: e('🐱') }] }] },
  },
  spelling: {
    en: { items: [{ id: 'cat', answer: 'cat', picture: e('🐱') }, { id: 'sun', answer: 'sun', picture: e('☀️') }, { id: 'egg', answer: 'egg', picture: e('🥚') }] },
    vi: { items: [{ id: 'ca', answer: 'cá', picture: e('🐟') }, { id: 'ga', answer: 'gà', picture: e('🐔') }, { id: 'me', answer: 'mẹ', picture: e('👩') }] },
  },
  'syllable-builder': {
    vi: { items: [{ id: 'ba', word: 'bà', picture: e('👵') }, { id: 'ca', word: 'cá', picture: e('🐟') }, { id: 'me', word: 'mẹ', picture: e('👩') }] },
  },
  'tone-finder': {
    vi: { items: [{ id: 'bo', word: 'bò', picture: e('🐄') }, { id: 'ca', word: 'cá', picture: e('🐟') }, { id: 'ho', word: 'hổ', picture: e('🐯') }] },
  },
  'word-sort': {
    en: {
      groups: [{ id: 'animals', label: 'Animals' }, { id: 'food', label: 'Food' }],
      items: [{ id: 'a1', text: 'cat', group: 'animals' }, { id: 'a2', text: 'dog', group: 'animals' }, { id: 'f1', text: 'bread', group: 'food' }, { id: 'f2', text: 'rice', group: 'food' }],
    },
    vi: {
      groups: [{ id: 'su-vat', label: 'Từ chỉ sự vật' }, { id: 'hoat-dong', label: 'Từ chỉ hoạt động' }],
      items: [{ id: 'a1', text: 'quyển vở', group: 'su-vat' }, { id: 'a2', text: 'con mèo', group: 'su-vat' }, { id: 'b1', text: 'chạy', group: 'hoat-dong' }, { id: 'b2', text: 'viết', group: 'hoat-dong' }],
    },
  },
  'sentence-order': {
    en: { items: [{ id: 's1', sentence: 'I like apples.' }, { id: 's2', sentence: 'The cat is sleeping.' }, { id: 's3', sentence: 'We go to school.' }] },
    vi: { items: [{ id: 's1', sentence: 'Bé đi học.' }, { id: 's2', sentence: 'Mẹ nấu cơm.' }, { id: 's3', sentence: 'Em tưới cây.' }] },
  },
};

/** Nội dung mẫu cho template theo ngôn ngữ sản phẩm; null nếu template không dùng cho ngôn ngữ đó. */
export function starterContent(templateKey: TemplateKey, locale: Locale): unknown | null {
  const s = STARTERS[templateKey]?.[locale];
  return s === undefined ? null : structuredClone(s);
}
