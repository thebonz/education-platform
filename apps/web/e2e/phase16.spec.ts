import { expect, test } from '@playwright/test';

const ADMIN = process.env.E2E_ADMIN_URL ?? 'http://admin.happyclass.test:3100';
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@happyclass.test';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';

test('Fusion Reveal: hidden 145 mm A/B printable game works in private preview and stays unpublished', async ({ page }) => {
  test.skip(!PASSWORD, 'No E2E admin credentials');
  test.setTimeout(150_000);
  await page.goto(ADMIN + '/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByTestId('admin-dashboard')).toBeVisible();

  const result = await page.request.get(ADMIN + '/api/admin/games?product=english&review=PENDING&pageSize=100');
  expect(result.ok()).toBeTruthy();
  type Game = { id: string; slug: string; isPublished: boolean; reviewStatus: string };
  const games = (await result.json()).games as Game[];
  const game = games.find((item) => item.slug === 'happyclass-fusion-reveal');
  expect(game).toBeTruthy();
  expect(game!.isPublished).toBe(false);
  expect(game!.reviewStatus).toBe('PENDING');

  await page.goto(ADMIN + '/games/' + game!.id);
  await page.getByTestId('open-builder').click();
  await page.getByTestId('refresh-preview').click();
  const preview = page.getByTestId('preview');
  await preview.getByTestId('shell-start').click();
  await expect(preview.getByTestId('fusion-reveal')).toBeVisible();
  await expect(preview.getByTestId('fusion-print')).toBeVisible();
  // Two print-only pages: A has encoded art, B has the opaque stripe stencil.
  await expect(preview.getByTestId('fusion-print-pages').locator('.fusion-print-square')).toHaveCount(2);

  for (let round = 0; round < 3; round++) {
    await expect(preview.getByTestId('fusion-round')).toContainText(`Card ${round + 1}/3`);
    await expect(preview.getByTestId('fusion-choice')).toHaveCount(3);
    await expect(preview.getByTestId('fusion-choice').first()).toBeDisabled();
    const slider = preview.getByTestId('fusion-slider');
    await slider.focus();
    await slider.press('End');
    await expect(preview.getByTestId('fusion-aligned')).toContainText('aligned');
    await expect(preview.getByTestId('fusion-choice').first()).toBeEnabled();

    // Wrong guesses are nonterminal and a correct guess reveals the actual art.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (await preview.getByTestId('fusion-revealed').count()) break;
      await preview.getByTestId('fusion-choice').nth(attempt).click();
    }
    await expect(preview.getByTestId('fusion-revealed')).toBeVisible();
    await preview.getByTestId('fusion-next').click();
  }
  await expect(preview.getByTestId('shell-result')).toBeVisible();
  await expect(preview.getByTestId('result-score')).toContainText('3/3');

  // Preview does not make teacher-controlled draft games publicly visible.
  const afterReq = await page.request.get(ADMIN + '/api/admin/games?product=english&review=PENDING&pageSize=100');
  const after = (await afterReq.json()).games as Game[];
  const updated = after.find((item) => item.slug === 'happyclass-fusion-reveal');
  expect(updated?.isPublished).toBe(false);
  expect(updated?.reviewStatus).toBe('PENDING');
});
