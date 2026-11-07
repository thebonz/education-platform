import { createPublicKey, verify } from 'node:crypto';
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
});
