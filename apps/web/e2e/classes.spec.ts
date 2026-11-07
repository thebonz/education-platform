import { expect, test } from '@playwright/test';

/**
 * Lớp học: giáo viên tạo lớp, chép game, sửa bản của lớp, thêm học sinh; học sinh (không đăng nhập)
 * vào bằng mã lớp, chọn tên, chơi; giáo viên thấy kết quả.
 */
const VI = process.env.E2E_VIETNAMESE_URL ?? 'http://vietnamese.happyclass.test:3100';
const PW = 'Correct-Horse-Battery-42';

test('giáo viên tạo lớp và sửa game; học sinh vào bằng mã lớp, chơi; giáo viên xem kết quả', async ({ page, browser }) => {
  test.setTimeout(150_000);
  const email = `teacher-class-${Date.now()}@example.com`;
  const reg = await page.request.post(`${VI}/api/auth/register`, {
    headers: { Origin: VI }, data: { displayName: 'Cô Mai', email, password: PW, acceptTerms: true, confirmAdult: true, site: 'vietnamese' },
  });
  expect(reg.ok()).toBeTruthy();
  await page.goto(`${VI}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu').fill(PW);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page.getByTestId('account-heading')).toBeVisible();

  // 1. Tạo lớp
  await page.getByTestId('classes-link').click();
  await page.getByTestId('class-name').fill('Lớp 2A E2E');
  await page.getByTestId('class-create').click();
  await expect(page.getByTestId('class-title')).toContainText('Lớp 2A E2E');

  // 2. Chép game "Chọn dấu câu" vào lớp
  const option = page.getByTestId('pick-game').locator('option', { hasText: 'Chọn dấu câu' });
  await page.getByTestId('pick-game').selectOption(await option.getAttribute('value') ?? '');
  await page.getByTestId('add-game').click();
  await expect(page.getByTestId('class-games')).toContainText('Chọn dấu câu');

  // 3. Sửa bản của lớp: đổi tên, bớt còn 3 câu
  await page.getByTestId('edit-class-game').first().click();
  await expect(page.getByTestId('class-game-editor')).toBeVisible();
  await page.getByTestId('class-game-title').fill('Dấu câu – lớp 2A');
  const removeQuestion = page.locator('[data-path="questions"] > [data-testid=array-item] > .arr-tools [data-testid=remove-item]');
  for (let i = 0; i < 5; i++) await removeQuestion.first().click();
  await expect(page.locator('[data-path="questions"] > [data-testid=array-item]')).toHaveCount(3);
  await page.getByTestId('class-game-save').click();
  await expect(page.getByTestId('class-game-message')).toHaveText('Đã lưu.');

  // 4. Thêm học sinh, lấy mã lớp
  await page.getByRole('link', { name: '← Lớp' }).click();
  await page.getByTestId('tab-students').click();
  await page.getByTestId('student-names').fill('An\nBình');
  await page.getByTestId('add-students').click();
  await expect(page.getByTestId('student-list')).toContainText('Bình');
  await page.getByTestId('tab-share').click();
  const code = (await page.getByTestId('join-code').innerText()).trim();
  expect(code).toMatch(/^[2-9A-HJKMNP-Z]{6}$/);
  await expect(page.getByTestId('join-url')).toContainText(`/lop/${code}`);

  // 5. Học sinh: trình duyệt khác, không đăng nhập
  const kid = await (await browser.newContext()).newPage();
  await kid.goto(`${VI}/lop`);
  await kid.locator('[data-testid=join-code-form] input[name=code]').fill(code.toLowerCase());
  await kid.getByRole('button', { name: 'Vào lớp' }).click();
  await expect(kid.getByTestId('join-class-name')).toContainText('Lớp 2A E2E');
  await kid.locator('[data-testid=pick-student][data-name="An"]').click();
  await kid.locator('[data-testid=join-game][data-title="Dấu câu – lớp 2A"]').click();

  const view = await (await kid.request.get(`${VI}/api/class-join/${code}`)).json();
  const content = await (await kid.request.get(`${VI}/api/class-join/${code}/games/${view.games[0].id}`)).json();
  const questions: { prompt: string; answer: string }[] = content.data.questions;
  await kid.getByTestId('shell-start').click();
  for (let i = 0; i < questions.length; i++) {
    const prompt = await kid.getByTestId('quiz-prompt').innerText();
    const q = questions.find((x) => x.prompt === prompt)!;
    await kid.locator('.choice', { hasText: q.answer }).first().click();
    await kid.getByTestId('quiz-next').click();
  }
  await expect(kid.getByTestId('result-saved')).toHaveText('Cô/thầy đã nhận kết quả của em!');
  await kid.context().close();

  // 6. Giáo viên xem kết quả
  await page.reload();
  await page.getByTestId('tab-results').click();
  await expect(page.getByTestId('results-table')).toContainText('An');
  await expect(page.getByTestId('results-table')).toContainText('★★★');
});
