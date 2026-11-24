import Link from 'next/link';
import { adminContext } from '@/lib/admin-context';
import { formatVnd } from '@/lib/billing';
import { apiGet } from '@/lib/server-api';

type Product = 'english' | 'vietnamese';
type Analytics = {
  range: { days: number; from: string; to: string; product: Product | 'all' };
  summary: {
    revenueVnd: number; paidOrders: number; payingCustomers: number; averageOrderValueVnd: number;
    renewals: number; renewalRatePercent: number; repeatCustomers: number; membershipsExpiring30d: number;
  };
  byProduct: {
    product: Product; paidOrders: number; revenueVnd: number; payingCustomers: number; renewals: number;
    renewalRatePercent: number; averageOrderValueVnd: number;
  }[];
  trend: { day: string; revenueVnd: number; paidOrders: number }[];
  topPlans: { code: string; name: string; product: { slug: Product; name: string }; paidOrders: number; revenueVnd: number; renewals: number }[];
  generatedAt: string;
};

const number = new Intl.NumberFormat('vi-VN');
const productNames: Record<Product, string> = { english: 'English Games', vietnamese: 'Vietnamese Games' };

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="stat-tile">
      <span>{label}</span>
      <b>{typeof value === 'number' ? number.format(value) : value}</b>
      {hint && <small className="muted">{hint}</small>}
    </div>
  );
}

export default async function BusinessAnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string; product?: string }> }) {
  const { base, can } = await adminContext();
  if (!can('billing.read')) return <p className="form-error">Không có quyền xem phân tích kinh doanh.</p>;
  const sp = await searchParams;
  const requestedDays = Number(sp.days ?? 30);
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 30;
  const product = sp.product === 'english' || sp.product === 'vietnamese' ? sp.product : undefined;
  const qs = new URLSearchParams({ days: String(days), ...(product ? { product } : {}) });
  const res = await apiGet<Analytics>(`/admin/billing/analytics?${qs}`);
  if (!res.ok) return <p className="form-error">Không tải được báo cáo kinh doanh (mã {res.status}).</p>;

  const data = res.data;
  const generated = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(data.generatedAt));
  const dateLabel = (day: string) => new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' }).format(new Date(`${day}T00:00:00+07:00`));
  const filterHref = (nextDays: number, nextProduct?: Product) =>
    `${base}/business-analytics?${new URLSearchParams({ days: String(nextDays), ...(nextProduct ? { product: nextProduct } : {}) })}`;

  return (
    <section data-testid="business-analytics-page">
      <div className="page-head">
        <div>
          <h1>Phân tích kinh doanh</h1>
          <p className="muted">Doanh thu chỉ tính đơn đã xác nhận thanh toán · Cập nhật {generated}</p>
        </div>
      </div>

      <div className="category-chips" aria-label="Bộ lọc báo cáo">
        {[7, 30, 90].map((n) => (
          <Link key={n} className={days === n ? 'chip active' : 'chip'} href={filterHref(n, product)}>{n} ngày</Link>
        ))}
        <Link className={!product ? 'chip active' : 'chip'} href={filterHref(days)}>Tất cả sản phẩm</Link>
        <Link className={product === 'english' ? 'chip active' : 'chip'} href={filterHref(days, 'english')}>English</Link>
        <Link className={product === 'vietnamese' ? 'chip active' : 'chip'} href={filterHref(days, 'vietnamese')}>Tiếng Việt</Link>
      </div>

      <div className="stat-grid" data-testid="business-analytics-summary">
        <Stat label="Doanh thu" value={formatVnd(data.summary.revenueVnd)} hint={`Trong ${days} ngày`} />
        <Stat label="Đơn đã thanh toán" value={data.summary.paidOrders} />
        <Stat label="Khách hàng đã mua" value={data.summary.payingCustomers} />
        <Stat label="Giá trị đơn trung bình" value={formatVnd(data.summary.averageOrderValueVnd)} />
        <Stat label="Đơn gia hạn/nối tiếp" value={data.summary.renewals} hint={`Tỷ lệ ${data.summary.renewalRatePercent.toFixed(1)}%`} />
        <Stat label="Khách mua lại" value={data.summary.repeatCustomers} />
        <Stat label="Gói sắp hết hạn" value={data.summary.membershipsExpiring30d} hint="Trong 30 ngày tới" />
      </div>

      <section aria-labelledby="business-products-heading">
        <h2 id="business-products-heading">Doanh thu theo sản phẩm</h2>
        <table className="admin-table" data-testid="business-analytics-products">
          <thead><tr><th>Sản phẩm</th><th>Doanh thu</th><th>Đơn đã trả</th><th>Khách mua</th><th>Gia hạn</th><th>Tỷ lệ gia hạn</th><th>Giá trị đơn TB</th></tr></thead>
          <tbody>{data.byProduct.filter((row) => !product || row.product === product).map((row) => (
            <tr key={row.product}>
              <td>{productNames[row.product]}</td><td>{formatVnd(row.revenueVnd)}</td><td>{number.format(row.paidOrders)}</td>
              <td>{number.format(row.payingCustomers)}</td><td>{number.format(row.renewals)}</td>
              <td>{row.renewalRatePercent.toFixed(1)}%</td><td>{formatVnd(row.averageOrderValueVnd)}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>

      <section aria-labelledby="business-trend-heading">
        <h2 id="business-trend-heading">Doanh thu theo ngày</h2>
        {data.trend.length ? (
          <table className="admin-table" data-testid="business-analytics-trend">
            <thead><tr><th>Ngày</th><th>Doanh thu</th><th>Đơn đã thanh toán</th></tr></thead>
            <tbody>{data.trend.map((row) => (
              <tr key={row.day}><td>{dateLabel(row.day)}</td><td>{formatVnd(row.revenueVnd)}</td><td>{number.format(row.paidOrders)}</td></tr>
            ))}</tbody>
          </table>
        ) : <div className="panel"><p>Chưa có doanh thu trong khoảng thời gian này.</p></div>}
      </section>

      <section aria-labelledby="business-plans-heading">
        <h2 id="business-plans-heading">Gói thành viên có doanh thu cao</h2>
        {data.topPlans.length ? (
          <table className="admin-table" data-testid="business-analytics-plans">
            <thead><tr><th>Gói</th><th>Sản phẩm</th><th>Doanh thu</th><th>Đơn đã trả</th><th>Gia hạn</th></tr></thead>
            <tbody>{data.topPlans.map((row) => (
              <tr key={row.code}><td>{row.name}</td><td>{row.product.name}</td><td>{formatVnd(row.revenueVnd)}</td><td>{number.format(row.paidOrders)}</td><td>{number.format(row.renewals)}</td></tr>
            ))}</tbody>
          </table>
        ) : <div className="panel"><p>Chưa có đơn thanh toán trong khoảng thời gian này.</p></div>}
      </section>
      <p className="muted">Báo cáo chỉ sử dụng đơn đã thanh toán. Không hiển thị email, tên hoặc dữ liệu cá nhân của khách hàng.</p>
    </section>
  );
}
