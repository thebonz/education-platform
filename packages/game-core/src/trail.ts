/**
 * Luật di chuyển gốc HappyClass cho game đường sao.
 * Chỉ đáp án đúng mới được tiến; không vượt đích và không làm đổi mảng đầu vào.
 * Tách khỏi React để kiểm thử giới hạn và công bằng giữa các đội.
 */
export function advanceTrail(
  positions: readonly number[],
  team: number,
  steps: number,
  finish: number,
  correct: boolean,
): number[] {
  if (!Number.isInteger(team) || team < 0 || team >= positions.length
    || !Number.isInteger(steps) || steps < 1 || steps > 6
    || !Number.isInteger(finish) || finish < 1 || finish > 24
    || positions.some((x) => !Number.isInteger(x) || x < 0 || x > finish)) {
    throw new RangeError('Invalid trail move');
  }
  return positions.map((value, index) =>
    index === team && correct ? Math.min(finish, value + steps) : value);
}
