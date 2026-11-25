'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { sessionSelection } from '@happyclass/game-core/learning-session';
import { shuffle } from '@happyclass/game-core/rng';
import type { ClassroomExploreData } from '@happyclass/game-core/templates';
import type { TemplateProps } from '../shell/types';
import { PictureView } from '../picture';

/** HappyClass original interactive classroom: click illustrated objects, pick A/B/C,
 * hear the English word, earn a discovery star. No copied classroom layouts/assets.
 */
export function ClassroomExploreTemplate({ data, rng, round, audio, onProgress, onFinish }: TemplateProps<ClassroomExploreData>) {
  const items = useMemo(() => sessionSelection(data.items, data.wordsPerRound, round, rng)
    .map((item) => ({ ...item, choices: shuffle(item.choices, rng) })), [data.items, data.wordsPerRound, round, rng]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [found, setFound] = useState<Set<string>>(() => new Set());
  const [mistakes, setMistakes] = useState(0);
  const [wrongChoice, setWrongChoice] = useState<string | null>(null);
  const [hintShown, setHintShown] = useState(false);
  const [feedback, setFeedback] = useState('');
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (finishTimer.current) clearTimeout(finishTimer.current); }, []);

  const active = items.find((item) => item.id === activeId) ?? null;
  const completed = found.size === items.length;
  function select(id: string) {
    if (completed || found.has(id)) return;
    setActiveId(id);
    setWrongChoice(null);
    setHintShown(false);
    setFeedback('');
    const item = items.find((entry) => entry.id === id);
    if (item) audio.say(item.word);
  }
  function answer(choice: string) {
    if (!active || found.has(active.id) || completed) return;
    if (choice !== active.word) {
      const next = mistakes + 1;
      setMistakes(next);
      setWrongChoice(choice);
      setFeedback('Not quite. Try another answer!');
      audio.sfx('wrong');
      onProgress({ score: found.size, mistakes: next });
      return;
    }
    const next = new Set(found).add(active.id);
    setFound(next);
    setWrongChoice(null);
    setFeedback(`Amazing! You discovered ${active.word}!`);
    audio.say(active.word);
    audio.sfx('correct');
    onProgress({ score: next.size, mistakes });
    setActiveId(null);
    if (next.size === items.length)
      finishTimer.current = setTimeout(() => onFinish({ score: next.size, maxScore: items.length, mistakes }), 950);
  }
  const remaining = items.filter((item) => !found.has(item.id));

  return (
    <section className="tpl tpl-classroom-discovery" data-testid="classroom-explore">
      <header className="classroom-banner">
        <span aria-hidden="true">🎒</span><div><span className="eyebrow">HAPPYCLASS · LOOK · CHOOSE · SAY</span>
          <h2>Little Learning Classroom</h2>
          <p>Tap a glowing picture and pick the English word!</p></div><span aria-hidden="true">✦</span>
      </header>
      <div className="classroom-toolbar">
        <b data-testid="classroom-progress">⭐ {found.size}/{items.length} discovered</b>
        <span>📚 {data.items.length} pictures in this classroom</span>
        <button type="button" className="secondary-button" data-testid="classroom-surprise"
          disabled={completed || !remaining.length}
          onClick={() => select(remaining[Math.floor(rng() * remaining.length)].id)}>✨ Surprise me!</button>
      </div>
      <div className="classroom-scene" role="group" aria-label="Illustrated classroom items">
        <div className="classroom-chalkboard" aria-hidden="true">ABC ✦ 123</div>
        <div className="classroom-items">
          {items.map((item, i) => (
            <button type="button" key={item.id} data-testid="classroom-object" data-word={item.word}
              className={`classroom-object ${activeId === item.id ? 'active' : ''} ${found.has(item.id) ? 'found' : ''}`}
              onClick={() => select(item.id)} disabled={found.has(item.id)}
              aria-label={found.has(item.id) ? `Discovered ${item.word}` : `Explore classroom object ${i + 1}`}>
              <PictureView picture={item.picture} size={104} />
              <span>{found.has(item.id) ? `✓ ${item.word}` : `✧ ${i + 1}`}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="classroom-question-panel">
        {active ? <>
          <div className="classroom-question-hero">
            <PictureView picture={active.picture} size={125} />
            <div><span className="eyebrow">LOOK · CHOOSE · LEARN</span><h3>What is it?</h3>
              <button className="secondary-button" type="button" onClick={() => audio.say(active.word)}>🔊 Listen</button>
              {active.clue && <button className="link-button" type="button" data-testid="classroom-hint"
                onClick={() => setHintShown((b) => !b)}>💡 Hint</button>}
              {hintShown && active.clue && <p>{active.clue}</p>}</div>
          </div>
          <div className="classroom-answers">
            {active.choices.map((choice, index) => (
              <button type="button" key={choice} data-testid="classroom-answer"
                className={wrongChoice === choice ? 'choice wrong' : 'choice'}
                onClick={() => answer(choice)}>
                <b>{'ABC'[index]}</b> {choice}
              </button>
            ))}
          </div>
        </> : <div className="classroom-empty">
          <span aria-hidden="true">🌟</span><h3>{completed ? 'All objects discovered!' : 'What will you discover today?'}</h3>
          <p>{completed ? 'Well done! Play again to explore the other classroom objects.' : 'Choose a picture in the classroom or tap Surprise me!'}</p>
        </div>}
        <p className="tpl-feedback" role="status" data-testid="classroom-feedback">{feedback || ' '}</p>
      </div>
    </section>
  );
}
