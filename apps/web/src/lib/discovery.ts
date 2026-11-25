/** Nhóm hoạt động để khám phá game; dựa trên template đang có, không tạo game giả. */
export type SkillGroup = {
  key: string;
  label: string;
  icon: string;
  templateKeys: readonly string[];
};

export const SKILL_GROUPS: Record<'english' | 'vietnamese', readonly SkillGroup[]> = {
  english: [
    { key: 'listen', label: 'Listen & discover', icon: '🎧', templateKeys: ['bingo', 'picture-match', 'hidden-picture', 'mystery-doors'] },
    { key: 'words', label: 'Build & spell', icon: '🔤', templateKeys: ['bubble-spelling', 'spelling'] },
    { key: 'teams', label: 'Team challenges', icon: '🏆', templateKeys: ['quiz', 'trail-board'] },
  ],
  vietnamese: [
    { key: 'listen', label: 'Nghe & nhận diện', icon: '🎧', templateKeys: ['tone-finder', 'picture-match', 'bingo'] },
    { key: 'syllables', label: 'Ghép tiếng & dấu thanh', icon: '🔤', templateKeys: ['syllable-builder', 'tone-finder'] },
    { key: 'sentences', label: 'Từ & câu', icon: '🧩', templateKeys: ['word-sort', 'sentence-order', 'quiz', 'trail-board'] },
  ],
};

export function matchesSkill(templateKey: string, group: SkillGroup): boolean {
  return group.templateKeys.includes(templateKey);
}
