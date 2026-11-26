import { expect, test } from '@playwright/test';

const ADMIN = process.env.E2E_ADMIN_URL ?? 'http://admin.happyclass.test:3100';
const EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@happyclass.test';
const PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';

test('Three original English interaction forms work in private preview and remain hidden @mobile', async ({ page }) => {
  test.skip(!PASSWORD, 'No E2E admin credentials');
  test.setTimeout(170_000);
  await page.goto(ADMIN + '/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Mật khẩu').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByTestId('admin-dashboard')).toBeVisible();

  const gamesResult = await page.request.get(ADMIN + '/api/admin/games?product=english&review=PENDING&pageSize=100');
  expect(gamesResult.ok()).toBeTruthy();
  type Game = { id: string; slug: string; isPublished: boolean; reviewStatus: string };
  const games = (await gamesResult.json()).games as Game[];
  const slugs = ['sound-family-village', 'little-learning-classroom', 'shadow-safari-animals'];
  for (const slug of slugs) {
    const game = games.find((g) => g.slug === slug);
    expect(game, slug).toBeTruthy();
    expect(game!.isPublished).toBe(false);
    expect(game!.reviewStatus).toBe('PENDING');
  }

  async function openPreview(slug: string) {
    const game = games.find((g) => g.slug === slug)!;
    await page.goto(ADMIN + '/games/' + game.id);
    await page.getByTestId('open-builder').click();
    await page.getByTestId('refresh-preview').click();
    const preview = page.getByTestId('preview');
    await preview.getByTestId('shell-start').click();
    return preview;
  }

  const phonics = await openPreview(slugs[0]);
  await expect(phonics.getByTestId('phonics-word')).toHaveCount(6);
  const words1 = await phonics.getByTestId('phonics-word').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-word') ?? ''));
  for (const word of words1) {
    const ending = ['at', 'og', 'an'].find((part) => word.endsWith(part));
    expect(ending).toBeTruthy();
    await phonics.locator('[data-testid="phonics-word"][data-word="' + word + '"]').click();
    await phonics.locator('[data-testid="phonics-house"][data-family="' + ending + '"]').click();
  }
  await expect(phonics.getByTestId('shell-result')).toBeVisible();
  await expect(phonics.getByTestId('result-score')).toContainText('6/6');
  await phonics.getByTestId('play-again').click();
  const words2 = await phonics.getByTestId('phonics-word').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-word') ?? ''));
  expect(words2.some((word) => !words1.includes(word))).toBe(true);
  // The three visible hearts are a real loss condition, not decoration.
  const firstWord = words2[0];
  const wrongEnding = ['at', 'og', 'an'].find((ending) => !firstWord.endsWith(ending))!;
  await phonics.locator('[data-testid="phonics-word"][data-word="' + firstWord + '"]').click();
  for (let i = 0; i < 3; i++) {
    await phonics.locator('[data-testid="phonics-house"][data-family="' + wrongEnding + '"]').click();
  }
  await expect(phonics.locator('.phonics-metrics')).toContainText('0 lives');
  await expect(phonics.getByTestId('shell-result')).toBeVisible({ timeout: 5_000 });
  await expect(phonics.getByTestId('result-score')).toContainText('Mistakes: 3');

  const classroom = await openPreview(slugs[1]);
  const objects = await classroom.getByTestId('classroom-object').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-word') ?? ''));
  expect(objects).toHaveLength(6);
  await expect(classroom.locator('.classroom-toolbar')).toContainText('19 pictures');
  for (const word of objects) {
    await classroom.locator('[data-testid="classroom-object"][data-word="' + word + '"]').click();
    await expect(classroom.getByTestId('classroom-answer')).toHaveCount(3);
    await classroom.getByTestId('classroom-answer')
      .filter({ hasText: new RegExp('\\b' + word + '$') }).click();
  }
  await expect(classroom.getByTestId('shell-result')).toBeVisible();
  await expect(classroom.getByTestId('result-score')).toContainText('6/6');
  await classroom.getByTestId('play-again').click();
  const nextObjects = await classroom.getByTestId('classroom-object').evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute('data-word') ?? ''));
  expect(nextObjects).toHaveLength(6);
  expect(nextObjects.some((word) => !objects.includes(word))).toBe(true);
  // Rotate the real items and art, not only the placement of the same six tiles.

  const shadow = await openPreview(slugs[2]);
  for (let i = 0; i < 6; i++) {
    const src = await shadow.getByTestId('shadow-picture').locator('img').getAttribute('src');
    expect(src).toContain('/illustrations/silhouettes/');
    const name = src!.split('/').at(-1)!.replace('.svg', '');
    await shadow.getByTestId('shadow-choice')
      .filter({ hasText: new RegExp('\\b' + name + '$') }).click();
    await expect(shadow.getByTestId('shadow-picture')).toHaveClass(/revealed/);
    await shadow.getByTestId('shadow-next').click();
  }
  await expect(shadow.getByTestId('shell-result')).toBeVisible();
  await expect(shadow.getByTestId('result-score')).toContainText('6/6');

  const verify = await page.request.get(ADMIN + '/api/admin/games?product=english&review=PENDING&pageSize=100');
  const after = (await verify.json()).games as Game[];
  for (const slug of slugs) {
    const game = after.find((item) => item.slug === slug)!;
    expect(game.isPublished).toBe(false);
    expect(game.reviewStatus).toBe('PENDING');
  }
});
