/**
 * Logic một lượt chơi của các template tiếng Việt, tách khỏi giao diện để kiểm thử được.
 */
import { shuffle, type Rng } from '../rng';
import { answersEqual } from '../text';
import { stripEndPunctuation } from '../templates';
import { parseSyllable, type Syllable, type Tone } from './syllable';

/** Âm đầu và vần thường gặp ở lớp 1, dùng làm lựa chọn gây nhiễu khi nội dung không khai báo. */
export const COMMON_ONSETS = ['b', 'c', 'd', 'đ', 'g', 'h', 'k', 'l', 'm', 'n', 'nh', 'ng', 'ch', 'kh', 'ph', 'th', 'tr', 's', 'x', 'r', 'v', 't', 'qu', 'gi'];
export const COMMON_RHYMES = ['a', 'o', 'ô', 'ơ', 'e', 'ê', 'i', 'u', 'ư', 'ia', 'ua', 'ưa', 'ai', 'oi', 'ao', 'eo', 'an', 'am', 'at', 'ang', 'anh', 'ăn', 'ân', 'on', 'ông', 'ong', 'inh', 'ương', 'iêng', 'uôn', 'ach', 'oa', 'oe', 'uy'];

/** Đáp án + (count-1) lựa chọn gây nhiễu, lấy lần lượt theo từng tầng ưu tiên (mỗi tầng được xáo). */
function choicesFor(answer: string, tiers: string[][], count: number, rng: Rng): string[] {
  const ordered = tiers.flatMap((tier) => shuffle(tier, rng));
  const others = [...new Set(ordered)].filter((x) => x !== answer).slice(0, Math.max(1, count - 1));
  return shuffle([answer, ...others], rng);
}

export type SyllableRound = { target: Syllable; onsets: string[]; rhymes: string[] };

export function syllableRound(
  word: string,
  opts: { allWords: string[]; choices: number; onsets?: string[]; rhymes?: string[] },
  rng: Rng,
): SyllableRound {
  const target = parseSyllable(word);
  if (!target) throw new Error(`Không tách được tiếng: ${word}`);
  const parsed = opts.allWords.map(parseSyllable).filter((x): x is Syllable => !!x);
  // Thứ tự ưu tiên gây nhiễu: người soạn khai báo → âm/vần trong cùng bài → bộ chung.
  const onsets = choicesFor(target.onset, [opts.onsets ?? [], parsed.map((p) => p.onset), COMMON_ONSETS], opts.choices, rng);
  const rhymes = choicesFor(target.rhyme, [opts.rhymes ?? [], parsed.map((p) => p.rhyme), COMMON_RHYMES], opts.choices, rng);
  return { target, onsets, rhymes };
}

export function syllableCorrect(target: Syllable, pick: { onset: string; rhyme: string; tone: Tone }): boolean {
  return target.onset === pick.onset && target.rhyme === pick.rhyme && target.tone === pick.tone;
}

// ---------------------------------------------------------------------------
// Sắp xếp câu
// ---------------------------------------------------------------------------
export type SentenceLike = { sentence: string; chunks?: string[]; alternatives?: string[] };

export function sentenceChunks(item: SentenceLike): string[] {
  return item.chunks ?? stripEndPunctuation(item.sentence).split(' ');
}

/** Dấu câu cuối câu (hiển thị cố định), ví dụ "." hoặc "?". */
export function endPunctuation(sentence: string): string {
  return sentence.normalize('NFC').trim().match(/[.!?…]+$/u)?.[0] ?? '';
}

/** Xáo các mảnh, tránh trả về đúng thứ tự gốc khi có thể. */
export function scrambleChunks(chunks: string[], rng: Rng): string[] {
  if (new Set(chunks).size < 2) return [...chunks];
  for (let i = 0; i < 8; i++) {
    const out = shuffle(chunks, rng);
    if (out.join(' ') !== chunks.join(' ')) return out;
  }
  return [...chunks.slice(1), chunks[0]];
}

export function sentenceCorrect(item: SentenceLike, ordered: string[]): boolean {
  const attempt = ordered.join(' ');
  return [item.sentence, ...(item.alternatives ?? [])].some((s) => answersEqual(attempt, stripEndPunctuation(s)));
}
