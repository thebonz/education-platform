import { defineConfig, devices } from '@playwright/test';

/**
 * E2E chạy trên app thật (web + API + PostgreSQL) do CI khởi động trước.
 * Các tên miền *.happyclass.test được trỏ về 127.0.0.1 để kiểm tra đăng nhập dùng chung giữa subdomain.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--host-resolver-rules=MAP *.happyclass.test 127.0.0.1'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
});
