/** Mẫu câu nghe phục vụ GIÁO VIÊN kiểm duyệt, không cấp chứng nhận nội dung/giọng.
 *  Duyệt toàn bộ game vẫn cần chơi thử từng lượt, không thể suy ra từ 12 mẫu.
 */
const TTS_TEXT = /^[\p{L}\p{M}\p{N}\p{P}\p{Zs}]+$/u;
const SPOKEN = ['say', 'word', 'sentence', 'prompt', 'answer', 'text', 'pictureAnswer'] as const;

export function reviewVoiceSamples(data: unknown, limit = 12): string[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 40) throw new RangeError('invalid sample limit');
  const result: string[] = [];
  const seen = new Set<string>();
  let nodes = 0;

  function walk(value: unknown, depth: number): void {
    if (result.length >= limit || depth > 12 || ++nodes > 4000 || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item, depth + 1);
        if (result.length >= limit) break;
      }
      return;
    }
    const obj = value as Record<string, unknown>;
    for (const key of SPOKEN) {
      const text = obj[key];
      if (typeof text !== 'string') continue;
      const normalized = text.normalize('NFC').replace(/\s+/g, ' ').trim();
      if (normalized && normalized.length <= 300 && TTS_TEXT.test(normalized) && !seen.has(normalized)) {
        seen.add(normalized);
        result.push(normalized);
        if (result.length >= limit) return;
      }
    }
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        walk(value, depth + 1);
        if (result.length >= limit) return;
      }
    }
  }

  walk(data, 0);
  return result;
}
