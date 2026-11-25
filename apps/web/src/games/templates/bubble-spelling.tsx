'use client';

import { useEffect, useMemo, useState } from 'react';
import { createRng, shuffle } from '@happyclass/game-core/rng';
import type { Rng } from '@happyclass/game-core/rng';
import type { BubbleSpellingData } from '@happyclass/game-core/templates';
import { graphemes } from '@happyclass/game-core/text';
import { sessionSelection } from '@happyclass/game-core/learning-session';
import { PictureView } from '../picture';
import type { TemplateProps } from '../shell/types';
import { FeedbackLine, useFeedback } from './feedback';

const EN_POOL = 'abcdefghijklmnopqrstuvwxyz'.split('');
const VI_POOL = 'a ă â b c d đ e ê g h i k l m n o ô ơ p q r s t u ư v x y'.split(' ');

type Word = BubbleSpellingData['units'][number]['words'][number];
type Bubble = { key: string; value: string };

function makeBubbles(word: Word, extra: number, pool: string[], rng: Rng): Bubble[] {
  const segments = word.segments ?? graphemes(word.word);
  const needed = new Set(segments);
  const extras = shuffle(pool.filter((p) => !needed.has(p)), rng).slice(0, extra);
  return shuffle([...segments, ...extras], rng).map((value, i) => ({ key: `${i}-${value}`, value }));
}

export function BubbleSpellingTemplate({ data, lang, t, rng, round, audio, onProgress, onFinish }: TemplateProps<BubbleSpellingData>) {
  const [unitId, setUnitId] = useState<string | null>(data.units.length === 1 ? data.units[0].id : null);
  const unit = data.units.find((u) => u.id === unitId) ?? null;
  const pool = data.distractorPool ?? (lang === 'en' ? EN_POOL : VI_POOL);
  const seed = useMemo(() => Math.floor(rng() * 2 ** 31), [rng]);
  const unitWords = useMemo(
    () => unit ? sessionSelection(unit.words, data.wordsPerRound, round, createRng(`word-bank-${seed}-${unit.id}`)) : [],
    [unit, data.wordsPerRound, round, seed],
  );

  const [wordIndex, setWordIndex] = useState(0);
  const [built, setBuilt] = useState<string[]>([]);
  const [usedKeys, setUsedKeys] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [hints, setHints] = useState(0);
  const [wrongKey, setWrongKey] = useState<string | null>(null);
  const [wordDone, setWordDone] = useState(false);
  const { feedback, show } = useFeedback();

  const word = unitWords[wordIndex];
  const segments = useMemo(() => (word ? word.segments ?? graphemes(word.word) : []), [word]);
  const bubbles = useMemo(
    () => (word ? makeBubbles(word, data.extraBubbles, pool, createRng(`${seed}-${unitId}-${wordIndex}`)) : []),
    [word, data.extraBubbles, pool, seed, unitId, wordIndex],
  );

  useEffect(() => { if (word) audio.say(word.say ?? word.word); }, [word]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!unit) {
    return (
      <div className="tpl tpl-bubble">
        <div className="bubble-unit-intro">
          <span aria-hidden="true">🌼 ✦ 🫧</span>
          <h3>{t.chooseUnit}</h3>
          <p>{lang === 'vi' ? 'Mỗi khu vườn là một bộ từ mới. Chọn một khu vườn để bắt đầu!' : 'Every garden has new words to discover. Pick your first adventure!'}</p>
        </div>
        <div className="unit-grid">
          {data.units.map((u) => (
            <button key={u.id} type="button" className="unit-card" data-testid="unit-option" onClick={() => setUnitId(u.id)}>
              <PictureView picture={u.words[0].picture} size={72} />
              <b>{u.title}</b><small>{Math.min(data.wordsPerRound, u.words.length)} / {u.words.length} {t.words} · fresh set each replay</small>
            </button>
          ))}
        </div>
      </div>
    );
  }

  function pop(b: Bubble) {
    if (wordDone || usedKeys.has(b.key)) return;
    const expected = segments[built.length];
    if (b.value !== expected) {
      setMistakes(mistakes + 1);
      onProgress({ score, mistakes: mistakes + 1 });
      setWrongKey(b.key);
      window.setTimeout(() => setWrongKey(null), 400);
      audio.sfx('wrong');
      return;
    }
    const nextBuilt = [...built, b.value];
    setBuilt(nextBuilt);
    setUsedKeys(new Set(usedKeys).add(b.key));
    audio.sfx('pop');
    if (nextBuilt.length === segments.length) {
      setWordDone(true);
      setScore(score + 1);
      onProgress({ score: score + 1, mistakes });
      audio.say(word!.say ?? word!.word);
      show({ kind: 'correct', text: t.correct }, true);
    }
  }

  function hint() {
    if (wordDone) return;
    const expected = segments[built.length];
    const b = bubbles.find((x) => x.value === expected && !usedKeys.has(x.key));
    if (!b) return;
    setHints(hints + 1);
    if (word!.hint) show({ kind: 'info', text: word!.hint });
    pop(b);
  }

  function retry() {
    setBuilt([]); setUsedKeys(new Set()); setWordDone(false); show(null);
  }

  function nextWord() {
    if (wordIndex + 1 < unitWords.length) {
      setWordIndex(wordIndex + 1); retry();
    } else {
      onFinish({ score, maxScore: unitWords.length, mistakes: mistakes + hints });
    }
  }

  return (
    <div className="tpl tpl-bubble">
      <div className="bubble-stage-header">
        <div className="bubble-stage-title">
          <span className="eyebrow">{lang === 'vi' ? 'KHU VƯỜN TỪ NGỮ' : 'THE WORD GARDEN'}</span>
          <h3>🌻 {unit.title}</h3>
          <p className="tpl-sub" data-testid="bubble-word" data-word-id={word!.id}>
            {lang === 'vi' ? 'Từ' : 'Word'} {wordIndex + 1} {t.of} {unitWords.length}
          </p>
        </div>
        <div className="bubble-round-dots" role="group" aria-label={lang === 'vi' ? 'Tiến độ các từ' : 'Word progress'}>
          {unitWords.map((item, index) => (
            <span key={item.id} className={index < wordIndex ? 'complete' : index === wordIndex ? 'active' : ''}
              aria-label={`${lang === 'vi' ? 'Từ' : 'Word'} ${index + 1}: ${index < wordIndex ? (lang === 'vi' ? 'hoàn thành' : 'complete') : index === wordIndex ? (lang === 'vi' ? 'đang chơi' : 'current') : (lang === 'vi' ? 'chưa đến' : 'upcoming')}`}>
              {index < wordIndex ? '✓' : '✦'}
            </span>
          ))}
        </div>
      </div>
      <div className="bubble-target bubble-target-card">
        <span className="bubble-flower flower-one" aria-hidden="true">✿</span>
        <span className="bubble-flower flower-two" aria-hidden="true">✧</span>
        <PictureView picture={word!.picture} size={154} />
        <button type="button" className="icon-button" aria-label={t.listen} onClick={() => audio.say(word!.say ?? word!.word)}>🔊</button>
      </div>
      <p className="bubble-instruction">{lang === 'vi' ? 'Chạm những bong bóng đúng thứ tự để ghép thành từ!' : 'Pop the letter bubbles in the right order to grow the word!'}</p>
      <div className="bubble-slots" data-testid="bubble-slots">
        {segments.map((_, i) => <span key={i} className={`slot ${built[i] ? 'filled' : ''}`}>{built[i] ?? ''}</span>)}
      </div>
      <div className="bubble-field" aria-label={lang === 'vi' ? 'Các chữ cái bong bóng' : 'Letter bubbles'}>
        {bubbles.map((b, i) => (
          <button key={b.key} type="button" data-testid="bubble" data-value={b.value} disabled={usedKeys.has(b.key) || wordDone}
            className={`bubble b${i % 6} ${usedKeys.has(b.key) ? 'popped' : ''} ${wrongKey === b.key ? 'shake' : ''}`} onClick={() => pop(b)}>{b.value}</button>
        ))}
      </div>
      {wordDone && <div className="bubble-celebrate" data-testid="bubble-word-complete" aria-live="polite">
        🌟 {lang === 'vi' ? 'Giỏi lắm! Thêm một bông hoa trong khu vườn!' : 'Wonderful! You grew another word!'} 🌷
      </div>}
      <FeedbackLine feedback={feedback} />
      <div className="tpl-footer">
        <button type="button" className="secondary-button" onClick={hint} disabled={wordDone}>💡 {t.hint}</button>
        <button type="button" className="secondary-button" onClick={retry}>↺ {t.retry}</button>
        {wordDone && <button type="button" className="primary-button" onClick={nextWord} data-testid="bubble-next">{wordIndex + 1 < unitWords.length ? `${t.next} →` : t.finish}</button>}
      </div>
    </div>
  );
}
