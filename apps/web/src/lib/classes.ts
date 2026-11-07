export type ClassSummary = {
  id: string; name: string; gradeLabel: string | null; joinCode: string; isArchived: boolean;
  product: { slug: 'english' | 'vietnamese'; name: string }; students: number; games: number; createdAt: string;
};
export type ClassList = { limits: { classes: number; studentsPerClass: number; gamesPerClass: number }; classes: ClassSummary[] };
export type ClassStudent = { id: string; nickname: string; avatar: string };
export type ClassGameRow = {
  id: string; title: string; templateKey: string; accessLevel: 'FREE' | 'PREMIUM'; isActive: boolean; sortOrder: number; locked: boolean;
  sourceGame: { slug: string; title: string } | null; updatedAt: string;
};
export type ClassDetail = {
  id: string; name: string; gradeLabel: string | null; joinCode: string; isArchived: boolean;
  product: { slug: 'english' | 'vietnamese'; name: string }; limits: ClassList['limits'];
  students: ClassStudent[]; games: ClassGameRow[];
};
export type ClassResults = {
  cells: { studentId: string | null; classGameId: string; plays: number; bestStars: number; lastPlayedAt: string }[];
  recent: { id: string; score: number; maxScore: number; stars: number; mistakes: number; durationMs: number; createdAt: string; student: ClassStudent | null; classGame: { id: string; title: string } }[];
};
export type JoinView = {
  name: string; gradeLabel: string | null; product: { slug: 'english' | 'vietnamese'; name: string };
  students: ClassStudent[]; games: { id: string; title: string; templateKey: string; locked: boolean }[];
};

export const AVATARS = ['🐶', '🐱', '🐰', '🐻', '🐼', '🦊', '🐯', '🦁', '🐸', '🐵', '🐧', '🐤', '🐢', '🐙', '🦋', '🐞', '🌻', '⭐', '🚀', '⚽'];
export const CLASS_CODE = /^[2-9A-HJKMNP-Z]{6}$/;
