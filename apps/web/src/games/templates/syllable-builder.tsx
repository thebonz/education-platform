'use client';

import { useEffect, useMemo, useState } from 'react';
import { shuffle } from '@happyclass/game-core/rng';
import type { SyllableBuilderData } from '@happyclass/game-core/templates';
import { TONE_MARK_NAMES, TONE_SYMBOLS, TONES, composeSyllable, northernOnsetName, spellOut, syllableCorrect, syllableRound, type Tone } from '@happyclass/game-core/vi';
import { PictureView } from '../picture';
import type { TemplateProps } from '../shell/types';

/** Ghép tiếng: chọn âm đầu, vần, thanh; tiếng ghép được hiện ngay để trẻ tự nhìn và nghe. */
export function SyllableBuilderTemplate({ data, t, rng, audio, onProgress, onFinish }: TemplateProps<SyllableBuilderData>) {
  const order = useMemo(() => shuffle(data.items, rng), [data.items, rng]);
  const allWords = useMemo(() => data.items.map((x) => x.word), [data.items]);
  const [index, setIndex] = useState(0);
  const item = order[index];
  const round = useMemo(
    () => syllableRound(item.word, { allWords, choices: data.choicesPerStep, onsets: data.distractors.onsets, rhymes: data.distractors.rhymes }, rng),
    [item, allWords, data.choicesPerStep, data.distractors, rng],
  );
  const [onset, setOnset] = useState<string | null>(null);
  const [rhyme, setRhyme] = useState<string | null>(null);
  const [pickedTone, setTone] = useState<Tone | null>(null);
  const tone: Tone | null = data.includeTone ? pickedTone : round.target.tone;
  const [checked, setChecked] = useState<null | boolean>(null);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);

  useEffect(() => {
    audio.say(item.say ?? item.word);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = onset !== null && rhyme !== null ? composeSyllable(onset, rhyme, tone ?? 'ngang') : null;
  const complete = onset !== null && rhyme !== null && tone !== null;

  function check() {
    if (onset === null || rhyme === null || tone === null || checked !== null) return;
    const ok = syllableCorrect(round.target, { onset, rhyme, tone });
    setChecked(ok);
    audio.say(item.word);
    if (ok) { setScore(score + 1); onProgress({ score: score + 1, mistakes }); audio.sfx('correct'); }
    else { setMistakes(mistakes + 1); onProgress({ score, mistakes: mistakes + 1 }); audio.sfx('wrong'); }
  }

  function next() {
    if (index + 1 < order.length) { setOnset(null); setRhyme(null); setTone(null); setChecked(null); setIndex(index + 1); }
    else onFinish({ score, maxScore: order.length, mistakes });
  }

  const pickClass = (selected: boolean, isAnswer: boolean) =>
    `choice syl-choice ${selected ? 'picked' : ''} ${checked !== null && isAnswer ? 'right' : ''} ${checked === false && selected && !isAnswer ? 'wrong' : ''}`;

  return (
    <div className="tpl tpl-syllable" data-item-id={item.id}>
      <p className="tpl-sub">{t.item} {index + 1} {t.of} {order.length} — {t.buildSyllable}</p>
      <div className="spell-clue">
        {item.picture && <PictureView picture={item.picture} size={88} />}
        {item.hint && <p className="spell-prompt">{item.hint}</p>}
        <button type="button" className="icon-button" aria-label={t.listen} onClick={() => audio.say(item.say ?? item.word)}>🔊</button>
      </div>

      <div className="syl-preview" aria-live="polite" data-testid="syl-preview">
        <span className="syl-slot">{onset === null ? '?' : onset || '∅'}</span>
        <span className="syl-plus">+</span>
        <span className="syl-slot">{rhyme ?? '?'}</span>
        {data.includeTone && (<><span className="syl-plus">+</span><span className="syl-slot">{tone ? TONE_SYMBOLS[tone] : '?'}</span></>)}
        <span className="syl-plus">=</span>
        <strong className="syl-word">{preview ?? '…'}</strong>
      </div>

      <div className="syl-row" role="group" aria-label={t.onset}>
        <span className="syl-label">{t.onset}</span>
        {round.onsets.map((o) => (
          <button key={`o-${o}`} type="button" className={pickClass(onset === o, o === round.target.onset)} aria-pressed={onset === o}
            disabled={checked !== null} data-testid="syl-onset" data-value={o} onClick={() => { setOnset(o); audio.sfx('pop'); }}>
            {o || t.noOnset}
          </button>
        ))}
      </div>
      <div className="syl-row" role="group" aria-label={t.rhyme}>
        <span className="syl-label">{t.rhyme}</span>
        {round.rhymes.map((r) => (
          <button key={`r-${r}`} type="button" className={pickClass(rhyme === r, r === round.target.rhyme)} aria-pressed={rhyme === r}
            disabled={checked !== null} data-testid="syl-rhyme" data-value={r} onClick={() => { setRhyme(r); audio.sfx('pop'); }}>
            {r}
          </button>
        ))}
      </div>
      {data.includeTone && (
        <div className="syl-row" role="group" aria-label={t.toneLabel}>
          <span className="syl-label">{t.toneLabel}</span>
          {TONES.map((x) => (
            <button key={x} type="button" className={`${pickClass(tone === x, x === round.target.tone)} syl-tone`} aria-pressed={tone === x}
              aria-label={TONE_MARK_NAMES[x]} title={TONE_MARK_NAMES[x]} disabled={checked !== null} data-testid="syl-tone" data-value={x}
              onClick={() => { setTone(x); audio.sfx('pop'); }}>
              <span className="tone-mark">{TONE_SYMBOLS[x]}</span><small>{TONE_MARK_NAMES[x]}</small>
            </button>
          ))}
        </div>
      )}

      <div className="tpl-footer">
        <p className={`tpl-feedback ${checked === null ? '' : checked ? 'correct' : 'wrong'}`} role="status" data-testid="tpl-feedback">
          {checked === null ? ' ' : `${checked ? t.correct : `${t.wrong} ${t.answerWas}: ${item.word}.`} ${t.spelling}: ${spellOut(item.word, northernOnsetName)}`}
        </p>
        {checked === null
          ? <button type="button" className="primary-button" disabled={!complete} onClick={check} data-testid="syl-check">{t.check}</button>
          : <button type="button" className="primary-button" onClick={next} data-testid="quiz-next">{index + 1 < order.length ? `${t.next} →` : t.finish}</button>}
      </div>
    </div>
  );
}
