import Link from 'next/link';
import { adminContext } from '@/lib/admin-context';
import { apiGet } from '@/lib/server-api';

type Product = 'english' | 'vietnamese';
type Analytics = {
  range: { days: number; from: string; to: string; product: Product | 'all' };
  summary: {
    plays: number; activeClasses: number; activeStudents: number; averageScorePercent: number;
    averageStars: number; averageDurationMs: number; totalMistakes: number;
  };
  byProduct: {
    product: Product; plays: number; activeClasses: number; activeStudents: number;
    averageScorePercent: number; averageStars: number; averageDurationMs: number; totalMistakes: number;
  }[];
  trend: { day: string; plays: number; activeClasses: number; activeStudents: number }[];
  topGames: { title: string; product: { slug: Product; name: string }; plays: number; averageStars: number }[];
  generatedAt: string;
};

const number = new Intl.NumberFormat('vi-VN');
const productNames: Record<Product, string> = { english: 'English Games', vietnamese: 'Vietnamese Games' };
const duration = (ms: number) => {
  if (!ms) return '—';
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds} giây` : `${Math.floor(seconds / 60)} phút ${seconds % 60} giây`;
};

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="stat-tile">
      <span>{label}</span>
      <b>{typeof value === 'number' ? number.format(value) : value}</b>
      {hint && <small className="muted">{hint}</small>}
    </div>
  );
}

export default async function LearningAnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string; product?: string }> }) {
  const { base } = await adminContext();
  const sp = await searchParams;
  const requestedDays = Number(sp.days ?? 30);
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  const product = sp.product === 'english' || sp.product === 'vietnamese' ? sp.product : undefined;
  const qs = new URLSearchParams({ days: String(days), ...(product ? { product } : {}) });
  const res = await apiGet<Analytics>(`/admin/learning-analytics?${qs}`);
  if (!res.ok) return <p className="form-error">Không tải được báo cáo học tập (mã {res.status}).</p>;

  const data = res.data;
  const generated = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(data.generatedAt));
  const dateLabel = (day: string) => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(new Date(`${day}T00:00:00+07:00`));
  const filterHref = (nextDays: number, nextProduct?: Product) =>
    `${base}/learning-analytics?${new URLSearchParams({ days: String(nextDays), ...(nextProduct ? { product: nextProduct } : {}) })}`;

  return (
    <section data-testid="learning-analytics-page">
      <div className="page-head">
        <div>
          <h1>Phân tích học tập</h1>
          <p className="muted">Số liệu tổng hợp từ hoạt động trong lớp · Cập nhật {generated}</p>
        </div>
      </div>

      <div className="category-chips" aria-label="Khoảng thời gian">
        {[7, 30, 90].map((n) => (
          <Link key={n} className={days === n ? 'chip active' : 'chip'} href={filterHref(n, product)}>{n} ngày</Link>
        ))}
        <Link className={!product ? 'chip active' : 'chip'} href={filterHref(days)}>Tất cả sản phẩm</Link>
        <Link className={product === 'english' ? 'chip active' : 'chip'} href={filterHref(days, 'english')}>English</Link>
        <Link className={product === 'vietnamese' ? 'chip active' : 'chip'} href={filterHref(days, 'vietnamese')}>Tiếng Việt</Link>
      </div>

      <div className="stat-grid" data-testid="learning-analytics-summary">
        <Stat label="Lượt chơi" value={data.summary.plays} hint={`Trong ${days} ngày`} />
        <Stat label="Lớp có hoạt động" value={data.summary.activeClasses} />
        <Stat label="Học sinh có hoạt động" value={data.summary.activeStudents} hint="Đếm theo mã học sinh trong lớp" />
        <Stat label="Điểm trung bình" value={`${data.summary.averageScorePercent.toFixed(1)}%`} />
        <Stat label="Sao trung bình" value={data.summary.averageStars.toFixed(2)} />
        <Stat label="Thời lượng trung bình" value={duration(data.summary.averageDurationMs)} />
        <Stat label="Lỗi trả lời" value={data.summary.totalMistakes} />
      </div>

      <section aria-labelledby="learning-products-heading">
        <h2 id="learning-products-heading">Theo sản phẩm</h2>
        <table className="admin-table" data-testid="learning-analytics-products">
          <thead><tr><th>Sản phẩm</th><th>Lượt chơi</th><th>Lớp</th><th>Học sinh</th><th>Điểm TB</th><th>Sao TB</th><th>Lỗi</th></tr></thead>
          <tbody>
            {data.byProduct.filter((row) => !product || row.product === product).map((row) => (
              <tr key={row.product}>
                <td>{productNames[row.product]}</td><td>{number.format(row.plays)}</td><td>{number.format(row.activeClasses)}</td>
                <td>{number.format(row.activeStudents)}</td><td>{row.averageScorePercent.toFixed(1)}%</td>
                <td>{row.averageStars.toFixed(2)}</td><td>{number.format(row.totalMistakes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="learning-trend-heading">
        <h2 id="learning-trend-heading">Xu hướng hoạt động theo ngày</h2>
        {data.trend.length ? (
          <table className="admin-table" data-testid="learning-analytics-trend">
            <thead><tr><th>Ngày</th><th>Lượt chơi</th><th>Lớp hoạt động</th><th>Học sinh hoạt động</th></tr></thead>
            <tbody>{data.trend.map((row) => (
              <tr key={row.day}><td>{dateLabel(row.day)}</td><td>{number.format(row.plays)}</td><td>{number.format(row.activeClasses)}</td><td>{number.format(row.activeStudents)}</td></tr>
            ))}</tbody>
          </table>
        ) : <div className="panel"><p>Chưa có lượt chơi trong khoảng thời gian này.</p></div>}
      </section>

      <section aria-labelledby="learning-games-heading">
        <h2 id="learning-games-heading">Game được chơi nhiều nhất</h2>
        {data.topGames.length ? (
          <table className="admin-table" data-testid="learning-analytics-top-games">
            <thead><tr><th>Game</th><th>Sản phẩm</th><th>Lượt chơi</th><th>Sao TB</th></tr></thead>
            <tbody>{data.topGames.map((game, index) => (
              <tr key={`${game.product.slug}-${index}-${game.title}`}>
                <td>{game.title}</td><td>{game.product.name}</td><td>{number.format(game.plays)}</td><td>{game.averageStars.toFixed(2)}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : <div className="panel"><p>Chưa có dữ liệu game trong khoảng thời gian này.</p></div>}
      </section>
      <p className="muted">Báo cáo không hiển thị tên, email, biệt danh hoặc kết quả riêng lẻ của học sinh.</p>
    </section>
  );
}
