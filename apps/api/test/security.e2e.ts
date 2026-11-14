import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import { REQUIRE_AUTH, REQUIRE_PERMISSIONS, SKIP_ORIGIN_CHECK } from '../src/common/decorators';
import { createTestApp, createUser, login, ORIGIN_EN, TestApp } from './helpers';

/**
 * Kiểm thử bảo mật quét TOÀN BỘ route của API (không liệt kê tay), để route mới thêm sau này
 * không thể vô tình mở cho khách, bỏ qua kiểm tra quyền hay bỏ qua chống CSRF.
 */
type Route = { method: string; path: string; auth: boolean; permissions: string[]; skipOrigin: boolean };

/** Route được phép gọi khi chưa đăng nhập. Thêm route công khai mới phải sửa danh sách này (có chủ đích). */
const PUBLIC_ROUTES = [
  'GET /api/health',
  'GET /api/catalog/products',
  'GET /api/catalog/products/:slug',
  'GET /api/catalog/products/:slug/taxonomy',
  'GET /api/catalog/products/:slug/games',
  'GET /api/catalog/products/:slug/games/:gameSlug',
  'GET /api/catalog/products/:slug/games/:gameSlug/play',
  'POST /api/auth/register',
  'POST /api/auth/verify-email',
  'POST /api/auth/login',
  'POST /api/auth/logout',
  'POST /api/auth/forgot-password',
  'POST /api/auth/reset-password',
  'GET /api/media/:id',
  'GET /api/billing/plans',
  'POST /api/webhooks/sepay',
  'GET /api/class-join/:code',
  'GET /api/class-join/:code/games/:gid',
  'POST /api/class-join/:code/games/:gid/plays',
  'GET /api/offline/public-key',
  'GET /api/tts',
].sort();

/** Chỉ webhook (có khóa riêng, so sánh timing-safe) được bỏ qua kiểm tra Origin. */
const SKIP_ORIGIN_ALLOWED = ['POST /api/webhooks/sepay'];

const UUID = '00000000-0000-4000-8000-000000000000';
const fill = (path: string) => path.replace(/:code/g, 'ABCDEF').replace(/:n\b/g, '1').replace(/:(slug|gameSlug)/g, 'x').replace(/:[a-zA-Z]+/g, UUID);
const key = (r: Route) => `${r.method} ${r.path}`;
const join = (...parts: string[]) => `/${parts.map((p) => p.replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/')}`;

function discoverRoutes(t: TestApp): Route[] {
  const routes: Route[] = [];
  for (const mod of t.app.get(ModulesContainer).values()) {
    for (const wrapper of mod.controllers.values()) {
      const ctrl = wrapper.metatype as (new (...a: unknown[]) => unknown) | null;
      if (!ctrl) continue;
      const base = (Reflect.getMetadata(PATH_METADATA, ctrl) as string | undefined) ?? '';
      const classAuth = !!Reflect.getMetadata(REQUIRE_AUTH, ctrl);
      const classPerms = (Reflect.getMetadata(REQUIRE_PERMISSIONS, ctrl) as string[] | undefined) ?? [];
      for (const name of Object.getOwnPropertyNames(ctrl.prototype)) {
        const handler = (ctrl.prototype as Record<string, unknown>)[name];
        if (name === 'constructor' || typeof handler !== 'function') continue;
        const sub = Reflect.getMetadata(PATH_METADATA, handler) as string | string[] | undefined;
        const m = Reflect.getMetadata(METHOD_METADATA, handler) as RequestMethod | undefined;
        if (sub === undefined || m === undefined) continue;
        const perms = (Reflect.getMetadata(REQUIRE_PERMISSIONS, handler) as string[] | undefined) ?? classPerms;
        for (const p of Array.isArray(sub) ? sub : [sub]) {
          routes.push({
            method: RequestMethod[m], path: join('api', base, p),
            auth: !!Reflect.getMetadata(REQUIRE_AUTH, handler) || classAuth || perms.length > 0,
            permissions: perms, skipOrigin: !!Reflect.getMetadata(SKIP_ORIGIN_CHECK, handler),
          });
        }
      }
    }
  }
  return routes.sort((a, b) => key(a).localeCompare(key(b)));
}

describe('Bảo mật: quét toàn bộ route', () => {
  let t: TestApp;
  let routes: Route[];
  let member: string;
  const EVIL = 'https://evil.example';

  beforeAll(async () => {
    t = await createTestApp();
    await createUser(t.prisma, 'member@example.com', 'Correct-Horse-42');
    member = await login(t, 'member@example.com', 'Correct-Horse-42');
    routes = discoverRoutes(t);
  });
  afterAll(async () => { await t.close(); });

  const call = (r: Route) => {
    const req = (t.http() as unknown as Record<string, (u: string) => import('supertest').Test>)[r.method.toLowerCase()](fill(r.path));
    return req;
  };

  it('tìm thấy route của mọi controller', () => {
    expect(routes.length).toBeGreaterThan(80);
    expect(routes.map(key)).toContain('GET /api/admin/stats');
  });

  it('chỉ những route trong danh sách công khai mới không cần đăng nhập', () => {
    expect(routes.filter((r) => !r.auth).map(key)).toEqual(PUBLIC_ROUTES);
  });

  it('mọi route /api/admin/* đều đòi quyền admin.access và một quyền cụ thể', () => {
    const bad = routes.filter((r) => r.path.startsWith('/api/admin/') && !(r.permissions.includes('admin.access') && r.permissions.length >= 2));
    expect(bad.map(key)).toEqual([]);
  });

  it('chỉ webhook thanh toán được bỏ qua kiểm tra Origin', () => {
    expect(routes.filter((r) => r.skipOrigin).map(key)).toEqual(SKIP_ORIGIN_ALLOWED);
  });

  it('khách gọi route cần đăng nhập: luôn 401, kể cả với tham số giả', async () => {
    const wrong: string[] = [];
    for (const r of routes.filter((x) => x.auth)) {
      const res = await call(r).set('Origin', ORIGIN_EN).send({});
      if (res.status !== 401) wrong.push(`${key(r)} → ${res.status}`);
    }
    expect(wrong).toEqual([]);
  });

  it('thành viên thường gọi route quản trị: luôn 403', async () => {
    const wrong: string[] = [];
    for (const r of routes.filter((x) => x.permissions.length)) {
      const res = await call(r).set('Origin', ORIGIN_EN).set('Cookie', member).send({});
      if (res.status !== 403) wrong.push(`${key(r)} → ${res.status}`);
    }
    expect(wrong).toEqual([]);
  });

  it('mọi request thay đổi dữ liệu từ origin lạ hoặc không có Origin: 403 trước khi chạm dữ liệu', async () => {
    const wrong: string[] = [];
    for (const r of routes.filter((x) => x.method !== 'GET' && !x.skipOrigin)) {
      for (const origin of [EVIL, null]) {
        const req = call(r).set('Cookie', member);
        const res = await (origin ? req.set('Origin', origin) : req).send({});
        if (res.status !== 403 || res.body.error !== 'origin_not_allowed') wrong.push(`${key(r)} origin=${origin} → ${res.status}`);
      }
    }
    expect(wrong).toEqual([]);
  });
});

describe('Bảo mật: header, lỗi, giới hạn kích thước', () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp(); });
  afterAll(async () => { await t.close(); });

  it('API trả header bảo mật, không lộ công nghệ', async () => {
    const res = await t.http().get('/api/health').expect(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(res.headers['referrer-policy']).toBe('no-referrer');
  });

  it('lỗi không lộ stack trace hay đường dẫn mã nguồn', async () => {
    const bodies = [
      (await t.http().get('/api/khong-co-route-nay').expect(404)).text,
      (await t.http().post('/api/auth/login').set('Origin', ORIGIN_EN).set('Content-Type', 'application/json').send('{"email":').expect(400)).text,
      (await t.http().get('/api/admin/users/khong-phai-uuid')).text,
    ];
    for (const b of bodies) expect(b).not.toMatch(/at .+\.(ts|js):\d+|node_modules|\/app\/|stack/i);
  });

  it('từ chối JSON lớn hơn 100 KB', async () => {
    const big = JSON.stringify({ email: 'a@example.com', password: 'x'.repeat(200_000) });
    await t.http().post('/api/auth/login').set('Origin', ORIGIN_EN).set('Content-Type', 'application/json').send(big).expect(413);
  });

  it('đăng nhập sai email hay sai mật khẩu trả cùng một lỗi (không dò được email)', async () => {
    await createUser(t.prisma, 'exists@example.com', 'Correct-Horse-42');
    const a = await t.http().post('/api/auth/login').set('Origin', ORIGIN_EN).send({ email: 'exists@example.com', password: 'Wrong-Password-1' });
    const b = await t.http().post('/api/auth/login').set('Origin', ORIGIN_EN).send({ email: 'nobody@example.com', password: 'Wrong-Password-1' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(a.status);
    expect(b.body).toEqual(a.body);
  });

  it('mật khẩu được băm (không lưu bản rõ)', async () => {
    const u = await t.prisma.user.findUniqueOrThrow({ where: { email: 'exists@example.com' } });
    expect(u.passwordHash).not.toContain('Correct-Horse-42');
    expect(u.passwordHash).toMatch(/^\$argon2id\$/);
  });
});
