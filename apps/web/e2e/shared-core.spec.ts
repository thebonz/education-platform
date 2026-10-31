import { expect, test } from '@playwright/test';

const EN = process.env.E2E_ENGLISH_URL ?? 'http://english.happyclass.test:3100';
const VI = process.env.E2E_VIETNAMESE_URL ?? 'http://vietnamese.happyclass.test:3100';
const ADMIN = process.env.E2E_ADMIN_URL ?? 'http://admin.happyclass.test:3100';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@happyclass.test';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';
const PW = 'E2e-Password-2026';

test.describe.configure({ mode: 'serial' });
const email = `teacher-${Date.now()}@example.com`;

test('đăng ký trên English, đăng nhập, rồi đã đăng nhập sẵn trên Vietnamese (SSO subdomain)', async ({ page }) => {
  await page.goto(`${EN}/register`);
  await page.getByLabel('Display name').fill('Cô Hạnh');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PW);
  await page.getByLabel(/I agree/).check();
  await page.getByLabel(/18 or older/).check();
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.getByRole('status')).toContainText('verification email');

  await page.goto(`${EN}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PW);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(`${EN}/account`);
  await expect(page.getByTestId('account-heading')).toHaveText('My account');
  await expect(page.getByText(email)).toBeVisible();

  const cookies = await page.context().cookies(EN);
  const session = cookies.find((c) => c.name === 'hc_session')!;
  expect(session.httpOnly).toBe(true);
  expect(session.domain).toBe('.happyclass.test');

  await page.goto(`${VI}/account`);
  await expect(page).toHaveURL(`${VI}/account`);
  await expect(page.getByTestId('account-heading')).toHaveText('Tài khoản');
  await expect(page.getByTestId('account-link')).toHaveText('Cô Hạnh');

  await page.getByRole('button', { name: 'Đăng xuất' }).first().click();
  await page.waitForURL(`${VI}/`);
  await page.goto(`${EN}/account`);
  await expect(page).toHaveURL(/\/login\?next=/);
});

test('sai mật khẩu hiển thị lỗi, không lộ thông tin', async ({ page }) => {
  await page.goto(`${VI}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill('wrong-password-123');
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.locator('.form-error')).toHaveText('Email hoặc mật khẩu không đúng.');
});

test('tên miền riêng không hiện tiền tố đường dẫn và thư viện có 5 game @mobile', async ({ page }) => {
  await page.goto(`${VI}/games`);
  await expect(page.getByTestId('game-card')).toHaveCount(5);
  await page.getByPlaceholder('Tìm trò chơi, kỹ năng...').fill('chinh ta');
  await expect(page.getByTestId('game-card')).toHaveCount(1);
  await page.getByTestId('game-card').first().click();
  await expect(page).toHaveURL(`${VI}/games/tro-choi-chinh-ta`);
  await page.getByTestId('shell-start').click();
  await page.getByRole('button', { name: 'chăm chỉ', exact: true }).click();
  await expect(page.getByTestId('tpl-feedback')).toContainText('Chính xác');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('thành viên thường bị chặn ở admin', async ({ page }) => {
  await page.goto(`${ADMIN}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(PW);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByTestId('admin-forbidden')).toBeVisible();
});

test('super admin xem tổng quan, tìm và khóa người dùng; người bị khóa không đăng nhập được', async ({ page, browser }) => {
  test.skip(!ADMIN_PASSWORD, 'Chưa đặt E2E_ADMIN_PASSWORD');
  await page.goto(`${ADMIN}/login`);
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Mật khẩu').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByTestId('admin-dashboard')).toBeVisible();

  await page.getByRole('link', { name: 'Người dùng' }).click();
  await page.getByPlaceholder('Tìm theo email hoặc tên').fill(email);
  await page.getByRole('button', { name: 'Tìm' }).click();
  await page.getByRole('link', { name: email }).click();
  await page.getByLabel('Lý do khóa (bắt buộc)').fill('Kiểm thử E2E');
  await page.getByRole('button', { name: 'Khóa tài khoản' }).click();
  await expect(page.getByText('Đã khóa tài khoản')).toBeVisible();

  await page.getByRole('link', { name: 'Nhật ký thao tác' }).click();
  await expect(page.getByText('admin.user_locked').first()).toBeVisible();

  const other = await browser.newPage();
  await other.goto(`${EN}/login`);
  await other.getByLabel('Email').fill(email);
  await other.getByLabel('Password').fill(PW);
  await other.getByRole('button', { name: 'Log in' }).click();
  await expect(other.locator('.form-error')).toHaveText('This account is locked. Please contact support.');
});
