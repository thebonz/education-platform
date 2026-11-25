import { expect, test } from '@playwright/test';

/**
 * Game Builder (giai đoạn 5) trên app thật: tạo game, soạn bằng form, tải ảnh, xem trước,
 * lưu + phát hành, mở cho người chơi, chơi trên site công khai, rồi ẩn lại.
 * File chạy trước các file đếm số game (workers = 1, theo thứ tự tên), nên cuối test phải ẩn game.
 */
const ADMIN = process.env.E2E_ADMIN_URL ?? 'http://admin.happyclass.test:3100';
const VI = process.env.E2E_VIETNAMESE_URL ?? 'http://vietnamese.happyclass.test:3100';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@happyclass.test';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

test('tạo game mới bằng Game Builder, tải ảnh, phát hành và chơi trên site công khai', async ({ page }) => {
  test.skip(!ADMIN_PASSWORD, 'Chưa đặt E2E_ADMIN_PASSWORD');
  test.setTimeout(120_000);
  await page.goto(`${ADMIN}/login`);
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Mật khẩu').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByTestId('admin-dashboard')).toBeVisible();

  // 1. Tạo game
  await page.getByRole('link', { name: 'Nội dung game' }).click();
  await page.getByTestId('new-game').click();
  await page.getByTestId('new-product').selectOption('vietnamese');
  await page.getByTestId('new-template').selectOption('syllable-builder');
  await page.getByTestId('new-title').fill('Ghép tiếng có ảnh E2E');
  await expect(page.getByTestId('new-slug')).toHaveValue('ghep-tieng-co-anh-e2e');
  await page.getByTestId('new-summary').fill('Game tạo bằng Game Builder trong kiểm thử.');
  await page.getByTestId('new-level').selectOption('lop-1');
  await page.getByTestId('new-submit').click();
  await expect(page.getByTestId('game-builder')).toBeVisible();
  await expect(page.getByTestId('validation')).toHaveText(/Nội dung hợp lệ/);

  // 2. Lỗi chính tả hiện ngay tại ô nhập
  const word0 = page.locator('input[data-path="items.0.word"]');
  await word0.fill('gế');
  await expect(page.locator('[data-testid=field-issue][data-path="items.0.word"]')).toContainText('viết gh');
  await expect(page.getByTestId('save-draft')).toBeEnabled();
  await page.getByTestId('save-draft').click();
  await expect(page.getByTestId('builder-message')).toContainText('lỗi cần sửa');
  await word0.fill('ghế');

  // 3. Thêm một tiếng có ảnh tải lên từ máy
  await page.locator('[data-testid=add-item][data-path="items"]').click();
  await page.locator('input[data-path="items.3.word"]').fill('kẻ');
  await page.locator('[data-testid=add-optional][data-path="items.3.picture"]').click();
  await page.locator('select[data-path="items.3.picture.kind"]').selectOption('image');
  await page.locator('[data-testid=pick-image][data-path="items.3.picture.src"]').click();
  const picker = page.getByTestId('image-picker');
  await picker.getByTestId('media-file').setInputFiles({ name: 'cai-thuoc-ke.png', mimeType: 'image/png', buffer: PNG });
  await picker.getByTestId('media-alt').fill('cái thước kẻ');
  await picker.getByTestId('media-upload').click();
  await expect(picker).toBeHidden();
  await expect(page.locator('input[data-path="items.3.picture.alt"]')).toHaveValue('cái thước kẻ');
  await expect(page.getByTestId('validation')).toHaveText(/Nội dung hợp lệ/);

  // 4. Xem trước dùng nội dung đang soạn
  await page.getByTestId('refresh-preview').click();
  await page.getByTestId('preview').getByTestId('shell-start').click();
  await expect(page.getByTestId('preview').locator('.tpl-syllable')).toBeVisible();

  // 5. Lưu + phát hành, rồi mở cho người chơi
  await page.getByTestId('version-note').fill('thêm tiếng kẻ có ảnh');
  await page.getByTestId('save-publish').click();
  await expect(page.getByTestId('builder-message')).toContainText('Đã lưu và phát hành phiên bản 2');
  await expect(page.getByTestId('version-list').locator('[data-version="2"]')).toContainText('Đang phát hành');
  await page.getByTestId('toggle-visibility').click();
  await expect(page.getByTestId('visibility')).toHaveText('Đang mở');

  // 6. Người chơi thấy game, có ghi chú chờ duyệt, ảnh tải được
  const player = await page.context().browser()!.newPage();
  await player.goto(`${VI}/games/ghep-tieng-co-anh-e2e`);
  await expect(player.getByTestId('review-note')).toBeVisible();
  const play = await player.request.get(`${VI}/api/catalog/products/vietnamese/games/ghep-tieng-co-anh-e2e/play`);
  const data = (await play.json()).data;
  const item = data.items.find((x: { word: string }) => x.word === 'kẻ');
  expect(item.picture).toMatchObject({ kind: 'image', alt: 'cái thước kẻ' });
  const img = await player.request.get(`${VI}${item.picture.src}`);
  expect(img.headers()['content-type']).toBe('image/png');
  expect(img.headers()['x-content-type-options']).toBe('nosniff');
  await player.close();

  // 7. Ẩn lại để không ảnh hưởng các test đếm số game
  await page.getByTestId('toggle-visibility').click();
  await expect(page.getByTestId('visibility')).toHaveText('Đang ẩn');

  // 8. Thư viện media có ảnh vừa tải, đánh dấu nguồn
  await page.getByRole('link', { name: 'Thư viện media' }).click();
  await expect(page.getByTestId('media-item').filter({ hasText: 'cái thước kẻ' })).toBeVisible();
});

test('giáo viên xem được mẫu đọc tiếng Việt và phải tích đủ checklist trước khi nút duyệt được bật', async ({ page }) => {
  test.skip(!ADMIN_PASSWORD, 'Chưa đặt E2E_ADMIN_PASSWORD');
  await page.goto(`${ADMIN}/login`);
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Mật khẩu').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByTestId('admin-dashboard')).toBeVisible();
  await page.goto(`${ADMIN}/games?review=PENDING`);
  await page.locator('tr[data-slug="nghe-chon-dau-thanh"] a').first().click();
  const preview = page.getByTestId('admin-voice-review');
  await expect(preview).toBeVisible();
  await expect(preview.getByTestId('admin-voice-sample').first()).toBeVisible();
  await expect(preview.getByTestId('admin-voice-sample').first()).toContainText('bò');
  const approve = page.getByTestId('review-approve');
  await expect(approve).toBeDisabled();
  await page.getByTestId('review-check-0').check();
  await page.getByTestId('review-check-1').check();
  await expect(approve).toBeDisabled();
  await page.getByTestId('review-check-2').check();
  await expect(approve).toBeEnabled();
  await page.getByTestId('review-check-1').uncheck();
  await expect(approve).toBeDisabled();
  // Không tự bấm Duyệt: test không thay đổi nội dung hoặc trạng thái 29 game.
});

test('Star Trail: 2 bản mẫu ở chế độ ẩn, chơi bằng Game Builder không tự duyệt hay mở công khai', async ({ page }) => {
  test.skip(!ADMIN_PASSWORD, 'Chưa đặt E2E_ADMIN_PASSWORD');
  await page.goto(`${ADMIN}/login`);
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Mật khẩu').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByTestId('admin-dashboard')).toBeVisible();

  for (const slug of ['star-trail-adventure', 'duong-sao-dau-thanh']) {
    const product = slug === 'star-trail-adventure' ? 'english' : 'vietnamese';
    const response = await page.request.get(`${ADMIN}/api/admin/games?product=${product}&review=PENDING&pageSize=100`);
    expect(response.ok()).toBeTruthy();
    const list = await response.json();
    const game = list.games.find((g: { slug: string }) => g.slug === slug);
    expect(game).toBeTruthy();
    expect(game.isPublished).toBe(false);
    expect(game.reviewStatus).toBe('PENDING');
    await page.goto(`${ADMIN}/games/${game.id}`);
    await expect(page.getByTestId('review-status')).toBeVisible();
    await page.getByTestId('open-builder').click();
    await expect(page.getByTestId('game-builder')).toBeVisible();
    await page.getByTestId('refresh-preview').click();
    const preview = page.getByTestId('preview');
    await preview.getByTestId('team-count').selectOption('2');
    await preview.getByTestId('shell-start').click();
    await expect(preview.getByTestId('trail-board')).toBeVisible();
    await expect(preview.getByTestId('trail-team-0')).toBeVisible();
    await expect(preview.getByTestId('trail-team-1')).toBeVisible();
    await preview.getByTestId('trail-roll').click();
    await expect(preview.getByTestId('trail-roll-result')).toContainText(/\d/);
    await expect(preview.getByTestId('trail-choice')).toHaveCount(3);
    await preview.getByTestId('trail-choice').first().click();
    await expect(preview.getByTestId('trail-feedback')).not.toBeEmpty();
    await preview.getByTestId('trail-next').click();
    await expect(preview.getByTestId('trail-roll')).toBeVisible();
  }
  // Không bấm duyệt, không phát hành: vẫn là mẫu thử để giáo viên kiểm nội dung.
});
