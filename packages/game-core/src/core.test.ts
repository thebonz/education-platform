import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callOrder, completedLines, createRng, foldForSearch, generateBoard, graphemes, hashSeed, isBingo, normalizeAnswer, rankTeams, shuffle, starsFor, validateGameData } from './index';

test('RNG có seed cho kết quả lặp lại được', () => {
  const a = createRng('lop-3a');
  const b = createRng('lop-3a');
  const seqA = Array.from({ length: 5 }, a);
  assert.deepEqual(seqA, Array.from({ length: 5 }, b));
  assert.notDeepEqual(seqA, Array.from({ length: 5 }, createRng('lop-3b')));
  assert.ok(seqA.every((x) => x >= 0 && x < 1));
  assert.equal(hashSeed('abc'), hashSeed('abc'));
});

test('shuffle là hoán vị, không sửa mảng gốc', () => {
  const src = Array.from({ length: 30 }, (_, i) => i);
  const out = shuffle(src, createRng(1));
  assert.deepEqual([...out].sort((x, y) => x - y), src);
  assert.notDeepEqual(out, src);
  assert.deepEqual(src, Array.from({ length: 30 }, (_, i) => i));
});

test('chuẩn hóa đáp án: NFC, khoảng trắng, hoa thường; KHÔNG bỏ dấu', () => {
  assert.equal(normalizeAnswer('  Mèo  ĐEN '.normalize('NFD')), 'mèo đen');
  assert.notEqual(normalizeAnswer('ma'), normalizeAnswer('mà'));
  assert.equal(normalizeAnswer('Apple', { caseSensitive: true }), 'Apple');
  assert.equal(foldForSearch('Chính tả Đố vui'), 'chinh ta do vui');
});

test('tách grapheme giữ nguyên chữ có dấu', () => {
  assert.deepEqual(graphemes('nghiêng'.normalize('NFD')), ['n', 'g', 'h', 'i', 'ê', 'n', 'g']);
  assert.deepEqual(graphemes('APPLE'), ['A', 'P', 'P', 'L', 'E']);
});

test('bingo: bảng, thứ tự gọi, hàng/cột/chéo', () => {
  const ids = Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i));
  const board = generateBoard(ids, 4, createRng(7));
  assert.equal(board.cells.length, 16);
  assert.equal(new Set(board.cells).size, 16);
  assert.deepEqual([...callOrder(board, createRng(7))].sort(), [...board.cells].sort());
  assert.throws(() => generateBoard(ids.slice(0, 8), 3, createRng(1)));

  assert.equal(isBingo(board, new Set([0, 1, 2]), 'line'), false);
  assert.equal(isBingo(board, new Set([0, 1, 2, 3]), 'line'), true);       // hàng
  assert.equal(isBingo(board, new Set([1, 5, 9, 13]), 'line'), true);      // cột
  assert.equal(isBingo(board, new Set([0, 5, 10, 15]), 'line'), true);     // chéo chính
  assert.equal(isBingo(board, new Set([3, 6, 9, 12]), 'line'), true);      // chéo phụ
  assert.equal(completedLines(board, new Set([0, 1, 2, 3, 4, 8, 12])).length, 2);
  assert.equal(isBingo(board, new Set([0, 1, 2, 3]), 'full'), false);
  assert.equal(isBingo(board, new Set(board.cells.map((_, i) => i)), 'full'), true);
});

test('sao và xếp hạng đội', () => {
  assert.equal(starsFor(10, 10, 0), 3);
  assert.equal(starsFor(7, 10, 3), 2);
  assert.equal(starsFor(2, 10, 8), 1);
  assert.equal(starsFor(0, 0, 0), 1);
  assert.deepEqual(rankTeams([{ name: 'A', score: 3 }, { name: 'B', score: 5 }]), { winners: [{ name: 'B', score: 5 }], tie: false });
  assert.equal(rankTeams([{ name: 'A', score: 4 }, { name: 'B', score: 4 }]).tie, true);
});

test('validate: template lạ, đáp án ngoài lựa chọn, chuỗi NFD, điền mặc định', () => {
  assert.equal(validateGameData('khong-co', {}).ok, false);

  const quiz = {
    questions: [
      { id: 'q1', prompt: 'Pick', choices: ['a', 'b'], answer: 'c' },
      { id: 'q2', prompt: 'Pick', choices: ['a', 'b'], answer: 'a' },
      { id: 'q3', prompt: 'Pick', choices: ['a', 'b'], answer: 'b' },
    ],
  };
  const bad = validateGameData('quiz', quiz);
  assert.equal(bad.ok, false);
  assert.ok(!bad.ok && bad.issues.some((i) => i.path === 'questions.0.answer'));

  quiz.questions[0].answer = 'a';
  const good = validateGameData('quiz', quiz);
  assert.ok(good.ok);
  assert.equal(good.ok && good.data.mode, 'solo');
  assert.equal(good.ok && good.data.pointsPerCorrect, 1);

  const nfd = validateGameData('picture-match', {
    pairs: [
      { id: 'a', word: 'mèo'.normalize('NFD'), picture: { kind: 'emoji', value: '🐱' } },
      { id: 'b', word: 'cá', picture: { kind: 'emoji', value: '🐟' } },
      { id: 'c', word: 'gà', picture: { kind: 'emoji', value: '🐔' } },
    ],
  });
  assert.equal(nfd.ok, false);
});

test('validate bingo: đủ mục cho bảng, không trùng', () => {
  const items = Array.from({ length: 9 }, (_, i) => ({ id: `i${i}`, text: String.fromCharCode(65 + i) }));
  assert.equal(validateGameData('bingo', { boardSize: 4, items }).ok, false);
  assert.equal(validateGameData('bingo', { boardSize: 3, items }).ok, true);
  assert.equal(validateGameData('bingo', { boardSize: 3, items: [...items.slice(0, 8), { id: 'x', text: 'A' }] }).ok, false);
});

test('validate bubble-spelling: segments phải ghép ra đúng từ', () => {
  const base = (segments?: string[]) => ({ units: [{ id: 'u1', title: 'Unit 1', words: [{ id: 'w1', word: 'mèo', segments, picture: { kind: 'emoji', value: '🐱' } }] }] });
  assert.equal(validateGameData('bubble-spelling', base(['m', 'èo'])).ok, true);
  assert.equal(validateGameData('bubble-spelling', base(['m', 'eo'])).ok, false);
  assert.equal(validateGameData('bubble-spelling', base()).ok, true);
});
