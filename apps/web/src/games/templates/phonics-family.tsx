'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { sessionSelection } from '@happyclass/game-core/learning-session';
import { shuffle } from '@happyclass/game-core/rng';
import type { PhonicsFamilyData } from '@happyclass/game-core/templates';
import type { TemplateProps } from '../shell/types';
import { PictureView } from '../picture';

/** Original HappyClass phonics: selectable picture cards + three word-family nests.
 * Supports click/tap (mobile, keyboard) and drag/drop (desktop).
 * Audio plays complete words only: not a claim of phoneme-specific pronunciation.
 */
export function PhonicsFamilyTemplate({ data, round, rng, audio, onProgress, onFinish }: TemplateProps<PhonicsFamilyData>) {
  const all = useMemo(() => data.families.flatMap((family) => family.words.map((word) =>
    ({ ...word, familyId: family.id, ending: family.ending }))), [data.families]);
  const cards = useMemo(() => sessionSelection(all, data.wordsPerRound, round, rng),
    [all, data.wordsPerRound, round, rng]);
  const displayFamilies = useMemo(() => shuffle(data.families, rng), [data.families, rng]);
  const [picked, setPicked] = useState<string | null>(null);
  const [placed, setPlaced] = useState<Set<string>>(() => new Set());
  const [mistakes, setMistakes] = useState(0);
  const [lost, setLost] = useState(false);
  const [feedback, setFeedback] = useState('');
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completed = placed.size === cards.length;
  const ended = completed || lost;
  useEffect(() => () => { if (finishTimer.current) clearTimeout(finishTimer.current); }, []);

  function pick(id: string) {
    if (ended || placed.has(id)) return;
    const word = cards.find((x) => x.id === id);
    if (!word) return;
    setPicked(id);
    setFeedback('');
    audio.say(word.say ?? word.word);
  }

  function place(familyId: string, wordId = picked) {
    if (!wordId || ended || placed.has(wordId)) return;
    const word = cards.find((x) => x.id === wordId);
    if (!word) return;
    setPicked(wordId);
    if (word.familyId !== familyId) {
      const count = mistakes + 1;
      setMistakes(count);
      onProgress({ score: placed.size, mistakes: count });
      audio.sfx('wrong');
      if (count >= data.maxMistakes) {
        setLost(true);
        setFeedback('No hearts left! Play again to discover more word families.');
        if (!finishTimer.current) {
          finishTimer.current = setTimeout(() => onFinish({
            score: placed.size, maxScore: cards.length, mistakes: count,
          }), 900);
        }
      } else {
        setFeedback('Try another word family. Listen once more!');
      }
      return;
    }
    const next = new Set(placed).add(wordId);
    setPlaced(next);
    setPicked(null);
    setFeedback(`Wonderful! ${word.word} belongs to –${word.ending}.`);
    audio.sfx('correct');
    onProgress({ score: next.size, mistakes });
    if (next.size === cards.length) {
      finishTimer.current = setTimeout(() => onFinish({ score: next.size, maxScore: cards.length, mistakes }), 900);
    }
  }

  return (
    <section className="tpl tpl-phonics" data-testid="phonics-family">
      <header className="phonics-header">
        <span aria-hidden="true">🌟</span>
        <div><span className="eyebrow">HAPPYCLASS · LISTEN · MATCH · LEARN</span>
          <h2>The Sound Family Village</h2>
          <p>Tap a picture word, then its word-family house. You can also drag the card.</p>
        </div>
        <span aria-hidden="true">☁️</span>
      </header>
      <div className="phonics-metrics" aria-live="polite"><b data-testid="phonics-progress">⭐ {placed.size}/{cards.length}</b>
        <span>❤️ {Math.max(0, data.maxMistakes - mistakes)} lives · 📚 {all.length} words in the library</span></div>

      <div className="phonics-houses" role="group" aria-label="Word-family houses">
        {displayFamilies.map((family) => (
          <button key={family.id} type="button" data-testid="phonics-house" data-family={family.id}
            className={picked && cards.find((w) => w.id === picked)?.familyId === family.id ? 'phonics-house is-target' : 'phonics-house'}
            onClick={() => place(family.id)}
            disabled={ended}
            onDragOver={(event) => { if (!ended) event.preventDefault(); }}
            onDrop={(event) => { event.preventDefault(); place(family.id, event.dataTransfer.getData('text/plain')); }}>
            <span aria-hidden="true">🏡</span><strong>–{family.ending}</strong>
            <small>{cards.filter((w) => w.familyId === family.id && placed.has(w.id)).length}/{cards.filter((w) => w.familyId === family.id).length} found</small>
            <span className="phonics-found">
              {cards.filter((w) => w.familyId === family.id && placed.has(w.id)).map((w) => <em key={w.id}>{w.word}</em>)}
            </span>
          </button>
        ))}
      </div>

      <div className="phonics-deck" role="group" aria-label="Picture word cards">
        {cards.map((word) => (
          <button key={word.id} type="button" data-testid="phonics-word" data-word={word.word}
            aria-pressed={picked === word.id}
            draggable={!ended && !placed.has(word.id)}
            onDragStart={(event) => { event.dataTransfer.setData('text/plain', word.id); pick(word.id); }}
            onClick={() => pick(word.id)}
            disabled={ended || placed.has(word.id)}
            className={`phonics-word ${picked === word.id ? 'selected' : ''} ${placed.has(word.id) ? 'placed' : ''}`}>
            <PictureView picture={word.picture} size={100} />
            <b>{word.word}</b><span>{placed.has(word.id) ? '✓' : '🔊'}</span>
          </button>
        ))}
      </div>
      <div className="tpl-feedback" role="status" data-testid="phonics-feedback">{feedback || (picked ? 'Now tap the matching word-family house!' : 'Choose any picture to begin.')}</div>
      <div className="phonics-actions"><button className="secondary-button" type="button" onClick={() => {
        const active = cards.find((w) => w.id === picked); if (active) audio.say(active.say ?? active.word);
      }} disabled={!picked || ended}>🔊 Hear again</button>
      <p>{lost ? '💛 Great effort! Use Play again to practice with a new set.' : completed ? '✨ Your village is full of words!' : 'Find the same ending letters. Listen to each complete word.'}</p></div>
    </section>
  );
}
