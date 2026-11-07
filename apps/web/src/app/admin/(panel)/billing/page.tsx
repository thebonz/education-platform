import Link from 'next/link';
import { OrderActions } from '@/components/admin-actions';
import { adminContext } from '@/lib/admin-context';
import { ORDER_STATUS_LABEL } from '@/lib/admin-billing';
import { formatVnd } from '@/lib/billing';
import { apiGet } from '@/lib/server-api';

type Summary = { paymentsEnabled: boolean; revenue30dVnd: number; paidOrders30d: number; pendingOrders: number; transactionsToReview: number; activeMemberships: number };
type Row = {
  id: string; code: string; status: string; planName: string; amountVnd: number; paidAmountVnd: number | null; paymentMethod: string | null;
  createdAt: string; paidAt: string | null; note: string | null; user: { id: string; email: string; displayName: string }; product: { name: string };
};

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const { base, can } = await adminContext();
  if (!can('billing.read')) return <p className="form-error">Không có quyền xem thanh toán.</p>;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.status && sp.status in ORDER_STATUS_LABEL) qs.set('status', sp.status);
  if (sp.q) qs.set('q', sp.q.slice(0, 120));
  if (sp.page) qs.set('page', sp.page);
  const [summary, orders] = await Promise.all([apiGet<Summary>('/admin/billing/summary'), apiGet<{ total: number; page: number; pageSize: number; orders: Row[] }>(`/admin/billing/orders?${qs}`)]);
  if (!summary.ok || !orders.ok) return <p className="form-error">Không tải được dữ liệu thanh toán.</p>;
  const s = summary.data;
  const fmt = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  const link = (status?: string) => `${base}/billing${status ? `?status=${status}` : ''}`;
  return (
    <>
      <div className="page-head">
        <h1>Thanh toán</h1>
        <div className="actions-row">
          <Link className="secondary-button" href={`${base}/billing/plans`}>Gói và giá</Link>
          <Link className="secondary-button" href={`${base}/billing/transactions`}>Giao dịch ngân hàng{s.transactionsToReview ? ` (${s.transactionsToReview} cần xem)` : ''}</Link>
        </div>
      </div>
      {!s.paymentsEnabled && <p className="sandbox-banner">Thanh toán đang TẮT (PAYMENT_MODE=disabled). Chạy <code>sudo bash ops/configure-payments.sh</code> để bật chế độ thử nghiệm.</p>}
      <div className="stat-grid" data-testid="billing-summary">
        <div className="panel"><small>Doanh thu 30 ngày</small><strong>{formatVnd(s.revenue30dVnd)}</strong></div>
        <div className="panel"><small>Đơn đã thanh toán 30 ngày</small><strong>{s.paidOrders30d}</strong></div>
        <div className="panel"><small>Đơn đang chờ</small><strong>{s.pendingOrders}</strong></div>
        <div className="panel"><small>Gói đang hiệu lực</small><strong>{s.activeMemberships}</strong></div>
      </div>
      <div className="admin-filters">
        <Link className={!sp.status ? 'active' : ''} href={link()}>Tất cả</Link>
        {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => <Link key={k} className={sp.status === k ? 'active' : ''} href={link(k)}>{v}</Link>)}
        <form className="inline-search" action={`${base}/billing`}><input name="q" defaultValue={sp.q ?? ''} placeholder="Mã đơn hoặc email" /><button className="secondary-button small">Tìm</button></form>
      </div>
      <table className="admin-table" data-testid="orders-table">
        <thead><tr><th>Mã đơn</th><th>Khách</th><th>Gói</th><th>Số tiền</th><th>Trạng thái</th><th>Thời gian</th><th></th></tr></thead>
        <tbody>
          {orders.data.orders.map((o) => (
            <tr key={o.id} data-code={o.code}>
              <td><code>{o.code}</code></td>
              <td><Link href={`${base}/users/${o.user.id}`}>{o.user.email}</Link></td>
              <td>{o.planName}</td>
              <td>{formatVnd(o.amountVnd)}{o.paidAmountVnd !== null && o.paidAmountVnd !== o.amountVnd ? <small className="muted"> (nhận {formatVnd(o.paidAmountVnd)})</small> : null}</td>
              <td>{ORDER_STATUS_LABEL[o.status] ?? o.status}{o.paymentMethod ? <small className="muted"> · {o.paymentMethod === 'sepay' ? 'tự động' : 'xác nhận tay'}</small> : null}{o.note ? <><br /><small className="muted">{o.note}</small></> : null}</td>
              <td><small>{fmt.format(new Date(o.createdAt))}{o.paidAt ? ` → ${fmt.format(new Date(o.paidAt))}` : ''}</small></td>
              <td>{can('billing.manage') && <OrderActions orderId={o.id} status={o.status} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">{orders.data.total} đơn</p>
    </>
  );
}
