'use client';

import { useEffect, useState } from 'react';
import type { PicturePuzzleData } from '@happyclass/game-core/templates';
import type { GameAudio } from '../shell/audio';
import { PictureView } from '../picture';

type GalleryProps = {
  rounds: PicturePuzzleData['rounds'];
  lang: 'en' | 'vi';
  audio: GameAudio;
};

const SPEEDS = { slow: 2400, normal: 1500, fast: 850 } as const;
type Speed = keyof typeof SPEEDS;

/**
 * A teacher-friendly, independently designed 3D carousel for the existing
 * Picture Puzzle image bank. It is a visual introduction, NOT a graded game:
 * revealing/placing cards never calls onProgress or onFinish.
 */
export function PuzzleRingGallery({ rounds, lang, audio }: GalleryProps) {
  const isVi = lang === 'vi';
  const [focused, setFocused] = useState(0);
  const [placed, setPlaced] = useState<string[]>([]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>('normal');
  const current = rounds[focused];
  const allPlaced = placed.length === rounds.length;

  useEffect(() => {
    if (!playing || rounds.length < 2) return;
    const timer = window.setInterval(() => {
      setFocused((index) => (index + 1) % rounds.length);
    }, SPEEDS[speed]);
    return () => window.clearInterval(timer);
  }, [playing, rounds.length, speed]);

  function move(step: number) {
    setFocused((index) => (index + step + rounds.length) % rounds.length);
  }

  function placeOne() {
    // Always advance to an unplaced picture: repeatedly pressing Place 1
    // reveals the entire library without counting one picture twice.
    const target = !placed.includes(current.id)
      ? focused : rounds.findIndex((picture) => !placed.includes(picture.id));
    if (target < 0) return;
    const item = rounds[target];
    setPlaced((prev) => [...prev, item.id]);
    setFocused((target + 1) % rounds.length);
    audio.sfx('pop');
    audio.say(item.say ?? item.label);
    if (placed.length + 1 === rounds.length) setPlaying(false);
  }

  function placeAll() {
    setPlaced(rounds.map((picture) => picture.id));
    setPlaying(false);
    audio.sfx('correct');
  }

  return (
    <section className="puzzle-ring-gallery" data-testid="puzzle-ring-gallery"
      aria-label={isVi ? 'Thư viện tranh vòng xoay' : 'Picture carousel gallery'}>
      <div className="puzzle-ring-intro">
        <h3>{isVi ? 'Vòng xoay khám phá tranh' : 'Picture Discovery Ring'}</h3>
        <p>{isVi
          ? 'Khám phá tranh và nghe tên trước khi ghép hình. Hoạt động này không tính điểm.'
          : 'Explore the pictures and hear each word before solving the puzzle. This showcase does not award points.'}</p>
      </div>
      <div className="puzzle-ring-controls" role="group"
        aria-label={isVi ? 'Điều khiển vòng xoay' : 'Carousel controls'}>
        <button type="button" className="secondary-button" data-testid="ring-previous"
          onClick={() => move(-1)} aria-label={isVi ? 'Tranh trước' : 'Previous picture'}>←</button>
        <button type="button" className="secondary-button" data-testid="ring-play"
          aria-pressed={playing} onClick={() => setPlaying((value) => !value)}>
          {playing ? (isVi ? '⏸ Tạm dừng' : '⏸ Pause') : (isVi ? '▶ Tự xoay' : '▶ Auto spin')}
        </button>
        <label className="puzzle-ring-speed">
          {isVi ? 'Tốc độ' : 'Speed'}
          <select data-testid="ring-speed" value={speed}
            onChange={(event) => setSpeed(event.target.value as Speed)}>
            <option value="slow">{isVi ? 'Chậm' : 'Slow'}</option>
            <option value="normal">{isVi ? 'Vừa' : 'Normal'}</option>
            <option value="fast">{isVi ? 'Nhanh' : 'Fast'}</option>
          </select>
        </label>
        <button type="button" className="secondary-button" data-testid="ring-next"
          onClick={() => move(1)} aria-label={isVi ? 'Tranh tiếp' : 'Next picture'}>→</button>
      </div>

      <div className="puzzle-ring-viewport" data-testid="ring-viewport" role="group"
        aria-label={isVi ? 'Chọn tranh' : 'Choose a picture'}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
          if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
        }}>
        {rounds.map((picture, index) => {
          const forward = (index - focused + rounds.length) % rounds.length;
          const offset = forward > rounds.length / 2 ? forward - rounds.length : forward;
          const visible = Math.abs(offset) <= 2;
          return (
            <button key={picture.id} type="button" data-testid="ring-card"
              data-image-id={picture.id} data-focused={focused === index ? 'true' : 'false'}
              className={`puzzle-ring-card ${focused === index ? 'is-focused' : ''}`}
              aria-label={picture.label} aria-pressed={focused === index}
              aria-hidden={!visible} tabIndex={visible ? 0 : -1}
              style={{
                transform: `translateX(${offset * 92}px) translateZ(${-Math.abs(offset) * 94}px) rotateY(${offset * -23}deg)`,
                zIndex: rounds.length - Math.abs(offset),
                opacity: visible ? 1 : 0,
                pointerEvents: visible ? 'auto' : 'none',
              }}
              onClick={() => {
                setFocused(index);
                audio.say(picture.say ?? picture.label);
              }}>
              <PictureView picture={picture.picture} size={150} />
              <strong>{picture.label}</strong>
            </button>
          );
        })}
      </div>
      <div className="puzzle-ring-current" aria-live="polite">
        {focused + 1}/{rounds.length} · <strong>{current.label}</strong>
        <button type="button" data-testid="ring-listen" className="secondary-button"
          onClick={() => audio.say(current.say ?? current.label)}>
          🔊 {isVi ? 'Nghe từ' : 'Listen'}
        </button>
      </div>
      <div className="puzzle-ring-actions">
        <button type="button" className="primary-button" data-testid="ring-place-one"
          disabled={allPlaced} onClick={placeOne}>
          {isVi ? 'Đưa 1 tranh lên bảng' : 'Place 1'}
        </button>
        <button type="button" className="secondary-button" data-testid="ring-place-all"
          disabled={allPlaced} onClick={placeAll}>
          {isVi ? 'Hiện tất cả' : 'Place all'}
        </button>
        <button type="button" className="secondary-button" data-testid="ring-reset"
          disabled={placed.length === 0} onClick={() => setPlaced([])}>
          {isVi ? 'Xóa bảng' : 'Clear board'}
        </button>
      </div>
      <p className="puzzle-ring-count" data-testid="ring-placed-count" role="status">
        {isVi ? 'Đã khám phá' : 'Pictures placed'}: {placed.length}/{rounds.length}
      </p>
      <div className="puzzle-ring-display" data-testid="ring-placed-board">
        {placed.length === 0 && <p>{isVi ? 'Hãy chọn Place 1 để bắt đầu!' : 'Press Place 1 to start your picture gallery!'}</p>}
        {placed.map((id) => {
          const picture = rounds.find((item) => item.id === id)!;
          return (
            <div className="puzzle-ring-placed-card" data-testid="ring-placed-card" key={picture.id}>
              <PictureView picture={picture.picture} size={115} />
              <span>{picture.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
