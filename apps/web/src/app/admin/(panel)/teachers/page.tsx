import Link from 'next/link';
import { adminContext } from '@/lib/admin-context';
import { apiGet } from '@/lib/server-api';

type TeacherRow = {
  id: string;
  email: string;
  displayName: string;
  emailVerifiedAt: string | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  roles: string[];
  metrics: {
    activeClasses: number;
    activeStudents: number;
    activeGames: number;
    classesByProduct: { english: number; vietnamese: number };
  };
};

const roleNames: Record<string, string> = {
  teacher: 'Giáo viên',
  school_admin: 'Quản trị trường',
};

export default async function TeachersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { base } = await adminContext();
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.q) qs.set('q', sp.q);
  if (sp.page) qs.set('page', sp.page);
  const res = await apiGet<{ total: number; page: number; pageSize: number; teachers: TeacherRow[] }>(`/admin/users/teachers?${qs}`);
  if (!res.ok) return <p className="form-error">Không tải được danh sách giáo viên (mã {res.status}).</p>;

  const { teachers, total, page, pageSize } = res.data;
  const fmt = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' });
  const fmtLogin = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  return (
    <section data-testid="admin-teachers">
      <div className="page-head">
        <div>
          <h1>Giáo viên & quản trị trường <small>({total})</small></h1>
          <p className="muted">Theo dõi tài khoản và quy mô lớp học. Dữ liệu học sinh chỉ hiển thị dưới dạng số lượng tổng hợp.</p>
        </div>
      </div>
      <form className="admin-search">
        <input name="q" defaultValue={sp.q ?? ''} placeholder="Tìm theo email hoặc tên giáo viên" />
        <button className="secondary-button">Tìm</button>
      </form>
      {teachers.length ? (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Giáo viên</th><th>Vai trò</th><th>Lớp đang hoạt động</th>
              <th>English</th><th>Tiếng Việt</th><th>Học sinh</th><th>Game lớp</th>
              <th>Đăng nhập gần nhất</th><th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((teacher) => (
              <tr key={teacher.id}>
                <td>
                  <Link href={`${base}/users/${teacher.id}`}>{teacher.displayName}</Link>
                  <br /><small>{teacher.email}</small>
                </td>
                <td>{teacher.roles.map((role) => roleNames[role] ?? role).join(', ')}</td>
                <td>{teacher.metrics.activeClasses}</td>
                <td>{teacher.metrics.classesByProduct.english}</td>
                <td>{teacher.metrics.classesByProduct.vietnamese}</td>
                <td>{teacher.metrics.activeStudents}</td>
                <td>{teacher.metrics.activeGames}</td>
                <td>{teacher.lastLoginAt ? fmtLogin.format(new Date(teacher.lastLoginAt)) : 'Chưa đăng nhập'}</td>
                <td>{teacher.isActive ? 'Hoạt động' : <span className="tag-danger">Đã khóa</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="panel"><p>Chưa có giáo viên hoặc quản trị trường phù hợp.</p></div>
      )}
      <div className="pager">
        {page > 1 && <Link href={`?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(page - 1) })}`}>← Trước</Link>}
        <span>Trang {page} / {Math.max(1, Math.ceil(total / pageSize))}</span>
        {page * pageSize < total && <Link href={`?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(page + 1) })}`}>Sau →</Link>}
      </div>
    </section>
  );
}
