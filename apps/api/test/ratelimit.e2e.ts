import { createTestApp, ORIGIN_EN, TestApp } from './helpers';

describe('Giới hạn tần suất đăng nhập', () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp({ AUTH_RATE_LIMIT_PER_MINUTE: '3' }); });
  afterAll(async () => { await t.close(); });

  it('trả 429 khi vượt giới hạn', async () => {
    const attempt = () => t.http().post('/api/auth/login').set('Origin', ORIGIN_EN).send({ email: 'x@example.com', password: 'wrong-password' });
    for (let i = 0; i < 3; i++) expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(429);
  });
});
