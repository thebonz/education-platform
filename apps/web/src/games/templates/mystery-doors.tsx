'use client';

import { useEffect, useMemo, useState } from 'react';
import { shuffle } from '@happyclass/game-core/rng';
import type { MysteryDoorsData } from '@happyclass/game-core/templates';
import { PictureView } from '../picture';
import type { TemplateProps } from '../shell/types';

/**
 * Mystery Doors: game gốc HappyClass. Mỗi cửa hé một phần bức tranh,
 * người học tự quyết định khi nào đã đủ dữ kiện để đoán từ.
 * Không sao chép đồ họa, luật chơi chi tiết hoặc câu hỏi từ website khác.
 */
export function MysteryDoorsTemplate({
  data, lang, t, rng, audio, onProgress, onFinish,
}: TemplateProps<MysteryDoorsData>) {
  const isVi = lang === 'vi';
  const [roundIndex, setRoundIndex] = useState(0);
  const [opened, setOpened] = useState<Set<number>>(() => new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [hintShown, setHintShown] = useState(false);
  const [score, setScore] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [finished, setFinished] = useState(false);

  const choices = useMemo(() => data.rounds.map((round) => shuffle(round.choices, rng)),
    [data.rounds, rng]);
  const current = data.rounds[roundIndex];
  const columns = data.doorCount === 4 ? 2 : data.doorCount === 8 ? 4 : 3;
  const rows = data.doorCount / columns;
  const answered = selected !== null;
  const correct = selected === current.answer;
  const revealedCount = answered ? data.doorCount : opened.size;

  useEffect(() => {
    if (!finished) audio.say(current.say ?? current.question);
  }, [audio, current, finished]);

  function reveal(index: number) {
    if (answered || finished || opened.has(index)) return;
    setOpened((prev) => new Set(prev).add(index));
    audio.sfx('pop');
  }

  function answer(value: string) {
    if (!opened.size || answered || finished) return;
    setSelected(value);
    const ok = value === current.answer;
    const nextScore = score + Number(ok);
    const nextMistakes = mistakes + Number(!ok);
    setScore(nextScore);
    setMistakes(nextMistakes);
    onProgress({ score: nextScore, mistakes: nextMistakes });
    audio.sfx(ok ? 'correct' : 'wrong');
    audio.say(current.answer);
  }

  function next() {
    if (!answered || finished) return;
    if (roundIndex === data.rounds.length - 1) {
      setFinished(true);
      onFinish({ score, maxScore: data.rounds.length, mistakes });
      return;
    }
    setRoundIndex((index) => index + 1);
    setOpened(new Set());
    setSelected(null);
    setHintShown(false);
  }

  return (
    <div className="tpl tpl-mystery" data-testid="mystery-doors">
      <header className="mystery-header">
        <span className="mystery-header-decor" aria-hidden="true">✿</span>
        <div><span className="eyebrow">{isVi ? 'KHÁM PHÁ VÀ ĐOÁN HÌNH' : 'LOOK · DISCOVER · GUESS'}</span>
          <h2>{isVi ? 'Ngôi nhà những cánh cửa bí mật' : 'The Little Mystery House'}</h2>
          <p>{isVi ? 'Mở vài cánh cửa để nhìn bức tranh, rồi đoán từ!' : 'Open a few doors, discover the picture and make a guess!'}</p>
        </div>
        <span className="mystery-header-decor" aria-hidden="true">✧</span>
      </header>

      <div className="mystery-status">
        <strong data-testid="mystery-round">{t.question} {roundIndex + 1}/{data.rounds.length}</strong>
        <span>⭐ {score}/{data.rounds.length}</span>
      </div>
      <div className="mystery-workspace">
        <div className="mystery-house">
          <div className="mystery-house-roof" aria-hidden="true">☁️　✦　☁️</div>
          <div className="mystery-stage" style={{ aspectRatio: `${columns} / ${rows}` }}>
            <div className="mystery-picture" role="img"
              aria-label={revealedCount > 0 ? current.answer : isVi ? 'Tranh đang bị che' : 'Hidden picture'}>
              <PictureView picture={current.picture} size={176} />
            </div>
            <div className="mystery-door-grid"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
              {Array.from({ length: data.doorCount }, (_, index) => (
                <button key={index} type="button" data-testid="mystery-door"
                  className={`mystery-door ${opened.has(index) || answered ? 'opened' : ''}`}
                  disabled={opened.has(index) || answered || finished}
                  aria-label={`${isVi ? 'Mở cửa' : 'Open door'} ${index + 1}`}
                  onClick={() => reveal(index)}>
                  <span aria-hidden="true">✿</span>
                  <span className="mystery-door-number">{index + 1}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="mystery-reveal-count" data-testid="mystery-opened" role="status">
            🔎 {isVi ? `Đã mở ${revealedCount}/${data.doorCount} cánh cửa`
              : `${revealedCount}/${data.doorCount} doors opened`}
          </p>
        </div>

        <div className="mystery-questions">
          <p className="mystery-kicker">{isVi ? 'THỬ TÀI QUAN SÁT' : 'YOUR LITTLE GUESSING QUEST'}</p>
          <h3 data-testid="mystery-question">{current.question}</h3>
          <button type="button" className="secondary-button mystery-listen"
            onClick={() => audio.say(current.say ?? current.question)}>🔊 {t.repeat}</button>
          <p className="mystery-tip">
            {isVi ? 'Hãy mở ít nhất một cánh cửa rồi chọn đáp án.' : 'Open at least one door, then choose an answer.'}
          </p>
          {current.hint && opened.size > 0 && !answered && (
            <>
              <button type="button" className="link-button" data-testid="mystery-hint"
                onClick={() => setHintShown(true)} disabled={hintShown}>💡 {t.hint}</button>
              {hintShown && <p className="mystery-hint-copy">{current.hint}</p>}
            </>
          )}
          <div className="mystery-choices">
            {choices[roundIndex].map((choice) => (
              <button type="button" key={choice} data-testid="mystery-option"
                className={`mystery-option ${answered && choice === current.answer ? 'right' : ''} ${selected === choice && !correct ? 'wrong' : ''}`}
                disabled={opened.size === 0 || answered || finished}
                onClick={() => answer(choice)}>{choice}</button>
            ))}
          </div>
          {answered && (
            <div className="mystery-answer" data-testid="mystery-feedback" role="status">
              <strong>{correct ? (isVi ? '✨ Giỏi lắm!' : '✨ Fantastic!') : t.wrong}</strong>
              <span>{t.answerWas}: {current.answer}</span>
              <button type="button" className="primary-button" data-testid="mystery-next" onClick={next}>
                {roundIndex === data.rounds.length - 1 ? t.finish : `${t.next} →`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
