export type GameResult = {
  score: number;
  maxScore: number;
  mistakes: number;
  durationMs: number;
  stars: 1 | 2 | 3;
};

/** 3 sao: gần như tuyệt đối; 2 sao: đúng từ 60%; 1 sao: đã hoàn thành. */
export function starsFor(correct: number, total: number, mistakes: number): 1 | 2 | 3 {
  if (total <= 0) return 1;
  const ratio = correct / total;
  if (ratio >= 0.9 && mistakes <= Math.max(1, Math.floor(total * 0.1))) return 3;
  if (ratio >= 0.6) return 2;
  return 1;
}

export type TeamScore = { name: string; score: number };

/** Đội thắng; nhiều đội bằng điểm cao nhất → hòa. */
export function rankTeams(teams: readonly TeamScore[]): { winners: TeamScore[]; tie: boolean } {
  const top = Math.max(...teams.map((t) => t.score));
  const winners = teams.filter((t) => t.score === top);
  return { winners, tie: winners.length > 1 };
}
