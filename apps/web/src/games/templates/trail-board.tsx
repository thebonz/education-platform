'use client';

import { useMemo, useRef, useState } from 'react';
import { createRng, shuffle } from '@happyclass/game-core/rng';
import { sessionSelection } from '@happyclass/game-core/learning-session';
import { rankTeams } from '@happyclass/game-core/scoring';
import { advanceTrail } from '@happyclass/game-core/trail';
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
  data, lang, t, rng, round, audio, settings, onProgress, onFinish,
}: TemplateProps<TrailBoardData>) {
  const teams = Math.max(2, Math.min(4, settings.teamCount || data.defaultTeams));
  const seed = useMemo(() => Math.floor(rng() * 0x100000000), [rng]);
  const questions = useMemo(() => {
    const selected = data.questionsPerRound === undefined ? data.questions :
      sessionSelection(data.questions, data.questionsPerRound, round, createRng(`trail-bank-${seed}`));
    return selected.map((q) => ({
      ...q, choices: data.shuffleChoices ? shuffle(q.choices, createRng(`trail-choices-${seed}-${q.id}`)) : q.choices,
    }));
  }, [data.questions, data.questionsPerRound, data.shuffleChoices, round, seed]);

  const [index, setIndex] = useState(0);
  const [rolled, setRolled] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [rollMode, setRollMode] = useState<'dice' | 'spinner'>(data.rollMode);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<{ team: number; roll: number; correct: boolean; answer: string }[]>([]);
  const [teamHits, setTeamHits] = useState<number[]>(() => Array(teams).fill(0));
  const [positions, setPositions] = useState<number[]>(() => Array(teams).fill(0));
  const [correct, setCorrect] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const finished = useRef(false);

  const q = questions[index];
  const activeTeam = index % teams;
  const teamName = (i: number) => lang === 'vi' ? `Đội ${String.fromCharCode(65 + i)}` : `Team ${String.fromCharCode(65 + i)}`;
  const answered = selected !== null;
  const tiles = Array.from({ length: data.boardLength + 1 }, (_, pos) => pos);
  const segmentSize = 360 / data.diceSides;
  const spinnerColors = ['#fff0af', '#bfe8f4', '#f8c6dc', '#c4efdd', '#e0cdf9', '#f8d7af'];
  const spinnerBackground = `conic-gradient(${Array.from({ length: data.diceSides }, (_, index) =>
    `${spinnerColors[index % spinnerColors.length]} ${index * segmentSize}deg ${(index + 1) * segmentSize}deg`).join(', ')})`;

  const spinnerWheel = (
    <div className="trail-spinner-wrap" data-testid="trail-spinner"
      aria-label={lang === 'vi' ? 'Vòng quay số bước' : 'Move spinner'}>
      <div className="trail-spinner-pointer" aria-hidden="true">▼</div>
      <div className="trail-spinner-wheel"
        style={{ background: spinnerBackground, transform: `rotate(${wheelRotation}deg)` }}>
        {Array.from({ length: data.diceSides }, (_, segment) => (
          <span key={segment} style={{
            transform: `translate(-50%, -50%) rotate(${(segment + .5) * segmentSize}deg) translateY(-50px) rotate(${-(segment + .5) * segmentSize}deg)`,
          }}>{segment + 1}</span>
        ))}
      </div>
    </div>
  );

  function rollDice() {
    if (rolled !== null || finished.current) return;
    const value = Math.min(data.diceSides, 1 + Math.floor(rng() * data.diceSides));
    if (rollMode === 'spinner') {
      const target = (360 - (value - .5) * segmentSize + 360) % 360;
      setWheelRotation((current) => {
        const delta = (target - (current % 360) + 360) % 360;
        return current + 720 + delta;
      });
    }
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
      setPositions((previous) => advanceTrail(previous, activeTeam, rolled, data.boardLength, true));
      setTeamHits((previous) => previous.map((hits, team) => team === activeTeam ? hits + 1 : hits));
    }
    setHistory((previous) => [...previous, { team: activeTeam, roll: rolled, correct: ok, answer: q.answer }]);
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
            <li key={entry.name}>{entry.name}: {entry.score}/{data.boardLength} {lang === 'vi' ? 'ô' : 'spaces'} · ✓ {teamHits[summary.findIndex((team) => team.name === entry.name)]}</li>
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
            <small>{position}/{data.boardLength} · ✓ {teamHits[team]}</small>
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
      <div className="trail-history-controls">
        <button type="button" className="secondary-button" data-testid="trail-history-toggle"
          aria-controls="trail-turn-history" aria-expanded={historyOpen}
          onClick={() => setHistoryOpen((open) => !open)}>
          📜 {lang === 'vi' ? 'Nhật ký lượt chơi' : 'Turn history'} ({history.length})
        </button>
        <span>{lang === 'vi' ? 'Kho câu hỏi' : 'Question bank'}: {questions.length}/{data.questions.length}</span>
      </div>
      {historyOpen && <ol className="trail-history" id="trail-turn-history" data-testid="trail-history">
        {history.length === 0
          ? <li>{lang === 'vi' ? 'Chưa có lượt nào hoàn thành.' : 'No turns completed yet.'}</li>
          : history.map((entry, turn) => (
            <li key={turn} data-testid="trail-history-item">
              <strong>{turn + 1}. {teamName(entry.team)}</strong>
              <span> {entry.correct ? '✅' : '↩️'} {entry.roll} {lang === 'vi' ? 'bước' : 'steps'} </span>
              <span>{lang === 'vi' ? 'Đáp án' : 'Answer'}: {entry.answer}</span>
            </li>
          ))}
      </ol>}

      {rolled === null ? (
        <div className="trail-roll-panel">
          <label className="trail-roll-mode-label">{lang === 'vi' ? 'Cách chọn số bước' : 'How to choose your move'}
            <select data-testid="trail-roll-mode" value={rollMode}
              onChange={(event) => setRollMode(event.target.value as 'dice' | 'spinner')}>
              <option value="dice">{lang === 'vi' ? '🎲 Xúc xắc' : '🎲 Dice'}</option>
              <option value="spinner">{lang === 'vi' ? '🎡 Vòng quay' : '🎡 Spinner'}</option>
            </select>
          </label>
          {rollMode === 'spinner' ? spinnerWheel : <div className="trail-die" aria-hidden="true">🎲</div>}
          <p>{rollMode === 'spinner'
            ? (lang === 'vi' ? 'Quay để chọn số bước cho đội!' : 'Spin for your team’s next move!')
            : (lang === 'vi' ? 'Tung xúc xắc để mở câu hỏi!' : 'Roll the dice to reveal your question!')}</p>
          <button type="button" className="primary-button big" data-testid="trail-roll" onClick={rollDice}>
            {rollMode === 'spinner'
              ? (lang === 'vi' ? '🎡 Quay vòng' : '🎡 Spin the wheel')
              : (lang === 'vi' ? '🎲 Tung xúc xắc' : '🎲 Roll the dice')}
          </button>
        </div>
      ) : (
        <div className="trail-question-area">
          {rollMode === 'spinner' && spinnerWheel}
          <p className="trail-roll-result" data-testid="trail-roll-result">
            {rollMode === 'spinner' ? '🎡' : '🎲'} {lang === 'vi' ? `Đã chọn: ${rolled} bước` : `Selected: ${rolled} spaces`}
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
