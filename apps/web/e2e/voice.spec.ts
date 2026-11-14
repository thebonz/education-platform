import { expect, test } from '@playwright/test';

/**
 * Giọng đọc tiếng Việt: game tiếng Việt phát file giọng Bắc từ máy chủ (/api/tts), không dùng giọng
 * của trình duyệt (thường là giọng tiếng Anh khi máy chưa cài giọng Việt).
 */
const VI = process.env.E2E_VIETNAMESE_URL ?? 'http://vietnamese.happyclass.test:3100';

// WAV im lặng 0,1 giây (22 050 Hz, 16 bit, mono)
function silentWav(): Buffer {
  const samples = 2205, data = samples * 2;
  const b = Buffer.alloc(44 + data);
  b.write('RIFF', 0, 'latin1'); b.writeUInt32LE(36 + data, 4); b.write('WAVEfmt ', 8, 'latin1');
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(22050, 24);
  b.writeUInt32LE(44100, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36, 'latin1'); b.writeUInt32LE(data, 40);
  return b;
}

test.beforeEach(async ({ page }) => {
  // Đếm số lần trình duyệt tự đọc bằng Web Speech API
  await page.addInitScript(() => {
    (window as unknown as { __speak: string[] }).__speak = [];
    if ('speechSynthesis' in window) {
      window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => { (window as unknown as { __speak: string[] }).__speak.push(u.text); };
    }
  });
});

test('game tiếng Việt đọc bằng giọng của máy chủ, không dùng giọng trình duyệt', async ({ page }) => {
  const asked: string[] = [];
  await page.route('**/api/tts?**', (route) => {
    const u = new URL(route.request().url());
    asked.push(u.searchParams.get('text') ?? '');
    return route.fulfill({ status: 200, contentType: 'audio/wav', body: silentWav() });
  });
  await page.goto(`${VI}/games/nghe-chon-dau-thanh`);
  await page.getByTestId('shell-start').click();
  await expect.poll(() => asked.length).toBeGreaterThan(0);
  expect(asked[0].length).toBeGreaterThan(0);
  await page.getByRole('button', { name: /Nghe/ }).first().click();
  await expect.poll(() => asked.length).toBeGreaterThan(1);
  expect(await page.evaluate(() => (window as unknown as { __speak: string[] }).__speak)).toEqual([]);
  await expect(page.getByTestId('voice-missing')).toHaveCount(0);
});

test('máy chủ không đọc được và máy không có giọng Việt: báo rõ, không đọc bằng giọng tiếng Anh', async ({ page }) => {
  await page.route('**/api/tts?**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"tts_unavailable"}' }));
  await page.addInitScript(() => {
    if ('speechSynthesis' in window) {
      const en = { lang: 'en-US', name: 'English', voiceURI: 'en', localService: true, default: true } as SpeechSynthesisVoice;
      window.speechSynthesis.getVoices = () => [en];
    }
  });
  await page.goto(`${VI}/games/nghe-chon-dau-thanh`);
  await page.getByTestId('shell-start').click();
  await expect(page.getByTestId('voice-missing')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __speak: string[] }).__speak)).toEqual([]);
});
