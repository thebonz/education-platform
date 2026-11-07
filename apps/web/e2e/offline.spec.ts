import { chromium, expect, test } from '@playwright/test';

/**
 * Chơi offline (PWA): tải gói khi có mạng → tắt mạng → mở lại trang → vẫn thấy và chơi được game.
 * Service worker cần "secure context": trên CI dùng http://*.happyclass.test nên bật cờ coi origin đó là an toàn.
 */
const VI = process.env.E2E_VIETNAMESE_URL ?? 'http://vietnamese.happyclass.test:3100';
const PW = 'Correct-Horse-Battery-42';

test('tải game offline, tắt mạng, mở lại trang vẫn chơi được', async () => {
  test.setTimeout(120_000);
  const browser = await chromium.launch({
    args: ['--host-resolver-rules=MAP *.happyclass.test 127.0.0.1', `--unsafely-treat-insecure-origin-as-secure=${VI}`],
  });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const email = `offline-${Date.now()}@example.com`;
    expect((await page.request.post(`${VI}/api/auth/register`, { headers: { Origin: VI }, data: { displayName: 'Cô Hoa', email, password: PW, acceptTerms: true, confirmAdult: true, site: 'vietnamese' } })).ok()).toBeTruthy();
    expect((await page.request.post(`${VI}/api/auth/login`, { headers: { Origin: VI }, data: { email, password: PW } })).ok()).toBeTruthy();

    await page.goto(`${VI}/offline`);
    await expect(page.getByTestId('offline-none')).toBeVisible();
    await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));
    await page.getByTestId('offline-download').click();
    await expect(page.getByTestId('offline-message')).toContainText('Đã tải');
    await expect(page.getByTestId('offline-player')).toHaveAttribute('data-status', 'ok');
    await expect(page.getByTestId('offline-license')).toContainText('Chỉ có game miễn phí');
    const count = await page.getByTestId('offline-game').count();
    expect(count).toBeGreaterThan(5);
    // Mở lại một lần để service worker điều khiển trang
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('offline-player')).toHaveAttribute('data-status', 'ok');
    await expect(page.getByTestId('offline-games')).toBeVisible();
    await expect(page.getByTestId('offline-game')).toHaveCount(count);
    await page.locator('[data-testid=offline-game][data-slug="nghe-chon-dau-thanh"]').click();
    await page.getByTestId('shell-start').click();
    await expect(page.locator('.tpl-tone')).toBeVisible();
  } finally {
    await browser.close();
  }
});
