import { test } from 'node:test';
import assert from 'node:assert/strict';
import { composeSyllable, equalVietnamese, northernOnsetName, ONSETS, parseSyllable, spellingIssues, spellOut, stripTone, toneOf } from './syllable';

test('tách tiếng thành âm đầu + vần + thanh', () => {
  const cases: [string, string, string, string][] = [
    ['ba', 'b', 'a', 'ngang'],
    ['bà', 'b', 'a', 'huyen'],
    ['nghiêng', 'ngh', 'iêng', 'ngang'],
    ['người', 'ng', 'ươi', 'huyen'],
    ['quả', 'qu', 'a', 'hoi'],
    ['gì', 'gi', 'i', 'huyen'],
    ['gìn', 'gi', 'in', 'huyen'],
    ['giếng', 'gi', 'iêng', 'sac'],
    ['gió', 'gi', 'o', 'sac'],
    ['gà', 'g', 'a', 'huyen'],
    ['ếch', '', 'êch', 'sac'],
    ['yêu', '', 'yêu', 'ngang'],
    ['thuỷ', 'th', 'uy', 'hoi'],
    ['thủy', 'th', 'uy', 'hoi'],
    ['Đường', 'đ', 'ương', 'huyen'],
    ['khuỷu', 'kh', 'uyu', 'hoi'],
    ['học', 'h', 'oc', 'nang'],
  ];
  for (const [word, onset, rhyme, tone] of cases) {
    assert.deepEqual(parseSyllable(word), { onset, rhyme, tone }, word);
  }
  for (const bad of ['', 'hai con', 'brr', 'xyz1', 'qu', 'ngh']) assert.equal(parseSyllable(bad), null, bad);
});

test('ghép tiếng đặt dấu đúng vị trí (kiểu mới)', () => {
  const cases: [string, string, Parameters<typeof composeSyllable>[2], string][] = [
    ['ng', 'ươi', 'huyen', 'người'],
    ['m', 'ua', 'sac', 'múa'],
    ['m', 'ia', 'sac', 'mía'],
    ['c', 'ưa', 'hoi', 'cửa'],
    ['th', 'uy', 'hoi', 'thuỷ'],
    ['t', 'iêng', 'sac', 'tiếng'],
    ['kh', 'oe', 'hoi', 'khoẻ'],
    ['h', 'oa', 'huyen', 'hoà'],
    ['ng', 'oai', 'sac', 'ngoái'],
    ['t', 'oan', 'sac', 'toán'],
    ['qu', 'a', 'hoi', 'quả'],
    ['gi', 'i', 'huyen', 'gì'],
    ['gi', 'in', 'huyen', 'gìn'],
    ['gi', 'iêng', 'sac', 'giếng'],
    ['gi', 'o', 'sac', 'gió'],
    ['', 'êch', 'sac', 'ếch'],
    ['h', 'oc', 'nang', 'học'],
    ['kh', 'uyu', 'hoi', 'khuỷu'],
    ['m', 'ây', 'ngang', 'mây'],
    ['m', 'ay', 'sac', 'máy'],
    ['r', 'ươu', 'nang', 'rượu'],
    ['h', 'oăc', 'nang', 'hoặc'],
  ];
  for (const [onset, rhyme, tone, word] of cases) {
    assert.equal(composeSyllable(onset, rhyme, tone), word.normalize('NFC'), word);
    const parsed = parseSyllable(word);
    assert.ok(parsed, word);
    assert.equal(composeSyllable(parsed.onset, parsed.rhyme, parsed.tone), word.normalize('NFC'), `khứ hồi ${word}`);
  }
});

test('bỏ thanh và nhận thanh', () => {
  assert.equal(stripTone('Tiếng Việt'), 'Tiêng Viêt');
  assert.equal(stripTone('đường'), 'đương');
  assert.equal(toneOf('ngã'), 'nga');
  assert.equal(toneOf('nặng'), 'nang');
  assert.equal(toneOf('ba'), 'ngang');
  // chuỗi NFD (gõ trên một số máy) cũng nhận đúng
  assert.equal(toneOf('bà'.normalize('NFD')), 'huyen');
});

test('so sánh tiếng Việt: phân biệt dấu, không phân biệt kiểu đặt dấu', () => {
  assert.ok(equalVietnamese('hoà bình', 'hòa bình'));
  assert.ok(equalVietnamese('Thuỷ', 'thủy'));
  assert.ok(equalVietnamese('khoẻ'.normalize('NFD'), 'khỏe'));
  assert.ok(!equalVietnamese('ba', 'bà'));
  assert.ok(!equalVietnamese('hoà', 'hoá'));
  assert.ok(!equalVietnamese('mẹ', 'mẹ ơi'));
});

test('quy tắc chính tả c/k, g/gh, ng/ngh', () => {
  for (const ok of ['kẻ', 'kim', 'ghế', 'ghi', 'nghỉ', 'nghe', 'cá', 'gà', 'ngô', 'giếng', 'quả']) {
    assert.deepEqual(spellingIssues(ok), [], ok);
  }
  assert.equal(spellingIssues('cẻ')[0]?.rule, 'c-k');
  assert.equal(spellingIssues('ká')[0]?.rule, 'c-k');
  assert.equal(spellingIssues('gế')[0]?.rule, 'g-gh');
  assert.equal(spellingIssues('ghà')[0]?.rule, 'g-gh');
  assert.equal(spellingIssues('ngỉ')[0]?.rule, 'ng-ngh');
  assert.equal(spellingIssues('nghô')[0]?.rule, 'ng-ngh');
});

test('đánh vần', () => {
  assert.equal(spellOut('bà'), 'b – a – ba – huyền – bà');
  assert.equal(spellOut('ba'), 'b – a – ba');
  assert.equal(spellOut('ếch'), 'êch – sắc – ếch');
  assert.equal(spellOut('quả', (o) => (o === 'qu' ? 'quờ' : o)), 'quờ – a – qua – hỏi – quả');
  assert.equal(spellOut('bà', northernOnsetName), 'bờ – a – ba – huyền – bà');
  assert.equal(spellOut('giếng', northernOnsetName), 'di – iêng – giêng – sắc – giếng');
  for (const o of ONSETS) assert.notEqual(northernOnsetName(o), undefined, o);
});
