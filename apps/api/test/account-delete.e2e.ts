import { createTestApp, createUser, login, ORIGIN_VI, TestApp } from './helpers';

const PW = 'Correct-Horse-42';

describe('Người dùng tự xoá tài khoản', () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.close(); });

  const post = (url: string, cookie: string, body: object) => t.http().post(url).set('Origin', ORIGIN_VI).set('Cookie', cookie).send(body);

  it('xoá dữ liệu cá nhân và lớp học; giữ đơn đã thanh toán dưới dạng ẩn danh; không đăng nhập lại được', async () => {
    const u = await createUser(t.prisma, 'parent@example.com', PW);
    const cookie = await login(t, 'parent@example.com', PW, ORIGIN_VI);
    const vi = await t.prisma.product.findUniqueOrThrow({ where: { slug: 'vietnamese' } });
    const plan = await t.prisma.plan.findFirstOrThrow({ where: { productId: vi.id } });
    const paid = await t.prisma.order.create({ data: { code: 'HCTESTPAID', userId: u.id, planId: plan.id, productId: vi.id, planName: plan.name, months: plan.months, amountVnd: plan.priceVnd, status: 'PAID', expiresAt: new Date(), paidAt: new Date() } });
    await t.prisma.entitlement.create({ data: { userId: u.id, productId: vi.id, startsAt: new Date(), endsAt: new Date(Date.now() + 86_400_000), source: 'order', orderId: paid.id } });
    const cls = await post('/api/classes', cookie, { product: 'vietnamese', name: 'Lớp 1A' }).expect(201);
    await post(`/api/classes/${cls.body.id}/students`, cookie, { students: [{ nickname: 'An' }] }).expect(201);

    // Sai mật khẩu hoặc thiếu xác nhận → không xoá
    await post('/api/account/delete', cookie, { password: 'Wrong-1', confirm: 'XOA' }).expect(400);
    await post('/api/account/delete', cookie, { password: PW }).expect(400);
    // Origin lạ bị chặn (CSRF)
    await t.http().post('/api/account/delete').set('Origin', 'https://evil.example').set('Cookie', cookie).send({ password: PW, confirm: 'XOA' }).expect(403);

    const res = await post('/api/account/delete', cookie, { password: PW, confirm: 'XOA' }).expect(204);
    expect(String(res.headers['set-cookie'])).toMatch(/hc_session=;/);

    const after = await t.prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.email).not.toContain('parent');
    expect(after.displayName).toBe('Tài khoản đã xoá');
    expect(after.isActive).toBe(false);
    expect(after.deletedAt).not.toBeNull();
    expect(await t.prisma.classroom.count({ where: { ownerId: u.id } })).toBe(0);
    expect(await t.prisma.classStudent.count({ where: { nickname: 'An' } })).toBe(0);
    expect(await t.prisma.consent.count({ where: { userId: u.id } })).toBe(0);
    expect(await t.prisma.userSession.count({ where: { userId: u.id } })).toBe(0);
    expect(await t.prisma.entitlement.count({ where: { userId: u.id } })).toBe(0);
    // Chứng từ kế toán còn nguyên
    expect((await t.prisma.order.findUniqueOrThrow({ where: { id: paid.id } })).status).toBe('PAID');

    await t.http().get('/api/auth/me').set('Cookie', cookie).expect(401);
    await t.http().post('/api/auth/login').set('Origin', ORIGIN_VI).send({ email: 'parent@example.com', password: PW }).expect(401);
    // Email được dùng để đăng ký lại từ đầu
    await t.http().post('/api/auth/register').set('Origin', ORIGIN_VI)
      .send({ email: 'parent@example.com', password: PW, displayName: 'Phụ huynh', acceptTerms: true, confirmAdult: true, site: 'vietnamese' }).expect(202);
    const again = await t.prisma.user.findUniqueOrThrow({ where: { email: 'parent@example.com' } });
    expect(again.id).not.toBe(u.id);
    expect(await t.prisma.auditLog.count({ where: { action: 'account.deleted', entityId: u.id } })).toBe(1);
  });

  it('tài khoản nhân sự không tự xoá được', async () => {
    await createUser(t.prisma, 'editor@example.com', PW, ['content_editor', 'member']);
    const cookie = await login(t, 'editor@example.com', PW, ORIGIN_VI);
    const r = await post('/api/account/delete', cookie, { password: PW, confirm: 'XOA' }).expect(403);
    expect(r.body.error).toBe('staff_account');
  });
});
