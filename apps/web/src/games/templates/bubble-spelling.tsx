'use client';

import { useEffect, useMemo, useState } from 'react';
import { createRng, shuffle } from '@happyclass/game-core/rng';
import type { Rng } from '@happyclass/game-core/rng';
import type { BubbleSpellingData } from '@happyclass/game-core/templates';
import { graphemes } from '@happyclass/game-core/text';
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

export function BubbleSpellingTemplate({ data, lang, t, rng, audio, onProgress, onFinish }: TemplateProps<BubbleSpellingData>) {
  const [unitId, setUnitId] = useState<string | null>(data.units.length === 1 ? data.units[0].id : null);
  const unit = data.units.find((u) => u.id === unitId) ?? null;
  const pool = data.distractorPool ?? (lang === 'en' ? EN_POOL : VI_POOL);
  const seed = useMemo(() => Math.floor(rng() * 2 ** 31), [rng]);

  const [wordIndex, setWordIndex] = useState(0);
  const [built, setBuilt] = useState<string[]>([]);
  const [usedKeys, setUsedKeys] = useState<Set<string>>(new Set());
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [hints, setHints] = useState(0);
  const [wrongKey, setWrongKey] = useState<string | null>(null);
  const [wordDone, setWordDone] = useState(false);
  const { feedback, show } = useFeedback();

  const word = unit?.words[wordIndex];
  const segments = useMemo(() => (word ? word.segments ?? graphemes(word.word) : []), [word]);
  const bubbles = useMemo(
    () => (word ? makeBubbles(word, data.extraBubbles, pool, createRng(`${seed}-${unitId}-${wordIndex}`)) : []),
    [word, data.extraBubbles, pool, seed, unitId, wordIndex],
  );

  useEffect(() => { if (word) audio.say(word.say ?? word.word); }, [word]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!unit) {
    return (
      <div className="tpl tpl-bubble">
        <h3>{t.chooseUnit}</h3>
        <div className="unit-grid">
          {data.units.map((u) => (
            <button key={u.id} type="button" className="unit-card" data-testid="unit-option" onClick={() => setUnitId(u.id)}>
              <PictureView picture={u.words[0].picture} size={40} />
              <b>{u.title}</b><small>{u.words.length} {t.words}</small>
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
    if (wordIndex + 1 < unit!.words.length) {
      setWordIndex(wordIndex + 1); retry();
    } else {
      onFinish({ score, maxScore: unit!.words.length, mistakes: mistakes + hints });
    }
  }

  return (
    <div className="tpl tpl-bubble">
      <p className="tpl-sub" data-testid="bubble-word" data-word-id={word!.id}>{unit.title} · {wordIndex + 1} {t.of} {unit.words.length}</p>
      <div className="bubble-target">
        <PictureView picture={word!.picture} size={96} />
        <button type="button" className="icon-button" aria-label={t.listen} onClick={() => audio.say(word!.say ?? word!.word)}>🔊</button>
      </div>
      <div className="bubble-slots" data-testid="bubble-slots">
        {segments.map((_, i) => <span key={i} className={`slot ${built[i] ? 'filled' : ''}`}>{built[i] ?? ''}</span>)}
      </div>
      <div className="bubble-field">
        {bubbles.map((b, i) => (
          <button key={b.key} type="button" data-testid="bubble" data-value={b.value} disabled={usedKeys.has(b.key) || wordDone}
            className={`bubble b${i % 6} ${usedKeys.has(b.key) ? 'popped' : ''} ${wrongKey === b.key ? 'shake' : ''}`} onClick={() => pop(b)}>{b.value}</button>
        ))}
      </div>
      <FeedbackLine feedback={feedback} />
      <div className="tpl-footer">
        <button type="button" className="secondary-button" onClick={hint} disabled={wordDone}>💡 {t.hint}</button>
        <button type="button" className="secondary-button" onClick={retry}>↺ {t.retry}</button>
        {wordDone && <button type="button" className="primary-button" onClick={nextWord} data-testid="bubble-next">{wordIndex + 1 < unit.words.length ? `${t.next} →` : t.finish}</button>}
      </div>
    </div>
  );
}
