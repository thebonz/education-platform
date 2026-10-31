import { createTestApp, createUser, login, ORIGIN_EN, ORIGIN_VI, sessionCookie, TestApp, tokenFromMail } from './helpers';

const PW = 'Correct-Horse-42';

describe('Xác thực tài khoản', () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.close(); });

  const register = (body: Record<string, unknown>, origin = ORIGIN_EN) =>
    t.http().post('/api/auth/register').set('Origin', origin).send(body);

  const valid = (email: string) => ({ email, password: PW, displayName: 'Cô Lan', site: 'english', acceptTerms: true, confirmAdult: true });

  it('đăng ký, xác thực email, đăng nhập và đăng xuất', async () => {
    await register(valid('Lan@Example.com')).expect(202, { ok: true });

    const user = await t.prisma.user.findUniqueOrThrow({ where: { email: 'lan@example.com' }, include: { roles: { include: { role: true } }, consents: true } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.roles.map((r) => r.role.key)).toEqual(['member']);
    expect(user.consents.map((c) => c.kind).sort()).toEqual(['adult_account', 'privacy', 'terms']);

    const cookie = await login(t, 'lan@example.com', PW);
    const me = await t.http().get('/api/auth/me').set('Cookie', cookie).expect(200);
    expect(me.body.user).toMatchObject({ email: 'lan@example.com', emailVerified: false, roles: ['member'] });
    expect(me.body.user.passwordHash).toBeUndefined();

    const token = tokenFromMail(t.mail, 'lan@example.com', 'verify-email');
    expect(t.mail.outbox.at(-1)!.text).toContain(`${ORIGIN_EN}/verify-email?token=`);
    await t.http().post('/api/auth/verify-email').set('Origin', ORIGIN_EN).send({ token }).expect(200);
    await t.http().post('/api/auth/verify-email').set('Origin', ORIGIN_EN).send({ token }).expect(400); // dùng một lần

    const after = await t.http().get('/api/auth/me').set('Cookie', cookie).expect(200);
    expect(after.body.user.emailVerified).toBe(true);

    await t.http().post('/api/auth/logout').set('Origin', ORIGIN_EN).set('Cookie', cookie).expect(204);
    await t.http().get('/api/auth/me').set('Cookie', cookie).expect(401);
  });

  it('cookie phiên có HttpOnly, SameSite=Lax và domain dùng chung subdomain', async () => {
    await createUser(t.prisma, 'cookie@example.com', PW);
    const res = await t.http().post('/api/auth/login').set('Origin', ORIGIN_EN).send({ email: 'cookie@example.com', password: PW }).expect(200);
    const raw = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('hc_session='))!;
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/SameSite=Lax/i);
    expect(raw).toMatch(/Domain=\.?happyclass\.test/i);
    expect(raw).toMatch(/Path=\//);
    const stored = await t.prisma.userSession.findFirstOrThrow({ where: { user: { email: 'cookie@example.com' } } });
    expect(sessionCookie(res)).not.toContain(stored.tokenHash); // DB chỉ lưu hash
  });

  it('phiên tạo trên site English dùng được khi gọi từ site Vietnamese', async () => {
    await createUser(t.prisma, 'sso@example.com', PW);
    const cookie = await login(t, 'sso@example.com', PW, ORIGIN_EN);
    await t.http().get('/api/auth/me').set('Origin', ORIGIN_VI).set('Cookie', cookie).expect(200);
    await t.http().patch('/api/account/profile').set('Origin', ORIGIN_VI).set('Cookie', cookie).send({ displayName: 'Thầy Minh' }).expect(200);
  });

  it('không tiết lộ email đã đăng ký', async () => {
    await createUser(t.prisma, 'exists@example.com', PW);
    const a = await register(valid('exists@example.com'));
    const b = await register(valid('brand-new@example.com'));
    expect(a.status).toBe(202);
    expect(a.body).toEqual(b.body);
    expect(t.mail.outbox.at(-2)!.subject).toMatch(/already have/i);

    const wrongPw = await t.http().post('/api/auth/login').set('Origin', ORIGIN_EN).send({ email: 'exists@example.com', password: 'nope-nope-nope' });
    const noUser = await t.http().post('/api/auth/login').set('Origin', ORIGIN_EN).send({ email: 'ghost@example.com', password: 'nope-nope-nope' });
    expect(wrongPw.status).toBe(401);
    expect(noUser.status).toBe(401);
    expect(wrongPw.body).toEqual(noUser.body);

    const before = t.mail.outbox.length;
    await t.http().post('/api/auth/forgot-password').set('Origin', ORIGIN_EN).send({ email: 'ghost@example.com' }).expect(202);
    expect(t.mail.outbox.length).toBe(before);
  });

  it('từ chối dữ liệu không hợp lệ', async () => {
    await register({ ...valid('a@example.com'), acceptTerms: false }).expect(400);
    await register({ ...valid('a@example.com'), confirmAdult: undefined }).expect(400);
    await register({ ...valid('a@example.com'), password: 'short' }).expect(400);
    await register({ ...valid('not-an-email') }).expect(400);
    const res = await register({ ...valid('a@example.com'), displayName: '' }).expect(400);
    expect(res.body.fields).toContain('displayName');
  });

  it('chuẩn hóa tên tiếng Việt về Unicode NFC', async () => {
    const nfd = 'Nguyễn Thị Hoà'.normalize('NFD');
    await register({ ...valid('nfc@example.com'), displayName: `  ${nfd}  `, site: 'vietnamese' }).expect(202);
    const user = await t.prisma.user.findUniqueOrThrow({ where: { email: 'nfc@example.com' } });
    expect(user.displayName).toBe('Nguyễn Thị Hoà'.normalize('NFC'));
    expect(t.mail.outbox.at(-1)!.subject).toMatch(/Xác thực email/);
    expect(t.mail.outbox.at(-1)!.text).toContain(`${ORIGIN_VI}/verify-email?token=`);
  });

  it('chặn request thay đổi dữ liệu từ origin lạ (CSRF)', async () => {
    await createUser(t.prisma, 'csrf@example.com', PW);
    const body = { email: 'csrf@example.com', password: PW };
    await t.http().post('/api/auth/login').send(body).expect(403);
    await t.http().post('/api/auth/login').set('Origin', 'https://evil.example').send(body).expect(403);
    await t.http().post('/api/auth/login').set('Origin', 'null').send(body).expect(403);
    await t.http().post('/api/auth/login').set('Referer', `${ORIGIN_VI}/login`).send(body).expect(200);
  });

  it('quên mật khẩu: token một lần, đổi mật khẩu và thu hồi mọi phiên', async () => {
    await createUser(t.prisma, 'reset@example.com', PW, ['member'], false);
    const oldCookie = await login(t, 'reset@example.com', PW);
    await t.http().post('/api/auth/forgot-password').set('Origin', ORIGIN_VI).send({ email: 'reset@example.com', site: 'vietnamese' }).expect(202);
    const token = tokenFromMail(t.mail, 'reset@example.com', 'reset-password');

    await t.http().post('/api/auth/reset-password').set('Origin', ORIGIN_VI).send({ token, password: 'short' }).expect(400);
    await t.http().post('/api/auth/reset-password').set('Origin', ORIGIN_VI).send({ token, password: 'New-Password-2026' }).expect(200);
    await t.http().post('/api/auth/reset-password').set('Origin', ORIGIN_VI).send({ token, password: 'Another-Password-1' }).expect(400);

    await t.http().get('/api/auth/me').set('Cookie', oldCookie).expect(401);
    await t.http().post('/api/auth/login').set('Origin', ORIGIN_VI).send({ email: 'reset@example.com', password: PW }).expect(401);
    const cookie = await login(t, 'reset@example.com', 'New-Password-2026');
    const me = await t.http().get('/api/auth/me').set('Cookie', cookie).expect(200);
    expect(me.body.user.emailVerified).toBe(true);
  });

  it('token đặt lại mật khẩu hết hạn bị từ chối', async () => {
    await createUser(t.prisma, 'expired@example.com', PW);
    await t.http().post('/api/auth/forgot-password').set('Origin', ORIGIN_EN).send({ email: 'expired@example.com' }).expect(202);
    const token = tokenFromMail(t.mail, 'expired@example.com', 'reset-password');
    await t.prisma.authToken.updateMany({ where: { user: { email: 'expired@example.com' } }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await t.http().post('/api/auth/reset-password').set('Origin', ORIGIN_EN).send({ token, password: 'New-Password-2026' }).expect(400);
  });

  it('đổi mật khẩu giữ phiên hiện tại, thu hồi phiên khác', async () => {
    await createUser(t.prisma, 'change@example.com', PW);
    const current = await login(t, 'change@example.com', PW);
    const other = await login(t, 'change@example.com', PW);
    await t.http().post('/api/auth/change-password').set('Origin', ORIGIN_EN).set('Cookie', current)
      .send({ currentPassword: 'wrong-password', newPassword: 'Brand-New-Pass-1' }).expect(400);
    await t.http().post('/api/auth/change-password').set('Origin', ORIGIN_EN).set('Cookie', current)
      .send({ currentPassword: PW, newPassword: 'Brand-New-Pass-1' }).expect(200);
    await t.http().get('/api/auth/me').set('Cookie', current).expect(200);
    await t.http().get('/api/auth/me').set('Cookie', other).expect(401);
  });

  it('quản lý phiên của chính mình', async () => {
    await createUser(t.prisma, 'sessions@example.com', PW);
    const a = await login(t, 'sessions@example.com', PW);
    const b = await login(t, 'sessions@example.com', PW);
    const list = await t.http().get('/api/account/sessions').set('Cookie', a).expect(200);
    expect(list.body.sessions).toHaveLength(2);
    const otherSession = list.body.sessions.find((s: { current: boolean }) => !s.current);
    await t.http().delete(`/api/account/sessions/${otherSession.id}`).set('Origin', ORIGIN_EN).set('Cookie', a).expect(204);
    await t.http().get('/api/auth/me').set('Cookie', b).expect(401);

    // Không xóa được phiên của người khác
    await createUser(t.prisma, 'intruder@example.com', PW);
    const c = await login(t, 'intruder@example.com', PW);
    const mine = await t.http().get('/api/account/sessions').set('Cookie', a).expect(200);
    await t.http().delete(`/api/account/sessions/${mine.body.sessions[0].id}`).set('Origin', ORIGIN_EN).set('Cookie', c).expect(404);

    await t.http().post('/api/auth/logout-all').set('Origin', ORIGIN_EN).set('Cookie', a).expect(204);
    await t.http().get('/api/auth/me').set('Cookie', a).expect(401);
  });

  it('cookie giả hoặc quá dài không làm lỗi server', async () => {
    await t.http().get('/api/auth/me').set('Cookie', 'hc_session=not-a-real-token').expect(401);
    await t.http().get('/api/auth/me').set('Cookie', `hc_session=${'x'.repeat(5000)}`).expect(401);
  });
});
