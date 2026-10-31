'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createRng, shuffle } from '@happyclass/game-core/rng';
import type { SpellingData } from '@happyclass/game-core/templates';
import { answersEqual, graphemes } from '@happyclass/game-core/text';
import { PictureView } from '../picture';
import type { TemplateProps } from '../shell/types';

type Item = SpellingData['items'][number];

/** Vị trí bị ẩn: lấy từ nội dung, hoặc tự chọn ~40% (không ẩn ký tự đầu, bỏ qua khoảng trắng). */
function missingPositions(item: Item, letters: string[], seed: string): Set<number> {
  if (item.missing?.length) return new Set(item.missing);
  const candidates = letters.map((_, i) => i).filter((i) => i > 0 && letters[i].trim() !== '');
  const count = Math.max(1, Math.round(candidates.length * 0.4));
  return new Set(shuffle(candidates, createRng(seed)).slice(0, count));
}

export function SpellingTemplate({ data, t, rng, audio, onProgress, onFinish }: TemplateProps<SpellingData>) {
  const order = useMemo(() => shuffle(data.items, rng), [data.items, rng]);
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [blanks, setBlanks] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState<null | boolean>(null);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const firstInput = useRef<HTMLInputElement>(null);

  const item = order[index];
  const letters = useMemo(() => graphemes(item.answer), [item]);
  const hidden = useMemo(() => missingPositions(item, letters, `${item.id}-${index}`), [item, letters, index]);

  useEffect(() => {
    audio.say(item.say ?? item.answer);
    firstInput.current?.focus();
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const attempt = data.mode === 'type' ? typed : letters.map((ch, i) => (hidden.has(i) ? blanks[i] ?? '' : ch)).join('');
  const complete = data.mode === 'type' ? typed.trim().length > 0 : [...hidden].every((i) => (blanks[i] ?? '').length > 0);

  function check() {
    if (checked !== null || !complete) return;
    const ok = answersEqual(attempt, item.answer, { caseSensitive: data.caseSensitive });
    setChecked(ok);
    if (ok) { setScore(score + 1); onProgress({ score: score + 1, mistakes }); audio.sfx('correct'); }
    else { setMistakes(mistakes + 1); onProgress({ score, mistakes: mistakes + 1 }); audio.sfx('wrong'); }
  }

  function next() {
    if (index + 1 < order.length) {
      setIndex(index + 1); setTyped(''); setBlanks({}); setChecked(null);
    } else {
      onFinish({ score, maxScore: order.length, mistakes });
    }
  }

  function onBlank(i: number, value: string, el: HTMLInputElement) {
    const ch = graphemes(value).slice(-1)[0] ?? '';
    setBlanks((b) => ({ ...b, [i]: ch }));
    if (ch) {
      const inputs = Array.from(el.parentElement?.querySelectorAll<HTMLInputElement>('input[data-index]') ?? []);
      inputs.find((x) => Number(x.dataset.index) > i)?.focus();
    }
  }

  return (
    <div className="tpl tpl-spelling" data-item-id={item.id}>
      <p className="tpl-sub">{t.item} {index + 1} {t.of} {order.length}</p>
      <div className="spell-clue">
        {item.picture && <PictureView picture={item.picture} size={88} />}
        {item.prompt && <p className="spell-prompt">{item.prompt}</p>}
        <button type="button" className="icon-button" aria-label={t.listen} onClick={() => audio.say(item.say ?? item.answer)}>🔊</button>
      </div>

      <form className="spell-form" onSubmit={(e) => { e.preventDefault(); if (checked === null) check(); else next(); }}>
        {data.mode === 'type' ? (
          <input ref={firstInput} className="spell-input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t.typeAnswer}
            aria-label={t.typeAnswer} autoComplete="off" autoCapitalize="off" spellCheck={false} disabled={checked !== null} data-testid="spell-input" />
        ) : (
          <div className="spell-letters" aria-label={t.fillBlanks}>
            {letters.map((ch, i) => hidden.has(i) ? (
              <input key={i} ref={i === Math.min(...hidden) ? firstInput : undefined} data-index={i} data-testid="spell-blank" className="spell-blank"
                value={blanks[i] ?? ''} onChange={(e) => onBlank(i, e.target.value, e.currentTarget)} maxLength={4} autoComplete="off"
                autoCapitalize="off" spellCheck={false} disabled={checked !== null} aria-label={`${t.fillBlanks} ${i + 1}`} />
            ) : <span key={i} className="spell-fixed">{ch === ' ' ? ' ' : ch}</span>)}
          </div>
        )}
        <div className="tpl-footer">
          <p className={`tpl-feedback ${checked === null ? '' : checked ? 'correct' : 'wrong'}`} role="status" data-testid="tpl-feedback">
            {checked === null ? ' ' : checked ? t.correct : `${t.wrong} ${t.answerWas}: ${item.answer}`}
          </p>
          {checked === null
            ? <button type="submit" className="primary-button" disabled={!complete} data-testid="spell-check">{t.check}</button>
            : <button type="submit" className="primary-button" data-testid="quiz-next">{index + 1 < order.length ? `${t.next} →` : t.finish}</button>}
        </div>
      </form>
    </div>
  );
}
