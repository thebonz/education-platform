/**
 * Nạp dữ liệu nền: vai trò, sản phẩm, danh mục, 12 game demo.
 * Idempotent và KHÔNG ghi đè dữ liệu admin đã sửa (chỉ tạo bản ghi còn thiếu).
 * Chạy có chủ đích: node dist/cli/seed.js  (hoặc npm run seed khi dev)
 */
import { AccessLevel, Prisma, PrismaClient } from '@prisma/client';
import { ROLES } from '../rbac/permissions';
import seedGames from './seed-data.json';

type SeedGame = {
  product: 'english' | 'vietnamese';
  slug: string;
  title: string;
  summary: string;
  templateId: string;
  category: string;
  gradeLevel?: string;
  difficulty?: string;
  sortOrder: number;
  content: Prisma.InputJsonValue;
};

const PRODUCTS = [
  {
    slug: 'english', name: 'English Games', locale: 'en',
    description: 'Playful English learning games for children, teachers and classrooms.',
    theme: { accent: '#e85d9e', accentSoft: '#fff0f7', background: '#fffaf3' },
  },
  {
    slug: 'vietnamese', name: 'Vietnamese Games', locale: 'vi',
    description: 'Trò chơi tương tác giúp trẻ học chữ, tiếng, từ và câu tiếng Việt.',
    theme: { accent: '#159a83', accentSoft: '#e8fbf5', background: '#f8fffc' },
  },
];

const CATEGORIES: Record<string, { product: string; name: string; order: number }> = {
  classroom: { product: 'english', name: 'Classroom Games', order: 1 },
  vocabulary: { product: 'english', name: 'Vocabulary', order: 2 },
  spelling: { product: 'english', name: 'Spelling', order: 3 },
  'chu-cai': { product: 'vietnamese', name: 'Chữ cái', order: 1 },
  'tu-vung': { product: 'vietnamese', name: 'Từ vựng', order: 2 },
  'dau-thanh': { product: 'vietnamese', name: 'Dấu thanh', order: 3 },
  'van-va-tieng': { product: 'vietnamese', name: 'Vần và tiếng', order: 4 },
  'chinh-ta': { product: 'vietnamese', name: 'Chính tả', order: 5 },
  'do-vui': { product: 'vietnamese', name: 'Đố vui', order: 6 },
};

export async function seed(prisma: PrismaClient) {
  for (const [key, role] of Object.entries(ROLES)) {
    await prisma.role.upsert({ where: { key }, update: { name: role.name }, create: { key, name: role.name } });
  }

  const productIds: Record<string, string> = {};
  for (const p of PRODUCTS) {
    const row = await prisma.product.upsert({ where: { slug: p.slug }, update: {}, create: p });
    productIds[p.slug] = row.id;
  }

  for (const [slug, c] of Object.entries(CATEGORIES)) {
    const productId = productIds[c.product];
    await prisma.gameCategory.upsert({
      where: { productId_slug: { productId, slug } },
      update: {},
      create: { productId, slug, name: c.name, sortOrder: c.order },
    });
  }

  let created = 0;
  for (const g of seedGames as SeedGame[]) {
    const productId = productIds[g.product];
    const exists = await prisma.game.findUnique({ where: { productId_slug: { productId, slug: g.slug } } });
    if (exists) continue;
    const category = await prisma.gameCategory.findUnique({ where: { productId_slug: { productId, slug: g.category } } });
    await prisma.game.create({
      data: {
        productId, categoryId: category?.id, slug: g.slug, title: g.title, summary: g.summary,
        templateKey: g.templateId, gradeLevel: g.gradeLevel, difficulty: g.difficulty,
        accessLevel: AccessLevel.FREE, isPublished: true, sortOrder: g.sortOrder,
        versions: { create: { versionNumber: 1, content: g.content, isPublished: true } },
      },
    });
    created++;
  }
  return { roles: Object.keys(ROLES).length, products: PRODUCTS.length, gamesCreated: created };
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seed(prisma)
    .then((r) => console.log(`Seed hoàn tất: ${r.roles} vai trò, ${r.products} sản phẩm, ${r.gamesCreated} game mới.`))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
