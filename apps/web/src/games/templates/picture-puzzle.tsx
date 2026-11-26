'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createRng } from '@happyclass/game-core/rng';
import { sessionSelection } from '@happyclass/game-core/learning-session';
import { scrambledPuzzle, swapPuzzlePieces, isPuzzleSolved } from '@happyclass/game-core/picture-puzzle';
import type { PicturePuzzleData } from '@happyclass/game-core/templates';
import { PictureView } from '../picture';
import { PuzzleRingGallery } from './puzzle-ring-gallery';
import type { TemplateProps } from '../shell/types';

/**
 * HappyClass Picture Puzzle: original swap-two-pieces picture activity.
 * Works with teacher's own media images or built-in emoji. No copied artwork/assets.
 */
export function PicturePuzzleTemplate({
  data, lang, t, rng, round: sessionRound, audio, onProgress, onFinish,
}: TemplateProps<PicturePuzzleData>) {
  const isVi = lang === 'vi';
  const [mode, setMode] = useState<'puzzle' | 'ring'>('puzzle');
  const seed = useMemo(() => Math.floor(rng() * 0x100000000), [rng]);
  // Rotate real picture content on Play Again, not merely the tile order.
  // Existing teacher-authored packs without picturesPerRound still play every picture.
  const activeRounds = useMemo(() => data.picturesPerRound === undefined
    ? data.rounds
    : sessionSelection(data.rounds, data.picturesPerRound, sessionRound,
      createRng(`picture-bank-${seed}`)),
    [data.rounds, data.picturesPerRound, sessionRound, seed]);
  const decks = useMemo(() => activeRounds.map((item) =>
    scrambledPuzzle(data.size, createRng(`puzzle-${seed}-${item.id}`))),
    [activeRounds, data.size, seed]);
  const [index, setIndex] = useState(0);
  const [pieces, setPieces] = useState<number[]>(() => decks[0]);
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [peek, setPeek] = useState(false);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const round = activeRounds[index];

  useEffect(() => () => {
    if (peekTimer.current) clearTimeout(peekTimer.current);
  }, []);

  function swap(slot: number) {
    if (completed) return;
    if (selected === null) {
      setSelected(slot);
      audio.sfx('pop');
      return;
    }
    if (slot === selected) {
      setSelected(null);
      return;
    }
    const updated = swapPuzzlePieces(pieces, selected, slot);
    setPieces(updated);
    setSelected(null);
    setMoves((n) => n + 1);
    audio.sfx('pop');
    if (isPuzzleSolved(updated)) {
      setCompleted(true);
      setScore((prev) => prev + 1);
      onProgress({ score: score + 1, mistakes: 0 });
      audio.sfx('correct');
      audio.say(round.say ?? round.label);
    }
  }

  function showPreview() {
    if (completed) return;
    if (peekTimer.current) clearTimeout(peekTimer.current);
    setPeek(true);
    peekTimer.current = setTimeout(() => setPeek(false), 1200);
  }

  function next() {
    if (!completed) return;
    if (index + 1 === activeRounds.length) {
      onFinish({ score, maxScore: activeRounds.length, mistakes: 0 });
      return;
    }
    if (peekTimer.current) clearTimeout(peekTimer.current);
    setIndex((old) => old + 1);
    setPieces([...decks[index + 1]]);
    setSelected(null);
    setMoves(0);
    setCompleted(false);
    setPeek(false);
  }

  return (
    <div className="tpl tpl-picture-puzzle" data-testid="picture-puzzle">
      <div className="puzzle-mode-switch" role="group"
        aria-label={isVi ? 'Chọn hoạt động tranh' : 'Picture activity mode'}>
        <button type="button" data-testid="puzzle-swap-switch" aria-pressed={mode === 'puzzle'}
          onClick={() => setMode('puzzle')}>{isVi ? '🧩 Ghép hình' : '🧩 Solve puzzle'}</button>
        <button type="button" data-testid="puzzle-gallery-switch" aria-pressed={mode === 'ring'}
          onClick={() => setMode('ring')}>{isVi ? '🎠 Thư viện xoay 3D' : '🎠 3D Picture Ring'}</button>
      </div>
      {mode === 'ring' ? (
        <PuzzleRingGallery rounds={activeRounds} lang={lang} audio={audio} />
      ) : (<>
      <div className="puzzle-header">
        <span className="puzzle-spark" aria-hidden="true">✦</span>
        <div><span className="eyebrow">{isVi ? 'THẾ GIỚI GHÉP HÌNH' : 'PICTURE PUZZLE PLAYLAND'}</span>
          <h2>{isVi ? 'Ghép bức tranh vui' : 'Picture Puzzle Adventure'}</h2>
          <p>{isVi ? 'Chọn hai mảnh để đổi chỗ. Ghép thành bức tranh nhé!' : 'Pick two pieces to swap. Put the picture back together!'}</p></div>
        <span className="puzzle-spark" aria-hidden="true">✿</span>
      </div>

      <div className="puzzle-metrics">
        <span data-testid="puzzle-round">{isVi ? 'Tranh' : 'Picture'} {index + 1}/{activeRounds.length}</span>
        <span data-testid="puzzle-moves">{isVi ? 'Lượt đổi' : 'Moves'}: {moves}</span>
        <span>⭐ {score}/{activeRounds.length}</span>
      </div>

      <div className="puzzle-workspace">
        <div className="puzzle-board-panel">
          <div className="puzzle-board" role="group"
            aria-label={isVi ? 'Các mảnh ghép hình' : 'Picture puzzle pieces'}
            style={{ gridTemplateColumns: `repeat(${data.size}, minmax(0,1fr))` }}>
            {pieces.map((piece, slot) => {
              const row = Math.floor(piece / data.size);
              const col = piece % data.size;
              const complete = completed || peek;
              return (
                <button key={slot} type="button" data-testid="puzzle-piece" data-slot={slot}
                  data-piece={piece} disabled={completed}
                  aria-pressed={selected === slot}
                  aria-label={`${isVi ? 'Mảnh' : 'Piece'} ${slot + 1}`}
                  className={`puzzle-piece ${selected === slot ? 'selected' : ''} ${complete ? 'completed' : ''}`}
                  onClick={() => swap(slot)}>
                  <span className="puzzle-piece-crop" aria-hidden="true">
                    {round.picture.kind === 'image'
                      ? <span className="puzzle-tile-image" style={{
                          backgroundImage: `url(${JSON.stringify(round.picture.src)})`,
                          backgroundSize: `${data.size * 100}% ${data.size * 100}%`,
                          backgroundPosition: `${(col * 100) / (data.size - 1)}% ${(row * 100) / (data.size - 1)}%`,
                        }} />
                      : <span className="puzzle-tile-emoji" style={{
                          width: `${data.size * 100}%`, height: `${data.size * 100}%`,
                          left: `-${col * 100}%`, top: `-${row * 100}%`,
                        }}>{round.picture.value}</span>}
                  </span>
                  {!completed && <span className="puzzle-position">{slot + 1}</span>}
                </button>
              );
            })}
          </div>
          {completed && <div className="puzzle-complete" data-testid="puzzle-complete" role="status">
            ✨ {isVi ? 'Bé ghép đúng rồi!' : 'Picture complete!'} ✨
          </div>}
        </div>

        <div className="puzzle-side">
          <p className="puzzle-kicker">{isVi ? 'NHIỆM VỤ CỦA BÉ' : 'YOUR LITTLE CHALLENGE'}</p>
          <h3>{isVi ? 'Tìm đúng vị trí của các mảnh' : 'Find the correct place for every piece'}</h3>
          <p>{isVi ? 'Chạm mảnh thứ nhất, sau đó chạm mảnh muốn đổi chỗ.' : 'Tap the first piece, then tap the piece you want to swap with it.'}</p>
          <div className="puzzle-side-actions">
            <button type="button" className="secondary-button" data-testid="puzzle-peek"
              disabled={completed} onClick={showPreview}>👀 {isVi ? 'Xem gợi ý (1 giây)' : 'Quick peek (1 sec)'}</button>
            <button type="button" className="secondary-button"
              onClick={() => audio.say(round.say ?? round.label)}>🔊 {t.listen}</button>
          </div>
          {peek && !completed && <div className="puzzle-peek-card" data-testid="puzzle-peek-card">
            <PictureView picture={round.picture} size={160} />
          </div>}
          {completed && (
            <div className="puzzle-next-card" data-testid="puzzle-next-card">
              <h3>🌟 {round.label}</h3>
              <p>{isVi ? `Đã hoàn thành với ${moves} lượt đổi!` : `Completed in ${moves} swaps!`}</p>
              <button type="button" className="primary-button" data-testid="puzzle-next" onClick={next}>
                {index + 1 === activeRounds.length ? t.finish : `${t.next} →`}
              </button>
            </div>
          )}
        </div>
      </div>
      </>)}
    </div>
  );
}
