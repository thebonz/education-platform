import { createTestApp, createUser, login, ORIGIN_ADMIN, TestApp } from './helpers';

const PW = 'Correct-Horse-42';

describe('Duyệt nội dung game (giáo viên duyệt)', () => {
  let t: TestApp;
  let reviewer: string;
  let editor: string;
  let member: string;
  let gameId: string;

  beforeAll(async () => {
    t = await createTestApp();
    await createUser(t.prisma, 'reviewer@example.com', PW, ['content_reviewer']);
    await createUser(t.prisma, 'editor@example.com', PW, ['content_editor']);
    await createUser(t.prisma, 'member@example.com', PW);
    reviewer = await login(t, 'reviewer@example.com', PW, ORIGIN_ADMIN);
    editor = await login(t, 'editor@example.com', PW, ORIGIN_ADMIN);
    member = await login(t, 'member@example.com', PW, ORIGIN_ADMIN);
    gameId = (await t.prisma.game.findFirstOrThrow({ where: { slug: 'ghep-tieng-co-ban' } })).id;
  });
  afterAll(async () => { await t.close(); });

  const as = (cookie: string) => ({
    get: (url: string) => t.http().get(url).set('Cookie', cookie),
    post: (url: string, body: object) => t.http().post(url).set('Origin', ORIGIN_ADMIN).set('Cookie', cookie).send(body),
  });

  it('thành viên thường không xem được danh sách nội dung', async () => {
    await t.http().get('/api/admin/games').expect(401);
    await as(member).get('/api/admin/games').expect(403);
  });

  it('lọc theo sản phẩm và trạng thái duyệt; đếm số game chờ duyệt', async () => {
    const res = await as(editor).get('/api/admin/games?product=vietnamese&review=PENDING&pageSize=100').expect(200);
    expect(res.body.total).toBe(23);
    expect(res.body.reviewCounts).toEqual({ PENDING: 23 });
    expect(res.body.games[0]).toMatchObject({ product: { slug: 'vietnamese' }, reviewStatus: 'PENDING', version: 1 });
    expect(res.body.games[0]).not.toHaveProperty('content');
    await as(editor).get('/api/admin/games?review=KHONG_CO').expect(400);
  });

  it('chi tiết kèm nội dung phiên bản đang phát hành để đọc soát', async () => {
    const res = await as(editor).get(`/api/admin/games/${gameId}`).expect(200);
    expect(res.body.version.versionNumber).toBe(1);
    expect(res.body.version.content.items.length).toBeGreaterThan(5);
  });

  it('biên tập viên không có quyền duyệt', async () => {
    await as(editor).post(`/api/admin/games/${gameId}/review`, { status: 'APPROVED' }).expect(403);
  });

  it('yêu cầu sửa bắt buộc có ghi chú', async () => {
    const res = await as(reviewer).post(`/api/admin/games/${gameId}/review`, { status: 'CHANGES_REQUESTED' }).expect(400);
    expect(res.body.fields).toContain('note');
    await as(reviewer).post(`/api/admin/games/${gameId}/review`, { status: 'PENDING' }).expect(400);
  });

  it('giáo viên duyệt: lưu người duyệt, ghi audit, trang công khai thấy trạng thái mới', async () => {
    await as(reviewer).post(`/api/admin/games/${gameId}/review`, { status: 'CHANGES_REQUESTED', note: 'Nên thay hình chiếc ghế' }).expect(200);
    const ok = await as(reviewer).post(`/api/admin/games/${gameId}/review`, { status: 'APPROVED', note: '  Đã kiểm tra  ' }).expect(200);
    expect(ok.body).toMatchObject({ reviewStatus: 'APPROVED', reviewNote: 'Đã kiểm tra' });

    const detail = await as(editor).get(`/api/admin/games/${gameId}`).expect(200);
    expect(detail.body.reviewer).toMatchObject({ email: 'reviewer@example.com' });

    const logs = await t.prisma.auditLog.findMany({ where: { action: 'admin.game_reviewed', entityId: gameId }, orderBy: { createdAt: 'asc' } });
    expect(logs.map((l) => (l.metadata as { status: string }).status)).toEqual(['CHANGES_REQUESTED', 'APPROVED']);
    expect(logs[0].metadata).toMatchObject({ slug: 'ghep-tieng-co-ban', version: 1 });

    const pub = await t.http().get('/api/catalog/products/vietnamese/games/ghep-tieng-co-ban').expect(200);
    expect(pub.body.reviewStatus).toBe('APPROVED');
    const counts = await as(editor).get('/api/admin/games?product=vietnamese').expect(200);
    expect(counts.body.reviewCounts).toEqual({ APPROVED: 1, PENDING: 22 });
  });

  it('id không hợp lệ hoặc không tồn tại', async () => {
    await as(reviewer).post('/api/admin/games/khong-phai-uuid/review', { status: 'APPROVED' }).expect(400);
    await as(reviewer).post('/api/admin/games/00000000-0000-4000-8000-000000000000/review', { status: 'APPROVED' }).expect(404);
  });
});
