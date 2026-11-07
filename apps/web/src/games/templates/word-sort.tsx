'use client';

import { useMemo, useState } from 'react';
import { shuffle } from '@happyclass/game-core/rng';
import type { WordSortData } from '@happyclass/game-core/templates';
import { PictureView } from '../picture';
import type { TemplateProps } from '../shell/types';

type Placed = { id: string; firstTry: boolean };

/** Xếp từ vào nhóm: từng thẻ hiện ra, trẻ chạm vào nhóm phù hợp. Sai thì được thử lại (tính lỗi). */
export function WordSortTemplate({ data, t, rng, audio, onProgress, onFinish }: TemplateProps<WordSortData>) {
  const order = useMemo(() => shuffle(data.items, rng), [data.items, rng]);
  const [index, setIndex] = useState(0);
  const [placed, setPlaced] = useState<Record<string, Placed[]>>({});
  const [missedCurrent, setMissedCurrent] = useState(false);
  const [wrongGroup, setWrongGroup] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'correct' | 'wrong'; text: string } | null>(null);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const item = order[index];
  const done = index >= order.length;

  function choose(groupId: string) {
    if (done) return;
    if (groupId !== item.group) {
      setMistakes(mistakes + 1);
      onProgress({ score, mistakes: mistakes + 1 });
      setMissedCurrent(true);
      setWrongGroup(groupId);
      window.setTimeout(() => setWrongGroup(null), 450);
      setMessage({ kind: 'wrong', text: item.explain ? `${t.wrong} ${item.explain}` : `${t.wrong} ${t.retry}` });
      audio.sfx('wrong');
      return;
    }
    const nextScore = missedCurrent ? score : score + 1;
    setScore(nextScore);
    onProgress({ score: nextScore, mistakes });
    setPlaced((p) => ({ ...p, [groupId]: [...(p[groupId] ?? []), { id: item.id, firstTry: !missedCurrent }] }));
    setMessage({ kind: 'correct', text: t.correct });
    setMissedCurrent(false);
    audio.sfx('correct');
    if (index + 1 >= order.length) {
      window.setTimeout(() => onFinish({ score: nextScore, maxScore: order.length, mistakes }), 700);
    }
    setIndex(index + 1);
  }

  const byId = useMemo(() => new Map(data.items.map((x) => [x.id, x])), [data.items]);

  return (
    <div className="tpl tpl-sort">
      <p className="tpl-sub">{Math.min(index + 1, order.length)} {t.of} {order.length} — {t.sortInto}</p>
      <div className="sort-current" aria-live="polite">
        {!done && (
          <button type="button" className="sort-card" data-testid="sort-card" data-item-id={item.id} onClick={() => audio.say(item.text)} aria-label={`${t.listen}: ${item.text}`}>
            {item.picture && <PictureView picture={item.picture} size={56} />}
            <span>{item.text}</span>
          </button>
        )}
      </div>
      <div className="sort-groups" style={{ gridTemplateColumns: `repeat(${data.groups.length}, minmax(0, 1fr))` }}>
        {data.groups.map((g) => (
          <div key={g.id} className={`sort-group ${wrongGroup === g.id ? 'shake' : ''}`}>
            <button type="button" className="choice sort-target" disabled={done} data-testid="sort-group" data-group={g.id} onClick={() => choose(g.id)}>
              {g.label}
              {g.hint && <small>{g.hint}</small>}
            </button>
            <ul className="sort-list">
              {(placed[g.id] ?? []).map((p) => (
                <li key={p.id} className={p.firstTry ? '' : 'retried'}>{byId.get(p.id)?.text}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className={`tpl-feedback ${message?.kind ?? ''}`} role="status" data-testid="tpl-feedback">{message?.text ?? ' '}</p>
    </div>
  );
}
