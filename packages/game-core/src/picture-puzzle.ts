import { type Rng, shuffle } from './rng';

/** Pure puzzle helpers: every piece is a single position in a square picture. */
export function scrambledPuzzle(size: 2 | 3 | 4, rng: Rng): number[] {
  const length = size * size;
  const pieces = shuffle(Array.from({ length }, (_, index) => index), rng);
  if (pieces.every((piece, i) => piece === i)) {
    [pieces[0], pieces[1]] = [pieces[1], pieces[0]];
  }
  return pieces;
}

export function swapPuzzlePieces(pieces: readonly number[], a: number, b: number): number[] {
  if (![4, 9, 16].includes(pieces.length)
    || new Set(pieces).size !== pieces.length
    || pieces.some((n) => !Number.isInteger(n) || n < 0 || n >= pieces.length)
    || !Number.isInteger(a) || !Number.isInteger(b)
    || a < 0 || b < 0 || a >= pieces.length || b >= pieces.length) {
    throw new RangeError('Invalid puzzle swap');
  }
  const result = [...pieces];
  [result[a], result[b]] = [result[b], result[a]];
  return result;
}

export function isPuzzleSolved(pieces: readonly number[]): boolean {
  return pieces.length > 0 && pieces.every((piece, index) => piece === index);
}
