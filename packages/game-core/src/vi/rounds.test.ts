import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../rng';
import { validateGameData } from '../templates';
import { endPunctuation, scrambleChunks, sentenceChunks, sentenceCorrect, syllableCorrect, syllableRound } from './rounds';

const emoji = (value: string) => ({ kind: 'emoji' as const, value });

test('lượt ghép tiếng: có đáp án, không trùng, đúng số lựa chọn', () => {
  const allWords = ['bà', 'cá', 'mẹ', 'ghế', 'nghé'];
  for (let seed = 0; seed < 30; seed++) {
    const round = syllableRound('ghế', { allWords, choices: 4 }, createRng(seed));
    assert.deepEqual(round.target, { onset: 'gh', rhyme: 'ê', tone: 'sac' });
    assert.equal(round.onsets.length, 4);
    assert.equal(round.rhymes.length, 4);
    assert.ok(round.onsets.includes('gh') && round.rhymes.includes('ê'));
    assert.equal(new Set(round.onsets).size, 4);
    assert.equal(new Set(round.rhymes).size, 4);
  }
  // gây nhiễu do người soạn khai báo luôn được ưu tiên
  const r = syllableRound('kẻ', { allWords: ['kẻ', 'cá', 'gà'], choices: 2, onsets: ['c'] }, createRng(1));
  assert.deepEqual([...r.onsets].sort(), ['c', 'k']);
  assert.ok(syllableCorrect(r.target, { onset: 'k', rhyme: 'e', tone: 'hoi' }));
  assert.ok(!syllableCorrect(r.target, { onset: 'c', rhyme: 'e', tone: 'hoi' }));
});

test('sắp xếp câu: tách mảnh, xáo trộn, chấm điểm', () => {
  const item = { sentence: 'Em yêu bà ngoại.', alternatives: ['Bà ngoại yêu em.'] };
  assert.deepEqual(sentenceChunks(item), ['Em', 'yêu', 'bà', 'ngoại']);
  assert.equal(endPunctuation(item.sentence), '.');
  assert.equal(endPunctuation('Bạn tên là gì?'), '?');
  for (let seed = 0; seed < 20; seed++) {
    const s = scrambleChunks(sentenceChunks(item), createRng(seed));
    assert.notEqual(s.join(' '), 'Em yêu bà ngoại');
    assert.deepEqual([...s].sort(), ['Em', 'yêu', 'bà', 'ngoại'].sort());
  }
  assert.ok(sentenceCorrect(item, ['Em', 'yêu', 'bà', 'ngoại']));
  assert.ok(sentenceCorrect(item, ['Bà', 'ngoại', 'yêu', 'em']));
  assert.ok(!sentenceCorrect(item, ['yêu', 'Em', 'bà', 'ngoại']));
  const chunked = { sentence: 'Đàn cò trắng / bay qua cánh đồng.', chunks: ['Đàn cò trắng', '/', 'bay qua cánh đồng'] };
  assert.deepEqual(sentenceChunks(chunked), ['Đàn cò trắng', '/', 'bay qua cánh đồng']);
});

test('schema ghép tiếng / tìm dấu thanh kiểm tra tiếng hợp lệ và chính tả', () => {
  const ok = validateGameData('syllable-builder', {
    items: [
      { id: 'ba', word: 'bà', picture: emoji('👵') },
      { id: 'ca', word: 'cá', picture: emoji('🐟') },
      { id: 'ghe', word: 'ghế', hint: 'đồ dùng để ngồi' },
    ],
    distractors: { onsets: ['g', 'c'], rhymes: ['ê', 'e'] },
  });
  assert.ok(ok.ok, JSON.stringify(!ok.ok && ok.issues));
  if (ok.ok) assert.equal(ok.data.choicesPerStep, 4);

  const bad = validateGameData('syllable-builder', {
    items: [
      { id: 'a', word: 'gế', picture: emoji('🪑') },
      { id: 'b', word: 'hai con', picture: emoji('🐟') },
      { id: 'c', word: 'cá' },
    ],
    distractors: { onsets: ['zz'], rhymes: ['á'] },
  });
  assert.ok(!bad.ok);
  if (!bad.ok) {
    const text = bad.issues.map((i) => `${i.path}: ${i.message}`).join('\n');
    assert.match(text, /gh/);
    assert.match(text, /Không tách được tiếng: hai con/);
    assert.match(text, /items\.2: Cần ít nhất một gợi ý/);
    assert.match(text, /Âm đầu không hợp lệ/);
    assert.match(text, /Vần không hợp lệ/);
  }

  assert.ok(validateGameData('tone-finder', {
    items: [{ id: 'a', word: 'mà', say: 'mà' }, { id: 'b', word: 'má', say: 'má' }, { id: 'c', word: 'mạ', say: 'mạ' }],
  }).ok);
});

test('schema xếp nhóm và sắp xếp câu', () => {
  const sort = {
    groups: [{ id: 'su-vat', label: 'Từ chỉ sự vật' }, { id: 'hoat-dong', label: 'Từ chỉ hoạt động' }],
    items: [
      { id: 'a', text: 'quyển vở', group: 'su-vat' }, { id: 'b', text: 'cái bàn', group: 'su-vat' },
      { id: 'c', text: 'chạy', group: 'hoat-dong' }, { id: 'd', text: 'đọc', group: 'hoat-dong' },
    ],
  };
  assert.ok(validateGameData('word-sort', sort).ok);
  const badSort = validateGameData('word-sort', { ...sort, items: sort.items.map((x) => ({ ...x, group: x.group === 'su-vat' ? 'khac' : x.group })) });
  assert.ok(!badSort.ok);
  if (!badSort.ok) assert.match(badSort.issues.map((i) => i.message).join('\n'), /Nhóm không tồn tại: khac[\s\S]*chưa có từ nào/);

  const sentences = {
    items: [
      { id: 'a', sentence: 'Em yêu bà ngoại.' },
      { id: 'b', sentence: 'Bạn tên là gì?' },
      { id: 'c', sentence: 'Mẹ đi chợ.', chunks: ['Mẹ', 'đi chợ'] },
    ],
  };
  assert.ok(validateGameData('sentence-order', sentences).ok);
  const badSentence = validateGameData('sentence-order', { items: [...sentences.items.slice(0, 2), { id: 'c', sentence: 'Mẹ đi chợ.', chunks: ['Mẹ', 'về'] }] });
  assert.ok(!badSentence.ok);
});
