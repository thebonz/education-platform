'use client';

import { useEffect, useMemo, useState } from 'react';
import { shuffle } from '@happyclass/game-core/rng';
import { rankTeams } from '@happyclass/game-core/scoring';
import type { QuizData } from '@happyclass/game-core/templates';
import { PictureView } from '../picture';
import type { TemplateProps } from '../shell/types';

const TEAM_COLORS = ['#e85d9e', '#3b82f6', '#16a34a', '#f59e0b'];

export function QuizTemplate({ data, t, rng, audio, settings, onProgress, onFinish }: TemplateProps<QuizData>) {
  const teamMode = data.mode === 'teams';
  const teamCount = teamMode ? settings.teamCount : 1;
  const questions = useMemo(
    () => data.questions.map((q) => ({ ...q, choices: data.shuffleChoices ? shuffle(q.choices, rng) : q.choices })),
    [data.questions, data.shuffleChoices, rng],
  );
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [teamScores, setTeamScores] = useState<number[]>(() => Array(teamCount).fill(0));
  const [correctCount, setCorrectCount] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(data.timePerQuestionSec);

  const q = questions[index];
  const activeTeam = index % teamCount;
  const answered = chosen !== null || timedOut;
  const teamName = (i: number) => `${t.team} ${String.fromCharCode(65 + i)}`;

  useEffect(() => {
    audio.say(q.say ?? q.prompt);
    setSecondsLeft(data.timePerQuestionSec);
  }, [index]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data.timePerQuestionSec || answered) return;
    if (secondsLeft <= 0) {
      setTimedOut(true);
      const m = mistakes + 1;
      setMistakes(m);
      onProgress({ score: correctCount * data.pointsPerCorrect, mistakes: m });
      audio.sfx('wrong');
      return;
    }
    const id = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [secondsLeft, answered]); // eslint-disable-line react-hooks/exhaustive-deps

  function answer(choice: string) {
    if (answered) return;
    setChosen(choice);
    if (choice === q.answer) {
      const c = correctCount + 1;
      setCorrectCount(c);
      setTeamScores((s) => s.map((v, i) => (i === activeTeam ? v + data.pointsPerCorrect : v)));
      onProgress({ score: c * data.pointsPerCorrect, mistakes });
      audio.sfx('correct');
    } else {
      const m = mistakes + 1;
      setMistakes(m);
      onProgress({ score: correctCount * data.pointsPerCorrect, mistakes: m });
      audio.sfx('wrong');
    }
  }

  function next() {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setChosen(null);
      setTimedOut(false);
      return;
    }
    const teams = teamScores.map((score, i) => ({ name: teamName(i), score }));
    const ranking = teamMode ? rankTeams(teams) : null;
    onFinish({
      score: correctCount * data.pointsPerCorrect,
      maxScore: questions.length * data.pointsPerCorrect,
      mistakes,
      summary: ranking ? (
        <div className="team-result" data-testid="team-result">
          <h3>{ranking.tie ? t.tie : `🏆 ${t.winner}: ${ranking.winners[0].name}`}</h3>
          <ol>{[...teams].sort((a, b) => b.score - a.score).map((tm) => <li key={tm.name}>{tm.name}: {tm.score} {t.points}</li>)}</ol>
        </div>
      ) : undefined,
    });
  }

  const status = timedOut ? t.timeUp : chosen === null ? '' : chosen === q.answer ? t.correct : `${t.wrong} ${t.answerWas}: ${q.answer}`;

  return (
    <div className="tpl tpl-quiz">
      {teamMode && (
        <div className="team-board">
          {teamScores.map((s, i) => (
            <div key={i} className={`team-chip ${i === activeTeam ? 'active' : ''}`} style={{ borderColor: TEAM_COLORS[i] }} data-testid={`team-${i}`}>
              <span>{teamName(i)}</span><b>{s}</b>
            </div>
          ))}
        </div>
      )}
      <div className="quiz-meta">
        <span>{t.question} {index + 1} {t.of} {questions.length}</span>
        {teamMode && <span data-testid="active-team">{t.playingNow}: {teamName(activeTeam)}</span>}
        {data.timePerQuestionSec > 0 && <span className={`countdown ${secondsLeft <= 5 ? 'low' : ''}`}>⏳ {Math.max(0, secondsLeft)}s</span>}
      </div>
      <div className="quiz-card">
        {q.picture && <PictureView picture={q.picture} size={72} />}
        <h3 className="quiz-prompt" data-testid="quiz-prompt">{q.prompt}</h3>
        <button type="button" className="icon-button" aria-label={t.listen} onClick={() => audio.say(q.say ?? q.prompt)}>🔊</button>
      </div>
      <div className="choice-grid">
        {q.choices.map((c) => (
          <button key={c} type="button" disabled={answered}
            className={`choice ${answered && c === q.answer ? 'right' : ''} ${chosen === c && c !== q.answer ? 'wrong' : ''}`}
            onClick={() => answer(c)}>{c}</button>
        ))}
      </div>
      <div className="tpl-footer">
        <p className={`tpl-feedback ${timedOut || (chosen && chosen !== q.answer) ? 'wrong' : chosen ? 'correct' : ''}`} role="status" data-testid="tpl-feedback">{status || ' '}</p>
        {answered && <button type="button" className="primary-button" onClick={next} data-testid="quiz-next">{index + 1 < questions.length ? `${t.next} →` : t.finish}</button>}
      </div>
    </div>
  );
}
