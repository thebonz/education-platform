import { AccessLevel } from '@prisma/client';
import { createTestApp, createUser, login, TestApp } from './helpers';

const PW = 'Correct-Horse-42';

describe('Thư viện game và kiểm tra quyền chơi ở backend', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
    const vi = await t.prisma.product.findUniqueOrThrow({ where: { slug: 'vietnamese' } });
    await t.prisma.game.create({
      data: {
        productId: vi.id, slug: 'game-tra-phi', title: 'Game trả phí', summary: 'Chỉ dành cho thành viên',
        templateKey: 'quiz', accessLevel: AccessLevel.PREMIUM, isPublished: true,
        versions: { create: { versionNumber: 1, isPublished: true, content: { questions: [{ prompt: 'BÍ MẬT', choices: ['a'], answer: 'a' }] } } },
      },
    });
  });
  afterAll(async () => { await t.close(); });

  it('có đủ 12 game demo, 6 mỗi sản phẩm', async () => {
    const en = await t.http().get('/api/catalog/products/english/games').expect(200);
    const vi = await t.http().get('/api/catalog/products/vietnamese/games').expect(200);
    expect(en.body).toHaveLength(6);
    expect(vi.body.filter((g: { accessLevel: string }) => g.accessLevel === 'FREE')).toHaveLength(6);
  });

  it('danh sách game không bao giờ kèm nội dung câu hỏi', async () => {
    const res = await t.http().get('/api/catalog/products/vietnamese/games').expect(200);
    expect(JSON.stringify(res.body)).not.toContain('BÍ MẬT');
    for (const g of res.body) expect(g).not.toHaveProperty('content');
  });

  it('game miễn phí chơi được không cần đăng nhập', async () => {
    const res = await t.http().get('/api/catalog/products/english/games/team-quiz/play').expect(200);
    expect(res.body.content.questions.length).toBeGreaterThan(0);
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

  it('slug không hợp lệ hoặc không tồn tại trả 404', async () => {
    await t.http().get('/api/catalog/products/khong-co/games').expect(404);
    await t.http().get('/api/catalog/products/english/games/khong-co').expect(404);
    await t.http().get("/api/catalog/products/english/games/x'%20OR%201=1").expect(404);
  });
});
