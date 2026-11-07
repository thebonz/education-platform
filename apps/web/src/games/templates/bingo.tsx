'use client';

import { useEffect, useMemo, useState } from 'react';
import { callOrder, completedLines, generateBoard, isBingo } from '@happyclass/game-core/bingo';
import type { BingoData } from '@happyclass/game-core/templates';
import type { TemplateProps } from '../shell/types';
import { FeedbackLine, useFeedback } from './feedback';

export function BingoTemplate({ data, t, rng, audio, onProgress, onFinish }: TemplateProps<BingoData>) {
  const byId = useMemo(() => new Map(data.items.map((i) => [i.id, i])), [data.items]);
  const { board, calls } = useMemo(() => {
    const b = generateBoard(data.items.map((i) => i.id), data.boardSize, rng);
    return { board: b, calls: callOrder(b, rng) };
  }, [data.items, data.boardSize, rng]);

  const [callIndex, setCallIndex] = useState(0);
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [mistakes, setMistakes] = useState(0);
  const [showClue, setShowClue] = useState(data.showCallText);
  const [shake, setShake] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const { feedback, show } = useFeedback();

  const current = byId.get(calls[callIndex])!;
  const announce = (item = current) => audio.say(item.say ?? item.text);
  useEffect(() => { if (!done) announce(); }, [callIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const lines = completedLines(board, marked);
  const lineCells = new Set(lines.flat());

  function tap(index: number) {
    if (done || marked.has(index)) return;
    if (board.cells[index] !== current.id) {
      setMistakes((m) => { onProgress({ score: marked.size, mistakes: m + 1 }); return m + 1; });
      setShake(index);
      window.setTimeout(() => setShake(null), 400);
      audio.sfx('wrong');
      show({ kind: 'wrong', text: t.wrong });
      return;
    }
    const next = new Set(marked).add(index);
    setMarked(next);
    onProgress({ score: next.size, mistakes });
    audio.sfx('correct');
    if (isBingo(board, next, data.win)) {
      setDone(true);
      show({ kind: 'correct', text: t.bingo }, true);
      window.setTimeout(() => onFinish({ score: next.size, maxScore: next.size, mistakes }), 1200);
      return;
    }
    show({ kind: 'correct', text: t.correct });
    setCallIndex((i) => Math.min(i + 1, calls.length - 1));
  }

  return (
    <div className="tpl tpl-bingo">
      <div className="bingo-caller" data-testid="bingo-call" data-call-text={current.text}>
        <span className="caller-label">{t.bingoCall} · {callIndex + 1}/{calls.length}</span>
        <strong className={showClue ? '' : 'hidden-clue'}>{showClue ? current.text : '?'}</strong>
        <div className="caller-actions">
          <button type="button" className="secondary-button" onClick={() => announce()}>🔊 {t.repeat}</button>
          <button type="button" className="secondary-button" onClick={() => setShowClue((v) => !v)} data-testid="toggle-clue">{showClue ? t.hideClue : t.showClue}</button>
        </div>
      </div>
      <div className="bingo-board" style={{ gridTemplateColumns: `repeat(${board.size}, 1fr)` }}>
        {board.cells.map((id, i) => (
          <button key={id} type="button" data-testid="bingo-cell" data-text={byId.get(id)!.text}
            className={`bingo-tile ${marked.has(i) ? 'marked' : ''} ${lineCells.has(i) ? 'in-line' : ''} ${shake === i ? 'shake' : ''}`}
            aria-pressed={marked.has(i)} onClick={() => tap(i)}>
            {byId.get(id)!.text}
          </button>
        ))}
      </div>
      <FeedbackLine feedback={feedback} />
    </div>
  );
}
