'use client';

import { useMemo, useState } from 'react';
import { shuffle } from '@happyclass/game-core/rng';
import type { SentenceOrderData } from '@happyclass/game-core/templates';
import { endPunctuation, scrambleChunks, sentenceChunks, sentenceCorrect } from '@happyclass/game-core/vi';
import { PictureView } from '../picture';
import type { TemplateProps } from '../shell/types';

/** Sắp xếp câu: chạm các mảnh theo thứ tự; chạm mảnh đã xếp để trả lại. */
export function SentenceOrderTemplate({ data, t, rng, audio, onProgress, onFinish }: TemplateProps<SentenceOrderData>) {
  const order = useMemo(() => shuffle(data.items, rng), [data.items, rng]);
  const [index, setIndex] = useState(0);
  const item = order[index];
  const bank = useMemo(() => scrambleChunks(sentenceChunks(item), rng), [item, rng]);
  const [chosen, setChosen] = useState<number[]>([]); // chỉ số trong bank
  const [checked, setChecked] = useState<null | boolean>(null);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const punct = endPunctuation(item.sentence);
  const complete = chosen.length === bank.length;

  function add(i: number) {
    if (checked !== null || chosen.includes(i)) return;
    setChosen([...chosen, i]);
    audio.sfx('pop');
  }
  function remove(pos: number) {
    if (checked !== null) return;
    setChosen(chosen.filter((_, p) => p !== pos));
  }

  function check() {
    if (!complete || checked !== null) return;
    const ok = sentenceCorrect(item, chosen.map((i) => bank[i]));
    setChecked(ok);
    audio.say(item.say ?? item.sentence);
    if (ok) { setScore(score + 1); onProgress({ score: score + 1, mistakes }); audio.sfx('correct'); }
    else { setMistakes(mistakes + 1); onProgress({ score, mistakes: mistakes + 1 }); audio.sfx('wrong'); }
  }

  function next() {
    if (index + 1 < order.length) { setChosen([]); setChecked(null); setIndex(index + 1); }
    else onFinish({ score, maxScore: order.length, mistakes });
  }

  return (
    <div className="tpl tpl-sentence" data-item-id={item.id}>
      <p className="tpl-sub">{t.item} {index + 1} {t.of} {order.length} — {t.orderWords}</p>
      {(item.picture || item.say) && (
        <div className="spell-clue">
          {item.picture && <PictureView picture={item.picture} size={80} />}
          {item.say && <button type="button" className="icon-button" aria-label={t.listen} onClick={() => audio.say(item.say!)}>🔊</button>}
        </div>
      )}
      <div className={`sentence-line ${checked === null ? '' : checked ? 'right' : 'wrong'}`} data-testid="sentence-line">
        {chosen.map((i, pos) => (
          <button key={`${i}-${pos}`} type="button" className="chunk placed" onClick={() => remove(pos)} disabled={checked !== null} data-testid="sentence-placed">{bank[i]}</button>
        ))}
        {!complete && <span className="chunk-gap" aria-hidden="true">…</span>}
        {punct && <span className="sentence-punct">{punct}</span>}
      </div>
      <div className="sentence-bank">
        {bank.map((c, i) => (
          <button key={i} type="button" className="chunk" disabled={checked !== null || chosen.includes(i)} onClick={() => add(i)} data-testid="sentence-chunk" data-chunk={c}>
            {c}
          </button>
        ))}
      </div>
      <div className="tpl-footer">
        <p className={`tpl-feedback ${checked === null ? '' : checked ? 'correct' : 'wrong'}`} role="status" data-testid="tpl-feedback">
          {checked === null ? ' ' : checked ? t.correct : `${t.wrong} ${t.answerWas}: ${item.sentence}`}
        </p>
        {checked === null ? (
          <>
            <button type="button" className="secondary-button" onClick={() => setChosen([])} disabled={!chosen.length}>{t.clear}</button>
            <button type="button" className="primary-button" disabled={!complete} onClick={check} data-testid="sentence-check">{t.check}</button>
          </>
        ) : (
          <button type="button" className="primary-button" onClick={next} data-testid="quiz-next">{index + 1 < order.length ? `${t.next} →` : t.finish}</button>
        )}
      </div>
    </div>
  );
}
