/**
 * Tạo tài khoản nhân sự (mặc định Super Admin) hoặc cấp thêm vai trò cho tài khoản có sẵn.
 * Mật khẩu đọc từ stdin để không lưu vào lịch sử shell:
 *
 *   read -rs PW && printf '%s' "$PW" | \
 *     sudo docker compose run --rm -T api node dist/cli/create-admin.js user@example.com "Tên" [--role=content_reviewer]
 *
 * --role=<vai trò>  vai trò cấp (mặc định super_admin). Không nhận "member" (mọi tài khoản đều có sẵn).
 * --promote         tài khoản đã tồn tại: chỉ cấp thêm vai trò, không đổi mật khẩu.
 */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../auth/crypto';
import { isRoleKey, ROLE_KEYS } from '../rbac/permissions';

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
}

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const promote = process.argv.includes('--promote');
  const roleKey = process.argv.find((a) => a.startsWith('--role='))?.slice('--role='.length) || 'super_admin';
  if (!isRoleKey(roleKey) || roleKey === 'member') {
    throw new Error(`Vai trò không hợp lệ: ${roleKey}. Chọn một trong: ${ROLE_KEYS.filter((k) => k !== 'member').join(', ')}`);
  }
  const email = (args[0] ?? '').trim().toLowerCase();
  const name = (args[1] ?? 'Super Admin').normalize('NFC').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Cần email hợp lệ làm tham số thứ nhất.');

  const prisma = new PrismaClient();
  try {
    const role = await prisma.role.findUnique({ where: { key: roleKey } });
    const member = await prisma.role.findUnique({ where: { key: 'member' } });
    if (!role || !member) throw new Error('Chưa có vai trò. Hãy chạy seed trước.');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (!promote) throw new Error(`Email đã tồn tại. Dùng --promote để cấp thêm vai trò ${roleKey}.`);
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: existing.id, roleId: role.id } },
        update: {},
        create: { userId: existing.id, roleId: role.id },
      });
      await prisma.auditLog.create({
        data: { action: roleKey === 'super_admin' ? 'cli.super_admin_promoted' : 'cli.role_granted', entityType: 'user', entityId: existing.id, metadata: { role: roleKey } },
      });
      console.log(`Đã cấp vai trò ${roleKey}.`);
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
    await prisma.auditLog.create({
      data: { action: roleKey === 'super_admin' ? 'cli.super_admin_created' : 'cli.staff_created', entityType: 'user', entityId: user.id, metadata: { role: roleKey } },
    });
    console.log(`Đã tạo tài khoản ${roleKey}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error((e as Error).message); process.exitCode = 1; });
