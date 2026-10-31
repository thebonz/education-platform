import Link from 'next/link';
import { adminContext } from '@/lib/admin-context';
import { apiGet } from '@/lib/server-api';

type Row = { id: string; email: string; displayName: string; emailVerifiedAt: string | null; isActive: boolean; createdAt: string; roles: string[] };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { base } = await adminContext();
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.q) qs.set('q', sp.q);
  if (sp.page) qs.set('page', sp.page);
  const res = await apiGet<{ total: number; page: number; pageSize: number; users: Row[] }>(`/admin/users?${qs}`);
  if (!res.ok) return <p className="form-error">Không tải được danh sách (mã {res.status}).</p>;
  const { users, total, page, pageSize } = res.data;
  const fmt = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' });
  return (
    <>
      <h1>Người dùng <small>({total})</small></h1>
      <form className="admin-search"><input name="q" defaultValue={sp.q ?? ''} placeholder="Tìm theo email hoặc tên" /><button className="secondary-button">Tìm</button></form>
      <table className="admin-table">
        <thead><tr><th>Email</th><th>Tên</th><th>Vai trò</th><th>Xác thực</th><th>Trạng thái</th><th>Ngày tạo</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td><Link href={`${base}/users/${u.id}`}>{u.email}</Link></td>
              <td>{u.displayName}</td>
              <td>{u.roles.join(', ')}</td>
              <td>{u.emailVerifiedAt ? '✓' : '—'}</td>
              <td>{u.isActive ? 'Hoạt động' : <span className="tag-danger">Đã khóa</span>}</td>
              <td>{fmt.format(new Date(u.createdAt))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pager">
        {page > 1 && <Link href={`?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(page - 1) })}`}>← Trước</Link>}
        <span>Trang {page} / {Math.max(1, Math.ceil(total / pageSize))}</span>
        {page * pageSize < total && <Link href={`?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(page + 1) })}`}>Sau →</Link>}
      </div>
    </>
  );
}
