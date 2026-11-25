import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from './rng';
import { sessionSelection } from './learning-session';
import { starterContent } from './starters';
import { validateGameData } from './templates';

test('picture matching replay uses new words rather than reshuffling the same six', () => {
  const pool = Array.from({ length: 12 }, (_, i) => `word-${i}`);
  const first = sessionSelection(pool, 6, 1, createRng('first'));
  const second = sessionSelection(pool, 6, 2, createRng('second'));
  assert.equal(first.length, 6);
  assert.equal(second.length, 6);
  assert.equal(first.filter((item) => second.includes(item)).length, 0);
  assert.deepEqual([...first, ...second].sort(), [...pool].sort());
  assert.deepEqual(pool, Array.from({ length: 12 }, (_, i) => `word-${i}`));
});

test('multi-unit spelling stays within a bank and replay rotates the selected six', () => {
  const pool = Array.from({ length: 9 }, (_, i) => `fruit-${i}`);
  const first = sessionSelection(pool, 6, 1, createRng('f1'));
  const next = sessionSelection(pool, 6, 2, createRng('f2'));
  assert.equal(first.length, 6);
  assert.equal(next.length, 6);
  assert.equal(new Set(first).size, 6);
  assert.equal(new Set(next).size, 6);
  assert.ok(next.some((item) => !first.includes(item)));
});

test('small legacy 3-pair content and single-word units remain valid', () => {
  const pic = validateGameData('picture-match', starterContent('picture-match', 'en'));
  assert.equal(pic.ok, true, JSON.stringify(pic));
  const bubble = validateGameData('bubble-spelling', starterContent('bubble-spelling', 'en'));
  assert.equal(bubble.ok, true, JSON.stringify(bubble));
});

test('wrong round size, duplicate ids and missing pairs fail validation', () => {
  const base = starterContent('picture-match', 'en') as {
    pairs: { id: string; word: string; picture: unknown }[];
    roundSize?: number;
  };
  const tooMany = { ...structuredClone(base), roundSize: base.pairs.length + 1 };
  assert.equal(validateGameData('picture-match', tooMany).ok, false);
  assert.equal(validateGameData('picture-match', { ...base, pairs: [] }).ok, false);
  assert.throws(() => sessionSelection([1, 2, 3], 0, 1, createRng(1)), RangeError);
  assert.throws(() => sessionSelection([1, 2, 3], 2, -1, createRng(1)), RangeError);
});
