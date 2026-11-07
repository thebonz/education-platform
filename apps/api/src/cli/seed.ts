/**
 * Nạp dữ liệu nền: vai trò, sản phẩm, cấp độ, danh mục, game mẫu.
 *
 * Quy tắc an toàn:
 *  - Idempotent: chạy nhiều lần cho cùng kết quả.
 *  - Không ghi đè dữ liệu admin đã sửa: sản phẩm/danh mục/cấp độ chỉ tạo khi thiếu;
 *    game chỉ được cập nhật khi còn `managedBySeed = true` và gói có `revision` mới hơn.
 *  - Nội dung game luôn được kiểm tra bằng schema của template trước khi ghi.
 *  - Cập nhật game = tạo GameVersion mới (bản cũ vẫn còn, không xóa).
 *
 * Chạy có chủ đích: node dist/cli/seed.js  (hoặc npm run seed khi dev)
 */
import { validateGameData } from '@happyclass/game-core';
import { AccessLevel, Prisma, PrismaClient } from '@prisma/client';
import { ROLES } from '../rbac/permissions';
import { ENGLISH_GAMES } from './content/english';
import { TAXONOMY } from './content/taxonomy';
import type { GamePack } from './content/types';
import { VIETNAMESE_GAMES } from './content/vietnamese';

export const ALL_PACKS: GamePack[] = [...ENGLISH_GAMES, ...VIETNAMESE_GAMES];

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
] as const;

export type SeedReport = { roles: number; products: number; gamesCreated: number; gamesUpdated: number; gamesSkipped: number };

/** Kiểm tra mọi gói nội dung; ném lỗi kèm vị trí nếu có gói sai. */
export function validatePacks(packs: GamePack[] = ALL_PACKS) {
  const problems: string[] = [];
  const keys = new Set<string>();
  for (const p of packs) {
    const key = `${p.product}/${p.slug}`;
    if (keys.has(key)) problems.push(`${key}: slug bị trùng`);
    keys.add(key);
    const tax = TAXONOMY[p.product];
    if (!tax.categories.some(([slug]) => slug === p.category)) problems.push(`${key}: danh mục không tồn tại ${p.category}`);
    if (!tax.levels.some(([slug]) => slug === p.level)) problems.push(`${key}: cấp độ không tồn tại ${p.level}`);
    const result = validateGameData(p.templateKey, p.data);
    if (!result.ok) problems.push(...result.issues.map((i) => `${key}: ${i.path || '(gốc)'} – ${i.message}`));
  }
  if (problems.length) throw new Error(`Gói nội dung không hợp lệ:\n${problems.join('\n')}`);
}

export async function seed(prisma: PrismaClient, packs: GamePack[] = ALL_PACKS): Promise<SeedReport> {
  validatePacks(packs);

  for (const [key, role] of Object.entries(ROLES)) {
    await prisma.role.upsert({ where: { key }, update: { name: role.name }, create: { key, name: role.name } });
  }

  const productIds: Record<string, string> = {};
  for (const p of PRODUCTS) {
    const row = await prisma.product.upsert({ where: { slug: p.slug }, update: {}, create: { ...p, theme: p.theme } });
    productIds[p.slug] = row.id;
    const tax = TAXONOMY[p.slug];
    for (const [i, [slug, name]] of tax.levels.entries()) {
      await prisma.level.upsert({ where: { productId_slug: { productId: row.id, slug } }, update: {}, create: { productId: row.id, slug, name, sortOrder: i + 1 } });
    }
    for (const [i, [slug, name]] of tax.categories.entries()) {
      await prisma.gameCategory.upsert({ where: { productId_slug: { productId: row.id, slug } }, update: {}, create: { productId: row.id, slug, name, sortOrder: i + 1 } });
    }
  }

  const report: SeedReport = { roles: Object.keys(ROLES).length, products: PRODUCTS.length, gamesCreated: 0, gamesUpdated: 0, gamesSkipped: 0 };
  for (const pack of packs) {
    const productId = productIds[pack.product];
    const [category, level] = await Promise.all([
      prisma.gameCategory.findUnique({ where: { productId_slug: { productId, slug: pack.category } } }),
      prisma.level.findUnique({ where: { productId_slug: { productId, slug: pack.level } } }),
    ]);
    const data = validateGameData(pack.templateKey, pack.data);
    if (!data.ok) throw new Error(`Không hợp lệ: ${pack.slug}`);
    const content = data.data as unknown as Prisma.InputJsonValue;
    const meta = {
      title: pack.title, summary: pack.summary, templateKey: pack.templateKey, difficulty: pack.difficulty,
      accessLevel: pack.accessLevel === 'FREE' ? AccessLevel.FREE : AccessLevel.PREMIUM,
      categoryId: category?.id ?? null, levelId: level?.id ?? null, gradeLevel: level?.name ?? null,
      sortOrder: pack.sortOrder, isPublished: pack.published, seedRevision: pack.revision,
    };

    const existing = await prisma.game.findUnique({
      where: { productId_slug: { productId, slug: pack.slug } },
      include: { versions: { select: { versionNumber: true }, orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    if (!existing) {
      await prisma.game.create({
        data: { productId, slug: pack.slug, ...meta, versions: { create: { versionNumber: 1, content, isPublished: true } } },
      });
      report.gamesCreated++;
      continue;
    }
    if (!existing.managedBySeed || existing.seedRevision >= pack.revision) {
      report.gamesSkipped++;
      continue;
    }
    const next = (existing.versions[0]?.versionNumber ?? 0) + 1;
    await prisma.$transaction([
      prisma.gameVersion.updateMany({ where: { gameId: existing.id }, data: { isPublished: false } }),
      prisma.gameVersion.create({ data: { gameId: existing.id, versionNumber: next, content, isPublished: true } }),
      prisma.game.update({ where: { id: existing.id }, data: meta }),
      prisma.auditLog.create({
        data: { action: 'seed.game_version_published', entityType: 'game', entityId: existing.id, metadata: { slug: pack.slug, version: next, revision: pack.revision } },
      }),
    ]);
    report.gamesUpdated++;
  }
  return report;
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seed(prisma)
    .then((r) => console.log(`Seed hoàn tất: ${r.roles} vai trò, ${r.products} sản phẩm; game mới ${r.gamesCreated}, cập nhật ${r.gamesUpdated}, giữ nguyên ${r.gamesSkipped}.`))
    .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
