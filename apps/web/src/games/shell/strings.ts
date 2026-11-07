export type GameLang = 'en' | 'vi';

const en = {
  start: 'Start', playAgain: 'Play again', backToLibrary: 'Back to library', next: 'Next', check: 'Check', finish: 'See results',
  score: 'Score', points: 'points', mistakes: 'Mistakes', time: 'Time', fullscreen: 'Fullscreen', exitFullscreen: 'Exit fullscreen',
  restart: 'Restart', soundOn: 'Sound on', soundOff: 'Sound off', listen: 'Listen', hint: 'Hint', retry: 'Try again',
  accent: 'Accent', british: 'British', american: 'American', teams: 'Teams', team: 'Team', players: 'Number of teams',
  correct: 'Correct!', wrong: 'Not quite.', answerWas: 'The answer is', timeUp: "Time's up!",
  greatJob: 'Great job!', youScored: 'You scored', saved: 'Result saved to your account.', loginToSave: 'Log in to save your progress.',
  winner: 'Winner', tie: "It's a tie!", playingNow: 'Playing now', question: 'Question', item: 'Item', of: 'of',
  bingoCall: 'Find this one', showClue: 'Show clue', hideClue: 'Hide clue', repeat: 'Repeat', bingo: 'BINGO!',
  pickWord: 'Tap a word, then its picture.', matched: 'Matched', hiddenGuess: 'What is the hidden picture?',
  chooseUnit: 'Choose a unit', words: 'words', typeAnswer: 'Type your answer', fillBlanks: 'Fill in the missing letters',
  soundUnavailable: 'Read-aloud is not available in this browser.',
};

const vi: typeof en = {
  start: 'Bắt đầu', playAgain: 'Chơi lại', backToLibrary: 'Về thư viện', next: 'Tiếp theo', check: 'Kiểm tra', finish: 'Xem kết quả',
  score: 'Điểm', points: 'điểm', mistakes: 'Lỗi', time: 'Thời gian', fullscreen: 'Toàn màn hình', exitFullscreen: 'Thoát toàn màn hình',
  restart: 'Chơi lại từ đầu', soundOn: 'Bật âm thanh', soundOff: 'Tắt âm thanh', listen: 'Nghe', hint: 'Gợi ý', retry: 'Làm lại',
  accent: 'Giọng đọc', british: 'Anh-Anh', american: 'Anh-Mỹ', teams: 'Các đội', team: 'Đội', players: 'Số đội',
  correct: 'Chính xác!', wrong: 'Chưa đúng.', answerWas: 'Đáp án đúng là', timeUp: 'Hết giờ!',
  greatJob: 'Giỏi lắm!', youScored: 'Bạn đạt', saved: 'Đã lưu kết quả vào tài khoản.', loginToSave: 'Đăng nhập để lưu kết quả.',
  winner: 'Đội thắng', tie: 'Hòa!', playingNow: 'Đến lượt', question: 'Câu', item: 'Câu', of: '/',
  bingoCall: 'Hãy tìm', showClue: 'Hiện chữ', hideClue: 'Ẩn chữ', repeat: 'Đọc lại', bingo: 'BINGO!',
  pickWord: 'Chạm vào một từ, rồi chạm vào hình phù hợp.', matched: 'Đã ghép', hiddenGuess: 'Bức tranh bí mật là gì?',
  chooseUnit: 'Chọn bài', words: 'từ', typeAnswer: 'Nhập đáp án', fillBlanks: 'Điền chữ còn thiếu',
  soundUnavailable: 'Trình duyệt này chưa hỗ trợ đọc to.',
};

export type GameStrings = typeof en;
export const gameStrings = (lang: GameLang): GameStrings => (lang === 'en' ? en : vi);
