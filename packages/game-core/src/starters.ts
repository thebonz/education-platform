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
