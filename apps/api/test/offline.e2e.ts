import { createPublicKey, type JsonWebKey, randomUUID, verify } from 'node:crypto';
import { createTestApp, createUser, login, ORIGIN_EN, TestApp } from './helpers';

const PW = 'Correct-Horse-42';

function check(license: string, jwk: JsonWebKey) {
  const [body, sig] = license.split('.');
  const key = createPublicKey({ key: jwk, format: 'jwk' });
  const ok = verify('sha256', Buffer.from(body), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'));
  return { ok, claims: JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) };
}

describe('Gói chơi offline + giấy phép ký số', () => {
  let t: TestApp;
  let free: string;
  let paid: string;
  let premiumSlug: string;
  let jwk: JsonWebKey;

  beforeAll(async () => {
    t = await createTestApp();
    await createUser(t.prisma, 'free@example.com', PW);
    await createUser(t.prisma, 'paid@example.com', PW);
    free = await login(t, 'free@example.com', PW, ORIGIN_EN);
    paid = await login(t, 'paid@example.com', PW, ORIGIN_EN);
    const g = await t.prisma.game.findFirstOrThrow({ where: { slug: 'team-quiz' } });
    await t.prisma.game.update({ where: { id: g.id }, data: { accessLevel: 'PREMIUM' } });
    premiumSlug = g.slug;
    const user = await t.prisma.user.findUniqueOrThrow({ where: { email: 'paid@example.com' } });
    const en = await t.prisma.product.findUniqueOrThrow({ where: { slug: 'english' } });
    await t.prisma.entitlement.create({ data: { userId: user.id, productId: en.id, startsAt: new Date(), endsAt: new Date(Date.now() + 10 * 86_400_000), source: 'manual' } });
    jwk = (await t.http().get('/api/offline/public-key').expect(200)).body.jwk;
  });
  afterAll(async () => { await t.close(); });

  it('cần đăng nhập', async () => {
    await t.http().get('/api/offline/pack?product=english').expect(401);
  });

  it('tài khoản miễn phí: chỉ có game miễn phí, giấy phép 30 ngày, không có hạn game trả phí', async () => {
    const res = await t.http().get('/api/offline/pack?product=english').set('Cookie', free).expect(200);
    const slugs = res.body.games.map((g: { slug: string }) => g.slug);
    expect(slugs).not.toContain(premiumSlug);
    expect(slugs.length).toBe(5);
    expect(res.body.premiumUntil).toBeNull();
    const days = (res.body.expiresAt - res.body.issuedAt) / 86_400_000;
    expect(days).toBe(30);
    const { ok, claims } = check(res.body.license, jwk);
    expect(ok).toBe(true);
    expect(claims).toMatchObject({ product: 'english', exp: res.body.expiresAt, premiumUntil: null });
    expect(claims.games).toEqual(res.body.games.map((g: { slug: string; version: number }) => `${g.slug}@${g.version}`));
    expect(res.body.games[0].data).toBeDefined();
  });

  it('có gói: thêm game trả phí, hạn game trả phí = hạn gói (ngắn hơn 30 ngày)', async () => {
    const res = await t.http().get('/api/offline/pack?product=english').set('Cookie', paid).expect(200);
    expect(res.body.games.map((g: { slug: string }) => g.slug)).toContain(premiumSlug);
    expect(res.body.premiumUntil).toBeLessThan(res.body.expiresAt);
    expect(res.body.premiumUntil).toBeGreaterThan(Date.now() + 9 * 86_400_000);
    // Gói English không cho game Tiếng Việt trả phí (ở đây: chỉ game miễn phí của Tiếng Việt)
    const vi = await t.http().get('/api/offline/pack?product=vietnamese').set('Cookie', paid).expect(200);
    expect(vi.body.premiumUntil).toBeNull();
  });

  it('sửa hạn trong giấy phép thì chữ ký không còn khớp', async () => {
    const res = await t.http().get('/api/offline/pack?product=english').set('Cookie', free).expect(200);
    const [body, sig] = (res.body.license as string).split('.');
    const claims = JSON.parse(Buffer.from(body, 'base64url').toString());
    claims.exp += 365 * 86_400_000;
    const forged = `${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${sig}`;
    expect(check(forged, jwk).ok).toBe(false);
    const log = await t.prisma.auditLog.findFirst({ where: { action: 'offline.pack_downloaded' } });
    expect(log).not.toBeNull();
  });

  it('gói kèm danh sách ảnh thư viện mà game dùng', async () => {
    const g = await t.prisma.game.findFirstOrThrow({ where: { slug: 'vocabulary-matching' }, include: { versions: { where: { isPublished: true } } } });
    const id = '11111111-2222-4333-8444-555555555555';
    const content = JSON.parse(JSON.stringify(g.versions[0].content));
    const json = JSON.stringify(content).replace(/"picture":\{"kind":"emoji","value":"[^"]*"\}/, `"picture":{"kind":"image","src":"/api/media/${id}","alt":"x"}`);
    await t.prisma.gameVersion.update({ where: { id: g.versions[0].id }, data: { content: JSON.parse(json) } });
    const res = await t.http().get('/api/offline/pack?product=english').set('Cookie', free).expect(200);
    expect(json).not.toBe(JSON.stringify(content));
    expect(res.body.media).toEqual([`/api/media/${id}`]);
  });

  describe('đồng bộ kết quả chơi offline', () => {
    const DAY = 86_400_000;
    const sync = (cookie: string | null, body: object) => {
      const r = t.http().post('/api/offline/sync').set('Origin', ORIGIN_EN).send(body);
      return cookie ? r.set('Cookie', cookie) : r;
    };
    const result = (over: Record<string, unknown> = {}) => ({
      id: randomUUID(), slug: 'alphabet-bingo', playedAt: Date.now() - 2 * DAY, score: 8, maxScore: 10, mistakes: 1, stars: 2, durationMs: 60_000, ...over,
    });

    it('cần đăng nhập và đúng Origin', async () => {
      await sync(null, { product: 'english', results: [result()] }).expect(401);
      await t.http().post('/api/offline/sync').set('Origin', 'https://evil.example').set('Cookie', free).send({ product: 'english', results: [result()] }).expect(403);
    });

    it('lưu kết quả với thời điểm chơi thật; gửi lại không bị trùng', async () => {
      const a = result();
      const b = result({ slug: 'team-quiz' }); // game trả phí, tài khoản miễn phí → từ chối
      const r1 = await sync(free, { product: 'english', results: [a, b] }).expect(200);
      expect(r1.body).toEqual({ accepted: [a.id], rejected: [{ id: b.id, reason: 'membership_required' }], saved: 1 });
      const row = await t.prisma.gameSession.findUniqueOrThrow({ where: { clientId: a.id } });
      expect(row.offline).toBe(true);
      expect(row.createdAt.getTime()).toBe(a.playedAt);
      const r2 = await sync(free, { product: 'english', results: [a] }).expect(200);
      expect(r2.body).toEqual({ accepted: [a.id], rejected: [], saved: 0 });
      expect(await t.prisma.gameSession.count({ where: { clientId: a.id } })).toBe(1);
    });

    it('từ chối kết quả quá cũ, ở tương lai, sai sản phẩm hoặc điểm vô lý', async () => {
      const old = result({ playedAt: Date.now() - 40 * DAY });
      const future = result({ playedAt: Date.now() + DAY });
      const vi = result({ slug: 'chon-dau-cau-lop-2' });
      const r = await sync(free, { product: 'english', results: [old, future, vi] }).expect(200);
      expect(r.body.rejected).toEqual([
        { id: old.id, reason: 'too_old' }, { id: future.id, reason: 'in_future' }, { id: vi.id, reason: 'game_not_found' },
      ]);
      await sync(free, { product: 'english', results: [result({ score: 11, maxScore: 10 })] }).expect(400);
      await sync(free, { product: 'english', results: [] }).expect(400);
    });

    it('game trả phí: nhận nếu lúc chơi còn gói (kể cả gói đã hết hạn sau đó)', async () => {
      const user = await t.prisma.user.findUniqueOrThrow({ where: { email: 'free@example.com' } });
      const en = await t.prisma.product.findUniqueOrThrow({ where: { slug: 'english' } });
      await t.prisma.entitlement.create({ data: { userId: user.id, productId: en.id, startsAt: new Date(Date.now() - 20 * DAY), endsAt: new Date(Date.now() - 5 * DAY), source: 'manual' } });
      const during = result({ slug: premiumSlug, playedAt: Date.now() - 10 * DAY });
      const after = result({ slug: premiumSlug, playedAt: Date.now() - 2 * DAY });
      const r = await sync(free, { product: 'english', results: [during, after] }).expect(200);
      expect(r.body.accepted).toEqual([during.id]);
      expect(r.body.rejected).toEqual([{ id: after.id, reason: 'membership_required' }]);
      // Có gói hiện tại thì nhận
      const p = result({ slug: premiumSlug });
      expect((await sync(paid, { product: 'english', results: [p] }).expect(200)).body.saved).toBe(1);
    });
  });
});
