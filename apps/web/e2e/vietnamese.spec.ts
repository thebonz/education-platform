import { expect, Page, test } from '@playwright/test';
import { parseSyllable } from '@happyclass/game-core/vi';

/**
 * Game tiếng Việt lớp 1–5 (giai đoạn 4): chơi trọn các template mới trên app thật.
 * Đáp án lấy từ API /play để test luôn khớp nội dung đang xuất bản.
 */
const VI = process.env.E2E_VIETNAMESE_URL ?? 'http://vietnamese.happyclass.test:3100';

async function playData(page: Page, slug: string) {
  const res = await page.request.get(`${VI}/api/catalog/products/vietnamese/games/${slug}/play`);
  expect(res.ok()).toBeTruthy();
  return (await res.json()).data;
}

async function start(page: Page, slug: string) {
  await page.goto(`${VI}/games/${slug}`);
  await page.getByTestId('shell-start').click();
}

async function result(page: Page) {
  await expect(page.getByTestId('shell-result')).toBeVisible({ timeout: 10_000 });
  return page.getByTestId('result-score').innerText();
}

test.describe.configure({ mode: 'serial' });

test('thư viện tiếng Việt có đủ lớp 1–5, lọc theo lớp', async ({ page }) => {
  await page.goto(`${VI}/games`);
  await expect(page.getByTestId('game-card')).toHaveCount(23);
  const levels = await page.getByTestId('filter-level').locator('option').allInnerTexts();
  for (const l of ['Lớp 1', 'Lớp 2', 'Lớp 3', 'Lớp 4', 'Lớp 5']) expect(levels.join('|')).toContain(l);
  await page.getByTestId('filter-level').selectOption('lop-5');
  await expect(page).toHaveURL(/level=lop-5/);
  await expect(page.getByTestId('game-card')).toHaveCount(3);
});

test('Ghép tiếng: chọn âm đầu + vần + thanh, tiếng ghép hiện ngay; sai thì có đánh vần @mobile', async ({ page }) => {
  const data = await playData(page, 'ghep-tieng-co-ban');
  await start(page, 'ghep-tieng-co-ban');
  await expect(page.getByTestId('review-note')).toBeVisible();
  for (let i = 0; i < data.items.length; i++) {
    const id = await page.locator('.tpl-syllable').getAttribute('data-item-id');
    const item = data.items.find((x: { id: string }) => x.id === id);
    const target = parseSyllable(item.word)!;
    if (i === 0) {
      // Lượt đầu cố ý chọn sai thanh
      const wrongTone = target.tone === 'ngang' ? 'sac' : 'ngang';
      await page.locator(`[data-testid=syl-onset][data-value="${target.onset}"]`).click();
      await page.locator(`[data-testid=syl-rhyme][data-value="${target.rhyme}"]`).click();
      await page.locator(`[data-testid=syl-tone][data-value="${wrongTone}"]`).click();
      await page.getByTestId('syl-check').click();
      await expect(page.getByTestId('tpl-feedback')).toContainText(`Đáp án đúng là: ${item.word}`);
      await expect(page.getByTestId('tpl-feedback')).toContainText('Đánh vần:');
    } else {
      await page.locator(`[data-testid=syl-onset][data-value="${target.onset}"]`).click();
      await page.locator(`[data-testid=syl-rhyme][data-value="${target.rhyme}"]`).click();
      await page.locator(`[data-testid=syl-tone][data-value="${target.tone}"]`).click();
      await expect(page.getByTestId('syl-preview')).toContainText(item.word);
      await page.getByTestId('syl-check').click();
      await expect(page.getByTestId('tpl-feedback')).toContainText('Chính xác!');
    }
    await page.getByTestId('quiz-next').click();
  }
  expect(await result(page)).toContain(`Bạn đạt ${data.items.length - 1}/${data.items.length}`);
});

test('Ghép vần (đã phát hành lại): ghép tiếng có âm cuối và nguyên âm đôi', async ({ page }) => {
  const data = await playData(page, 'ghep-van');
  await start(page, 'ghep-van');
  for (let i = 0; i < data.items.length; i++) {
    const id = await page.locator('.tpl-syllable').getAttribute('data-item-id');
    const target = parseSyllable(data.items.find((x: { id: string }) => x.id === id).word)!;
    await page.locator(`[data-testid=syl-onset][data-value="${target.onset}"]`).click();
    await page.locator(`[data-testid=syl-rhyme][data-value="${target.rhyme}"]`).click();
    await page.locator(`[data-testid=syl-tone][data-value="${target.tone}"]`).click();
    await page.getByTestId('syl-check').click();
    await page.getByTestId('quiz-next').click();
  }
  expect(await result(page)).toContain(`Bạn đạt ${data.items.length}/${data.items.length}`);
});

test('Nghe và chọn dấu thanh: chữ chưa có dấu, chọn đúng thì hiện chữ đầy đủ', async ({ page }) => {
  const data = await playData(page, 'nghe-chon-dau-thanh');
  await start(page, 'nghe-chon-dau-thanh');
  for (let i = 0; i < data.items.length; i++) {
    const id = await page.locator('.tpl-tone').getAttribute('data-item-id');
    const item = data.items.find((x: { id: string }) => x.id === id);
    const target = parseSyllable(item.word)!;
    if (target.tone !== 'ngang') await expect(page.getByTestId('tone-word')).not.toHaveText(item.word);
    await page.locator(`[data-testid=tone-choice][data-value="${target.tone}"]`).click();
    await expect(page.getByTestId('tone-word')).toHaveText(item.word);
    await page.getByTestId('quiz-next').click();
  }
  expect(await result(page)).toContain(`Bạn đạt ${data.items.length}/${data.items.length}`);
});

test('Xếp từ vào nhóm: chọn sai được thử lại và tính lỗi', async ({ page }) => {
  const data = await playData(page, 'su-vat-hoat-dong-dac-diem');
  await start(page, 'su-vat-hoat-dong-dac-diem');
  for (let i = 0; i < data.items.length; i++) {
    const id = await page.getByTestId('sort-card').getAttribute('data-item-id');
    const item = data.items.find((x: { id: string }) => x.id === id);
    if (i === 0) {
      const wrong = data.groups.find((g: { id: string }) => g.id !== item.group);
      await page.locator(`[data-testid=sort-group][data-group="${wrong.id}"]`).click();
      await expect(page.getByTestId('tpl-feedback')).toContainText('Chưa đúng');
    }
    await page.locator(`[data-testid=sort-group][data-group="${item.group}"]`).click();
  }
  expect(await result(page)).toContain(`Bạn đạt ${data.items.length - 1}/${data.items.length}`);
  expect(await result(page)).toContain('Lỗi: 1');
});

test('Sắp xếp câu: chạm các mảnh theo thứ tự, chạm lại để gỡ', async ({ page }) => {
  const data = await playData(page, 'xep-cau-lop-2');
  await start(page, 'xep-cau-lop-2');
  for (let i = 0; i < data.items.length; i++) {
    const id = await page.locator('.tpl-sentence').getAttribute('data-item-id');
    const item = data.items.find((x: { id: string }) => x.id === id);
    const chunks: string[] = item.chunks;
    // Thử gỡ một mảnh đã đặt
    await page.locator(`[data-testid=sentence-chunk][data-chunk="${chunks[chunks.length - 1]}"]`).click();
    await page.getByTestId('sentence-placed').first().click();
    await expect(page.getByTestId('sentence-placed')).toHaveCount(0);
    for (const c of chunks) await page.locator(`[data-testid=sentence-chunk][data-chunk="${c}"]:not([disabled])`).first().click();
    await page.getByTestId('sentence-check').click();
    await expect(page.getByTestId('tpl-feedback')).toHaveText('Chính xác!');
    await page.getByTestId('quiz-next').click();
  }
  expect(await result(page)).toContain(`Bạn đạt ${data.items.length}/${data.items.length}`);
});
