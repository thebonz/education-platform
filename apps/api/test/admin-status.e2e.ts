import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTestApp, createUser, login, TestApp } from './helpers';

describe('Admin: tình trạng hệ thống', () => {
  let t: TestApp;
  let admin: string;
  let editor: string;
  const statusDir = mkdtempSync(join(tmpdir(), 'hc-status-'));

  beforeAll(async () => {
    t = await createTestApp({ STATUS_DIR: statusDir, GIT_COMMIT: 'abc1234' });
    await createUser(t.prisma, 'owner@example.com', 'Correct-Horse-42', ['super_admin']);
    await createUser(t.prisma, 'editor@example.com', 'Correct-Horse-42', ['content_editor']);
    admin = await login(t, 'owner@example.com', 'Correct-Horse-42');
    editor = await login(t, 'editor@example.com', 'Correct-Horse-42');
  });
  afterAll(async () => {
    await t.close();
    process.env.STATUS_DIR = '';
    process.env.GIT_COMMIT = '';
    rmSync(statusDir, { recursive: true, force: true });
  });

  const get = (cookie: string) => t.http().get('/api/admin/system/status').set('Cookie', cookie);
  const check = (body: { checks: { key: string; level: string; detail: string }[] }, key: string) => body.checks.find((c) => c.key === key)!;

  it('chỉ Super Admin xem được (biên tập viên bị chặn)', async () => {
    await get(editor).expect(403);
  });

  it('chưa sao lưu: báo lỗi và hướng dẫn; các mục khác có trạng thái rõ ràng', async () => {
    const r = await get(admin).expect(200);
    expect(r.body.version.commit).toBe('abc1234');
    expect(check(r.body, 'database').level).toBe('ok');
    expect(check(r.body, 'backup')).toMatchObject({ level: 'error' });
    expect(check(r.body, 'backup').detail).toContain('configure-backup.sh');
    expect(check(r.body, 'restore').level).toBe('warn');
    expect(check(r.body, 'tts').level).toBe('error'); // môi trường test không chạy dịch vụ tts
    expect(check(r.body, 'payments').level).toBe('warn');
    expect(check(r.body, 'mail').level).toBe('warn');
    expect(r.body.summary.error).toBeGreaterThan(0);
  });

  it('đọc file trạng thái do script sao lưu ghi', async () => {
    const now = new Date().toISOString();
    writeFileSync(join(statusDir, 'backup.json'), JSON.stringify({ lastSuccess: now, provider: 'r2', mediaFiles: 12 }));
    writeFileSync(join(statusDir, 'restore-test.json'), JSON.stringify({ lastSuccess: now }));
    const r = await get(admin).expect(200);
    expect(check(r.body, 'backup')).toMatchObject({ level: 'ok' });
    expect(check(r.body, 'backup').detail).toContain('12 file media');
    expect(check(r.body, 'restore').level).toBe('ok');
    // Sao lưu cũ quá 2 ngày → lỗi
    writeFileSync(join(statusDir, 'backup.json'), JSON.stringify({ lastSuccess: new Date(Date.now() - 3 * 86_400_000).toISOString() }));
    expect(check((await get(admin).expect(200)).body, 'backup').level).toBe('error');
  });

  it('không lộ bí mật trong phản hồi', async () => {
    const text = JSON.stringify((await get(admin).expect(200)).body);
    expect(text).not.toContain('postgresql://');
    // Không chứa giá trị của bất kỳ biến môi trường bí mật nào (chỉ được nhắc tên biến trong hướng dẫn)
    for (const [k, v] of Object.entries(process.env)) {
      if (/SECRET|PASSWORD|KEY|TOKEN|DATABASE_URL/.test(k) && v && v.length >= 8) expect(text).not.toContain(v);
    }
  });
});
