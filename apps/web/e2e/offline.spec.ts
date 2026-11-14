import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, expect, test } from '@playwright/test';
import { parseSyllable } from '@happyclass/game-core/vi';

/**
 * Chơi offline (PWA): tải gói khi có mạng → tắt mạng → mở lại trang → vẫn thấy và chơi được game.
 * Service worker cần "secure context": trên CI dùng http://*.happyclass.test nên bật cờ coi origin đó là an toàn.
 */
const VI = process.env.E2E_VIETNAMESE_URL ?? 'http://vietnamese.happyclass.test:3100';
const PW = 'Correct-Horse-Battery-42';

test('tải game offline, tắt mạng, chơi hết một game; có mạng lại thì kết quả tự gửi lên', async () => {
  test.setTimeout(120_000);
  // Cờ "coi origin là an toàn" chỉ có hiệu lực với profile riêng và chế độ headless mới (channel chromium).
  const profile = mkdtempSync(join(tmpdir(), 'hc-offline-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    args: ['--host-resolver-rules=MAP *.happyclass.test 127.0.0.1', `--unsafely-treat-insecure-origin-as-secure=${VI}`],
  });
  try {
    const page = context.pages()[0] ?? await context.newPage();
    const email = `offline-${Date.now()}@example.com`;
    expect((await page.request.post(`${VI}/api/auth/register`, { headers: { Origin: VI }, data: { displayName: 'Cô Hoa', email, password: PW, acceptTerms: true, confirmAdult: true, site: 'vietnamese' } })).ok()).toBeTruthy();
    expect((await page.request.post(`${VI}/api/auth/login`, { headers: { Origin: VI }, data: { email, password: PW } })).ok()).toBeTruthy();

    await page.goto(`${VI}/offline`);
    await expect(page.getByTestId('offline-none')).toBeVisible();
    expect(await page.evaluate(() => window.isSecureContext && 'serviceWorker' in navigator)).toBe(true);
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.getByTestId('offline-download').click();
    await expect(page.getByTestId('offline-message')).toContainText('Đã tải');
    await expect(page.getByTestId('offline-player')).toHaveAttribute('data-status', 'ok');
    await expect(page.getByTestId('offline-license')).toContainText('Chỉ có game miễn phí');
    const count = await page.getByTestId('offline-game').count();
    expect(count).toBeGreaterThan(5);
    // Mở lại một lần để service worker điều khiển trang
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);

    const play = await (await page.request.get(`${VI}/api/catalog/products/vietnamese/games/nghe-chon-dau-thanh/play`)).json();
    const items: { id: string; word: string }[] = play.data.items;

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('offline-player')).toHaveAttribute('data-status', 'ok');
    await expect(page.getByTestId('offline-games')).toBeVisible();
    await expect(page.getByTestId('offline-game')).toHaveCount(count);
    await page.locator('[data-testid=offline-game][data-slug="nghe-chon-dau-thanh"]').click();
    await page.getByTestId('shell-start').click();
    for (let i = 0; i < items.length; i++) {
      const id = await page.locator('.tpl-tone').getAttribute('data-item-id');
      const item = items.find((x) => x.id === id)!;
      await page.locator(`[data-testid=tone-choice][data-value="${parseSyllable(item.word)!.tone}"]`).click();
      await page.getByTestId('quiz-next').click();
    }
    await expect(page.getByTestId('result-saved')).toHaveText('Đã lưu kết quả trên máy – sẽ tự gửi khi có mạng.');
    await page.getByRole('button', { name: 'Về thư viện' }).click();
    await expect(page.getByTestId('offline-pending')).toHaveAttribute('data-count', '1');

    // Có mạng lại: tự gửi, hàng đợi trống, kết quả xuất hiện trong "game đã chơi"
    await context.setOffline(false);
    await expect(page.getByTestId('offline-pending')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByTestId('offline-message')).toContainText('Đã gửi 1 kết quả');
    const recent = await (await page.request.get(`${VI}/api/account/recent-games`)).json();
    expect(JSON.stringify(recent)).toContain('nghe-chon-dau-thanh');
  } finally {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  }
});
