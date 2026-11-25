import { expect, test } from '@playwright/test';

const EN = process.env.E2E_ENGLISH_URL ?? 'http://english.happyclass.test:3100';

type Spoken = { text: string; voice: string | null; lang: string; rate: number };

test('English voice studio prioritizes clearer available voices, lets students compare and remembers preference', async ({ page }) => {
  await page.addInitScript(() => {
    const spoken: Spoken[] = [];
    (window as unknown as { __spoken: Spoken[] }).__spoken = spoken;
    const voices = [
      { name: 'eSpeak English', lang: 'en-US', voiceURI: 'en-espeak', localService: true, default: true },
      { name: 'Microsoft Jenny Online (Natural)', lang: 'en-US', voiceURI: 'en-jenny', localService: false, default: false },
      { name: 'Microsoft Sonia Online (Natural)', lang: 'en-GB', voiceURI: 'en-sonia', localService: false, default: false },
    ] as SpeechSynthesisVoice[];
    // Native SpeechSynthesisUtterance.voice rejects plain-object test doubles.
    // Replace it with an isolated no-audio utterance stub; this tests selection/rate only.
    class MockUtterance {
      text: string;
      lang = '';
      rate = 1;
      pitch = 1;
      voice: SpeechSynthesisVoice | null = null;
      onstart: ((event: SpeechSynthesisEvent) => void) | null = null;
      onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;
      constructor(text: string) { this.text = text; }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: MockUtterance });
    window.speechSynthesis.getVoices = () => voices;
    window.speechSynthesis.speak = (utterance) => {
      spoken.push({
        text: utterance.text, voice: utterance.voice?.voiceURI ?? null,
        lang: utterance.lang, rate: utterance.rate,
      });
    };
  });

  await page.goto(`${EN}/games/alphabet-bingo`);
  const panel = page.getByTestId('english-voice-panel');
  await expect(panel).toBeVisible();
  const voices = page.getByTestId('english-voice-select');
  await expect(voices.locator('option')).toHaveCount(4);
  await page.getByTestId('english-voice-test').click();
  await expect.poll(async () => page.evaluate(() =>
    (window as unknown as { __spoken: Spoken[] }).__spoken.at(-1)?.voice)).toBe('en-jenny');
  await expect.poll(async () => page.evaluate(() =>
    (window as unknown as { __spoken: Spoken[] }).__spoken.at(-1)?.rate)).toBe(0.85);

  await voices.selectOption('en-sonia');
  await page.getByTestId('english-voice-speed').selectOption('0.75');
  await page.getByTestId('english-voice-test').click();
  const second = await page.evaluate(() =>
    (window as unknown as { __spoken: Spoken[] }).__spoken.at(-1));
  expect(second).toMatchObject({ voice: 'en-sonia', rate: 0.75, lang: 'en-GB' });

  await page.reload();
  await expect(page.getByTestId('english-voice-select')).toHaveValue('en-sonia');
  await expect(page.getByTestId('english-voice-speed')).toHaveValue('0.75');
  // Changing country must drop the manually chosen old-country voice.
  await page.getByLabel('Accent').selectOption('en-GB');
  await expect(page.getByTestId('english-voice-select')).toHaveValue('auto');
  await page.getByTestId('english-voice-test').click();
  await expect.poll(async () => page.evaluate(() =>
    (window as unknown as { __spoken: Spoken[] }).__spoken.at(-1)?.voice)).toBe('en-sonia');
});

test('English voice studio shows a meaningful fallback when browser voices are not available', async ({ page }) => {
  await page.addInitScript(() => {
    window.speechSynthesis.getVoices = () => [];
    (window as unknown as { __spoken: string[] }).__spoken = [];
    window.speechSynthesis.speak = (utterance) => {
      (window as unknown as { __spoken: string[] }).__spoken.push(utterance.text);
    };
  });
  await page.goto(`${EN}/games/alphabet-bingo`);
  await expect(page.getByTestId('english-voice-panel')).toContainText('No installed English voices');
  await page.getByTestId('english-voice-test').click();
  const result = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
  expect(result[0]).toContain('Welcome to HappyClass');
  // This fallback is browser-dependent, not proof a natural device voice is installed.
});
