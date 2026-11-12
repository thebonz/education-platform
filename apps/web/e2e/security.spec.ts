import { expect, test } from '@playwright/test';

/**
 * Header bảo mật của Web và CSP không chặn nhầm chức năng nào: mở các trang chính, chơi thử một game,
 * và bảo đảm trình duyệt không báo vi phạm CSP hay lỗi JavaScript.
 */
const EN = process.env.E2E_ENGLISH_URL ?? 'http://english.happyclass.test:3100';
const VI = process.env.E2E_VIETNAMESE_URL ?? 'http://vietnamese.happyclass.test:3100';
const ADMIN = process.env.E2E_ADMIN_URL ?? 'http://admin.happyclass.test:3100';

const PAGES = [
  `${EN}/`, `${EN}/games`, `${EN}/games/alphabet-bingo`, `${EN}/pricing`, `${EN}/login`, `${EN}/register`, `${EN}/terms`, `${EN}/privacy`,
  `${VI}/`, `${VI}/games`, `${VI}/games/nghe-chon-dau-thanh`, `${VI}/pricing`, `${VI}/lop`, `${VI}/offline`, `${VI}/dieu-khoan`, `${VI}/quyen-rieng-tu`,
  `${ADMIN}/login`,
];

test('Web trả header bảo mật (CSP, HSTS, nosniff, chống nhúng iframe)', async ({ request }) => {
  const res = await request.get(`${EN}/games`);
  expect(res.ok()).toBeTruthy();
  const h = res.headers();
  expect(h['content-security-policy']).toContain("default-src 'self'");
  expect(h['content-security-policy']).toContain("object-src 'none'");
  expect(h['content-security-policy']).toContain("frame-ancestors 'self'");
  expect(h['strict-transport-security']).toMatch(/max-age=\d+/);
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toBe('SAMEORIGIN');
  expect(h['x-powered-by']).toBeUndefined();
});

test('các trang chính không vi phạm CSP và không lỗi JavaScript', async ({ page }) => {
  test.setTimeout(120_000);
  const problems: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text())) problems.push(`${page.url()}: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`${page.url()}: ${e.message}`));
  for (const url of PAGES) {
    const res = await page.goto(url);
    expect(res?.status(), url).toBeLessThan(400);
    await page.waitForLoadState('networkidle');
  }
  // Chơi thử: bấm bắt đầu để chạy mã game (âm thanh, hiệu ứng) dưới CSP
  await page.goto(`${VI}/games/nghe-chon-dau-thanh`);
  await page.getByTestId('shell-start').click();
  await page.waitForTimeout(500);
  expect(problems).toEqual([]);
});

test('người dùng tự xoá tài khoản ở trang Tài khoản; sau đó không đăng nhập lại được', async ({ page }) => {
  const email = `delete-me-${Date.now()}@example.com`;
  const PW = 'Correct-Horse-Battery-42';
  const reg = await page.request.post(`${VI}/api/auth/register`, {
    headers: { Origin: VI }, data: { displayName: 'Phụ huynh', email, password: PW, acceptTerms: true, confirmAdult: true, site: 'vietnamese' },
  });
  expect(reg.ok()).toBeTruthy();
  await page.goto(`${VI}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(PW);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByTestId('account-heading')).toBeVisible();
  const form = page.getByTestId('delete-account');
  await form.locator('input[name=password]').fill(PW);
  await form.locator('input[name=confirm]').fill('XOA');
  await form.getByRole('button').click();
  await page.waitForURL(`${VI}/`);
  const again = await page.request.post(`${VI}/api/auth/login`, { headers: { Origin: VI }, data: { email, password: PW } });
  expect(again.status()).toBe(401);
});
