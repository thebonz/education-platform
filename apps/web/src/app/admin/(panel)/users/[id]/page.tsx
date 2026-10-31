import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RolesEditor, UserStatusActions } from '@/components/admin-actions';
import { adminContext } from '@/lib/admin-context';
import { apiGet } from '@/lib/server-api';

const ALL_ROLES = [
  { key: 'member', name: 'Thành viên' },
  { key: 'teacher', name: 'Giáo viên' },
  { key: 'school_admin', name: 'Quản trị trường' },
  { key: 'support', name: 'Hỗ trợ khách hàng' },
  { key: 'content_editor', name: 'Biên tập nội dung' },
  { key: 'content_reviewer', name: 'Duyệt nội dung' },
  { key: 'product_manager', name: 'Quản lý sản phẩm' },
  { key: 'accountant', name: 'Kế toán' },
  { key: 'super_admin', name: 'Super Admin' },
];

type Detail = {
  id: string; email: string; displayName: string; emailVerifiedAt: string | null; isActive: boolean; lockedReason: string | null;
  createdAt: string; lastLoginAt: string | null; roles: { key: string; name: string }[];
  consents: { kind: string; version: string; acceptedAt: string }[]; activeSessions: number;
};

export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { base, can } = await adminContext();
  const res = await apiGet<Detail>(`/admin/users/${encodeURIComponent(id)}`);
  if (!res.ok) notFound();
  const u = res.data;
  const fmt = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <>
      <Link href={`${base}/users`} className="back-link">← Người dùng</Link>
      <h1>{u.displayName} <small>{u.email}</small></h1>
      <dl className="detail-list">
        <dt>Trạng thái</dt><dd>{u.isActive ? 'Hoạt động' : `Đã khóa – ${u.lockedReason ?? ''}`}</dd>
        <dt>Email</dt><dd>{u.emailVerifiedAt ? `Đã xác thực ${fmt.format(new Date(u.emailVerifiedAt))}` : 'Chưa xác thực'}</dd>
        <dt>Tạo lúc</dt><dd>{fmt.format(new Date(u.createdAt))}</dd>
        <dt>Đăng nhập gần nhất</dt><dd>{u.lastLoginAt ? fmt.format(new Date(u.lastLoginAt)) : '—'}</dd>
        <dt>Phiên đang hoạt động</dt><dd>{u.activeSessions}</dd>
        <dt>Đồng ý</dt><dd>{u.consents.map((c) => `${c.kind} (${c.version})`).join(', ') || '—'}</dd>
      </dl>
      <div className="account-grid">
        <UserStatusActions userId={u.id} isActive={u.isActive} canLock={can('users.lock')} canRevoke={can('users.sessions.revoke')} />
        {can('roles.assign') && <RolesEditor userId={u.id} current={u.roles.map((r) => r.key)} all={ALL_ROLES} />}
      </div>
    </>
  );
}
