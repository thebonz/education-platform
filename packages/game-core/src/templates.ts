import { z } from 'zod';
import { isNfc } from './text';
import { ONSETS, parseSyllable, spellingIssues } from './vi/syllable';

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
  z.object({ kind: z.literal('image'), src: z.string().max(500).regex(/^(https:\/\/|\/)/, 'Ảnh phải là ảnh trong thư viện (/api/media/…) hoặc đường dẫn https://'), alt: text(120) }),
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
// mystery-doors: khám phá hình ảnh từng cửa và đoán từ bằng gợi ý
// ---------------------------------------------------------------------------
const mysteryRoundSchema = z
  .object({
    id,
    picture: pictureSchema,
    question: text(140),
    choices: z.array(text(60)).min(3).max(4),
    answer: text(60),
    say: optionalText(160),
    hint: optionalText(140),
  })
  .superRefine((round, ctx) => {
    if (!round.choices.includes(round.answer)) ctx.addIssue({
      code: z.ZodIssueCode.custom, path: ['answer'], message: 'Đáp án phải thuộc danh sách lựa chọn',
    });
    if (new Set(round.choices).size !== round.choices.length) ctx.addIssue({
      code: z.ZodIssueCode.custom, path: ['choices'], message: 'Đáp án lựa chọn bị trùng',
    });
  });

export const mysteryDoorsSchema = z
  .object({
    instructions: optionalText(300),
    doorCount: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(9)]).default(6),
    rounds: z.array(mysteryRoundSchema).min(3).max(12),
  })
  .superRefine((data, ctx) => {
    uniqueBy(data.rounds, (round) => round.id, ctx, 'rounds', 'id');
  });

// ---------------------------------------------------------------------------
// picture-puzzle: Hoán đổi mảnh tranh (game gốc HappyClass)
// ---------------------------------------------------------------------------
const puzzleRound = z.object({
  id,
  picture: pictureSchema,
  label: text(80),
  say: optionalText(140),
});
export const picturePuzzleSchema = z.object({
  instructions: optionalText(300),
  size: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
  rounds: z.array(puzzleRound).min(2).max(12),
}).superRefine((data, ctx) => {
  uniqueBy(data.rounds, (round) => round.id, ctx, 'rounds', 'id');
});

// ---------------------------------------------------------------------------
// picture-match
// ---------------------------------------------------------------------------
export const pictureMatchSchema = z
  .object({
    instructions: optionalText(300),
    pairs: z.array(z.object({ id, word: text(40), picture: pictureSchema, say: optionalText(80) })).min(3).max(60),
    roundSize: z.number().int().min(3).max(12).optional(),
    timeLimitSec: z.number().int().min(0).max(600).default(0),
  })
  .superRefine((d, ctx) => {
    uniqueBy(d.pairs, (x) => x.id, ctx, 'pairs', 'id');
    uniqueBy(d.pairs, (x) => x.word, ctx, 'pairs', 'Từ');
    if (d.roundSize !== undefined && d.roundSize > d.pairs.length) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['roundSize'], message: 'Số cặp mỗi lượt không vượt số từ trong thư viện' });
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
    questions: z.array(choiceQuestion).min(3).max(60),
    questionsPerRound: z.number().int().min(3).max(25).optional(),
  })
  .superRefine((d, ctx) => {
    uniqueBy(d.questions, (x) => x.id, ctx, 'questions', 'id');
    if (d.questionsPerRound !== undefined && d.questionsPerRound > d.questions.length)
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['questionsPerRound'], message: 'Số câu mỗi lượt không vượt ngân hàng câu hỏi' });
  });

// ---------------------------------------------------------------------------
// trail-board: trò chơi thám hiểm theo lượt, luật tự xây dựng cho HappyClass
// ---------------------------------------------------------------------------
export const trailBoardSchema = z
  .object({
    instructions: optionalText(300),
    boardLength: z.number().int().min(8).max(24).default(12),
    diceSides: z.number().int().min(2).max(6).default(4),
    defaultTeams: z.number().int().min(2).max(4).default(2),
    shuffleChoices: z.boolean().default(true),
    questions: z.array(choiceQuestion).min(4).max(40),
  })
  .superRefine((d, ctx) => {
    uniqueBy(d.questions, (q) => q.id, ctx, 'questions', 'id');
  });

// ---------------------------------------------------------------------------
// hidden-picture
// ---------------------------------------------------------------------------
const hiddenSceneSchema = z.object({
  picture: pictureSchema,
  answer: text(60),
  choices: z.array(text(60)).min(2).max(4),
}).superRefine((scene, ctx) => {
  if (!scene.choices.includes(scene.answer)) ctx.addIssue({
    code: z.ZodIssueCode.custom, path: ['answer'], message: 'Đáp án phải nằm trong lựa chọn',
  });
  if (new Set(scene.choices).size !== scene.choices.length) ctx.addIssue({
    code: z.ZodIssueCode.custom, path: ['choices'], message: 'Lựa chọn trùng',
  });
});
export const hiddenPictureSchema = z
  .object({
    instructions: optionalText(300),
    // Legacy single scene stays valid for teacher-edited games and offline packs.
    picture: pictureSchema,
    pictureAnswer: text(60),
    pictureChoices: z.array(text(60)).min(2).max(4),
    scenes: z.array(hiddenSceneSchema).min(2).max(12).optional(),
    questionsPerRound: z.number().int().min(4).max(16).optional(),
    questions: z.array(choiceQuestion).min(4).max(40),
  })
  .superRefine((d, ctx) => {
    if (!d.pictureChoices.includes(d.pictureAnswer)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pictureAnswer'], message: 'Đáp án bức tranh phải nằm trong lựa chọn' });
    uniqueBy(d.questions, (x) => x.id, ctx, 'questions', 'id');
    if (d.questionsPerRound !== undefined && d.questionsPerRound > d.questions.length) ctx.addIssue({
      code: z.ZodIssueCode.custom, path: ['questionsPerRound'], message: 'Số câu mỗi lượt không vượt thư viện câu hỏi',
    });
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
    wordsPerRound: z.number().int().min(1).max(12).optional(),
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
// Phase 12 – game mechanisms independently designed after studying public demos.
// All three are opt-in and English only; never reuse a vendor's code/assets.
// ---------------------------------------------------------------------------
const phonicsWordSchema = z.object({
  id,
  word: text(40),
  picture: pictureSchema,
  say: optionalText(80),
});
const phonicsFamilySchemaItem = z.object({
  id,
  ending: text(12),
  words: z.array(phonicsWordSchema).min(3).max(15),
}).superRefine((family, ctx) => {
  uniqueBy(family.words, (word) => word.id, ctx, 'words', 'id');
  for (const [i, word] of family.words.entries()) {
    if (!word.word.toLowerCase().endsWith(family.ending.toLowerCase())) ctx.addIssue({
      code: z.ZodIssueCode.custom, path: ['words', i, 'word'],
      message: 'Từ phải có phần vần (ending) như đã chọn',
    });
  }
});
export const phonicsFamilySchema = z.object({
  instructions: optionalText(300),
  wordsPerRound: z.number().int().min(3).max(12).default(6),
  families: z.array(phonicsFamilySchemaItem).min(2).max(10),
}).superRefine((data, ctx) => {
  uniqueBy(data.families, (family) => family.id, ctx, 'families', 'id');
  const words = data.families.flatMap((family) => family.words);
  if (words.length < data.wordsPerRound) ctx.addIssue({
    code: z.ZodIssueCode.custom, path: ['wordsPerRound'], message: 'Cần đủ từ cho mỗi lượt',
  });
  const seen = new Set<string>();
  data.families.forEach((family, fi) => family.words.forEach((word, wi) => {
    const key = word.word.toLowerCase();
    if (seen.has(key)) ctx.addIssue({
      code: z.ZodIssueCode.custom, path: ['families', fi, 'words', wi],
      message: 'Một từ không được trùng ở nhiều nhóm âm',
    });
    seen.add(key);
  }));
});

const classroomObjectSchema = z.object({
  id,
  word: text(40),
  picture: pictureSchema,
  clue: optionalText(120),
  choices: z.array(text(40)).length(3),
}).superRefine((item, ctx) => {
  if (!item.choices.includes(item.word)) ctx.addIssue({ code: z.ZodIssueCode.custom,
    path: ['choices'], message: 'Ba lựa chọn phải chứa từ đúng' });
  if (new Set(item.choices).size !== 3) ctx.addIssue({ code: z.ZodIssueCode.custom,
    path: ['choices'], message: 'Ba lựa chọn không được trùng' });
});
export const classroomExploreSchema = z.object({
  instructions: optionalText(300),
  wordsPerRound: z.number().int().min(3).max(12).default(6),
  items: z.array(classroomObjectSchema).min(3).max(48),
}).superRefine((data, ctx) => {
  uniqueBy(data.items, (x) => x.id, ctx, 'items', 'id');
  if (data.wordsPerRound > data.items.length) ctx.addIssue({
    code: z.ZodIssueCode.custom, path: ['wordsPerRound'], message: 'Số từ một lượt không vượt tổng từ',
  });
});

const shadowItemSchema = z.object({
  id, word: text(40), picture: pictureSchema, silhouette: pictureSchema, hint: optionalText(140),
  choices: z.array(text(40)).length(3),
}).superRefine((item, ctx) => {
  if (!item.choices.includes(item.word)) ctx.addIssue({ code: z.ZodIssueCode.custom,
    path: ['choices'], message: 'Phải có đáp án đúng trong ba lựa chọn' });
  if (new Set(item.choices).size !== 3) ctx.addIssue({ code: z.ZodIssueCode.custom,
    path: ['choices'], message: 'Các lựa chọn phải khác nhau' });
});
export const shadowGuessSchema = z.object({
  instructions: optionalText(300),
  wordsPerRound: z.number().int().min(3).max(12).default(6),
  maxMistakes: z.number().int().min(1).max(5).default(3),
  items: z.array(shadowItemSchema).min(3).max(48),
}).superRefine((data, ctx) => {
  uniqueBy(data.items, (x) => x.id, ctx, 'items', 'id');
  if (data.wordsPerRound > data.items.length) ctx.addIssue({
    code: z.ZodIssueCode.custom, path: ['wordsPerRound'], message: 'Số từ một lượt không vượt tổng từ',
  });
});

// ---------------------------------------------------------------------------
// Tiếng Việt: kiểm tra chung
// ---------------------------------------------------------------------------
/** Một tiếng tiếng Việt hợp lệ (tách được âm đầu + vần + thanh, đúng quy tắc c/k, g/gh, ng/ngh). */
const viSyllable = text(12).superRefine((w, ctx) => {
  if (!parseSyllable(w)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Không tách được tiếng: ${w}` });
  else spellingIssues(w).forEach((i) => ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${w}: ${i.message}` }));
});
const viOnset = z.string().refine((o) => o === '' || (ONSETS as readonly string[]).includes(o), 'Âm đầu không hợp lệ');
const viRhyme = text(6).refine((r) => {
  const p = parseSyllable(r);
  return !!p && p.onset === '' && p.tone === 'ngang';
}, 'Vần không hợp lệ (viết thường, không dấu thanh)');

// ---------------------------------------------------------------------------
// syllable-builder (Ghép tiếng: âm đầu + vần + thanh)
// ---------------------------------------------------------------------------
export const syllableBuilderSchema = z
  .object({
    instructions: optionalText(300),
    /** Số lựa chọn hiện ra cho mỗi bước (gồm cả đáp án đúng). */
    choicesPerStep: z.number().int().min(2).max(6).default(4),
    /** Bỏ bước chọn thanh khi bài chỉ học tiếng thanh ngang. */
    includeTone: z.boolean().default(true),
    distractors: z
      .object({ onsets: z.array(viOnset).max(20).optional(), rhymes: z.array(viRhyme).max(20).optional() })
      .default({}),
    items: z
      .array(z.object({ id, word: viSyllable, picture: pictureSchema.optional(), hint: optionalText(80), say: optionalText(80) }))
      .min(3)
      .max(30),
  })
  .superRefine((d, ctx) => {
    uniqueBy(d.items, (x) => x.id, ctx, 'items', 'id');
    uniqueBy(d.items, (x) => x.word, ctx, 'items', 'Tiếng');
    d.items.forEach((item, i) => {
      if (!item.picture && !item.hint && !item.say) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', i], message: 'Cần ít nhất một gợi ý: picture, hint hoặc say' });
    });
  });

// ---------------------------------------------------------------------------
// tone-finder (Tìm dấu thanh)
// ---------------------------------------------------------------------------
export const toneFinderSchema = z
  .object({
    instructions: optionalText(300),
    items: z
      .array(z.object({ id, word: viSyllable, picture: pictureSchema.optional(), hint: optionalText(80), say: optionalText(80) }))
      .min(3)
      .max(30),
  })
  .superRefine((d, ctx) => {
    uniqueBy(d.items, (x) => x.id, ctx, 'items', 'id');
    d.items.forEach((item, i) => {
      if (!item.picture && !item.hint && !item.say) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', i], message: 'Cần ít nhất một gợi ý: picture, hint hoặc say' });
    });
  });

// ---------------------------------------------------------------------------
// word-sort (Xếp từ vào nhóm)
// ---------------------------------------------------------------------------
export const wordSortSchema = z
  .object({
    instructions: optionalText(300),
    groups: z.array(z.object({ id, label: text(40), hint: optionalText(120) })).min(2).max(4),
    items: z
      .array(z.object({ id, text: text(40), group: id, picture: pictureSchema.optional(), explain: optionalText(160) }))
      .min(4)
      .max(24),
  })
  .superRefine((d, ctx) => {
    uniqueBy(d.groups, (x) => x.id, ctx, 'groups', 'id');
    uniqueBy(d.items, (x) => x.id, ctx, 'items', 'id');
    uniqueBy(d.items, (x) => x.text, ctx, 'items', 'Từ');
    const groups = new Set(d.groups.map((g) => g.id));
    d.items.forEach((item, i) => {
      if (!groups.has(item.group)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', i, 'group'], message: `Nhóm không tồn tại: ${item.group}` });
    });
    d.groups.forEach((g, i) => {
      if (!d.items.some((x) => x.group === g.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['groups', i], message: `Nhóm ${g.label} chưa có từ nào` });
    });
  });

// ---------------------------------------------------------------------------
// sentence-order (Sắp xếp thành câu)
// ---------------------------------------------------------------------------
const sentenceItem = z
  .object({
    id,
    sentence: text(160),
    /** Các mảnh theo đúng thứ tự. Bỏ trống = tách theo khoảng trắng (dấu câu cuối câu giữ cố định). */
    chunks: z.array(text(40)).min(2).max(12).optional(),
    /** Câu khác cũng được chấp nhận (cùng các mảnh, khác thứ tự). */
    alternatives: z.array(text(160)).max(4).optional(),
    picture: pictureSchema.optional(),
    say: optionalText(200),
  })
  .superRefine((item, ctx) => {
    if (item.chunks && item.chunks.join(' ') !== stripEndPunctuation(item.sentence)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['chunks'], message: 'Ghép các mảnh (cách nhau 1 khoảng trắng) phải ra đúng câu, không kể dấu câu cuối' });
    }
    const n = (item.chunks ?? stripEndPunctuation(item.sentence).split(' ')).length;
    if (n < 2 || n > 12) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sentence'], message: 'Câu cần 2–12 mảnh' });
  });

/** Bỏ dấu câu ở cuối (. ! ? …) để xếp mảnh; dấu câu được hiển thị cố định ở cuối. */
export function stripEndPunctuation(sentence: string): string {
  return sentence.normalize('NFC').trim().replace(/\s+/g, ' ').replace(/\s*[.!?…]+$/u, '');
}

export const sentenceOrderSchema = z
  .object({
    instructions: optionalText(300),
    items: z.array(sentenceItem).min(3).max(20),
  })
  .superRefine((d, ctx) => uniqueBy(d.items, (x) => x.id, ctx, 'items', 'id'));

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
export const TEMPLATES = {
  bingo: { name: { en: 'Bingo', vi: 'Bingo' }, schema: bingoSchema, languages: ['en', 'vi'] },
  'picture-match': { name: { en: 'Picture Match', vi: 'Ghép chữ với hình' }, schema: pictureMatchSchema, languages: ['en', 'vi'] },
  'phonics-family': { name: { en: 'Phonics Family Match', vi: 'Ghép nhóm vần' }, schema: phonicsFamilySchema, languages: ['en'] },
  'classroom-explore': { name: { en: 'Classroom Discovery', vi: 'Khám phá lớp học' }, schema: classroomExploreSchema, languages: ['en'] },
  'shadow-guess': { name: { en: 'Shadow Safari', vi: 'Đoán bóng hình' }, schema: shadowGuessSchema, languages: ['en'] },
  'picture-puzzle': { name: { en: 'Picture Puzzle', vi: 'Ghép mảnh bức tranh' }, schema: picturePuzzleSchema, languages: ['en', 'vi'] },
  quiz: { name: { en: 'Quiz', vi: 'Đố vui' }, schema: quizSchema, languages: ['en', 'vi'] },
  'trail-board': { name: { en: 'Star Trail Adventure', vi: 'Đường đua ngôi sao' }, schema: trailBoardSchema, languages: ['en', 'vi'] },
  'hidden-picture': { name: { en: 'Hidden Picture', vi: 'Bức tranh bí mật' }, schema: hiddenPictureSchema, languages: ['en', 'vi'] },
  'mystery-doors': { name: { en: 'Mystery Doors', vi: 'Những cánh cửa bí mật' }, schema: mysteryDoorsSchema, languages: ['en', 'vi'] },
  'bubble-spelling': { name: { en: 'Bubble Spelling', vi: 'Bong bóng đánh vần' }, schema: bubbleSpellingSchema, languages: ['en', 'vi'] },
  spelling: { name: { en: 'Spelling', vi: 'Chính tả' }, schema: spellingSchema, languages: ['en', 'vi'] },
  'syllable-builder': { name: { en: 'Syllable Builder', vi: 'Ghép tiếng' }, schema: syllableBuilderSchema, languages: ['vi'] },
  'tone-finder': { name: { en: 'Tone Finder', vi: 'Tìm dấu thanh' }, schema: toneFinderSchema, languages: ['vi'] },
  'word-sort': { name: { en: 'Word Sort', vi: 'Xếp từ vào nhóm' }, schema: wordSortSchema, languages: ['en', 'vi'] },
  'sentence-order': { name: { en: 'Sentence Order', vi: 'Sắp xếp câu' }, schema: sentenceOrderSchema, languages: ['en', 'vi'] },
} as const;

export type TemplateKey = keyof typeof TEMPLATES;
export const TEMPLATE_KEYS = Object.keys(TEMPLATES) as TemplateKey[];

export type BingoData = z.infer<typeof bingoSchema>;
export type PictureMatchData = z.infer<typeof pictureMatchSchema>;
export type PhonicsFamilyData = z.infer<typeof phonicsFamilySchema>;
export type ClassroomExploreData = z.infer<typeof classroomExploreSchema>;
export type ShadowGuessData = z.infer<typeof shadowGuessSchema>;
export type PicturePuzzleData = z.infer<typeof picturePuzzleSchema>;
export type QuizData = z.infer<typeof quizSchema>;
export type QuizQuestion = QuizData['questions'][number];
export type TrailBoardData = z.infer<typeof trailBoardSchema>;
export type HiddenPictureData = z.infer<typeof hiddenPictureSchema>;
export type MysteryDoorsData = z.infer<typeof mysteryDoorsSchema>;
export type BubbleSpellingData = z.infer<typeof bubbleSpellingSchema>;
export type SpellingData = z.infer<typeof spellingSchema>;
export type SyllableBuilderData = z.infer<typeof syllableBuilderSchema>;
export type ToneFinderData = z.infer<typeof toneFinderSchema>;
export type WordSortData = z.infer<typeof wordSortSchema>;
export type SentenceOrderData = z.infer<typeof sentenceOrderSchema>;

export type TemplateDataMap = {
  bingo: BingoData;
  'picture-match': PictureMatchData;
  'phonics-family': PhonicsFamilyData;
  'classroom-explore': ClassroomExploreData;
  'shadow-guess': ShadowGuessData;
  'picture-puzzle': PicturePuzzleData;
  quiz: QuizData;
  'trail-board': TrailBoardData;
  'hidden-picture': HiddenPictureData;
  'mystery-doors': MysteryDoorsData;
  'bubble-spelling': BubbleSpellingData;
  spelling: SpellingData;
  'syllable-builder': SyllableBuilderData;
  'tone-finder': ToneFinderData;
  'word-sort': WordSortData;
  'sentence-order': SentenceOrderData;
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
