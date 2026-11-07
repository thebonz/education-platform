/**
 * Xử lý âm tiết (tiếng) tiếng Việt: tách âm đầu + vần + thanh, ghép lại, kiểm tra quy tắc chính tả.
 *
 * Quy ước sư phạm (theo cách dạy ở tiểu học):
 *  - "gi" và "qu" là âm đầu: "gà" = g + a, "gió" = gi + o, "quả" = qu + a.
 *    Khi sau "gi" không còn nguyên âm ("gì", "gìn") thì chữ i dùng chung: gì = gi + i, gìn = gi + in.
 *  - Vần không mang dấu thanh: "người" = ng + ươi + thanh huyền.
 *  - Dấu thanh đặt theo quy tắc mới (dấu trên âm chính): hoà, khoẻ, thuỷ, múa, tiếng, người.
 *    So sánh đáp án không phân biệt kiểu đặt dấu cũ/mới ("hòa" = "hoà").
 */

export const TONES = ['ngang', 'sac', 'huyen', 'hoi', 'nga', 'nang'] as const;
export type Tone = (typeof TONES)[number];

export const TONE_NAMES: Record<Tone, string> = {
  ngang: 'thanh ngang', sac: 'thanh sắc', huyen: 'thanh huyền', hoi: 'thanh hỏi', nga: 'thanh ngã', nang: 'thanh nặng',
};
/** Tên dấu (không có dấu với thanh ngang). */
export const TONE_MARK_NAMES: Record<Tone, string> = {
  ngang: 'không dấu', sac: 'dấu sắc', huyen: 'dấu huyền', hoi: 'dấu hỏi', nga: 'dấu ngã', nang: 'dấu nặng',
};
/** Ký hiệu hiển thị trên nút chọn thanh. */
export const TONE_SYMBOLS: Record<Tone, string> = {
  ngang: '\u25CC', sac: '\u25CC\u0301', huyen: '\u25CC\u0300', hoi: '\u25CC\u0309', nga: '\u25CC\u0303', nang: '\u25CC\u0323',
};

const COMBINING: Record<Exclude<Tone, 'ngang'>, string> = {
  sac: '́', huyen: '̀', hoi: '̉', nga: '̃', nang: '̣',
};
const TONE_BY_MARK = new Map<string, Tone>(Object.entries(COMBINING).map(([t, m]) => [m, t as Tone]));

/** Âm đầu viết bằng chữ, xếp dài trước để so khớp dài nhất. */
export const ONSETS = ['ngh', 'ng', 'nh', 'ch', 'gh', 'gi', 'kh', 'ph', 'th', 'tr', 'qu', 'b', 'c', 'd', 'đ', 'g', 'h', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'x'] as const;
const CODAS = ['ch', 'ng', 'nh', 'c', 'm', 'n', 'p', 't'];
const VOWELS = new Set(['a', 'ă', 'â', 'e', 'ê', 'i', 'o', 'ô', 'ơ', 'u', 'ư', 'y']);
const MARKED_VOWELS = new Set(['ă', 'â', 'ê', 'ô', 'ơ', 'ư']);

export type Syllable = { onset: string; rhyme: string; tone: Tone };

/** Bỏ dấu thanh, giữ dấu mũ/dấu râu/dấu trăng và chữ đ. */
export function stripTone(value: string): string {
  return value.normalize('NFD').replace(/[̣̀́̃̉]/g, '').normalize('NFC');
}

export function toneOf(syllable: string): Tone {
  for (const ch of syllable.normalize('NFD')) {
    const t = TONE_BY_MARK.get(ch);
    if (t) return t;
  }
  return 'ngang';
}

const isVowel = (ch: string | undefined) => !!ch && VOWELS.has(ch);

/** Tách một tiếng. Trả về null nếu không phải một tiếng tiếng Việt hợp lệ về cấu trúc. */
export function parseSyllable(input: string): Syllable | null {
  const word = input.normalize('NFC').trim().toLocaleLowerCase('vi');
  if (!word || /\s/.test(word)) return null;
  const tone = toneOf(word);
  const base = stripTone(word);
  if (!/^[a-zăâđêôơư]+$/.test(base)) return null;

  let onset = '';
  for (const o of ONSETS) {
    if (base.startsWith(o)) { onset = o; break; }
  }
  let rhyme = base.slice(onset.length);
  // gì, gìn, giếng: chữ i của "gi" dùng chung với vần (gi + i, gi + in, gi + iêng)
  if (onset === 'gi' && (!isVowel(rhyme[0]) || rhyme[0] === 'ê')) rhyme = `i${rhyme}`;
  if (onset === 'qu' && !rhyme) return null;
  if (!rhyme || !isVowel(rhyme[0])) return null;
  const vowelsPart = rhyme.replace(/(ch|ng|nh|c|m|n|p|t)$/, '');
  if (![...vowelsPart].every((ch) => VOWELS.has(ch))) return null;
  return { onset, rhyme, tone };
}

/** Vị trí (theo grapheme) của nguyên âm mang dấu thanh trong vần, theo quy tắc đặt dấu mới. */
export function toneCarrierIndex(rhyme: string): number {
  const chars = [...rhyme.normalize('NFC')];
  const vowelIdx = chars.map((c, i) => (VOWELS.has(c) ? i : -1)).filter((i) => i >= 0);
  if (!vowelIdx.length) return -1;
  const marked = vowelIdx.filter((i) => MARKED_VOWELS.has(chars[i]));
  if (marked.length) return marked[marked.length - 1];
  const hasCoda = CODAS.some((c) => rhyme.endsWith(c)) && !VOWELS.has(chars[chars.length - 1]);
  if (hasCoda) return vowelIdx[vowelIdx.length - 1];
  if (vowelIdx.length === 1) return vowelIdx[0];
  const [a, b] = [chars[vowelIdx[0]], chars[vowelIdx[1]]];
  // âm đệm o/u đứng trước âm chính: oa, oe, oai, oay, uy → dấu ở âm chính
  if ((a === 'o' && (b === 'a' || b === 'e')) || (a === 'u' && b === 'y')) return vowelIdx[1];
  return vowelIdx[0]; // ia, ua, ai, ao, au, ay, oi, ui, iu, eo...
}

/** Ghép âm đầu + vần + thanh thành chữ viết (NFC). */
export function composeSyllable(onset: string, rhyme: string, tone: Tone): string {
  const r = stripTone(rhyme.normalize('NFC').toLocaleLowerCase('vi'));
  const o = onset.normalize('NFC').toLocaleLowerCase('vi');
  // gi + i → gi, gi + in → gin, gi + iêng → giêng: chữ i viết một lần
  const shared = o === 'gi' && r.startsWith('i') && (!isVowel(r[1]) || r[1] === 'ê');
  const chars = [...r];
  if (tone !== 'ngang') {
    const idx = toneCarrierIndex(r);
    if (idx >= 0) chars[idx] = (chars[idx] + COMBINING[tone]).normalize('NFC');
  }
  const rhymeWritten = chars.join('');
  return (shared ? `g${rhymeWritten}` : `${o}${rhymeWritten}`).normalize('NFC');
}

/** So sánh hai tiếng/cụm từ tiếng Việt: phân biệt dấu, không phân biệt hoa thường và kiểu đặt dấu cũ/mới. */
export function equalVietnamese(a: string, b: string): boolean {
  const wa = a.normalize('NFC').trim().split(/\s+/);
  const wb = b.normalize('NFC').trim().split(/\s+/);
  if (wa.length !== wb.length) return false;
  return wa.every((x, i) => {
    const pa = parseSyllable(x);
    const pb = parseSyllable(wb[i]);
    if (pa && pb) return pa.onset === pb.onset && pa.rhyme === pb.rhyme && pa.tone === pb.tone;
    return x.toLocaleLowerCase('vi') === wb[i].toLocaleLowerCase('vi');
  });
}

export type SpellingIssue = { rule: 'c-k' | 'g-gh' | 'ng-ngh' | 'q-u'; message: string };

/** Kiểm tra quy tắc chính tả c/k, g/gh, ng/ngh cho một tiếng. */
export function spellingIssues(word: string): SpellingIssue[] {
  const p = parseSyllable(word);
  if (!p) return [];
  const front = /^[ieêy]/.test(p.rhyme);
  const issues: SpellingIssue[] = [];
  if (p.onset === 'c' && front) issues.push({ rule: 'c-k', message: 'Trước i, e, ê viết k, không viết c' });
  if (p.onset === 'k' && !front) issues.push({ rule: 'c-k', message: 'Chỉ viết k trước i, e, ê' });
  if (p.onset === 'g' && front) issues.push({ rule: 'g-gh', message: 'Trước i, e, ê viết gh, không viết g' });
  if (p.onset === 'gh' && !front) issues.push({ rule: 'g-gh', message: 'Chỉ viết gh trước i, e, ê' });
  if (p.onset === 'ng' && front) issues.push({ rule: 'ng-ngh', message: 'Trước i, e, ê viết ngh, không viết ng' });
  if (p.onset === 'ngh' && !front) issues.push({ rule: 'ng-ngh', message: 'Chỉ viết ngh trước i, e, ê' });
  return issues;
}

/**
 * Tên âm đầu khi đánh vần theo giọng Bắc (cách đọc thường dùng ở lớp 1):
 * c, k → "cờ" (k cũng gọi tên chữ là "ca"), gi → "di", ng/ngh → "ngờ", qu → "quờ".
 * Cần giáo viên duyệt lại cho từng bộ sách.
 */
export const NORTHERN_ONSET_NAMES: Record<string, string> = {
  b: 'bờ', c: 'cờ', k: 'ca', ch: 'chờ', d: 'dờ', đ: 'đờ', g: 'gờ', gh: 'gờ', gi: 'di', h: 'hờ', kh: 'khờ', l: 'lờ', m: 'mờ', n: 'nờ',
  ng: 'ngờ', ngh: 'ngờ', nh: 'nhờ', p: 'pờ', ph: 'phờ', qu: 'quờ', r: 'rờ', s: 'sờ', t: 'tờ', th: 'thờ', tr: 'trờ', v: 'vờ', x: 'xờ',
};
export const northernOnsetName = (onset: string) => NORTHERN_ONSET_NAMES[onset] ?? onset;

/** Hiển thị cách đánh vần một tiếng, ví dụ: "b – a – ba – huyền – bà". Cách đọc tên âm do hồ sơ đánh vần quyết định. */
export function spellOut(word: string, spellName: (onset: string) => string = (o) => o): string | null {
  const p = parseSyllable(word);
  if (!p) return null;
  const toneless = composeSyllable(p.onset, p.rhyme, 'ngang');
  const parts = p.onset ? [spellName(p.onset), p.rhyme, toneless] : [p.rhyme];
  if (p.tone !== 'ngang') parts.push(TONE_NAMES[p.tone].replace('thanh ', ''), composeSyllable(p.onset, p.rhyme, p.tone));
  return parts.join(' – ');
}
