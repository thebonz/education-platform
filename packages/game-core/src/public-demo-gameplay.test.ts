import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starterContent } from './starters';
import { validateGameData } from './templates';

const keys = ['phonics-family', 'classroom-explore', 'shadow-guess'] as const;

test('all three independent English interaction starters pass schema validation', () => {
  for (const key of keys) {
    assert.equal(validateGameData(key, starterContent(key, 'en')).ok, true, key);
    assert.equal(starterContent(key, 'vi'), null);
  }
});

test('phonics rejects a word not belonging to its ending and duplicate words across families', () => {
  const content = structuredClone(starterContent('phonics-family', 'en')) as {
    families: { id: string; ending: string; words: { id: string; word: string; picture: unknown }[] }[];
  };
  content.families[0].words[0].word = 'ball';
  assert.equal(validateGameData('phonics-family', content).ok, false);
  const original = structuredClone(starterContent('phonics-family', 'en')) as typeof content;
  original.families[1].words[0] = { ...original.families[1].words[0], id: 'cat', word: 'cat' };
  assert.equal(validateGameData('phonics-family', original).ok, false);
});

test('classroom refuses choices that omit the answer or are repeated', () => {
  const start = structuredClone(starterContent('classroom-explore', 'en')) as {
    items: { word: string; choices: string[] }[]; wordsPerRound: number;
  };
  start.items[0].choices = ['cat', 'dog', 'fish'];
  assert.equal(validateGameData('classroom-explore', start).ok, false);
  start.items[0].choices = [start.items[0].word, 'cat', 'cat'];
  assert.equal(validateGameData('classroom-explore', start).ok, false);
});

test('silhouette game requires a separate shape and enforces lives/round bounds', () => {
  const start = structuredClone(starterContent('shadow-guess', 'en')) as {
    maxMistakes: number; wordsPerRound: number;
    items: { silhouette?: unknown; choices: string[]; word: string }[];
  };
  delete start.items[0].silhouette;
  assert.equal(validateGameData('shadow-guess', start).ok, false);
  start.items[0].silhouette = { kind: 'emoji', value: '🐈' };
  start.maxMistakes = 0;
  assert.equal(validateGameData('shadow-guess', start).ok, false);
  start.maxMistakes = 3; start.wordsPerRound = 9;
  assert.equal(validateGameData('shadow-guess', start).ok, false);
});
