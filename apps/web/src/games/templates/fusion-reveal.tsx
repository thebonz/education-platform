'use client';

import { useId, useMemo, useState } from 'react';
import { sessionSelection } from '@happyclass/game-core/learning-session';
import type { FusionRevealData, Picture } from '@happyclass/game-core/templates';
import { PictureView } from '../picture';
import type { TemplateProps } from '../shell/types';

const SIDE = 580;
type FusionItem = FusionRevealData['items'][number];

function EncodedPicture({ picture, stripes }: { picture: Picture; stripes: number }) {
  const identifier = useId().replace(/:/g, '');
  const clipId = `fusion-clip-${identifier}`;
  const noiseId = `fusion-noise-${identifier}`;
  const step = SIDE / stripes;
  return (
    <svg className="fusion-pattern-svg" viewBox="0 0 580 580"
      xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label="Sheet A: striped picture with matching alignment marks">
      <defs>
        <clipPath id={clipId}>
          {Array.from({ length: stripes / 2 }, (_, index) => (
            <rect key={index} x={index * step * 2} y={0}
              width={step} height={SIDE} />
          ))}
        </clipPath>
        <pattern id={noiseId} width="15" height="15" patternUnits="userSpaceOnUse">
          <rect width="15" height="15" fill="#d4c5e5" />
          <path d="M-5 15L15 -5M0 20L20 0" stroke="#857398" strokeWidth="3" />
          <circle cx="7" cy="7" r="2" fill="#b08fc5" />
        </pattern>
      </defs>
      <rect width={SIDE} height={SIDE} fill="#fff8ec" />
      {Array.from({ length: stripes / 2 }, (_, index) => (
        <rect key={index} x={(index * 2 + 1) * step} width={step}
          height={SIDE} fill={`url(#${noiseId})`} />
      ))}
      <g clipPath={`url(#${clipId})`}>
        {picture.kind === 'image'
          ? <image href={picture.src} x="0" y="0" width={SIDE} height={SIDE} preserveAspectRatio="xMidYMid meet" />
          : <text x="290" y="350" fontSize="290" textAnchor="middle">{picture.value}</text>}
      </g>
      <rect x="2" y="2" width="576" height="576" fill="none" stroke="#36334b" strokeWidth="3" />
      <path d="M0 20h35M20 0v35M545 0v35M560 0v35M0 560h35M20 545v35M545 560h35M560 545v35"
        fill="none" stroke="#252335" strokeWidth="3" />
    </svg>
  );
}

function DecoderStencil({ stripes }: { stripes: number }) {
  const step = SIDE / stripes;
  return (
    <svg className="fusion-pattern-svg" viewBox="0 0 580 580"
      xmlns="http://www.w3.org/2000/svg" role="img"
      aria-label="Sheet B: transparent decoder with opaque stripes and alignment marks">
      {/* Print on clear film: only the dark alternating stripes receive ink. */}
      {Array.from({ length: stripes / 2 }, (_, index) => (
        <rect key={index} x={(index * 2 + 1) * step} width={step}
          height={SIDE} fill="#30293d" />
      ))}
      <rect x="2" y="2" width="576" height="576" fill="none" stroke="#20202f" strokeWidth="2" />
      <path d="M0 20h35M20 0v35M545 0v35M560 0v35M0 560h35M20 545v35M545 560h35M560 545v35"
        fill="none" stroke="#252335" strokeWidth="3" />
    </svg>
  );
}

/**
 * HappyClass Fusion Reveal: an independently authored two-sheet analogue
 * decoding exercise. A has alternating picture/noise bands; B is a clear
 * stencil bearing opaque stripes. Print at 145×145 mm and align its marks.
 * On-screen, the slider moves B over A. Only teacher-owned content is used.
 */
export function FusionRevealTemplate({
  data, lang, t, round, rng, audio, onProgress, onFinish,
}: TemplateProps<FusionRevealData>) {
  const cards = useMemo(
    () => sessionSelection(data.items, data.cardsPerRound, round, rng),
    [data.items, data.cardsPerRound, round, rng],
  );
  const [index, setIndex] = useState(0);
  const [slide, setSlide] = useState(0);
  const [hintVisible, setHintVisible] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [wrongChoice, setWrongChoice] = useState<string | null>(null);
  const current: FusionItem = cards[index];
  const score = index + Number(chosen === current.word);
  const solved = chosen === current.word;
  const aligned = slide >= 90;
  const gap = SIDE / data.stripeCount;
  const xOffset = gap * (1 - slide / 100);

  function answer(choice: string) {
    if (!aligned || solved) return;
    if (choice !== current.word) {
      setMistakes((count) => count + 1);
      setWrongChoice(choice);
      onProgress({ score: index, mistakes: mistakes + 1 });
      audio.sfx('wrong');
      return;
    }
    setChosen(choice);
    setWrongChoice(null);
    audio.sfx('correct');
    audio.say(current.say ?? current.word);
    onProgress({ score: index + 1, mistakes });
  }

  function next() {
    if (!solved) return;
    if (index + 1 === cards.length) {
      onFinish({ score: cards.length, maxScore: cards.length, mistakes });
      return;
    }
    setIndex((value) => value + 1);
    setSlide(0);
    setHintVisible(false);
    setWrongChoice(null);
    setChosen(null);
  }

  return (
    <section className="tpl tpl-fusion-reveal" data-testid="fusion-reveal">
      <header className="fusion-banner">
        <span aria-hidden="true">🔮</span>
        <div>
          <span className="eyebrow">HAPPYCLASS · ALIGN · REVEAL · GUESS</span>
          <h2>Fusion Reveal Cards</h2>
          <p>Slide your secret decoder until the two patterns line up, then guess the picture!</p>
        </div>
        <span aria-hidden="true">✧</span>
      </header>

      <div className="fusion-metrics" aria-live="polite">
        <strong data-testid="fusion-round">Card {index + 1}/{cards.length}</strong>
        <span>⭐ {score}/{cards.length}</span>
        <span>🔎 {aligned ? 'Patterns aligned!' : 'Find the matching marks'}</span>
      </div>

      <div className="fusion-workspace">
        <div className="fusion-art-panel">
          <div className="fusion-stage" data-testid="fusion-stage">
            <EncodedPicture picture={current.picture} stripes={data.stripeCount} />
            <div className="fusion-decoder-layer" style={{ transform: `translateX(${xOffset / SIDE * 100}%)` }}>
              <DecoderStencil stripes={data.stripeCount} />
            </div>
            {solved && <div className="fusion-revealed" data-testid="fusion-revealed">
              <PictureView picture={current.picture} size={220} />
              <b>{current.word}</b>
            </div>}
          </div>
          <label className="fusion-slider-label" htmlFor="fusion-align">
            🎚️ Slide decoder B to match the printed alignment marks
          </label>
          <input id="fusion-align" type="range" min={0} max={100} value={slide}
            data-testid="fusion-slider" disabled={solved}
            aria-label="Move the transparent decoder across the picture"
            onChange={(event) => setSlide(Number(event.target.value))} />
          <p className="fusion-align-hint" data-testid="fusion-aligned" role="status">
            {aligned ? '✅ A and B are aligned. Choose the word!' : '↔ Move the slider to the right to reveal the hidden shape.'}
          </p>
          <button type="button" className="secondary-button" data-testid="fusion-print"
            onClick={() => window.print()}>
            🖨️ Print sheets A + B (145 mm)
          </button>
          <p className="fusion-print-note">Teacher note: Print A on white paper and B on transparent film at 100% scale.
            Ordinary paper for B requires cutting out its clear stripes. Check alignment and printer margins.</p>
        </div>

        <div className="fusion-quiz-panel">
          <h3>What picture do you see?</h3>
          <p>Align the patterns first. Then choose the English word.</p>
          {current.hint && !solved && (
            <div className="fusion-hint">
              <button type="button" className="secondary-button" data-testid="fusion-hint"
                onClick={() => setHintVisible((show) => !show)}>💡 Hint</button>
              {hintVisible && <p>{current.hint}</p>}
            </div>
          )}
          <div className="fusion-choices" role="group" aria-label="Choose the hidden English word">
            {current.choices.map((choice, choiceIndex) => (
              <button type="button" key={choice} data-testid="fusion-choice"
                disabled={!aligned || solved}
                className={`choice ${wrongChoice === choice ? 'wrong' : ''} ${solved && choice === current.word ? 'right' : ''}`}
                onClick={() => answer(choice)}>
                <span>{'ABCD'[choiceIndex]}</span> {choice}
              </button>
            ))}
          </div>
          <p role="status" className={`tpl-feedback ${solved ? 'correct' : wrongChoice ? 'wrong' : ''}`}
            data-testid="fusion-feedback">
            {solved ? `Fantastic! You found ${current.word}!`
              : wrongChoice ? 'Not quite! Check the picture again.'
                : aligned ? 'The hidden picture is ready. Make your guess!' : 'Align A and B to unlock the answers.'}
          </p>
          {solved && <>
            <button type="button" className="secondary-button" onClick={() => audio.say(current.say ?? current.word)}>
              🔊 Listen
            </button>
            <button type="button" className="primary-button" data-testid="fusion-next" onClick={next}>
              {index + 1 < cards.length ? `${t.next} →` : t.finish}
            </button>
          </>}
        </div>
      </div>

      <div className="fusion-print-only" aria-hidden="true" data-testid="fusion-print-pages">
        <section className="fusion-print-page">
          <h2>HAPPYCLASS · FUSION REVEAL · SHEET A</h2>
          <p>Print on white paper, landscape A4, actual size. Use the corner marks for alignment.</p>
          <div className="fusion-print-square"><EncodedPicture picture={current.picture} stripes={data.stripeCount} /></div>
        </section>
        <section className="fusion-print-page">
          <h2>HAPPYCLASS · FUSION REVEAL · SHEET B</h2>
          <p>Print on transparent film at 100% / no scaling. The empty bands must remain transparent.</p>
          <div className="fusion-print-square"><DecoderStencil stripes={data.stripeCount} /></div>
        </section>
      </div>
    </section>
  );
}
