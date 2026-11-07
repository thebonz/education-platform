export type Access = { allowed: boolean; reason: 'free' | 'staff_preview' | 'login_required' | 'membership_required' };

export type CatalogGame = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  templateKey: string;
  difficulty: string | null;
  accessLevel: 'FREE' | 'PREMIUM';
  thumbnail: string | null;
  category: { slug: string; name: string } | null;
  level: { slug: string; name: string; sortOrder: number } | null;
  access: Access;
  favorite?: boolean;
};

export type CatalogProduct = { slug: string; name: string; description: string | null; locale: string };
export type Taxonomy = { categories: { slug: string; name: string; games: number }[]; levels: { slug: string; name: string; games: number }[] };

export type PlayPayload = {
  game: { id: string; slug: string; title: string; templateKey: string };
  version: number;
  data: Record<string, unknown> & { instructions?: string };
};

export const TEMPLATE_EMOJI: Record<string, string> = {
  bingo: '🎯', 'picture-match': '🧩', 'hidden-picture': '🖼️', 'bubble-spelling': '🫧', spelling: '✍️', quiz: '⚡',
};
