import { PrismaClient } from '@prisma/client';
import { ALL_PACKS, seed, validatePacks } from '../src/cli/seed';
import { resetDatabase } from './helpers';

describe('Seed nội dung game', () => {
  const prisma = new PrismaClient();
  beforeAll(async () => {
    if (!/test/i.test(new URL(process.env.DATABASE_URL!).pathname)) throw new Error('Chỉ chạy trên database test');
    await resetDatabase(prisma);
  });
  afterAll(async () => { await prisma.$disconnect(); });

  it('tạo đủ 12 game, cấp độ và danh mục; chạy lại không tạo trùng', async () => {
    expect(await prisma.game.count()).toBe(12);
    expect(await prisma.level.count()).toBe(12);
    expect(await prisma.gameCategory.count({ where: { product: { slug: 'english' } } })).toBe(20);
    const again = await seed(prisma);
    expect(again).toMatchObject({ gamesCreated: 0, gamesUpdated: 0, gamesSkipped: 12 });
    expect(await prisma.gameVersion.count()).toBe(12);
  });

  it('nâng cấp game cũ lên phiên bản nội dung mới, giữ bản cũ', async () => {
    const game = await prisma.game.findFirstOrThrow({ where: { slug: 'alphabet-bingo' } });
    await prisma.game.update({ where: { id: game.id }, data: { seedRevision: 1, templateKey: 'bingo-cu' } });
    const report = await seed(prisma);
    expect(report.gamesUpdated).toBe(1);
    const versions = await prisma.gameVersion.findMany({ where: { gameId: game.id }, orderBy: { versionNumber: 'asc' } });
    expect(versions.map((v) => [v.versionNumber, v.isPublished])).toEqual([[1, false], [2, true]]);
    const updated = await prisma.game.findUniqueOrThrow({ where: { id: game.id } });
    expect(updated).toMatchObject({ templateKey: 'bingo', seedRevision: 2 });
    expect(await prisma.auditLog.count({ where: { action: 'seed.game_version_published', entityId: game.id } })).toBe(1);
  });

  it('không ghi đè game admin đã chỉnh (managedBySeed = false)', async () => {
    const game = await prisma.game.findFirstOrThrow({ where: { slug: 'team-quiz' } });
    await prisma.game.update({ where: { id: game.id }, data: { managedBySeed: false, seedRevision: 0, title: 'Đã sửa bởi admin' } });
    await seed(prisma);
    const after = await prisma.game.findUniqueOrThrow({ where: { id: game.id } });
    expect(after.title).toBe('Đã sửa bởi admin');
    expect(await prisma.gameVersion.count({ where: { gameId: game.id } })).toBe(1);
  });

  it('từ chối gói nội dung sai schema hoặc sai danh mục', () => {
    expect(() => validatePacks(ALL_PACKS)).not.toThrow();
    const broken = { ...ALL_PACKS[0], data: { items: [] } };
    expect(() => validatePacks([broken])).toThrow(/items/);
    expect(() => validatePacks([{ ...ALL_PACKS[0], category: 'khong-co' }])).toThrow(/danh mục/);
    expect(() => validatePacks([ALL_PACKS[0], ALL_PACKS[0]])).toThrow(/trùng/);
  });
});
