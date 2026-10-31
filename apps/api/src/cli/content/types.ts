import type { TemplateKey } from '@happyclass/game-core';

/** Gói nội dung do seed quản lý. Tăng `revision` để seed phát hành phiên bản nội dung mới. */
export type GamePack = {
  product: 'english' | 'vietnamese';
  slug: string;
  title: string;
  summary: string;
  templateKey: TemplateKey;
  category: string;
  level: string;
  difficulty: 'easy' | 'medium' | 'hard';
  accessLevel: 'FREE' | 'PREMIUM';
  sortOrder: number;
  revision: number;
  published: boolean;
  data: unknown;
};

export type Taxonomy = Record<'english' | 'vietnamese', { levels: [string, string][]; categories: [string, string][] }>;

export const emoji = (value: string) => ({ kind: 'emoji' as const, value });
