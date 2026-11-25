'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { sessionSelection } from '@happyclass/game-core/learning-session';
import { shuffle } from '@happyclass/game-core/rng';
import type { ShadowGuessData } from '@happyclass/game-core/templates';
import type { TemplateProps } from '../shell/types';
import { PictureView } from '../picture';

/** Original HappyClass silhouette guessing with dedicated transparent shape art.
 * No filters applied to opaque photo backgrounds (which would make black squares).
 */
export function ShadowGuessTemplate({ data, rng, round, audio, onProgress, onFinish }: TemplateProps<ShadowGuessData>) {
  const cards = useMemo(() => sessionSelection(data.items, data.wordsPerRound, round, rng)
    .map((item) => ({ ...item, choices: shuffle(item.choices, rng) })), [data.items, data.wordsPerRound, round, rng]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [hint, setHint] = useState(false);
  const [lost, setLost] = useState(false);
  const finished = useRef(false);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (finishTimer.current) clearTimeout(finishTimer.current); }, []);
  const current = cards[index];
  const correct = chosen === current.word;
  const revealed = correct || lost;

  function answer(choice: string) {
    if (revealed || finished.current) return;
    if (choice === current.word) {
      setChosen(choice);
      const next = score + 1;
      setScore(next);
      onProgress({ score: next, mistakes });
      audio.sfx('correct');
      audio.say(current.word);
      return;
    }
    const next = mistakes + 1;
    setMistakes(next);
    setChosen(null);
    audio.sfx('wrong');
    onProgress({ score, mistakes: next });
    if (next >= data.maxMistakes) {
      setLost(true);
      finished.current = true;
      finishTimer.current = setTimeout(() => onFinish({ score, maxScore: cards.length, mistakes: next }), 1000);
    }
  }

  function next() {
    if (!correct || finished.current) return;
    if (index + 1 === cards.length) {
      finished.current = true;
      onFinish({ score, maxScore: cards.length, mistakes });
    } else {
      setIndex((n) => n + 1);
      setHint(false);
      setChosen(null);
    }
  }

  return (
    <section className="tpl tpl-shadow-safari" data-testid="shadow-guess">
      <header className="shadow-banner"><span aria-hidden="true">🐾</span>
        <div><span className="eyebrow">HAPPYCLASS · LITTLE ANIMAL DETECTIVES</span><h2>Shadow Safari</h2>
          <p>Can you name the animal by its silhouette? Watch the colours appear!</p></div><span aria-hidden="true">✦</span></header>
      <div className="shadow-stats"><b data-testid="shadow-progress">⭐ {score}/{cards.length}</b>
        <span>Round {index + 1}/{cards.length}</span><span data-testid="shadow-mistakes">❤️ {Math.max(0, data.maxMistakes - mistakes)} lives</span>
        <span>📚 {data.items.length} animals</span></div>
      <div className="shadow-stage">
        <div className={revealed ? 'shadow-art revealed' : 'shadow-art'} data-testid="shadow-picture">
          <PictureView picture={revealed ? current.picture : current.silhouette} size={255} />
          <span className="shadow-art-label">{revealed ? current.word : 'WHO AM I?'}</span>
        </div>
        <div className="shadow-play">
          <div><span className="eyebrow">PICTURE {index + 1}</span><h3>Guess the shadow!</h3></div>
          {current.hint && !revealed && <div className="shadow-hint">
            <button type="button" className="secondary-button" data-testid="shadow-hint" onClick={() => setHint((v) => !v)}>💡 Hint</button>
            {hint && <p>{current.hint}</p>}
          </div>}
          <div className="shadow-options" role="group" aria-label="Choose the animal">
            {current.choices.map((choice, i) => (
              <button key={choice} type="button" data-testid="shadow-choice"
                className={`choice ${revealed && choice === current.word ? 'right' : ''}`}
                disabled={revealed} onClick={() => answer(choice)}><span>{'ABC'[i]}</span> {choice}</button>
            ))}
          </div>
          <p className={`tpl-feedback ${correct ? 'correct' : lost ? 'wrong' : ''}`} role="status" data-testid="shadow-feedback">
            {correct ? `Brilliant! It's a ${current.word}!` : lost ? `Let's try again! It was ${current.word}.` : 'Look carefully. Choose A, B or C.'}
          </p>
          {correct && <div className="shadow-next"><button type="button" className="secondary-button" onClick={() => audio.say(current.word)}>🔊 Hear the word</button>
            <button type="button" className="primary-button" data-testid="shadow-next" onClick={next}>
              {index + 1 === cards.length ? 'See results →' : 'Next animal →'}
            </button></div>}
        </div>
      </div>
    </section>
  );
}
