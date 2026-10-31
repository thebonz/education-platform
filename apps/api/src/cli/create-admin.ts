/**
 * Tạo (hoặc nâng quyền) tài khoản Super Admin đầu tiên.
 * Mật khẩu đọc từ stdin để không lưu vào lịch sử shell:
 *
 *   read -rs ADMIN_PW && printf '%s' "$ADMIN_PW" | \
 *     sudo docker compose run --rm -T api node dist/cli/create-admin.js admin@example.com "Tên quản trị"
 *
 * Thêm --promote để cấp super_admin cho tài khoản đã tồn tại (không đổi mật khẩu).
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../auth/crypto';

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const promote = process.argv.includes('--promote');
  const email = (args[0] ?? '').trim().toLowerCase();
  const name = (args[1] ?? 'Super Admin').normalize('NFC').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Cần email hợp lệ làm tham số thứ nhất.');

  const prisma = new PrismaClient();
  try {
    const role = await prisma.role.findUnique({ where: { key: 'super_admin' } });
    const member = await prisma.role.findUnique({ where: { key: 'member' } });
    if (!role || !member) throw new Error('Chưa có vai trò. Hãy chạy seed trước.');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (!promote) throw new Error('Email đã tồn tại. Dùng --promote để cấp quyền super_admin.');
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: existing.id, roleId: role.id } },
        update: {},
        create: { userId: existing.id, roleId: role.id },
      });
      await prisma.auditLog.create({ data: { action: 'cli.super_admin_promoted', entityType: 'user', entityId: existing.id } });
      console.log('Đã cấp quyền super_admin.');
      return;
    }

    const password = await readStdin();
    if (password.length < 12) throw new Error('Mật khẩu (đọc từ stdin) phải dài ít nhất 12 ký tự.');
    const user = await prisma.user.create({
      data: {
        email, displayName: name, passwordHash: await hashPassword(password), emailVerifiedAt: new Date(),
        roles: { create: [{ roleId: role.id }, { roleId: member.id }] },
      },
    });
    await prisma.auditLog.create({ data: { action: 'cli.super_admin_created', entityType: 'user', entityId: user.id } });
    console.log('Đã tạo tài khoản super_admin.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error((e as Error).message); process.exitCode = 1; });
