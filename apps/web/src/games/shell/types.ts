import type { ReactNode } from 'react';
import type { Rng } from '@happyclass/game-core/rng';
import type { GameAudio } from './audio';
import type { GameLang, GameStrings } from './strings';

export type FinishPayload = {
  score: number;
  maxScore: number;
  mistakes: number;
  /** Nội dung riêng của template hiển thị ở màn kết quả (ví dụ bảng điểm các đội). */
  summary?: ReactNode;
};

export type ShellSettings = { teamCount: number };

export type TemplateProps<D> = {
  data: D;
  lang: GameLang;
  t: GameStrings;
  rng: Rng;
  audio: GameAudio;
  settings: ShellSettings;
  /** Báo điểm hiện tại để Shell hiển thị trên thanh trên cùng. */
  onProgress: (p: { score: number; mistakes: number }) => void;
  onFinish: (p: FinishPayload) => void;
};
