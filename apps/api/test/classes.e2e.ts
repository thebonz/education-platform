import { createTestApp, createUser, login, ORIGIN_VI, TestApp } from './helpers';

const PW = 'Correct-Horse-42';

describe('Lớp học của giáo viên', () => {
  let t: TestApp;
  let teacher: string;
  let other: string;
  let classId: string;
  let code: string;
  let classGameId: string;
  let studentA: string;

  beforeAll(async () => {
    t = await createTestApp();
    await createUser(t.prisma, 'teacher@example.com', PW);
    await createUser(t.prisma, 'other@example.com', PW);
    teacher = await login(t, 'teacher@example.com', PW, ORIGIN_VI);
    other = await login(t, 'other@example.com', PW, ORIGIN_VI);
  });
  afterAll(async () => { await t.close(); });

  const as = (cookie: string | null) => ({
    get: (url: string) => (cookie ? t.http().get(url).set('Cookie', cookie) : t.http().get(url)),
    post: (url: string, body: object = {}) => { const r = t.http().post(url).set('Origin', ORIGIN_VI).send(body); return cookie ? r.set('Cookie', cookie) : r; },
    patch: (url: string, body: object) => t.http().patch(url).set('Origin', ORIGIN_VI).set('Cookie', cookie!).send(body),
    del: (url: string) => t.http().delete(url).set('Origin', ORIGIN_VI).set('Cookie', cookie!),
  });

  it('tạo lớp cần đăng nhập; mã lớp 6 ký tự không dễ nhầm', async () => {
    await as(null).post('/api/classes', { product: 'vietnamese', name: 'Lớp 1A' }).expect(401);
    const res = await as(teacher).post('/api/classes', { product: 'vietnamese', name: 'Lớp 1A', gradeLabel: 'Lớp 1' }).expect(201);
    expect(res.body.joinCode).toMatch(/^[2-9A-HJKMNP-Z]{6}$/);
    classId = res.body.id; code = res.body.joinCode;
    const list = await as(teacher).get('/api/classes').expect(200);
    expect(list.body.classes).toEqual([expect.objectContaining({ id: classId, students: 0, games: 0, product: expect.objectContaining({ slug: 'vietnamese' }) })]);
  });

  it('người khác không thấy lớp', async () => {
    await as(other).get(`/api/classes/${classId}`).expect(404);
    await as(other).post(`/api/classes/${classId}/students`, { students: [{ nickname: 'X' }] }).expect(404);
    expect((await as(other).get('/api/classes').expect(200)).body.classes).toEqual([]);
  });

  it('thêm học sinh bằng biệt danh; từ chối dữ liệu không phải emoji ở ảnh đại diện', async () => {
    await as(teacher).post(`/api/classes/${classId}/students`, { students: [{ nickname: 'An', avatar: '🐶' }, { nickname: 'Bình' }] }).expect(201);
    await as(teacher).post(`/api/classes/${classId}/students`, { students: [{ nickname: 'C', avatar: '<b>' }] }).expect(400);
    const d = await as(teacher).get(`/api/classes/${classId}`).expect(200);
    expect(d.body.students.map((s: { nickname: string }) => s.nickname)).toEqual(['An', 'Bình']);
    studentA = d.body.students[0].id;
  });

  it('chép game miễn phí vào lớp; game trả phí cần gói; game khác sản phẩm bị từ chối', async () => {
    const free = await t.prisma.game.findFirstOrThrow({ where: { slug: 'chon-dau-cau-lop-2' } });
    const res = await as(teacher).post(`/api/classes/${classId}/games`, { gameId: free.id }).expect(201);
    classGameId = res.body.id;

    const premium = await t.prisma.game.findFirstOrThrow({ where: { slug: 'so-sanh-lop-3' } });
    await t.prisma.game.update({ where: { id: premium.id }, data: { accessLevel: 'PREMIUM' } });
    const r2 = await as(teacher).post(`/api/classes/${classId}/games`, { gameId: premium.id }).expect(403);
    expect(r2.body.error).toBe('membership_required');

    const english = await t.prisma.game.findFirstOrThrow({ where: { product: { slug: 'english' } } });
    await as(teacher).post(`/api/classes/${classId}/games`, { gameId: english.id }).expect(400);
  });

  it('sửa bản sao của lớp: kiểm tra schema; game gốc không đổi', async () => {
    const g = await as(teacher).get(`/api/classes/${classId}/games/${classGameId}`).expect(200);
    const content = g.body.content as { questions: { prompt: string }[] };
    const bad = await as(teacher).patch(`/api/classes/${classId}/games/${classGameId}`, { content: { ...content, questions: content.questions.slice(0, 1) } }).expect(400);
    expect(bad.body.error).toBe('invalid_content');
    const edited = { ...content, questions: content.questions.slice(0, 3).map((q, i) => (i === 0 ? { ...q, prompt: 'Lớp 1A làm bài chưa …' } : q)) };
    await as(teacher).patch(`/api/classes/${classId}/games/${classGameId}`, { title: 'Dấu câu – 1A', content: edited }).expect(200);
    const source = await t.prisma.gameVersion.findFirstOrThrow({ where: { game: { slug: 'chon-dau-cau-lop-2' }, isPublished: true } });
    expect((source.content as { questions: unknown[] }).questions).toHaveLength(8);
  });

  it('học sinh vào bằng mã lớp (không đăng nhập), thấy biệt danh và game, chơi và gửi kết quả', async () => {
    const view = await as(null).get(`/api/class-join/${code.toLowerCase()}`).expect(200);
    expect(view.body).toMatchObject({ name: 'Lớp 1A', product: { slug: 'vietnamese' } });
    expect(view.body.students.map((s: { nickname: string }) => s.nickname)).toEqual(['An', 'Bình']);
    expect(view.body.games).toEqual([expect.objectContaining({ id: classGameId, title: 'Dấu câu – 1A', locked: false })]);
    expect(JSON.stringify(view.body)).not.toContain('teacher@example.com');

    const game = await as(null).get(`/api/class-join/${code}/games/${classGameId}`).expect(200);
    expect(game.body.data.questions).toHaveLength(3);
    await as(null).post(`/api/class-join/${code}/games/${classGameId}/plays`, { studentId: studentA, score: 3, maxScore: 3, mistakes: 0, stars: 3, durationMs: 40_000 }).expect(201);
    await as(null).post(`/api/class-join/${code}/games/${classGameId}/plays`, { score: 1, maxScore: 3, mistakes: 2, stars: 1, durationMs: 50_000 }).expect(201);
    // Học sinh của lớp khác / dữ liệu vô lý bị từ chối
    await as(null).post(`/api/class-join/${code}/games/${classGameId}/plays`, { studentId: '00000000-0000-4000-8000-000000000000', score: 1, maxScore: 3, stars: 1, durationMs: 1 }).expect(400);
    await as(null).post(`/api/class-join/${code}/games/${classGameId}/plays`, { score: 5, maxScore: 3, stars: 3, durationMs: 1 }).expect(400);
    await as(null).get('/api/class-join/ZZZZZZ').expect(404);
    await as(null).get('/api/class-join/abc').expect(400);
  });

  it('chỉ chủ lớp xem kết quả', async () => {
    await as(other).get(`/api/classes/${classId}/results`).expect(404);
    const r = await as(teacher).get(`/api/classes/${classId}/results`).expect(200);
    expect(r.body.cells).toEqual(expect.arrayContaining([
      expect.objectContaining({ studentId: studentA, classGameId, plays: 1, bestStars: 3 }),
      expect.objectContaining({ studentId: null, classGameId, plays: 1, bestStars: 1 }),
    ]));
    expect(r.body.recent[0].student).toBeNull();
  });

  it('xoá học sinh xoá luôn kết quả của em đó', async () => {
    await as(teacher).del(`/api/classes/${classId}/students/${studentA}`).expect(204);
    expect(await t.prisma.classPlay.count({ where: { studentId: studentA } })).toBe(0);
    expect(await t.prisma.classStudent.count({ where: { id: studentA } })).toBe(0);
  });

  it('đổi mã lớp: mã cũ hết hiệu lực; lưu trữ lớp thì học sinh không vào được', async () => {
    const r = await as(teacher).post(`/api/classes/${classId}/rotate-code`).expect(200);
    expect(r.body.joinCode).not.toBe(code);
    await as(null).get(`/api/class-join/${code}`).expect(404);
    await as(null).get(`/api/class-join/${r.body.joinCode}`).expect(200);
    await as(teacher).patch(`/api/classes/${classId}`, { isArchived: true }).expect(200);
    await as(null).get(`/api/class-join/${r.body.joinCode}`).expect(404);
  });

  it('chủ lớp có gói: game trả phí mở; hết gói: học sinh thấy khoá', async () => {
    const owner = await t.prisma.user.findUniqueOrThrow({ where: { email: 'teacher@example.com' } });
    const vi = await t.prisma.product.findUniqueOrThrow({ where: { slug: 'vietnamese' } });
    const c2 = await as(teacher).post('/api/classes', { product: 'vietnamese', name: 'Lớp 3B' }).expect(201);
    const ent = await t.prisma.entitlement.create({ data: { userId: owner.id, productId: vi.id, startsAt: new Date(), endsAt: new Date(Date.now() + 86_400_000), source: 'manual' } });
    const premium = await t.prisma.game.findFirstOrThrow({ where: { slug: 'so-sanh-lop-3' } });
    const g = await as(teacher).post(`/api/classes/${c2.body.id}/games`, { gameId: premium.id }).expect(201);
    await as(null).get(`/api/class-join/${c2.body.joinCode}/games/${g.body.id}`).expect(200);
    await t.prisma.entitlement.update({ where: { id: ent.id }, data: { endsAt: new Date(Date.now() - 1000) } });
    const view = await as(null).get(`/api/class-join/${c2.body.joinCode}`).expect(200);
    expect(view.body.games[0].locked).toBe(true);
    await as(null).get(`/api/class-join/${c2.body.joinCode}/games/${g.body.id}`).expect(403);
    await t.prisma.game.update({ where: { id: premium.id }, data: { accessLevel: 'FREE' } });
  });
});
