import type { Rng } from './rng';
import { shuffle } from './rng';

/**
 * Học liệu nhiều từ hơn số câu mỗi lượt: mỗi lần chơi tiếp theo lấy một nhóm kế
 * tiếp trong cùng ngân hàng, không lặp lại ngay nhóm trước khi còn đủ từ.
 * Trộn vị trí để trẻ không học thuộc thứ tự trên màn hình.
 */
export function sessionSelection<T>(items: readonly T[], requested: number, round: number, rng: Rng): T[] {
  if (!Number.isInteger(requested) || requested < 1 || !Number.isInteger(round) || round < 1
    || items.length < 1 || items.length > 200) throw new RangeError('invalid learning session');
  const length = Math.min(requested, items.length);
  const start = ((round - 1) * length) % items.length;
  const selected = Array.from({ length }, (_, i) => items[(start + i) % items.length]);
  return shuffle(selected, rng);
}
