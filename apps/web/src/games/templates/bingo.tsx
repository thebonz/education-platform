'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { callOrder, completedLines, generateBoard, isBingo } from '@happyclass/game-core/bingo';
import { createRng } from '@happyclass/game-core/rng';
import type { BingoData } from '@happyclass/game-core/templates';
import type { TemplateProps } from '../shell/types';
import { FeedbackLine, useFeedback } from './feedback';

/**
 * HappyClass Bingo Carnival: một bộ mục trong Game Builder dùng được cho nhiều
 * kích thước và mục tiêu, nhưng không mở khóa tài nguyên ngoài quyền của game.
 * Thiết kế/luật trình bày độc lập, không sao chép thành phần của website tham khảo.
 */
export function BingoTemplate({ data, lang, t, rng, audio, onProgress, onFinish }: TemplateProps<BingoData>) {
  const isVi = lang === 'vi';
  const byId = useMemo(() => new Map(data.items.map((item) => [item.id, item])), [data.items]);
  const availableSizes = [3, 4, 5].filter((size) => size * size <= data.items.length);
  const [size, setSize] = useState<number>(data.boardSize);
  const [win, setWin] = useState<'line' | 'full'>(data.win);
  const [deal, setDeal] = useState(0);
  const baseSeed = useMemo(() => Math.floor(rng() * 0x100000000), [rng]);
  const { board, calls } = useMemo(() => {
    const dealRng = createRng(`bingo-${baseSeed}-${size}-${deal}`);
    const generated = generateBoard(data.items.map((item) => item.id), size, dealRng);
    return { board: generated, calls: callOrder(generated, dealRng) };
  }, [data.items, size, deal, baseSeed]);

  const [callIndex, setCallIndex] = useState(0);
  const [marked, setMarked] = useState<Set<number>>(() => new Set());
  const [mistakes, setMistakes] = useState(0);
  const [showClue, setShowClue] = useState(data.showCallText);
  const [shake, setShake] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { feedback, show } = useFeedback();

  const current = byId.get(calls[callIndex])!;
  const lines = completedLines(board, marked);
  const lineCells = new Set(lines.flat());
  const goal = win === 'full' ? board.cells.length : board.size;
  const progress = win === 'full' ? marked.size : Math.max(
    0, ...Array.from({ length: board.size * 2 + 2 }, (_, line) => {
      if (line < board.size) return Array.from({ length: board.size }, (_, col) => line * board.size + col)
        .filter((cell) => marked.has(cell)).length;
      if (line < board.size * 2) return Array.from({ length: board.size }, (_, row) =>
        row * board.size + line - board.size).filter((cell) => marked.has(cell)).length;
      return Array.from({ length: board.size }, (_, index) =>
        index * board.size + (line === board.size * 2 ? index : board.size - 1 - index))
        .filter((cell) => marked.has(cell)).length;
    }),
  );

  useEffect(() => {
    if (!done && current) audio.say(current.say ?? current.text);
  }, [audio, current, deal, done]); // Tự gọi mỗi khi đổi lượt hoặc trộn bảng.

  useEffect(() => () => {
    if (finishTimer.current) clearTimeout(finishTimer.current);
  }, []);

  function reset(nextSize: number, nextWin: 'line' | 'full', reshuffle = false) {
    if (done) return;
    setSize(nextSize);
    setWin(nextWin);
    setDeal((n) => reshuffle || nextSize === size ? n + 1 : n);
    setCallIndex(0);
    setMarked(new Set());
    setMistakes(0);
    setShake(null);
    show(null);
    onProgress({ score: 0, mistakes: 0 });
  }

  function tap(index: number) {
    if (done || marked.has(index)) return;
    if (board.cells[index] !== current.id) {
      const errors = mistakes + 1;
      setMistakes(errors);
      onProgress({ score: marked.size, mistakes: errors });
      setShake(index);
      window.setTimeout(() => setShake((previous) => previous === index ? null : previous), 400);
      audio.sfx('wrong');
      show({ kind: 'wrong', text: t.wrong });
      return;
    }
    const next = new Set(marked).add(index);
    setMarked(next);
    onProgress({ score: next.size, mistakes });
    audio.sfx('correct');
    if (isBingo(board, next, win)) {
      setDone(true);
      show({ kind: 'correct', text: t.bingo }, true);
      audio.sfx('win');
      finishTimer.current = setTimeout(() => onFinish({
        score: next.size, maxScore: next.size, mistakes,
      }), 1150);
      return;
    }
    show({ kind: 'correct', text: t.correct });
    setCallIndex((index) => Math.min(index + 1, calls.length - 1));
  }

  return (
    <div className="tpl tpl-bingo bingo-carnival" data-testid="bingo-carnival">
      <div className="bingo-festival-heading">
        <span className="bingo-star" aria-hidden="true">✦</span>
        <div>
          <span className="eyebrow">{isVi ? 'HỌC VUI MỖI NGÀY' : 'THE HAPPYCLASS PLAY PARADE'}</span>
          <h2>{isVi ? 'Lễ hội Bingo' : 'Bingo Carnival'} <span aria-hidden="true">🎈</span></h2>
          <p>{isVi ? 'Nghe, tìm đúng ô và tạo một hàng Bingo!' : 'Listen, find the match and make your winning line!'}</p>
        </div>
        <span className="bingo-star" aria-hidden="true">✧</span>
      </div>

      <div className="bingo-settings" role="group" aria-label={isVi ? 'Tùy chọn bảng Bingo' : 'Bingo board options'}>
        <label>{isVi ? 'Kích thước bảng' : 'Board size'}
          <select data-testid="bingo-size" value={size} disabled={done}
            onChange={(event) => reset(Number(event.target.value), win)}>
            {availableSizes.map((value) => <option key={value} value={value}>{value} × {value}</option>)}
          </select>
        </label>
        <label>{isVi ? 'Mục tiêu' : 'Winning goal'}
          <select data-testid="bingo-goal" value={win} disabled={done}
            onChange={(event) => reset(size, event.target.value as 'line' | 'full')}>
            <option value="line">{isVi ? 'Một hàng' : 'One line'}</option>
            <option value="full">{isVi ? 'Toàn bảng' : 'Full board'}</option>
          </select>
        </label>
        <button type="button" className="secondary-button" data-testid="bingo-new-card" disabled={done}
          onClick={() => reset(size, win, true)}>
          ↻ {isVi ? 'Trộn bảng mới' : 'New card'}
        </button>
      </div>

      <div className="bingo-play-layout">
        <div className="bingo-caller" data-testid="bingo-call" data-call-text={current.text}>
          <span className="bingo-caller-icon" aria-hidden="true">📣</span>
          <span className="caller-label">{t.bingoCall} · {callIndex + 1}/{calls.length}</span>
          <strong aria-live="polite" className={showClue ? '' : 'hidden-clue'}>
            {showClue ? current.text : '?'}
          </strong>
          <p className="bingo-caller-tip">
            {isVi ? 'Nghe kỹ và chạm đúng ô trên bảng.' : 'Listen carefully, then tap the matching tile.'}
          </p>
          <div className="caller-actions">
            <button type="button" className="secondary-button" data-testid="bingo-repeat" onClick={() => audio.say(current.say ?? current.text)}>
              🔊 {t.repeat}
            </button>
            <button type="button" className="secondary-button" onClick={() => setShowClue((value) => !value)}
              data-testid="toggle-clue">{showClue ? t.hideClue : t.showClue}</button>
          </div>
          <div className="bingo-progress-box">
            <div><b>{isVi ? 'Tiến độ' : 'Progress'}</b><span>{progress}/{goal}</span></div>
            <progress data-testid="bingo-progress" max={goal} value={progress} />
            <small>{win === 'line'
              ? (isVi ? 'Hoàn thành một hàng ngang, dọc hoặc chéo.' : 'Complete a row, column or diagonal.')
              : (isVi ? 'Đánh dấu đủ tất cả các ô.' : 'Mark every space on your board.')}</small>
          </div>
        </div>

        <div className="bingo-board-wrap">
          <div className="bingo-board-label">
            <span>✿ {isVi ? 'BẢNG CỦA BÉ' : 'YOUR LUCKY BOARD'}</span>
            <span>{marked.size}/{board.cells.length} ✓</span>
          </div>
          <div className="bingo-board" style={{ gridTemplateColumns: `repeat(${board.size}, minmax(0, 1fr))` }}>
            {board.cells.map((id, index) => (
              <button key={id} type="button" data-testid="bingo-cell" data-text={byId.get(id)!.text}
                className={`bingo-tile ${marked.has(index) ? 'marked' : ''} ${lineCells.has(index) ? 'in-line' : ''} ${shake === index ? 'shake' : ''}`}
                aria-pressed={marked.has(index)} disabled={done} onClick={() => tap(index)}>
                <span>{byId.get(id)!.text}</span>
                {marked.has(index) && <span className="bingo-stamp" aria-hidden="true">★</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
      {done && <div className="bingo-victory" role="status" data-testid="bingo-victory">
        <span aria-hidden="true">✨ 🏆 ✨</span>
        <strong>{t.bingo}</strong>
      </div>}
      <FeedbackLine feedback={feedback} />
    </div>
  );
}
