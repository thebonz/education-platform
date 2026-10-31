import { adminContext } from '@/lib/admin-context';
import { apiGet } from '@/lib/server-api';

type Stats = {
  users: { total: number; verified: number; locked: number; new7d: number };
  activeSessions: number;
  products: { slug: string; name: string; publishedGames: number }[];
  generatedAt: string;
};

export default async function AdminHome() {
  const { can } = await adminContext();
  if (!can('stats.read')) return <h1>Tổng quan</h1>;
  const stats = await apiGet<Stats>('/admin/stats');
  if (!stats.ok) return <p className="form-error">Không tải được số liệu.</p>;
  const s = stats.data;
  const tiles = [
    ['Tổng người dùng', s.users.total],
    ['Đã xác thực email', s.users.verified],
    ['Đăng ký 7 ngày qua', s.users.new7d],
    ['Tài khoản bị khóa', s.users.locked],
    ['Phiên đang hoạt động', s.activeSessions],
    ...s.products.map((p) => [`Game đã xuất bản – ${p.name}`, p.publishedGames] as const),
  ] as const;
  return (
    <>
      <h1 data-testid="admin-dashboard">Tổng quan</h1>
      <div className="stat-grid">{tiles.map(([label, value]) => <div className="stat-tile" key={label}><span>{label}</span><b>{value}</b></div>)}</div>
      <p className="muted">Doanh thu, đơn hàng và membership sẽ hiển thị khi mở giai đoạn thanh toán.</p>
    </>
  );
}
