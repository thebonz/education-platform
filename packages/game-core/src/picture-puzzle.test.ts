import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from './rng';
import { scrambledPuzzle, swapPuzzlePieces, isPuzzleSolved } from './picture-puzzle';
import { starterContent } from './starters';
import { validateGameData } from './templates';

test('picture puzzle EN/VI starters are valid, NFC-safe and bounded', () => {
  for (const locale of ['en', 'vi'] as const) {
    const parsed = validateGameData('picture-puzzle', starterContent('picture-puzzle', locale));
    assert.equal(parsed.ok, true, locale);
    if (parsed.ok) {
      assert.equal(parsed.data.size, 3);
      assert.equal(parsed.data.rounds.length, 2);
    }
  }
});

test('picture puzzle rejects duplicate rounds, invalid pictures and sizes', () => {
  const original = starterContent('picture-puzzle', 'en') as {
    size: number;
    rounds: { id: string; picture: unknown; label: string }[];
  };
  const dupe = structuredClone(original);
  dupe.rounds[1].id = dupe.rounds[0].id;
  assert.equal(validateGameData('picture-puzzle', dupe).ok, false);
  const broken = structuredClone(original);
  broken.rounds[0].picture = { kind: 'image', src: 'javascript:alert(1)', alt: 'bad' };
  assert.equal(validateGameData('picture-puzzle', broken).ok, false);
  const wrongSize = structuredClone(original);
  wrongSize.size = 5;
  assert.equal(validateGameData('picture-puzzle', wrongSize).ok, false);
});

test('every generated puzzle is solvable, deterministic and never initially complete', () => {
  for (const size of [2, 3, 4] as const) {
    const rngA = createRng(`size-${size}`);
    const rngB = createRng(`size-${size}`);
    const pieces = scrambledPuzzle(size, rngA);
    assert.deepEqual(pieces, scrambledPuzzle(size, rngB));
    assert.equal(pieces.length, size * size);
    assert.equal(isPuzzleSolved(pieces), false);
    assert.deepEqual([...pieces].sort((a, b) => a - b), Array.from({ length: size * size }, (_, i) => i));
    let rearranged = [...pieces];
    for (let i = 0; i < rearranged.length; i++) {
      if (rearranged[i] !== i) rearranged = swapPuzzlePieces(rearranged, i, rearranged.indexOf(i));
    }
    assert.equal(isPuzzleSolved(rearranged), true);
    assert.equal(isPuzzleSolved(pieces), false);
  }
});

test('invalid puzzle swaps fail safely', () => {
  assert.throws(() => swapPuzzlePieces([0, 1, 2, 3], -1, 2), RangeError);
  assert.throws(() => swapPuzzlePieces([0, 1, 2, 3], 0, 4), RangeError);
  assert.throws(() => swapPuzzlePieces([0, 1, 2, 2], 0, 1), RangeError);
  assert.throws(() => swapPuzzlePieces([], 0, 0), RangeError);
});
