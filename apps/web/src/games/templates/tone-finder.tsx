'use client';

import { useEffect, useMemo, useState } from 'react';
import { shuffle } from '@happyclass/game-core/rng';
import type { ToneFinderData } from '@happyclass/game-core/templates';
import { TONE_MARK_NAMES, TONE_SYMBOLS, TONES, composeSyllable, parseSyllable, type Tone } from '@happyclass/game-core/vi';
import { PictureView } from '../picture';
import type { TemplateProps } from '../shell/types';

/** Tìm dấu thanh: nhìn tiếng chưa có dấu, nghe đọc, chọn đúng dấu thanh. */
export function ToneFinderTemplate({ data, t, rng, audio, onProgress, onFinish }: TemplateProps<ToneFinderData>) {
  const order = useMemo(() => shuffle(data.items, rng), [data.items, rng]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<Tone | null>(null);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const item = order[index];
  const target = useMemo(() => parseSyllable(item.word)!, [item]);
  const bare = composeSyllable(target.onset, target.rhyme, 'ngang');
  const ok = picked === target.tone;

  useEffect(() => {
    audio.say(item.say ?? item.word);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  function pick(tone: Tone) {
    if (picked !== null) return;
    setPicked(tone);
    if (tone === target.tone) { setScore(score + 1); onProgress({ score: score + 1, mistakes }); audio.sfx('correct'); }
    else { setMistakes(mistakes + 1); onProgress({ score, mistakes: mistakes + 1 }); audio.sfx('wrong'); }
  }

  function next() {
    if (index + 1 < order.length) { setPicked(null); setIndex(index + 1); }
    else onFinish({ score, maxScore: order.length, mistakes });
  }

  return (
    <div className="tpl tpl-tone" data-item-id={item.id}>
      <p className="tpl-sub">{t.item} {index + 1} {t.of} {order.length} — {t.pickTone}</p>
      <div className="spell-clue">
        {item.picture && <PictureView picture={item.picture} size={88} />}
        {item.hint && <p className="spell-prompt">{item.hint}</p>}
        <button type="button" className="icon-button" aria-label={t.listen} onClick={() => audio.say(item.say ?? item.word)}>🔊</button>
      </div>
      <p className="tone-word" data-testid="tone-word">{picked === null ? bare : item.word}</p>
      <div className="tone-grid">
        {TONES.map((x) => (
          <button key={x} type="button" data-testid="tone-choice" data-value={x} disabled={picked !== null}
            className={`choice syl-tone ${picked !== null && x === target.tone ? 'right' : ''} ${picked === x && !ok ? 'wrong' : ''}`}
            aria-label={TONE_MARK_NAMES[x]} onClick={() => pick(x)}>
            <span className="tone-mark">{TONE_SYMBOLS[x]}</span><small>{TONE_MARK_NAMES[x]}</small>
          </button>
        ))}
      </div>
      <div className="tpl-footer">
        <p className={`tpl-feedback ${picked === null ? '' : ok ? 'correct' : 'wrong'}`} role="status" data-testid="tpl-feedback">
          {picked === null ? ' ' : ok ? `${t.correct} ${item.word}: ${TONE_MARK_NAMES[target.tone]}` : `${t.wrong} ${t.answerWas}: ${item.word} (${TONE_MARK_NAMES[target.tone]})`}
        </p>
        {picked !== null && (
          <button type="button" className="primary-button" onClick={next} data-testid="quiz-next">{index + 1 < order.length ? `${t.next} →` : t.finish}</button>
        )}
      </div>
    </div>
  );
}
