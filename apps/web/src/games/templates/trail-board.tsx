'use client';

import { useMemo, useRef, useState } from 'react';
import { shuffle } from '@happyclass/game-core/rng';
import { rankTeams } from '@happyclass/game-core/scoring';
import type { TrailBoardData } from '@happyclass/game-core/templates';
import { PictureView } from '../picture';
import type { TemplateProps } from '../shell/types';

/**
 * Cơ chế riêng của HappyClass: tung xúc xắc → giải câu hỏi → tiến trên đường sao.
 * Các đội thay phiên, mọi lượt đều được hoàn thành. Xếp hạng theo vị trí,
 * điểm cá nhân tính theo đáp án đúng để lưu kết quả trong GameShell.
 * Không có dữ liệu hay asset sao chép từ website khác.
 */
export function TrailBoardTemplate({
  data, lang, t, rng, audio, settings, onProgress, onFinish,
}: TemplateProps<TrailBoardData>) {
  const teams = Math.max(2, Math.min(4, settings.teamCount || data.defaultTeams));
  const questions = useMemo(
    () => data.questions.map((q) => ({
      ...q,
      choices: data.shuffleChoices ? shuffle(q.choices, rng) : q.choices,
    })),
    [data.questions, data.shuffleChoices, rng],
  );

  const [index, setIndex] = useState(0);
  const [rolled, setRolled] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [positions, setPositions] = useState<number[]>(() => Array(teams).fill(0));
  const [correct, setCorrect] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const finished = useRef(false);

  const q = questions[index];
  const activeTeam = index % teams;
  const teamName = (i: number) => lang === 'vi' ? `Đội ${String.fromCharCode(65 + i)}` : `Team ${String.fromCharCode(65 + i)}`;
  const answered = selected !== null;
  const tiles = Array.from({ length: data.boardLength + 1 }, (_, pos) => pos);

  function rollDice() {
    if (rolled !== null || finished.current) return;
    const value = Math.min(data.diceSides, 1 + Math.floor(rng() * data.diceSides));
    setRolled(value);
    audio.sfx('pop');
    audio.say(q.say ?? q.prompt);
  }

  function choose(choice: string) {
    if (rolled === null || answered || finished.current) return;
    setSelected(choice);
    const ok = choice === q.answer;
    const points = correct + (ok ? 1 : 0);
    const errors = mistakes + (ok ? 0 : 1);
    setCorrect(points);
    setMistakes(errors);
    if (ok) {
      setPositions((previous) => previous.map((value, team) =>
        team === activeTeam ? Math.min(data.boardLength, value + rolled) : value));
    }
    audio.sfx(ok ? 'correct' : 'wrong');
    onProgress({ score: points, mistakes: errors });
  }

  function next() {
    if (!answered || finished.current) return;
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setRolled(null);
      setSelected(null);
      return;
    }
    finished.current = true;
    const summary = positions.map((position, i) => ({ name: teamName(i), score: position }));
    const ranked = rankTeams(summary);
    onFinish({
      score: correct, maxScore: questions.length, mistakes,
      summary: (
        <div className="trail-finish" data-testid="trail-finish">
          <h3>{ranked.tie ? t.tie : `🏆 ${t.winner}: ${ranked.winners[0].name}`}</h3>
          <ol>{[...summary].sort((a, b) => b.score - a.score).map((entry) => (
            <li key={entry.name}>{entry.name}: {entry.score}/{data.boardLength} {lang === 'vi' ? 'ô' : 'spaces'}</li>
          ))}</ol>
        </div>
      ),
    });
  }

  return (
    <div className="tpl tpl-trail" data-testid="trail-board">
      <div className="trail-banner">
        <span className="trail-banner-icon" aria-hidden="true">🌈</span>
        <div><span className="eyebrow">{lang === 'vi' ? 'CHUYẾN PHIÊU LƯU CỦA BÉ' : 'YOUR LITTLE ADVENTURE'}</span>
          <h2>{lang === 'vi' ? 'Đường đua ngôi sao' : 'Star Trail Adventure'}</h2>
          <p>{lang === 'vi' ? 'Trả lời đúng để giúp đội tiến lên!' : 'Answer correctly to move your team forward!'}</p>
        </div>
        <span className="trail-banner-icon" aria-hidden="true">⭐</span>
      </div>

      <div className="trail-team-row" aria-label={lang === 'vi' ? 'Vị trí các đội' : 'Team positions'}>
        {positions.map((position, team) => (
          <div key={team} className={`trail-team trail-team-${team} ${team === activeTeam ? 'active' : ''}`}
            data-testid={`trail-team-${team}`}>
            <span aria-hidden="true">●</span>
            <b>{teamName(team)}</b>
            <small>{position}/{data.boardLength}</small>
          </div>
        ))}
      </div>

      <div className="trail-grid" role="group" aria-label={lang === 'vi' ? 'Bàn chơi gồm các ô' : 'Board spaces'}>
        {tiles.map((tile) => (
          <div key={tile} className={`trail-tile ${tile === 0 ? 'start' : ''} ${tile === data.boardLength ? 'goal' : ''}`}
            aria-label={tile === 0 ? (lang === 'vi' ? 'Xuất phát' : 'Start') : tile === data.boardLength ? (lang === 'vi' ? 'Đích' : 'Finish') : `${lang === 'vi' ? 'Ô' : 'Space'} ${tile}`}>
            <span className="trail-tile-number">{tile === 0 ? '🏁' : tile === data.boardLength ? '🌟' : tile}</span>
            <span className="trail-pawns" aria-hidden="true">
              {positions.map((position, team) => position === tile
                ? <i key={team} className={`trail-pawn trail-pawn-${team}`}>{String.fromCharCode(65 + team)}</i>
                : null)}
            </span>
          </div>
        ))}
      </div>

      <div className="trail-turn" aria-live="polite">
        <span>{lang === 'vi' ? 'Lượt của' : 'Turn for'} <strong>{teamName(activeTeam)}</strong></span>
        <span>{t.question} {index + 1}/{questions.length}</span>
      </div>

      {rolled === null ? (
        <div className="trail-roll-panel">
          <div className="trail-die" aria-hidden="true">🎲</div>
          <p>{lang === 'vi' ? 'Tung xúc xắc để mở câu hỏi!' : 'Roll the dice to reveal your question!'}</p>
          <button type="button" className="primary-button big" data-testid="trail-roll" onClick={rollDice}>
            {lang === 'vi' ? '🎲 Tung xúc xắc' : '🎲 Roll the dice'}
          </button>
        </div>
      ) : (
        <div className="trail-question-area">
          <p className="trail-roll-result" data-testid="trail-roll-result">
            🎲 {lang === 'vi' ? `Đã tung: ${rolled} bước` : `Rolled: ${rolled} spaces`}
          </p>
          <div className="quiz-card">
            {q.picture && <PictureView picture={q.picture} size={72} />}
            <h3 className="quiz-prompt" data-testid="trail-prompt">{q.prompt}</h3>
            <button type="button" className="icon-button" aria-label={t.listen} onClick={() => audio.say(q.say ?? q.prompt)}>🔊</button>
          </div>
          <div className="choice-grid">
            {q.choices.map((choice) => (
              <button key={choice} type="button" data-testid="trail-choice" disabled={answered}
                className={`choice ${answered && choice === q.answer ? 'right' : ''} ${selected === choice && selected !== q.answer ? 'wrong' : ''}`}
                onClick={() => choose(choice)}>{choice}</button>
            ))}
          </div>
          <div className="tpl-footer">
            <p className={`tpl-feedback ${answered ? selected === q.answer ? 'correct' : 'wrong' : ''}`}
              role="status" data-testid="trail-feedback">
              {!answered ? ' ' : selected === q.answer
                ? (lang === 'vi' ? `Tuyệt vời! Tiến lên ${rolled} ô!` : `Brilliant! Move ${rolled} spaces!`)
                : `${t.wrong} ${t.answerWas}: ${q.answer}`}
            </p>
            {answered && (
              <button type="button" className="primary-button" data-testid="trail-next" onClick={next}>
                {index + 1 < questions.length ? `${t.next} →` : t.finish}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
