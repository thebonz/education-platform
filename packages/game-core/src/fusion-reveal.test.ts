import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from './rng';
import { sessionSelection } from './learning-session';
import { starterContent } from './starters';
import { validateGameData } from './templates';

test('Fusion Reveal has a valid English teacher starter; no Vietnamese draft by accident', () => {
  const starter = starterContent('fusion-reveal', 'en');
  const result = validateGameData('fusion-reveal', starter);
  assert.equal(result.ok, true, JSON.stringify(!result.ok && result.issues));
  assert.equal(starterContent('fusion-reveal', 'vi'), null);
  if (result.ok) {
    assert.equal(result.data.stripeCount, 40);
    assert.equal(result.data.cardsPerRound, 3);
    assert.equal(result.data.items.length, 3);
    assert.ok(result.data.items.every((item) => item.picture.kind === 'image'));
  }
});

test('Fusion Reveal rejects unsafe or ill-defined pattern and answer banks', () => {
  const original = starterContent('fusion-reveal', 'en') as {
    stripeCount: number;
    cardsPerRound: number;
    items: { id: string; word: string; picture: unknown; choices: string[] }[];
  };
  assert.equal(validateGameData('fusion-reveal', { ...original, stripeCount: 35 }).ok, false);
  assert.equal(validateGameData('fusion-reveal', { ...original, stripeCount: 12 }).ok, false);
  assert.equal(validateGameData('fusion-reveal', { ...original, stripeCount: 62 }).ok, false);
  assert.equal(validateGameData('fusion-reveal', { ...original, cardsPerRound: 4 }).ok, false);

  const duplicate = structuredClone(original);
  duplicate.items[1].id = duplicate.items[0].id;
  assert.equal(validateGameData('fusion-reveal', duplicate).ok, false);

  const duplicateWord = structuredClone(original);
  duplicateWord.items[1].word = duplicateWord.items[0].word;
  assert.equal(validateGameData('fusion-reveal', duplicateWord).ok, false);

  const missingAnswer = structuredClone(original);
  missingAnswer.items[0].choices = ['dog', 'bird', 'fish'];
  assert.equal(validateGameData('fusion-reveal', missingAnswer).ok, false);

  const dangerousPicture = structuredClone(original);
  dangerousPicture.items[0].picture = { kind: 'image', src: 'javascript:alert(1)', alt: 'Unsafe picture' };
  assert.equal(validateGameData('fusion-reveal', dangerousPicture).ok, false);
});

test('Fusion Reveal replay presents new picture IDs from the same approved bank', () => {
  const original = starterContent('fusion-reveal', 'en') as {
    stripeCount: number;
    cardsPerRound: number;
    items: { id: string; word: string; picture: unknown; choices: string[] }[];
  };
  const items = Array.from({ length: 12 }, (_, i) => ({
    ...structuredClone(original.items[i % 3]), id: `fusion-${i}`, word: `word-${i}`,
    choices: [`word-${i}`, `wrong-${i}`, `other-${i}`],
  }));
  const result = validateGameData('fusion-reveal', { ...original, items });
  assert.equal(result.ok, true);
  const first = sessionSelection(items, 3, 1, createRng('fusion'));
  const second = sessionSelection(items, 3, 2, createRng('fusion'));
  assert.equal(first.length, 3);
  assert.ok(second.every((item) => !first.some((prev) => prev.id === item.id)));
});
