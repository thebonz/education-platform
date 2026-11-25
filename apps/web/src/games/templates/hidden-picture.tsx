'use client';

import { useEffect, useMemo, useState } from 'react';
import { shuffle } from '@happyclass/game-core/rng';
import { sessionSelection } from '@happyclass/game-core/learning-session';
import type { HiddenPictureData } from '@happyclass/game-core/templates';
import { PictureView } from '../picture';
import type { TemplateProps } from '../shell/types';

export function HiddenPictureTemplate({ data, t, rng, round, audio, onProgress, onFinish }: TemplateProps<HiddenPictureData>) {
  const questions = useMemo(
    () => sessionSelection(data.questions, data.questionsPerRound ?? data.questions.length, round, rng),
    [data.questions, data.questionsPerRound, round, rng],
  );
  const total = questions.length;
  const scenes = data.scenes?.length ? data.scenes :
    [{ picture: data.picture, answer: data.pictureAnswer, choices: data.pictureChoices }];
  const scene = scenes[(round - 1) % scenes.length];
  const cols = Math.ceil(Math.sqrt(total));
  const rows = Math.ceil(total / cols);
  const tileOrder = useMemo(() => shuffle(Array.from({ length: total }, (_, i) => i), rng), [total, rng]);
  const guessChoices = useMemo(() => shuffle(scene.choices, rng), [scene.choices, rng]);

  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [guessing, setGuessing] = useState(false);
  const [guess, setGuess] = useState<string | null>(null);

  const q = questions[index];
  useEffect(() => { if (!guessing) audio.say(q.say ?? q.prompt); }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  function answer(choice: string) {
    if (chosen) return;
    setChosen(choice);
    if (choice === q.answer) {
      setRevealed((r) => new Set(r).add(tileOrder[index]));
      setScore(score + 1);
      onProgress({ score: score + 1, mistakes });
      audio.sfx('pop');
    } else {
      setMistakes(mistakes + 1);
      onProgress({ score, mistakes: mistakes + 1 });
      audio.sfx('wrong');
    }
  }

  function next() {
    setChosen(null);
    if (index + 1 < total) setIndex(index + 1);
    else { setGuessing(true); audio.say(t.hiddenGuess); }
  }

  function finalGuess(choice: string) {
    if (guess) return;
    setGuess(choice);
    const ok = choice === scene.answer;
    const finalScore = score + (ok ? 1 : 0);
    const finalMistakes = mistakes + (ok ? 0 : 1);
    setRevealed(new Set(tileOrder));
    onProgress({ score: finalScore, mistakes: finalMistakes });
    audio.sfx(ok ? 'win' : 'wrong');
    audio.say(scene.answer);
    window.setTimeout(() => onFinish({ score: finalScore, maxScore: total + 1, mistakes: finalMistakes }), 1800);
  }

  return (
    <div className="tpl tpl-hidden">
      <div className="hidden-frame" style={{ aspectRatio: `${cols} / ${rows}` }}>
        <div className="hidden-picture"><PictureView picture={scene.picture} size={300} /></div>
        <div className="hidden-tiles" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
          {Array.from({ length: cols * rows }, (_, i) => (
            <span key={i} className={`hidden-tile ${revealed.has(i) || i >= total ? 'gone' : ''}`} data-testid="hidden-tile">{i < total ? i + 1 : ''}</span>
          ))}
        </div>
      </div>

      {(data.scenes?.length || data.questions.length > total) && (
        <p className="learning-bank-note" data-testid="hidden-scene-library">
          🖼️ {scenes.length} illustrated pictures · {total} questions this round · Play again for a new surprise!
        </p>
      )}
      {!guessing ? (
        <>
          <p className="tpl-sub">{t.question} {index + 1} {t.of} {total}</p>
          <h3 className="quiz-prompt" data-testid="quiz-prompt">{q.prompt}</h3>
          <div className="choice-grid">
            {q.choices.map((c) => (
              <button key={c} type="button" disabled={!!chosen} className={`choice ${chosen && c === q.answer ? 'right' : ''} ${chosen === c && c !== q.answer ? 'wrong' : ''}`} onClick={() => answer(c)}>{c}</button>
            ))}
          </div>
          <div className="tpl-footer">
            <p className={`tpl-feedback ${chosen ? (chosen === q.answer ? 'correct' : 'wrong') : ''}`} role="status" data-testid="tpl-feedback">
              {chosen ? (chosen === q.answer ? t.correct : `${t.wrong} ${t.answerWas}: ${q.answer}`) : ' '}
            </p>
            {chosen && <button type="button" className="primary-button" onClick={next} data-testid="quiz-next">{t.next} →</button>}
          </div>
        </>
      ) : (
        <>
          <h3 className="quiz-prompt" data-testid="hidden-guess">{t.hiddenGuess}</h3>
          <div className="choice-grid">
            {guessChoices.map((c) => (
              <button key={c} type="button" disabled={!!guess} className={`choice ${guess && c === scene.answer ? 'right' : ''} ${guess === c && c !== scene.answer ? 'wrong' : ''}`} onClick={() => finalGuess(c)}>{c}</button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
