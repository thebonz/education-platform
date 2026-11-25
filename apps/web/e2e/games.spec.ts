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
  await expect(page.locator('.game-poster-art .poster-center')).toHaveCount(6);
  await expect(page.getByTestId('game-review-pill')).toHaveCount(6);
  await expect(page.getByTestId('homepage-skills')).toBeVisible();
  await page.getByTestId('home-skill-listen').click();
  await expect(page).toHaveURL(/\/games\?skill=listen/);
  await expect(page.getByTestId('game-card')).toHaveCount(3);
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

test('khám phá theo nhóm kỹ năng, URL chia sẻ được và xoá bộ lọc rỗng', async ({ page }) => {
  await page.goto(`${EN}/games`);
  await page.getByTestId('skill-chip-words').click();
  await expect(page).toHaveURL(/skill=words/);
  await expect(page.getByTestId('game-card')).toHaveCount(2);
  await expect(page.getByTestId('skill-chip-words')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('library-results')).toContainText('Showing 2 of 6 games');
  await page.goto(`${EN}/games?skill=teams&category=spelling`);
  await expect(page.getByTestId('game-card')).toHaveCount(0);
  await page.getByTestId('clear-library-filters').click();
  await expect(page).toHaveURL(`${EN}/games`);
  await expect(page.getByTestId('game-card')).toHaveCount(6);
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

test('Bingo Carnival: thay kích thước, mục tiêu và trộn bảng; chơi thắng toàn bảng @mobile', async ({ page }) => {
  await page.goto(`${EN}/games/alphabet-bingo`);
  await page.getByTestId('shell-start').click();
  await expect(page.getByTestId('bingo-carnival')).toBeVisible();
  await expect(page.getByTestId('bingo-cell')).toHaveCount(16);

  await page.getByTestId('bingo-size').selectOption('3');
  await expect(page.getByTestId('bingo-cell')).toHaveCount(9);
  await page.getByTestId('bingo-goal').selectOption('full');
  await expect(page.getByTestId('bingo-progress')).toHaveAttribute('max', '9');
  await page.getByTestId('bingo-new-card').click();
  await expect(page.getByTestId('bingo-progress')).toHaveAttribute('value', '0');
  const firstCall = (await page.getByTestId('bingo-call').getAttribute('data-call-text')) ?? '';
  await page.locator(`[data-testid=bingo-cell][data-text="${firstCall}"]`).click();
  await expect(page.getByTestId('bingo-progress')).toHaveAttribute('value', '1');

  // Không thể đánh dấu một ô khác khi người gọi chưa đọc đến chữ đó.
  const nextCall = (await page.getByTestId('bingo-call').getAttribute('data-call-text')) ?? '';
  const wrong = page.getByTestId('bingo-cell').filter({ hasNotText: nextCall }).filter({ hasNotText: firstCall }).first();
  await wrong.click();
  await expect(page.getByTestId('bingo-progress')).toHaveAttribute('value', '1');
  await page.getByTestId('bingo-repeat').click();

  for (let i = 1; i < 9; i++) {
    const call = await page.getByTestId('bingo-call').getAttribute('data-call-text');
    await page.locator(`[data-testid=bingo-cell][data-text="${call}"]`).click();
  }
  await expect(page.getByTestId('bingo-victory')).toBeVisible();
  await expect(page.getByTestId('bingo-progress')).toHaveAttribute('value', '9');
  await expectResult(page);
  await expect(page.getByTestId('result-score')).toContainText('Mistakes: 1');
});

test('Bingo Carnival: tùy chọn 5x5 chỉ hiện khi có ít nhất 25 mục', async ({ page }) => {
  await page.goto(`${EN}/games/alphabet-bingo`);
  await page.getByTestId('shell-start').click();
  await page.getByTestId('bingo-size').selectOption('5');
  await expect(page.getByTestId('bingo-cell')).toHaveCount(25);
  await expect(page.getByTestId('bingo-progress')).toHaveAttribute('max', '5');
  await page.getByTestId('bingo-goal').selectOption('full');
  await expect(page.getByTestId('bingo-progress')).toHaveAttribute('max', '25');
});

test('Animal Match: ghép từ với hình, có lỗi được tính', async ({ page }) => {
  await page.goto(`${EN}/games/vocabulary-matching`);
  await page.getByTestId('shell-start').click();
  const current = await page.getByTestId('match-word').evaluateAll((nodes) => nodes.map((el) => el.getAttribute('data-id')));
  await expect(page.getByTestId('match-picture').first().locator('img')).toHaveAttribute('src', /\/illustrations\//);
  await expect.poll(async () => page.getByTestId('match-picture').first().locator('img')
    .evaluate((img) => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.locator(`[data-testid=match-word][data-id="${current[0]}"]`).click();
  await page.locator(`[data-testid=match-picture][data-id="${current[1]}"]`).click();
  expect(current).toHaveLength(6);
  await expect(page.getByTestId('match-library-count')).toContainText('12 words');
  for (const id of current) {
    await page.locator(`[data-testid=match-word][data-id="${id}"]`).click();
    await page.locator(`[data-testid=match-picture][data-id="${id}"]`).click();
  }
  expect(await expectResult(page)).toContain('You scored 6/6 points · Mistakes: 1');
  await page.getByTestId('play-again').click();
  const newSet = await page.getByTestId('match-word').evaluateAll((nodes) => nodes.map((el) => el.getAttribute('data-id')));
  expect(newSet).toHaveLength(6);
  expect(newSet.some((id) => !current.includes(id))).toBe(true);
});

test('Hidden Picture: mở hết ô và đoán đúng bức tranh', async ({ page }) => {
  const data = await playData(page, 'hidden-picture');
  await page.goto(`${EN}/games/hidden-picture`);
  await page.getByTestId('shell-start').click();
  const total = data.questionsPerRound ?? data.questions.length;
  await expect(page.getByTestId('hidden-scene-library')).toContainText('6 illustrated pictures');
  const firstArt = await page.locator('.hidden-picture img').getAttribute('src');
  expect(firstArt).toContain('puzzle-cat.svg');
  for (let i = 0; i < total; i++) {
    const q = await currentQuestion(page, data.questions);
    await page.getByRole('button', { name: q.answer, exact: true }).click();
    await page.getByTestId('quiz-next').click();
  }
  await expect(page.locator('.hidden-tile.gone')).toHaveCount(total);
  await page.getByRole('button', { name: data.scenes[0].answer, exact: true }).click();
  expect(await expectResult(page)).toContain(`You scored ${total + 1}/${total + 1}`);
  await page.getByTestId('play-again').click();
  await expect(page.locator('.hidden-picture img')).toHaveAttribute('src', /dog\.svg/);
  const firstPromptReplay = await page.getByTestId('quiz-prompt').innerText();
  expect(data.questions.slice(total).some((q: Q) => q.prompt === firstPromptReplay)).toBe(true);
});

test('Bubble Word Garden: chọn bài, bấm bong bóng đúng thứ tự @mobile', async ({ page }) => {
  const data = await playData(page, 'bubble-word-garden');
  await page.goto(`${EN}/games/bubble-word-garden`);
  await page.getByTestId('shell-start').click();
  await page.getByTestId('unit-option').first().click();
  await expect(page.locator('.bubble-stage-header')).toBeVisible();
  await expect(page.locator('.bubble-round-dots > span')).toHaveCount(data.wordsPerRound);
  const unit = data.units[0];
  for (let i = 0; i < data.wordsPerRound; i++) {
    const id = await page.getByTestId('bubble-word').getAttribute('data-word-id');
    const word = unit.words.find((w: { id: string }) => w.id === id);
    for (const seg of word.segments ?? graphemes(word.word)) await page.locator(`[data-testid=bubble][data-value="${seg}"]:not([disabled])`).first().click();
    await expect(page.getByTestId('bubble-word-complete')).toBeVisible();
    await page.getByTestId('bubble-next').click();
  }
  expect(await expectResult(page)).toContain(`You scored ${data.wordsPerRound}/${data.wordsPerRound}`);
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
  await expect(page.getByTestId('quiz-bank-count')).toContainText('20 questions');
  for (let i = 0; i < data.questionsPerRound; i++) {
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

test('teacher random picker: no-repeat turns, reset and browser-only privacy', async ({ page }) => {
  await page.goto(`${EN}/`);
  await page.getByTestId('open-student-picker').click();
  await expect(page).toHaveURL(`${EN}/tools/random-picker`);
  await expect(page.getByTestId('student-picker')).toBeVisible();
  await page.getByTestId('picker-names').fill('Alex\nBen\nCharlie\nAlex');
  await expect(page.getByTestId('picker-remaining')).toContainText('3 remaining');

  const seen = new Set<string>();
  for (let i = 0; i < 3; i++) {
    await page.getByTestId('picker-draw').click();
    const name = await page.getByTestId('picker-selected').innerText();
    expect(['Alex', 'Ben', 'Charlie']).toContain(name);
    expect(seen.has(name)).toBe(false);
    seen.add(name);
  }
  expect(seen.size).toBe(3);
  await expect(page.getByTestId('picker-draw')).toBeDisabled();
  await expect(page.getByTestId('picker-remaining')).toContainText('0 remaining');
  await page.getByTestId('picker-reset').click();
  await expect(page.getByTestId('picker-draw')).toBeEnabled();
  await page.getByTestId('picker-repeat').check();
  await page.getByTestId('picker-draw').click();
  await expect(page.getByTestId('picker-selected')).not.toHaveText('✨');
  expect(await page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.includes('picker')))).toEqual([]);
  await page.reload();
  await expect(page.getByTestId('picker-names')).toHaveValue('');
});

test('Vietnamese student picker: chặn danh sách quá dài và không ghi nhớ họ tên', async ({ page }) => {
  const VI = process.env.E2E_VIETNAMESE_URL ?? 'http://vietnamese.happyclass.test:3100';
  await page.goto(`${VI}/tools/random-picker`);
  await expect(page.getByRole('heading', { name: 'Vòng quay gọi tên' })).toBeVisible();
  await page.getByTestId('picker-names').fill(Array.from({ length: 41 }, (_, i) => `Bạn ${i + 1}`).join('\n'));
  await expect(page.getByTestId('student-picker').getByRole('alert')).toBeVisible();
  await expect(page.getByTestId('picker-draw')).toBeDisabled();
  await page.getByTestId('picker-clear').click();
  await expect(page.getByTestId('picker-draw')).toBeDisabled();
  await page.getByTestId('picker-names').fill('Bé An\nBé Bình\nBé Chi');
  await page.getByTestId('picker-draw').click();
  await expect(page.getByTestId('picker-selected')).not.toHaveText('✨');
});
