import { Rng, shuffle } from './rng';

export type BingoBoard = { size: number; cells: string[] };

/** Chọn size×size mục từ danh sách và xếp ngẫu nhiên lên bảng. */
export function generateBoard(itemIds: readonly string[], size: number, rng: Rng): BingoBoard {
  const need = size * size;
  if (itemIds.length < need) throw new Error(`Cần ít nhất ${need} mục cho bảng ${size}×${size}`);
  return { size, cells: shuffle(itemIds, rng).slice(0, need) };
}

/** Thứ tự gọi: chỉ gọi các mục có trên bảng, theo thứ tự ngẫu nhiên. */
export function callOrder(board: BingoBoard, rng: Rng): string[] {
  return shuffle(board.cells, rng);
}

export function winningLines(size: number): number[][] {
  const lines: number[][] = [];
  for (let r = 0; r < size; r++) lines.push(Array.from({ length: size }, (_, c) => r * size + c));
  for (let c = 0; c < size; c++) lines.push(Array.from({ length: size }, (_, r) => r * size + c));
  lines.push(Array.from({ length: size }, (_, i) => i * size + i));
  lines.push(Array.from({ length: size }, (_, i) => i * size + (size - 1 - i)));
  return lines;
}

/** Trả về các hàng/cột/đường chéo đã hoàn thành (theo chỉ số ô). */
export function completedLines(board: BingoBoard, marked: ReadonlySet<number>): number[][] {
  return winningLines(board.size).filter((line) => line.every((i) => marked.has(i)));
}

export function isBingo(board: BingoBoard, marked: ReadonlySet<number>, win: 'line' | 'full'): boolean {
  return win === 'full' ? marked.size === board.cells.length : completedLines(board, marked).length > 0;
}
