import { expect, request, test } from '@playwright/test';

/**
 * Mua gói (chế độ thử nghiệm): game trả phí bị khóa → bảng giá → đơn + VietQR → SePay báo tiền về
 * (giả lập webhook có khóa API) → trang thanh toán tự chuyển "thành công" → game mở.
 * Chạy trước các file khác (tên file), nên cuối test trả game về miễn phí.
 */
const EN = process.env.E2E_ENGLISH_URL ?? 'http://english.happyclass.test:3100';
const ADMIN = process.env.E2E_ADMIN_URL ?? 'http://admin.happyclass.test:3100';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@happyclass.test';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';
const KEY = process.env.E2E_SEPAY_KEY ?? '';
const PW = 'Correct-Horse-Battery-42';

test('mua gói tháng bằng VietQR, tiền về qua webhook SePay, game trả phí được mở', async ({ page }) => {
  test.skip(!ADMIN_PASSWORD || !KEY, 'Chưa đặt E2E_ADMIN_PASSWORD / E2E_SEPAY_KEY');
  test.setTimeout(120_000);

  // Admin chuyển một game English sang trả phí (trả lại ở cuối test)
  const admin = await request.newContext({ baseURL: ADMIN, extraHTTPHeaders: { Origin: ADMIN } });
  await admin.post('/api/auth/login', { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } }).then((r) => expect(r.ok()).toBeTruthy());
  const list = await (await admin.get('/api/admin/games?product=english&pageSize=100')).json();
  const game = list.games.find((g: { isPublished: boolean }) => g.isPublished);
  await admin.patch(`/api/admin/games/${game.id}`, { data: { accessLevel: 'PREMIUM' } }).then((r) => expect(r.ok()).toBeTruthy());

  try {
    // Thành viên mới
    const email = `parent-${Date.now()}@example.com`;
    const reg = await page.request.post(`${EN}/api/auth/register`, {
      headers: { Origin: EN },
      data: { displayName: 'Phụ huynh Lan', email, password: PW, acceptTerms: true, confirmAdult: true },
    });
    expect(reg.ok()).toBeTruthy();
    await page.goto(`${EN}/login`);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(PW);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByTestId('account-heading')).toBeVisible();

    // Game trả phí bị khóa → bảng giá
    await page.goto(`${EN}/games/${game.slug}`);
    await expect(page.getByTestId('locked-panel')).toBeVisible();
    await page.getByTestId('locked-pricing').click();
    await expect(page.getByTestId('plan-card')).toHaveCount(2);
    await expect(page.locator('[data-plan="english-year"]')).toContainText('599.000');
    await page.locator('[data-plan="english-month"]').getByTestId('buy-plan').click();

    // Trang thanh toán: QR, thông tin chuyển khoản, nhãn thử nghiệm
    await expect(page.getByTestId('checkout')).toHaveAttribute('data-status', 'PENDING');
    await expect(page.getByTestId('sandbox-banner')).toBeVisible();
    await expect(page.getByTestId('qr').locator('svg')).toBeVisible();
    await expect(page.getByTestId('tr-account')).toHaveText('100000000001');
    await expect(page.getByTestId('tr-amount')).toContainText('55.000');
    const code = (await page.getByTestId('tr-content').innerText()).trim();
    expect(code).toMatch(/^HC[2-9A-HJKMNP-Z]{8}$/);

    // SePay báo tiền về (nội dung bị ngân hàng thêm tiền tố, chữ thường)
    const hook = await page.request.post(`${EN}/api/webhooks/sepay`, {
      headers: { Authorization: `Apikey ${KEY}` },
      data: { id: Date.now(), gateway: 'VietinBank', transactionDate: '2026-11-08 10:00:00', accountNumber: '100000000001', content: `MBVCB.99 ${code.toLowerCase()} chuyen tien`, transferType: 'in', transferAmount: 55000 },
    });
    expect(await hook.json()).toMatchObject({ success: true, result: 'matched' });

    // Trang tự cập nhật, không cần tải lại
    await expect(page.getByTestId('checkout-paid')).toBeVisible({ timeout: 15_000 });

    // Game mở; tài khoản hiện gói
    await page.goto(`${EN}/games/${game.slug}`);
    await expect(page.getByTestId('shell-start')).toBeVisible();
    await page.goto(`${EN}/account`);
    await expect(page.getByTestId('my-plans')).toContainText('English Games');
    await expect(page.getByTestId('my-plans')).toContainText(code);
  } finally {
    await admin.patch(`/api/admin/games/${game.id}`, { data: { accessLevel: 'FREE' } });
    await admin.dispose();
  }
});
