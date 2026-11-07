import { z } from 'zod';
import { isNfc } from './text';

/**
 * Mỗi template = một kiểu chơi. Dữ liệu của một game được kiểm tra bằng schema của template đó
 * ở cả API (khi lưu/seed) và Web (khi chơi). Game Builder (giai đoạn 5) sẽ dựng form từ các schema này.
 */

const id = z.string().regex(/^[a-z0-9-]{1,40}$/, 'id chỉ gồm a-z, 0-9, dấu gạch ngang');
const text = (max: number) =>
  z.string().min(1).max(max).refine(isNfc, 'Chuỗi phải ở dạng Unicode NFC');
const optionalText = (max: number) => text(max).optional();

export const pictureSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('emoji'), value: z.string().min(1).max(16) }),
  z.object({ kind: z.literal('image'), src: z.string().max(500).regex(/^(https:\/\/|\/)/), alt: text(120) }),
]);
export type Picture = z.infer<typeof pictureSchema>;

function uniqueBy<T>(items: T[], key: (item: T) => string, ctx: z.RefinementCtx, path: string, label: string) {
  const seen = new Set<string>();
  items.forEach((item, i) => {
    const k = key(item);
    if (seen.has(k)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path, i], message: `${label} bị trùng: ${k}` });
    seen.add(k);
  });
}

// ---------------------------------------------------------------------------
// bingo
// ---------------------------------------------------------------------------
export const bingoSchema = z
  .object({
    instructions: optionalText(300),
    boardSize: z.union([z.literal(3), z.literal(4), z.literal(5)]).default(4),
    win: z.enum(['line', 'full']).default('line'),
    /** false: chỉ đọc to, không hiện chữ được gọi (luyện nghe). */
    showCallText: z.boolean().default(true),
    items: z.array(z.object({ id, text: text(40), say: optionalText(80) })).min(9).max(60),
  })
  .superRefine((d, ctx) => {
    if (d.items.length < d.boardSize * d.boardSize) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: `Cần ít nhất ${d.boardSize * d.boardSize} mục cho bảng ${d.boardSize}×${d.boardSize}` });
    }
    uniqueBy(d.items, (x) => x.id, ctx, 'items', 'id');
    uniqueBy(d.items, (x) => x.text, ctx, 'items', 'Chữ');
  });

// ---------------------------------------------------------------------------
// picture-match
// ---------------------------------------------------------------------------
export const pictureMatchSchema = z
  .object({
    instructions: optionalText(300),
    pairs: z.array(z.object({ id, word: text(40), picture: pictureSchema, say: optionalText(80) })).min(3).max(12),
    timeLimitSec: z.number().int().min(0).max(600).default(0),
  })
  .superRefine((d, ctx) => {
    uniqueBy(d.pairs, (x) => x.id, ctx, 'pairs', 'id');
    uniqueBy(d.pairs, (x) => x.word, ctx, 'pairs', 'Từ');
  });

// ---------------------------------------------------------------------------
// quiz (dùng cho Team Quiz và đố vui cá nhân)
// ---------------------------------------------------------------------------
const choiceQuestion = z
  .object({
    id,
    prompt: text(200),
    choices: z.array(text(80)).min(2).max(4),
    answer: text(80),
    say: optionalText(200),
    picture: pictureSchema.optional(),
  })
  .superRefine((q, ctx) => {
    if (!q.choices.includes(q.answer)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['answer'], message: 'Đáp án phải nằm trong các lựa chọn' });
    if (new Set(q.choices).size !== q.choices.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['choices'], message: 'Lựa chọn bị trùng' });
  });

export const quizSchema = z
  .object({
    instructions: optionalText(300),
    mode: z.enum(['solo', 'teams']).default('solo'),
    defaultTeams: z.number().int().min(2).max(4).default(2),
    timePerQuestionSec: z.number().int().min(0).max(120).default(0),
    pointsPerCorrect: z.number().int().min(1).max(10).default(1),
    shuffleChoices: z.boolean().default(true),
    questions: z.array(choiceQuestion).min(3).max(50),
  })
  .superRefine((d, ctx) => uniqueBy(d.questions, (x) => x.id, ctx, 'questions', 'id'));

// ---------------------------------------------------------------------------
// hidden-picture
// ---------------------------------------------------------------------------
export const hiddenPictureSchema = z
  .object({
    instructions: optionalText(300),
    picture: pictureSchema,
    pictureAnswer: text(60),
    pictureChoices: z.array(text(60)).min(2).max(4),
    questions: z.array(choiceQuestion).min(4).max(16),
  })
  .superRefine((d, ctx) => {
    if (!d.pictureChoices.includes(d.pictureAnswer)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pictureAnswer'], message: 'Đáp án bức tranh phải nằm trong lựa chọn' });
    uniqueBy(d.questions, (x) => x.id, ctx, 'questions', 'id');
  });

// ---------------------------------------------------------------------------
// bubble-spelling (Bubble Word Garden)
// ---------------------------------------------------------------------------
const bubbleWord = z
  .object({
    id,
    word: text(30),
    /** Tách sẵn thành các mảnh (ví dụ âm/vần tiếng Việt). Bỏ trống = tách theo từng chữ cái. */
    segments: z.array(text(10)).min(1).max(15).optional(),
    picture: pictureSchema,
    hint: optionalText(120),
    say: optionalText(80),
  })
  .superRefine((w, ctx) => {
    if (w.segments && w.segments.join('') !== w.word) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['segments'], message: 'Ghép các mảnh phải ra đúng từ' });
  });

export const bubbleSpellingSchema = z
  .object({
    instructions: optionalText(300),
    /** Số bong bóng gây nhiễu thêm vào mỗi từ. */
    extraBubbles: z.number().int().min(0).max(6).default(2),
    distractorPool: z.array(text(10)).min(1).max(40).optional(),
    units: z
      .array(z.object({ id, title: text(60), words: z.array(bubbleWord).min(1).max(20) }))
      .min(1)
      .max(20),
  })
  .superRefine((d, ctx) => {
    uniqueBy(d.units, (u) => u.id, ctx, 'units', 'id');
    d.units.forEach((u, i) => {
      const seen = new Set<string>();
      u.words.forEach((w, j) => {
        if (seen.has(w.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['units', i, 'words', j], message: `id bị trùng: ${w.id}` });
        seen.add(w.id);
      });
    });
  });

// ---------------------------------------------------------------------------
// spelling
// ---------------------------------------------------------------------------
export const spellingSchema = z
  .object({
    instructions: optionalText(300),
    mode: z.enum(['type', 'missing']).default('type'),
    caseSensitive: z.boolean().default(false),
    items: z
      .array(
        z.object({
          id,
          answer: text(40),
          prompt: optionalText(160),
          picture: pictureSchema.optional(),
          say: optionalText(80),
          /** Chế độ missing: vị trí (tính từ 0) các ký tự bị ẩn. */
          missing: z.array(z.number().int().min(0).max(39)).max(20).optional(),
        }),
      )
      .min(3)
      .max(30),
  })
  .superRefine((d, ctx) => {
    uniqueBy(d.items, (x) => x.id, ctx, 'items', 'id');
    d.items.forEach((item, i) => {
      if (!item.prompt && !item.picture && !item.say) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', i], message: 'Cần ít nhất một gợi ý: prompt, picture hoặc say' });
      }
      item.missing?.forEach((m) => {
        if (m >= Array.from(item.answer).length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', i, 'missing'], message: 'Vị trí ẩn vượt quá độ dài từ' });
      });
    });
  });

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
export const TEMPLATES = {
  bingo: { name: { en: 'Bingo', vi: 'Bingo' }, schema: bingoSchema, languages: ['en', 'vi'] },
  'picture-match': { name: { en: 'Picture Match', vi: 'Ghép chữ với hình' }, schema: pictureMatchSchema, languages: ['en', 'vi'] },
  quiz: { name: { en: 'Quiz', vi: 'Đố vui' }, schema: quizSchema, languages: ['en', 'vi'] },
  'hidden-picture': { name: { en: 'Hidden Picture', vi: 'Bức tranh bí mật' }, schema: hiddenPictureSchema, languages: ['en', 'vi'] },
  'bubble-spelling': { name: { en: 'Bubble Spelling', vi: 'Bong bóng đánh vần' }, schema: bubbleSpellingSchema, languages: ['en', 'vi'] },
  spelling: { name: { en: 'Spelling', vi: 'Chính tả' }, schema: spellingSchema, languages: ['en', 'vi'] },
} as const;

export type TemplateKey = keyof typeof TEMPLATES;
export const TEMPLATE_KEYS = Object.keys(TEMPLATES) as TemplateKey[];

export type BingoData = z.infer<typeof bingoSchema>;
export type PictureMatchData = z.infer<typeof pictureMatchSchema>;
export type QuizData = z.infer<typeof quizSchema>;
export type QuizQuestion = QuizData['questions'][number];
export type HiddenPictureData = z.infer<typeof hiddenPictureSchema>;
export type BubbleSpellingData = z.infer<typeof bubbleSpellingSchema>;
export type SpellingData = z.infer<typeof spellingSchema>;

export type TemplateDataMap = {
  bingo: BingoData;
  'picture-match': PictureMatchData;
  quiz: QuizData;
  'hidden-picture': HiddenPictureData;
  'bubble-spelling': BubbleSpellingData;
  spelling: SpellingData;
};

export function isTemplateKey(value: string): value is TemplateKey {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, value);
}

export type ValidationIssue = { path: string; message: string };
export type ValidationResult<K extends TemplateKey = TemplateKey> =
  | { ok: true; data: TemplateDataMap[K] }
  | { ok: false; issues: ValidationIssue[] };

/** Kiểm tra và điền giá trị mặc định cho dữ liệu game theo template. */
export function validateGameData<K extends TemplateKey>(templateKey: K, data: unknown): ValidationResult<K>;
export function validateGameData(templateKey: string, data: unknown): ValidationResult;
export function validateGameData(templateKey: string, data: unknown): ValidationResult {
  if (!isTemplateKey(templateKey)) return { ok: false, issues: [{ path: '', message: `Template không tồn tại: ${templateKey}` }] };
  const result = TEMPLATES[templateKey].schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data as TemplateDataMap[TemplateKey] };
  return { ok: false, issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) };
}
