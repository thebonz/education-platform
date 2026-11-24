import { adminContext } from '@/lib/admin-context';
import { apiGet } from '@/lib/server-api';

type Stats = {
  users: { total: number; verified: number; locked: number; new7d: number };
  activeSessions: number;
  plays7d: number;
  education: { activeTeachers: number; activeClasses: number; activeStudents: number; classPlays7d: number };
  products: { slug: string; name: string; publishedGames: number }[];
  generatedAt: string;
};
type BillingSummary = {
  paymentsEnabled: boolean;
  revenue30dVnd: number;
  paidOrders30d: number;
  pendingOrders: number;
  transactionsToReview: number;
  activeMemberships: number;
};

const count = new Intl.NumberFormat('vi-VN');
const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="stat-tile"><span>{label}</span><b>{typeof value === 'number' ? count.format(value) : value}</b></div>;
}

export default async function AdminHome() {
  const { can } = await adminContext();
  if (!can('stats.read')) return <h1>Tổng quan</h1>;

  const [stats, billing] = await Promise.all([
    apiGet<Stats>('/admin/stats'),
    can('billing.read') ? apiGet<BillingSummary>('/admin/billing/summary') : Promise.resolve(null),
  ]);
  if (!stats.ok) return <p className="form-error">Không tải được số liệu.</p>;
  const s = stats.data;
  const b = billing?.ok ? billing.data : null;
  const generated = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(s.generatedAt));

  return (
    <>
      <div className="page-head">
        <div><h1 data-testid="admin-dashboard">Tổng quan</h1><p className="muted">Tình hình hoạt động HappyClass · Cập nhật {generated}</p></div>
      </div>

      <section aria-labelledby="dashboard-users-heading">
        <h2 id="dashboard-users-heading">Tài khoản & truy cập</h2>
        <div className="stat-grid">
          <Stat label="Tổng người dùng" value={s.users.total} />
          <Stat label="Đã xác thực email" value={s.users.verified} />
          <Stat label="Đăng ký 7 ngày qua" value={s.users.new7d} />
          <Stat label="Tài khoản bị khóa" value={s.users.locked} />
          <Stat label="Phiên đang hoạt động" value={s.activeSessions} />
        </div>
      </section>

      <section aria-labelledby="dashboard-learning-heading" data-testid="admin-dashboard-learning">
        <h2 id="dashboard-learning-heading">Hoạt động học tập</h2>
        <div className="stat-grid">
          <Stat label="Giáo viên / quản trị trường đang hoạt động" value={s.education.activeTeachers} />
          <Stat label="Lớp học đang hoạt động" value={s.education.activeClasses} />
          <Stat label="Học sinh đang hoạt động" value={s.education.activeStudents} />
          <Stat label="Lượt chơi game cá nhân · 7 ngày" value={s.plays7d} />
          <Stat label="Lượt chơi trong lớp · 7 ngày" value={s.education.classPlays7d} />
        </div>
      </section>

      <section aria-labelledby="dashboard-content-heading">
        <h2 id="dashboard-content-heading">Nội dung</h2>
        <div className="stat-grid">
          {s.products.map((p) => <Stat key={p.slug} label={`Game đã xuất bản – ${p.name}`} value={p.publishedGames} />)}
        </div>
      </section>

      {b && (
        <section aria-labelledby="dashboard-billing-heading" data-testid="admin-dashboard-billing">
          <h2 id="dashboard-billing-heading">Thanh toán · 30 ngày gần nhất</h2>
          <div className="stat-grid">
            <Stat label="Doanh thu đã xác nhận" value={money.format(b.revenue30dVnd)} />
            <Stat label="Đơn đã thanh toán" value={b.paidOrders30d} />
            <Stat label="Đơn đang chờ" value={b.pendingOrders} />
            <Stat label="Gói thành viên đang hiệu lực" value={b.activeMemberships} />
            <Stat label="Giao dịch cần đối soát" value={b.transactionsToReview} />
          </div>
        </section>
      )}
    </>
  );
}
