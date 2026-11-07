import { AccessLevel } from '@prisma/client';
import { createTestApp, createUser, login, ORIGIN_EN, TestApp } from './helpers';

const PW = 'Correct-Horse-42';
const SECRET_QUIZ = {
  questions: [
    { id: 'q1', prompt: 'BÍ MẬT', choices: ['a', 'b'], answer: 'a' },
    { id: 'q2', prompt: 'Câu 2', choices: ['a', 'b'], answer: 'b' },
    { id: 'q3', prompt: 'Câu 3', choices: ['a', 'b'], answer: 'a' },
  ],
};

describe('Thư viện game và kiểm tra quyền chơi ở backend', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
    const vi = await t.prisma.product.findUniqueOrThrow({ where: { slug: 'vietnamese' } });
    await t.prisma.game.create({
      data: {
        productId: vi.id, slug: 'game-tra-phi', title: 'Game trả phí', summary: 'Chỉ dành cho thành viên',
        templateKey: 'quiz', accessLevel: AccessLevel.PREMIUM, isPublished: true,
        versions: { create: { versionNumber: 1, isPublished: true, content: SECRET_QUIZ } },
      },
    });
    await t.prisma.game.create({
      data: {
        productId: vi.id, slug: 'game-hong', title: 'Game hỏng', summary: 'Nội dung sai schema',
        templateKey: 'quiz', accessLevel: AccessLevel.FREE, isPublished: true,
        versions: { create: { versionNumber: 1, isPublished: true, content: { questions: [] } } },
      },
    });
  });
  afterAll(async () => { await t.close(); });

  it('6 game English và 5 game Vietnamese đang xuất bản (Ghép vần tạm ẩn)', async () => {
    const en = await t.http().get('/api/catalog/products/english/games').expect(200);
    expect(en.body.map((g: { slug: string }) => g.slug)).toEqual([
      'alphabet-bingo', 'vocabulary-matching', 'hidden-picture', 'bubble-word-garden', 'spelling-challenge', 'team-quiz',
    ]);
    expect(en.body[0].level).toMatchObject({ slug: 'kindergarten', name: 'Kindergarten' });
    const vi = await t.http().get('/api/catalog/products/vietnamese/games').expect(200);
    const seeded = vi.body.filter((g: { slug: string }) => !g.slug.startsWith('game-'));
    expect(seeded).toHaveLength(5);
    expect(seeded.map((g: { slug: string }) => g.slug)).not.toContain('ghep-van');
  });

  it('taxonomy chỉ liệt kê danh mục và cấp độ có game', async () => {
    const res = await t.http().get('/api/catalog/products/english/taxonomy').expect(200);
    expect(res.body.levels.map((l: { slug: string }) => l.slug)).toEqual(['kindergarten', 'primary', 'pre-a1', 'a1']);
    expect(res.body.categories).toEqual(expect.arrayContaining([{ slug: 'spelling', name: 'Spelling Games', games: 2 }]));
    expect(res.body.categories.find((c: { slug: string }) => c.slug === 'grammar')).toBeUndefined();
  });

  it('danh sách game không bao giờ kèm nội dung câu hỏi', async () => {
    const res = await t.http().get('/api/catalog/products/vietnamese/games').expect(200);
    expect(JSON.stringify(res.body)).not.toContain('BÍ MẬT');
    for (const g of res.body) { expect(g).not.toHaveProperty('content'); expect(g).not.toHaveProperty('data'); }
  });

  it('game miễn phí chơi được không cần đăng nhập; dữ liệu đã điền mặc định theo template', async () => {
    const res = await t.http().get('/api/catalog/products/english/games/team-quiz/play').expect(200);
    expect(res.body.game.templateKey).toBe('quiz');
    expect(res.body.data.questions).toHaveLength(10);
    expect(res.body.data.mode).toBe('teams');
    const bingo = await t.http().get('/api/catalog/products/english/games/alphabet-bingo/play').expect(200);
    expect(bingo.body.data.items).toHaveLength(26);
  });

  it('nội dung sai schema không được trả cho người chơi', async () => {
    const res = await t.http().get('/api/catalog/products/vietnamese/games/game-hong/play').expect(500);
    expect(res.body.error).toBe('invalid_game_content');
  });

  it('game trả phí: khách 401, thành viên 403, biên tập viên xem trước được', async () => {
    const url = '/api/catalog/products/vietnamese/games/game-tra-phi/play';
    await t.http().get(url).expect(401);
    await createUser(t.prisma, 'member@example.com', PW);
    const member = await login(t, 'member@example.com', PW);
    const denied = await t.http().get(url).set('Cookie', member).expect(403);
    expect(denied.body.error).toBe('membership_required');
    expect(JSON.stringify(denied.body)).not.toContain('BÍ MẬT');
    await createUser(t.prisma, 'editor@example.com', PW, ['content_editor']);
    const editor = await login(t, 'editor@example.com', PW);
    const ok = await t.http().get(url).set('Cookie', editor).expect(200);
    expect(JSON.stringify(ok.body)).toContain('BÍ MẬT');
  });

  it('lưu kết quả chơi, game gần đây và yêu thích', async () => {
    await createUser(t.prisma, 'player@example.com', PW);
    const cookie = await login(t, 'player@example.com', PW);
    const url = '/api/catalog/products/english/games/team-quiz/sessions';
    const result = { score: 8, maxScore: 10, mistakes: 2, stars: 2, durationMs: 95_000 };

    await t.http().post(url).set('Origin', ORIGIN_EN).send(result).expect(401);
    await t.http().post(url).set('Origin', ORIGIN_EN).set('Cookie', cookie).send({ ...result, score: 11 }).expect(400);
    await t.http().post(url).set('Origin', ORIGIN_EN).set('Cookie', cookie).send({ ...result, stars: 4 }).expect(400);
    await t.http().post(url).set('Origin', ORIGIN_EN).set('Cookie', cookie).send(result).expect(201);
    await t.http().post(url).set('Origin', ORIGIN_EN).set('Cookie', cookie).send({ ...result, score: 10, stars: 3 }).expect(201);
    await t.http().post('/api/catalog/products/vietnamese/games/game-tra-phi/sessions').set('Origin', ORIGIN_EN).set('Cookie', cookie).send(result).expect(403);

    const recent = await t.http().get('/api/account/recent-games').set('Cookie', cookie).expect(200);
    expect(recent.body.games).toHaveLength(1);
    expect(recent.body.games[0]).toMatchObject({ slug: 'team-quiz', product: 'english', plays: 2, bestStars: 3, lastScore: 10 });

    const detail = await t.http().get('/api/catalog/products/english/games/team-quiz').set('Cookie', cookie).expect(200);
    expect(detail.body.favorite).toBe(false);
    await t.http().put(`/api/account/favorites/${detail.body.id}`).set('Origin', ORIGIN_EN).set('Cookie', cookie).expect(204);
    await t.http().put(`/api/account/favorites/${detail.body.id}`).set('Origin', ORIGIN_EN).set('Cookie', cookie).expect(204);
    const fav = await t.http().get('/api/account/favorites').set('Cookie', cookie).expect(200);
    expect(fav.body.favorites).toHaveLength(1);
    expect(fav.body.favorites[0]).toMatchObject({ slug: 'team-quiz', product: 'english' });
    expect((await t.http().get('/api/catalog/products/english/games/team-quiz').set('Cookie', cookie)).body.favorite).toBe(true);
    await t.http().delete(`/api/account/favorites/${detail.body.id}`).set('Origin', ORIGIN_EN).set('Cookie', cookie).expect(204);
    expect((await t.http().get('/api/account/favorites').set('Cookie', cookie)).body.favorites).toHaveLength(0);
    await t.http().put('/api/account/favorites/00000000-0000-0000-0000-000000000000').set('Origin', ORIGIN_EN).set('Cookie', cookie).expect(404);
  });

  it('slug không hợp lệ hoặc không tồn tại trả 404', async () => {
    await t.http().get('/api/catalog/products/khong-co/games').expect(404);
    await t.http().get('/api/catalog/products/english/games/khong-co').expect(404);
    await t.http().get("/api/catalog/products/english/games/x'%20OR%201=1").expect(404);
  });
});
