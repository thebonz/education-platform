/** Chuẩn hóa đáp án để so sánh: Unicode NFC, gộp khoảng trắng, (tùy chọn) không phân biệt hoa thường.
 *  KHÔNG bỏ dấu: với tiếng Việt, "ma" và "mà" là hai đáp án khác nhau. */
export function normalizeAnswer(value: string, options: { caseSensitive?: boolean } = {}): string {
  const s = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  return options.caseSensitive ? s : s.toLocaleLowerCase('vi');
}

export function answersEqual(a: string, b: string, options: { caseSensitive?: boolean } = {}): boolean {
  return normalizeAnswer(a, options) === normalizeAnswer(b, options);
}

/** Bỏ dấu để TÌM KIẾM (không dùng để chấm điểm): "Chính tả" → "chinh ta". */
export function foldForSearch(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

/** Tách thành ký tự hiển thị (grapheme), giữ nguyên chữ có dấu như "ệ" thành một ký tự. */
export function graphemes(value: string): string[] {
  const s = value.normalize('NFC');
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) return Array.from(new Seg('vi', { granularity: 'grapheme' }).segment(s), (x) => x.segment);
  return Array.from(s);
}

export function isNfc(value: string): boolean {
  return value === value.normalize('NFC');
}
