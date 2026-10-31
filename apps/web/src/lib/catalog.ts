export type Access = { allowed: boolean; reason: 'free' | 'staff_preview' | 'login_required' | 'membership_required' };

export type CatalogGame = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  templateKey: string;
  gradeLevel: string | null;
  difficulty: string | null;
  accessLevel: 'FREE' | 'PREMIUM';
  thumbnail: string | null;
  category: { slug: string; name: string } | null;
  access: Access;
};

export type CatalogProduct = { slug: string; name: string; description: string | null; locale: string };
