import { expect, Page, test } from '@playwright/test';

/**
 * Chơi trọn 6 game tiếng Anh trên app thật (web + API + PostgreSQL).
 * Đáp án lấy từ chính API /play, để test luôn khớp nội dung đang xuất bản.
 */
const EN = process.env.E2E_ENGLISH_URL ?? 'http://english.happyclass.test:3100';
const PW = 'Games-Password-2026';

type Q = { prompt: string; choices: string[]; answer: string };
const graphemes = (s: string) => Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s.normalize('NFC')), (x) => x.segment);

async function playData(page: Page, slug: string) {
  const res = await page.request.get(`${EN}/api/catalog/products/english/games/${slug}/play`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data;
}

async function currentQuestion(page: Page, questions: Q[]) {
  const prompt = await page.getByTestId('quiz-prompt').innerText();
  const shown = await page.locator('.choice').allInnerTexts();
  return questions.find((q) => q.prompt === prompt && q.choices.every((c) => shown.includes(c)))!;
}

async function expectResult(page: Page) {
  await expect(page.getByTestId('shell-result')).toBeVisible({ timeout: 10_000 });
  return page.getByTestId('result-score').innerText();
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  // Đăng ký tài khoản dùng cho các test cần lưu kết quả
  await request.post(`${EN}/api/auth/register`, {
    headers: { Origin: EN },
    data: { email: 'player-e2e@example.com', password: PW, displayName: 'Player', site: 'english', acceptTerms: true, confirmAdult: true },
  });
});

test('trang chủ English có bộ sưu tập và 6 game nổi bật', async ({ page }) => {
  await page.goto(`${EN}/`);
  await expect(page.locator('.collection-card').first()).toBeVisible();
  await expect(page.getByTestId('game-card')).toHaveCount(6);
});

test('thư viện lọc theo cấp độ và danh mục, bộ lọc nằm trên URL', async ({ page }) => {
  await page.goto(`${EN}/games`);
  await expect(page.getByTestId('game-card')).toHaveCount(6);
  await page.getByTestId('filter-level').selectOption('a1');
  await expect(page).toHaveURL(/level=a1/);
  await expect(page.getByTestId('game-card')).toHaveCount(2);
  await page.goto(`${EN}/games?category=spelling`);
  await expect(page.getByTestId('game-card')).toHaveCount(2);
});

test('Alphabet Bingo: nghe gọi chữ, đánh dấu, BINGO', async ({ page }) => {
  await page.goto(`${EN}/games/alphabet-bingo`);
  await page.getByTestId('shell-start').click();
  await expect(page.locator('.hidden-clue')).toBeVisible();
  await page.getByTestId('toggle-clue').click();
  for (let i = 0; i < 20 && !(await page.getByTestId('shell-result').count()); i++) {
    const call = await page.getByTestId('bingo-call').getAttribute('data-call-text');
    const cell = page.locator(`[data-testid=bingo-cell][data-text="${call}"]`);
    if ((await cell.getAttribute('aria-pressed')) === 'true') break;
    await cell.click();
  }
  expect(await expectResult(page)).toMatch(/You scored \d+\/\d+ points · Mistakes: 0/);
});

test('Animal Match: ghép từ với hình, có lỗi được tính', async ({ page }) => {
  const data = await playData(page, 'vocabulary-matching');
  await page.goto(`${EN}/games/vocabulary-matching`);
  await page.getByTestId('shell-start').click();
  await page.locator(`[data-testid=match-word][data-id="${data.pairs[0].id}"]`).click();
  await page.locator(`[data-testid=match-picture][data-id="${data.pairs[1].id}"]`).click();
  for (const p of data.pairs) {
    await page.locator(`[data-testid=match-word][data-id="${p.id}"]`).click();
    await page.locator(`[data-testid=match-picture][data-id="${p.id}"]`).click();
  }
  expect(await expectResult(page)).toContain('You scored 8/8 points · Mistakes: 1');
});

test('Hidden Picture: mở hết ô và đoán đúng bức tranh', async ({ page }) => {
  const data = await playData(page, 'hidden-picture');
  await page.goto(`${EN}/games/hidden-picture`);
  await page.getByTestId('shell-start').click();
  for (let i = 0; i < data.questions.length; i++) {
    const q = await currentQuestion(page, data.questions);
    await page.getByRole('button', { name: q.answer, exact: true }).click();
    await page.getByTestId('quiz-next').click();
  }
  await expect(page.locator('.hidden-tile.gone')).toHaveCount(data.questions.length);
  await page.getByRole('button', { name: data.pictureAnswer, exact: true }).click();
  expect(await expectResult(page)).toContain(`You scored ${data.questions.length + 1}/${data.questions.length + 1}`);
});

test('Bubble Word Garden: chọn bài, bấm bong bóng đúng thứ tự @mobile', async ({ page }) => {
  const data = await playData(page, 'bubble-word-garden');
  await page.goto(`${EN}/games/bubble-word-garden`);
  await page.getByTestId('shell-start').click();
  await page.getByTestId('unit-option').first().click();
  const unit = data.units[0];
  for (let i = 0; i < unit.words.length; i++) {
    const id = await page.getByTestId('bubble-word').getAttribute('data-word-id');
    const word = unit.words.find((w: { id: string }) => w.id === id);
    for (const seg of word.segments ?? graphemes(word.word)) await page.locator(`[data-testid=bubble][data-value="${seg}"]:not([disabled])`).first().click();
    await page.getByTestId('bubble-next').click();
  }
  expect(await expectResult(page)).toContain(`You scored ${unit.words.length}/${unit.words.length}`);
});

test('Spelling Challenge: điền chữ còn thiếu; đăng nhập thì kết quả được lưu và hiện ở tài khoản', async ({ page }) => {
  await page.goto(`${EN}/login`);
  await page.getByLabel('Email').fill('player-e2e@example.com');
  await page.getByLabel('Password').fill(PW);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(`${EN}/account`);

  const data = await playData(page, 'spelling-challenge');
  await page.goto(`${EN}/games/spelling-challenge`);
  await page.getByTestId('favorite-button').click();
  await expect(page.getByTestId('favorite-button')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('shell-start').click();
  for (let i = 0; i < data.items.length; i++) {
    const id = await page.locator('.tpl-spelling').getAttribute('data-item-id');
    const item = data.items.find((x: { id: string }) => x.id === id);
    const letters = graphemes(item.answer);
    for (const input of await page.getByTestId('spell-blank').all()) await input.fill(letters[Number(await input.getAttribute('data-index'))]);
    await page.getByTestId('spell-check').click();
    await expect(page.getByTestId('tpl-feedback')).toHaveText('Correct!');
    await page.getByTestId('quiz-next').click();
  }
  expect(await expectResult(page)).toContain(`You scored ${data.items.length}/${data.items.length}`);
  await expect(page.getByTestId('result-saved')).toBeVisible();

  await page.goto(`${EN}/account`);
  await expect(page.getByTestId('recent-games')).toContainText('Spelling Challenge');
  await expect(page.getByTestId('favorite-games')).toContainText('Spelling Challenge');
});

test('Team Quiz: 3 đội thay phiên, đếm giờ, công bố đội thắng', async ({ page }) => {
  const data = await playData(page, 'team-quiz');
  await page.goto(`${EN}/games/team-quiz`);
  await page.getByTestId('team-count').selectOption('3');
  await page.getByTestId('shell-start').click();
  await expect(page.locator('.countdown')).toBeVisible();
  for (let i = 0; i < data.questions.length; i++) {
    await expect(page.getByTestId('active-team')).toContainText(`Team ${'ABC'[i % 3]}`);
    const q = await currentQuestion(page, data.questions);
    // Đội A luôn trả lời đúng, đội B và C luôn sai → A thắng
    const pick = i % 3 === 0 ? q.answer : q.choices.find((c) => c !== q.answer)!;
    await page.getByRole('button', { name: pick, exact: true }).click();
    await page.getByTestId('quiz-next').click();
  }
  await expectResult(page);
  await expect(page.getByTestId('team-result')).toContainText('Winner: Team A');
});

test('toàn màn hình, tắt âm thanh và chơi lại không lỗi', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${EN}/games/team-quiz`);
  await page.getByTestId('shell-start').click();
  await page.getByRole('button', { name: 'Sound off' }).click();
  await page.getByRole('button', { name: /Fullscreen/ }).click();
  await page.getByRole('button', { name: 'Restart' }).click();
  await expect(page.getByTestId('game-shell')).toHaveAttribute('data-phase', 'playing');
  expect(errors).toEqual([]);
});

test('sitemap và robots theo từng tên miền', async ({ request }) => {
  const sitemap = await request.get(`${EN}/sitemap.xml`);
  expect(sitemap.ok()).toBeTruthy();
  const xml = await sitemap.text();
  expect(xml).toContain('<loc>http://english.happyclass.test:3100/games/team-quiz</loc>');
  expect(xml).not.toContain('vietnamese');
  const robots = await (await request.get(`${EN}/robots.txt`)).text();
  expect(robots).toContain('Disallow: /admin');
});
