import type { GamePack } from '../types';

/**
 * Nội dung tiếng Việt tiểu học, soạn mới theo mạch chủ đề của bộ Kết nối tri thức với cuộc sống.
 * Không chép văn bản, hình ảnh hay bài tập nguyên văn từ sách giáo khoa.
 * Mọi game seed ra ở trạng thái "chờ giáo viên duyệt"; giáo viên duyệt trong trang quản trị.
 */
export type ViPack = Omit<GamePack, 'product' | 'accessLevel' | 'published' | 'difficulty'> &
  Partial<Pick<GamePack, 'accessLevel' | 'published' | 'difficulty'>>;

export const viPack = (p: ViPack): GamePack => ({
  product: 'vietnamese', accessLevel: 'FREE', published: true, difficulty: 'easy', ...p,
});

export const e = (value: string) => ({ kind: 'emoji' as const, value });
