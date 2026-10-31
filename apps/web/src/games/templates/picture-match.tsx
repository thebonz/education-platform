'use client';

import { useEffect, useMemo, useState } from 'react';
import { shuffle } from '@happyclass/game-core/rng';
import type { PictureMatchData } from '@happyclass/game-core/templates';
import { PictureView } from '../picture';
import type { TemplateProps } from '../shell/types';
import { FeedbackLine, useFeedback } from './feedback';

type Pick = { side: 'word' | 'picture'; id: string } | null;

export function PictureMatchTemplate({ data, t, rng, audio, onProgress, onFinish }: TemplateProps<PictureMatchData>) {
  const words = useMemo(() => shuffle(data.pairs, rng), [data.pairs, rng]);
  const pictures = useMemo(() => shuffle(data.pairs, rng), [data.pairs, rng]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [pick, setPick] = useState<Pick>(null);
  const [wrong, setWrong] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(data.timeLimitSec);
  const { feedback, show } = useFeedback();

  useEffect(() => {
    if (!data.timeLimitSec) return;
    const id = window.setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearInterval(id);
  }, [data.timeLimitSec]);
  useEffect(() => {
    if (data.timeLimitSec && secondsLeft <= 0) onFinish({ score: matched.size, maxScore: data.pairs.length, mistakes });
  }, [secondsLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  function choose(side: 'word' | 'picture', id: string) {
    if (matched.has(id)) return;
    if (side === 'word') audio.say(data.pairs.find((p) => p.id === id)!.say ?? data.pairs.find((p) => p.id === id)!.word);
    if (!pick || pick.side === side) { setPick({ side, id }); return; }
    if (pick.id === id) {
      const next = new Set(matched).add(id);
      setMatched(next);
      setPick(null);
      onProgress({ score: next.size, mistakes });
      audio.sfx('correct');
      show({ kind: 'correct', text: t.correct });
      if (next.size === data.pairs.length) window.setTimeout(() => onFinish({ score: next.size, maxScore: data.pairs.length, mistakes }), 700);
      return;
    }
    const m = mistakes + 1;
    setMistakes(m);
    onProgress({ score: matched.size, mistakes: m });
    setWrong(id);
    window.setTimeout(() => setWrong(null), 450);
    setPick(null);
    audio.sfx('wrong');
    show({ kind: 'wrong', text: t.wrong });
  }

  const cls = (side: 'word' | 'picture', id: string) =>
    `match-card ${matched.has(id) ? 'matched' : ''} ${pick?.side === side && pick.id === id ? 'picked' : ''} ${wrong === id ? 'shake' : ''}`;

  return (
    <div className="tpl tpl-match">
      <p className="tpl-sub">{t.matched} {matched.size}/{data.pairs.length}{data.timeLimitSec ? ` · ⏳ ${Math.max(0, secondsLeft)}s` : ''} — {t.pickWord}</p>
      <div className="match-columns">
        <div className="match-col">
          {words.map((p) => (
            <button key={p.id} type="button" className={cls('word', p.id)} disabled={matched.has(p.id)} data-testid="match-word" data-id={p.id} onClick={() => choose('word', p.id)}>{p.word}</button>
          ))}
        </div>
        <div className="match-col">
          {pictures.map((p) => (
            <button key={p.id} type="button" className={cls('picture', p.id)} disabled={matched.has(p.id)} data-testid="match-picture" data-id={p.id} aria-label={matched.has(p.id) ? p.word : undefined} onClick={() => choose('picture', p.id)}>
              <PictureView picture={p.picture} size={52} />
            </button>
          ))}
        </div>
      </div>
      <FeedbackLine feedback={feedback} />
    </div>
  );
}
