import { hashPassword, hashToken, newToken, verifyPassword } from '../../src/auth/crypto';
import { loadEnv } from '../../src/config/env';
import { permissionsFor, ROLES } from '../../src/rbac/permissions';

describe('crypto', () => {
  it('token ngẫu nhiên, đủ dài, hash ổn định', () => {
    const a = newToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newToken()).not.toBe(a);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).toHaveLength(64);
  });

  it('argon2id băm và kiểm tra mật khẩu, kể cả tiếng Việt có dấu', async () => {
    const h = await hashPassword('Mật-khẩu-đẹp-2026');
    expect(h.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(h, 'Mật-khẩu-đẹp-2026')).toBe(true);
    expect(await verifyPassword(h, 'Mat-khau-dep-2026')).toBe(false);
    expect(await verifyPassword('not-a-hash', 'x')).toBe(false);
  });
});

describe('permissions', () => {
  it('member chỉ có quyền tự quản lý tài khoản', () => {
    expect(permissionsFor(['member'])).toEqual(['account.self']);
  });
  it('super_admin có mọi quyền; vai trò lạ bị bỏ qua', () => {
    expect(permissionsFor(['super_admin', 'hacker'])).toEqual([...ROLES.super_admin.permissions].sort());
  });
  it('chỉ super_admin có roles.assign', () => {
    for (const [key, role] of Object.entries(ROLES)) {
      expect((role.permissions as readonly string[]).includes('roles.assign')).toBe(key === 'super_admin');
    }
  });
});

describe('env', () => {
  const base = { DATABASE_URL: 'postgresql://u:p@localhost:5432/x' };
  it('production bắt buộc cookie Secure và SMTP', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', MAIL_TRANSPORT: 'smtp' })).toThrow(/COOKIE_SECURE/);
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', COOKIE_SECURE: 'true' })).toThrow(/MAIL_TRANSPORT/);
    expect(loadEnv({ ...base, NODE_ENV: 'production', COOKIE_SECURE: 'true', MAIL_TRANSPORT: 'smtp' }).COOKIE_SECURE).toBe(true);
  });
  it('báo tên biến sai nhưng không in giá trị', () => {
    expect(() => loadEnv({ DATABASE_URL: '', SESSION_TTL_DAYS: '999' })).toThrow(/DATABASE_URL.*SESSION_TTL_DAYS|SESSION_TTL_DAYS.*DATABASE_URL/);
  });
});
