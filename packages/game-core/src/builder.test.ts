import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeTemplate, emptyValue, type FieldNode } from './describe';
import { starterContent } from './starters';
import { TEMPLATE_KEYS, TEMPLATES, validateGameData } from './templates';

test('mỗi template có nội dung mẫu hợp lệ cho mọi ngôn ngữ nó hỗ trợ', () => {
  for (const key of TEMPLATE_KEYS) {
    for (const locale of ['en', 'vi'] as const) {
      const starter = starterContent(key, locale);
      if (!(TEMPLATES[key].languages as readonly string[]).includes(locale)) {
        assert.equal(starter, null, `${key}/${locale} không dùng`);
        continue;
      }
      assert.ok(starter, `${key}/${locale} thiếu mẫu`);
      const r = validateGameData(key, starter);
      assert.ok(r.ok, `${key}/${locale}: ${JSON.stringify(!r.ok && r.issues)}`);
    }
  }
  // Bản sao độc lập: sửa không ảnh hưởng lần sau
  const a = starterContent('quiz', 'vi') as { questions: unknown[] };
  a.questions.length = 0;
  assert.equal((starterContent('quiz', 'vi') as { questions: unknown[] }).questions.length, 3);
});

test('mô tả schema đủ để dựng form cho mọi template', () => {
  const walk = (n: FieldNode, path: string): void => {
    assert.notEqual(n.type, 'unknown', `Không mô tả được: ${path}`);
    if (n.type === 'array') walk(n.item, `${path}[]`);
    if (n.type === 'object') n.fields.forEach((f) => walk(f.node, `${path}.${f.key}`));
    if (n.type === 'variant') Object.entries(n.options).forEach(([k, fs]) => fs.forEach((f) => walk(f.node, `${path}<${k}>.${f.key}`)));
  };
  for (const key of TEMPLATE_KEYS) walk(describeTemplate(key), key);

  const bingo = describeTemplate('bingo');
  assert.equal(bingo.type, 'object');
  if (bingo.type !== 'object') return;
  const byKey = Object.fromEntries(bingo.fields.map((f) => [f.key, f]));
  assert.deepEqual(byKey.boardSize.node, { type: 'choice', options: [3, 4, 5] });
  assert.equal(byKey.boardSize.default, 4);
  assert.equal(byKey.instructions.optional, true);
  assert.deepEqual(byKey.instructions.node, { type: 'string', min: 1, max: 300 });
  assert.equal(byKey.items.node.type, 'array');
  if (byKey.items.node.type === 'array') assert.equal(byKey.items.node.min, 9);

  const pm = describeTemplate('picture-match');
  if (pm.type !== 'object') throw new Error('object');
  const pairs = pm.fields.find((f) => f.key === 'pairs')!.node;
  if (pairs.type !== 'array' || pairs.item.type !== 'object') throw new Error('pairs');
  const picture = pairs.item.fields.find((f) => f.key === 'picture')!.node;
  assert.equal(picture.type, 'variant');
  if (picture.type === 'variant') {
    assert.deepEqual(Object.keys(picture.options), ['emoji', 'image']);
    assert.deepEqual(emptyValue(picture), { kind: 'emoji', value: '' });
  }
  assert.deepEqual(emptyValue(pairs.item), { id: '', word: '', picture: { kind: 'emoji', value: '' } });
});
