import { createTestApp, createUser, login, ORIGIN_ADMIN, ORIGIN_EN, TestApp } from './helpers';

const PW = 'Correct-Horse-42';

describe('Phân quyền và quản trị', () => {
  let t: TestApp;
  let superCookie: string;
  let memberCookie: string;
  let memberId: string;

  beforeAll(async () => {
    t = await createTestApp();
    await createUser(t.prisma, 'root@example.com', PW, ['super_admin', 'member']);
    memberId = (await createUser(t.prisma, 'member@example.com', PW)).id;
    superCookie = await login(t, 'root@example.com', PW, ORIGIN_ADMIN);
    memberCookie = await login(t, 'member@example.com', PW);
  });
  afterAll(async () => { await t.close(); });

  const admin = (cookie: string) => ({
    get: (url: string) => t.http().get(url).set('Cookie', cookie),
    post: (url: string, body: object = {}) => t.http().post(url).set('Origin', ORIGIN_ADMIN).set('Cookie', cookie).send(body),
    put: (url: string, body: object) => t.http().put(url).set('Origin', ORIGIN_ADMIN).set('Cookie', cookie).send(body),
    patch: (url: string, body: object) => t.http().patch(url).set('Origin', ORIGIN_ADMIN).set('Cookie', cookie).send(body),
  });

  it('khách và thành viên thường không vào được admin', async () => {
    await t.http().get('/api/admin/stats').expect(401);
    await admin(memberCookie).get('/api/admin/stats').expect(403);
    await admin(memberCookie).get('/api/admin/users').expect(403);
    await admin(memberCookie).post(`/api/admin/users/${memberId}/lock`, { reason: 'test lock' }).expect(403);
  });

  it('super admin xem thống kê và danh sách người dùng', async () => {
    const stats = await admin(superCookie).get('/api/admin/stats').expect(200);
    expect(stats.body.users.total).toBe(2);
    expect(stats.body.products).toEqual(expect.arrayContaining([
      expect.objectContaining({ slug: 'english', publishedGames: 6 }),
      expect.objectContaining({ slug: 'vietnamese', publishedGames: 5 }),
    ]));
    const users = await admin(superCookie).get('/api/admin/users?q=member').expect(200);
    expect(users.body.total).toBe(1);
    expect(users.body.users[0]).not.toHaveProperty('passwordHash');
  });

  it('khóa tài khoản thu hồi phiên và chặn đăng nhập; mở khóa khôi phục', async () => {
    await createUser(t.prisma, 'victim@example.com', PW);
    const victimCookie = await login(t, 'victim@example.com', PW);
    const victim = await t.prisma.user.findUniqueOrThrow({ where: { email: 'victim@example.com' } });

    await admin(superCookie).post(`/api/admin/users/${victim.id}/lock`, { reason: 'Vi phạm điều khoản' }).expect(200);
    await t.http().get('/api/auth/me').set('Cookie', victimCookie).expect(401);
    const blocked = await t.http().post('/api/auth/login').set('Origin', ORIGIN_EN).send({ email: 'victim@example.com', password: PW }).expect(401);
    expect(blocked.body.error).toBe('account_locked');

    await admin(superCookie).post(`/api/admin/users/${victim.id}/unlock`).expect(200);
    await login(t, 'victim@example.com', PW);

    const root = await t.prisma.user.findUniqueOrThrow({ where: { email: 'root@example.com' } });
    await admin(superCookie).post(`/api/admin/users/${root.id}/lock`, { reason: 'self' }).expect(400);
  });

  it('gán vai trò, chặn leo thang quyền và giữ ít nhất một super admin', async () => {
    const support = await createUser(t.prisma, 'support@example.com', PW, ['support', 'member']);
    const supportCookie = await login(t, 'support@example.com', PW, ORIGIN_ADMIN);

    await admin(supportCookie).get('/api/admin/users').expect(200);
    await admin(supportCookie).put(`/api/admin/users/${memberId}/roles`, { roles: ['teacher'] }).expect(403); // thiếu roles.assign
    await admin(supportCookie).put(`/api/admin/users/${support.id}/roles`, { roles: ['super_admin'] }).expect(403);

    await admin(superCookie).put(`/api/admin/users/${memberId}/roles`, { roles: ['member', 'teacher'] }).expect(200);
    await admin(superCookie).put(`/api/admin/users/${memberId}/roles`, { roles: ['hacker'] }).expect(400);
    const me = await t.http().get('/api/auth/me').set('Cookie', memberCookie).expect(200);
    expect(me.body.user.roles).toEqual(['member', 'teacher']);

    const root = await t.prisma.user.findUniqueOrThrow({ where: { email: 'root@example.com' } });
    const res = await admin(superCookie).put(`/api/admin/users/${root.id}/roles`, { roles: ['member'] }).expect(400);
    expect(res.body.error).toBe('last_super_admin');
  });

  it('sửa sản phẩm và domain; ghi audit log', async () => {
    const products = await admin(superCookie).get('/api/admin/products').expect(200);
    const vi = products.body.find((p: { slug: string }) => p.slug === 'vietnamese');
    await admin(superCookie).patch(`/api/admin/products/${vi.id}`, { name: 'Tiếng Việt Vui', theme: { accent: '#159a83', accentSoft: '#e8fbf5', background: '#f8fffc' } }).expect(200);
    await admin(superCookie).patch(`/api/admin/products/${vi.id}`, { slug: 'hack' }).expect(400);
    await admin(superCookie).post(`/api/admin/products/${vi.id}/domains`, { hostname: 'TiengViet.HappyClass.asia', isPrimary: true }).expect(201);
    await admin(superCookie).post(`/api/admin/products/${vi.id}/domains`, { hostname: 'tiengviet.happyclass.asia' }).expect(409);
    await admin(superCookie).post(`/api/admin/products/${vi.id}/domains`, { hostname: 'not a host' }).expect(400);

    const logs = await admin(superCookie).get('/api/admin/audit-logs?action=admin.').expect(200);
    const actions = logs.body.logs.map((l: { action: string }) => l.action);
    expect(actions).toEqual(expect.arrayContaining(['admin.user_locked', 'admin.user_unlocked', 'admin.user_roles_changed', 'admin.product_updated', 'admin.domain_added']));
    expect(logs.body.logs[0].actorEmail).toBe('root@example.com');
    await admin(memberCookie).get('/api/admin/audit-logs').expect(403);
  });
});
