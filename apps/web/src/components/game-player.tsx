'use client';

import { useMemo, useState } from 'react';
/** Trình chơi demo từ Sprint 1. Giai đoạn 3 thay bằng hệ template có schema. */
export type PlayableGame = { slug: string; title: string; templateId: string; content: Record<string, unknown> | null };

type Question = { prompt: string; choices: string[]; answer: string };
type Pair = { id: string; left: string; right: string };
type Content = {
  instructions?: string;
  questions?: Question[];
  items?: { prompt: string; answer: string }[];
  pairs?: Pair[];
  boardItems?: string[];
  calls?: string[];
  revealEmoji?: string;
  target?: string;
  hint?: string;
  tiles?: string[];
};

export function GamePlayer({ game, product }: { game: PlayableGame; product: string }) {
  const content = (game.content || {}) as unknown as Content;
  const [score, setScore] = useState(0);
  const [teamScores, setTeamScores] = useState([0, 0]);
  const [activeTeam, setActiveTeam] = useState(0);
  const [finished, setFinished] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answerInput, setAnswerInput] = useState('');
  const [matched, setMatched] = useState<string[]>([]);
  const [leftPick, setLeftPick] = useState<string | null>(null);
  const [marked, setMarked] = useState<string[]>([]);
  const [callIndex, setCallIndex] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [built, setBuilt] = useState<number[]>([]);

  const isVi = product === 'vietnamese';
  const questions = content.questions || [];
  const items = content.items || [];
  const pairs = content.pairs || [];
  const currentQuestion = questions[questionIndex];
  const currentSpelling = items[questionIndex];
  const currentCall = content.calls?.[callIndex];
  const target = content.target || '';
  const tiles = content.tiles || [];
  const builtWord = built.map((index) => tiles[index]).join('');
  const shuffledRight = useMemo(() => [...pairs].sort((a, b) => a.id.localeCompare(b.id)).reverse(), [pairs]);

  function reset() {
    setScore(0); setTeamScores([0, 0]); setActiveTeam(0); setFinished(false); setFeedback(''); setQuestionIndex(0); setSelected(null);
    setAnswerInput(''); setMatched([]); setLeftPick(null); setMarked([]); setCallIndex(0); setRevealed(0); setBuilt([]);
  }

  function answerQuestion(choice: string) {
    if (!currentQuestion || selected) return;
    setSelected(choice);
    const correct = choice === currentQuestion.answer;
    if (correct) {
      setScore((value) => value + 1);
      if (game.slug === 'team-quiz') setTeamScores((values) => values.map((value, index) => index === activeTeam ? value + 1 : value));
    }
    setFeedback(correct ? (isVi ? 'Chính xác! Giỏi lắm! ✨' : 'That’s correct! Great job! ✨') : (isVi ? `Đáp án đúng: ${currentQuestion.answer}` : `Correct answer: ${currentQuestion.answer}`));
  }

  function nextQuestion(total: number) {
    if (questionIndex + 1 >= total) setFinished(true);
    else { setQuestionIndex((value) => value + 1); if (game.slug === 'team-quiz') setActiveTeam((value) => value === 0 ? 1 : 0); setSelected(null); setFeedback(''); setAnswerInput(''); }
  }

  function checkSpelling() {
    if (!currentSpelling || !answerInput.trim()) return;
    const correct = answerInput.trim().toLocaleUpperCase() === currentSpelling.answer.toLocaleUpperCase();
    if (correct) setScore((value) => value + 1);
    setFeedback(correct ? (isVi ? 'Đúng rồi! 🌟' : 'Perfect spelling! 🌟') : `${isVi ? 'Đáp án:' : 'Answer:'} ${currentSpelling.answer}`);
  }

  function pickRight(pair: Pair) {
    if (!leftPick || matched.includes(pair.id)) return;
    const leftPair = pairs.find((item) => item.id === leftPick);
    if (leftPair?.id === pair.id) {
      const updated = [...matched, pair.id]; setMatched(updated); setScore((value) => value + 1); setFeedback(isVi ? 'Ghép đúng rồi!' : 'A perfect match!');
      setLeftPick(null); if (updated.length === pairs.length) setFinished(true);
    } else {
      setFeedback(isVi ? 'Chưa đúng, thử lại nhé.' : 'Not quite. Try again.');
      setLeftPick(null);
    }
  }

  function markBingo(item: string) {
    if (item !== currentCall || marked.includes(item)) return;
    const updated = [...marked, item]; setMarked(updated); setScore((value) => value + 1); setFeedback(isVi ? 'Tìm đúng chữ rồi!' : 'You found it!');
    if (callIndex + 1 >= (content.calls?.length || 0)) setFinished(true);
    else setCallIndex((value) => value + 1);
  }

  function answerHiddenPicture(choice: string) {
    if (!currentQuestion || selected) return;
    setSelected(choice);
    if (choice === currentQuestion.answer) {
      setScore((value) => value + 1); setRevealed((value) => value + 1); setFeedback(isVi ? 'Mở thêm một mảnh tranh!' : 'One more piece revealed!');
    } else setFeedback(isVi ? `Đáp án đúng: ${currentQuestion.answer}` : `Correct answer: ${currentQuestion.answer}`);
  }

  function checkBuiltWord() {
    if (builtWord.toLocaleLowerCase() === target.toLocaleLowerCase()) {
      setScore(1); setFeedback(isVi ? 'Bạn ghép đúng tiếng rồi!' : 'You built the word!'); setFinished(true);
    } else setFeedback(isVi ? 'Chưa đúng thứ tự. Thử lại nhé!' : 'Not quite. Try another order!');
  }

  const header = <><div className="player-topline"><div><span className="player-label">{game.templateId.replace('-', ' ').toUpperCase()}</span><h2>{game.title}</h2><p>{content.instructions}</p></div><div className="score-pill">⭐ {score} {isVi ? 'điểm' : 'points'}</div></div>{game.slug === 'team-quiz' && <div className="team-scoreboard"><div className={activeTeam === 0 ? 'team-score active' : 'team-score'}><span>TEAM A</span><b>{teamScores[0]}</b></div><div className={activeTeam === 1 ? 'team-score active' : 'team-score'}><span>TEAM B</span><b>{teamScores[1]}</b></div><small>{isVi ? 'Đến lượt' : 'Playing now'}: Team {activeTeam === 0 ? 'A' : 'B'}</small></div>}</>;

  if (finished) {
    return <section className="player-panel">{header}<div className="game-complete"><div className="complete-star">🏆</div><h3>{isVi ? 'Hoàn thành xuất sắc!' : 'You did it!'}</h3><p>{isVi ? `Bạn đạt ${score} điểm.` : `You scored ${score} points.`}</p><button className="primary-button" onClick={reset}>{isVi ? 'Chơi lại' : 'Play again'} ↻</button></div></section>;
  }

  return (
    <section className="player-panel">
      {header}
      {game.templateId === 'quiz' && currentQuestion && <div className="play-area"><div className="question-count">{isVi ? 'Câu' : 'Question'} {questionIndex + 1}/{questions.length}</div><h3 className="question-prompt">{currentQuestion.prompt}</h3><div className="answer-grid">{currentQuestion.choices.map((choice) => <button key={choice} className={`answer-option ${selected === choice ? (choice === currentQuestion.answer ? 'correct' : 'incorrect') : ''}`} onClick={() => answerQuestion(choice)} disabled={!!selected}>{choice}</button>)}</div>{feedback && <div className="feedback-line">{feedback}<button className="text-button" onClick={() => nextQuestion(questions.length)}>{questionIndex + 1 === questions.length ? (isVi ? 'Xem kết quả' : 'See result') : (isVi ? 'Câu tiếp theo →' : 'Next question →')}</button></div>}</div>}

      {game.templateId === 'spelling' && currentSpelling && <div className="play-area"><div className="question-count">{isVi ? 'Câu' : 'Item'} {questionIndex + 1}/{items.length}</div><div className="hint-card">💡 {currentSpelling.prompt}</div><input className="word-input" value={answerInput} onChange={(event) => { setAnswerInput(event.target.value); setFeedback(''); }} placeholder={isVi ? 'Nhập đáp án...' : 'Type your answer...'} onKeyDown={(event) => event.key === 'Enter' && checkSpelling()} />{!feedback ? <button className="primary-button" onClick={checkSpelling}>{isVi ? 'Kiểm tra' : 'Check answer'}</button> : <div className="feedback-line">{feedback}<button className="text-button" onClick={() => nextQuestion(items.length)}>{questionIndex + 1 === items.length ? (isVi ? 'Xem kết quả' : 'See result') : (isVi ? 'Câu tiếp theo →' : 'Next item →')}</button></div>}</div>}

      {game.templateId === 'matching' && <div className="play-area"><p className="question-count">{isVi ? 'Đã ghép' : 'Matched'} {matched.length}/{pairs.length}</p><div className="matching-grid"><div>{pairs.map((pair) => <button key={pair.id} disabled={matched.includes(pair.id)} className={`match-tile ${leftPick === pair.id ? 'picked' : ''} ${matched.includes(pair.id) ? 'matched' : ''}`} onClick={() => { setLeftPick(pair.id); setFeedback(''); }}>{pair.left}</button>)}</div><div>{shuffledRight.map((pair) => <button key={pair.id} disabled={matched.includes(pair.id)} className={`match-tile match-right ${matched.includes(pair.id) ? 'matched' : ''}`} onClick={() => pickRight(pair)}>{pair.right}</button>)}</div></div><div className="feedback-line">{feedback || (isVi ? 'Chọn một từ, sau đó chọn hình phù hợp.' : 'Pick a word, then choose its matching picture.')}</div></div>}

      {game.templateId === 'bingo' && <div className="play-area"><div className="bingo-call"><span>{isVi ? 'Hãy tìm chữ' : 'Find this letter'}</span><strong>{currentCall || '✓'}</strong><small>{callIndex + 1}/{content.calls?.length || 0}</small></div><div className="bingo-grid">{(content.boardItems || []).map((item) => <button key={item} onClick={() => markBingo(item)} disabled={marked.includes(item) || item !== currentCall} className={`bingo-cell ${marked.includes(item) ? 'marked' : ''}`}>{item}</button>)}</div><p className="feedback-line">{feedback || (isVi ? 'Chọn đúng chữ cái đang được gọi.' : 'Tap the letter that is being called.')}</p></div>}

      {game.templateId === 'hidden-picture' && currentQuestion && <div className="play-area"><div className="hidden-art"><div className="hidden-tiles">{Array.from({ length: 9 }).map((_, index) => <span key={index} className={index < revealed ? 'revealed' : ''}>{index < revealed ? content.revealEmoji : '✦'}</span>)}</div><strong>{isVi ? 'Bức tranh bí mật' : 'Mystery picture'}</strong></div><div className="question-count">{isVi ? 'Câu' : 'Question'} {questionIndex + 1}/{questions.length}</div><h3 className="question-prompt">{currentQuestion.prompt}</h3><div className="answer-grid">{currentQuestion.choices.map((choice) => <button key={choice} className="answer-option" onClick={() => answerHiddenPicture(choice)} disabled={!!selected}>{choice}</button>)}</div>{feedback && <div className="feedback-line">{feedback}<button className="text-button" onClick={() => nextQuestion(questions.length)}>{questionIndex + 1 === questions.length ? (isVi ? 'Xem tranh' : 'Reveal picture') : (isVi ? 'Câu tiếp theo →' : 'Next question →')}</button></div>}</div>}

      {game.templateId === 'letter-builder' && <div className="play-area"><div className="hint-card">💡 {content.hint}</div><div className="built-word">{builtWord || <span>{isVi ? 'Chạm các chữ bên dưới' : 'Tap the letters below'}</span>}</div><div className="letter-tiles">{tiles.map((tile, index) => <button key={`${tile}-${index}`} disabled={built.includes(index)} onClick={() => { setBuilt((value) => [...value, index]); setFeedback(''); }}>{tile}</button>)}</div><div className="builder-actions"><button className="secondary-button" onClick={() => { setBuilt([]); setFeedback(''); }}>{isVi ? 'Xóa' : 'Clear'}</button><button className="primary-button" onClick={checkBuiltWord}>{isVi ? 'Kiểm tra' : 'Check word'}</button></div>{feedback && <div className="feedback-line">{feedback}</div>}</div>}
    </section>
  );
}
