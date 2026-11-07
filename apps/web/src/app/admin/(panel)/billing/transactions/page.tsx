import Link from 'next/link';
import { MatchTransaction } from '@/components/admin-actions';
import { adminContext } from '@/lib/admin-context';
import { TX_STATUS_LABEL } from '@/lib/admin-billing';
import { formatVnd } from '@/lib/billing';
import { apiGet } from '@/lib/server-api';

type Tx = { id: string; providerTxId: string; amountVnd: number; content: string; referenceCode: string | null; transactionDate: string | null; status: string; createdAt: string; order: { code: string; status: string; amountVnd: number } | null };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { base, can } = await adminContext();
  if (!can('billing.read')) return <p className="form-error">Không có quyền xem.</p>;
  const { status } = await searchParams;
  const qs = status && status in TX_STATUS_LABEL ? `?status=${status}` : '';
  const res = await apiGet<{ total: number; transactions: Tx[] }>(`/admin/billing/transactions${qs}`);
  if (!res.ok) return <p className="form-error">Không tải được giao dịch.</p>;
  const fmt = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  return (
    <>
      <Link href={`${base}/billing`} className="back-link">← Thanh toán</Link>
      <h1>Giao dịch ngân hàng</h1>
      <p className="muted">Mọi giao dịch SePay báo về đều được lưu. Giao dịch “Chưa khớp”/“Sai số tiền” cần kế toán xem và gán vào đúng đơn.</p>
      <div className="admin-filters">
        <Link className={!status ? 'active' : ''} href={`${base}/billing/transactions`}>Tất cả</Link>
        {Object.entries(TX_STATUS_LABEL).map(([k, v]) => <Link key={k} className={status === k ? 'active' : ''} href={`${base}/billing/transactions?status=${k}`}>{v}</Link>)}
      </div>
      <table className="admin-table" data-testid="tx-table">
        <thead><tr><th>Thời gian</th><th>Số tiền</th><th>Nội dung</th><th>Trạng thái</th><th>Đơn</th><th></th></tr></thead>
        <tbody>
          {res.data.transactions.map((x) => (
            <tr key={x.id}>
              <td><small>{fmt.format(new Date(x.transactionDate ?? x.createdAt))}</small></td>
              <td>{formatVnd(x.amountVnd)}</td>
              <td><small>{x.content}</small>{x.referenceCode ? <><br /><small className="muted">{x.referenceCode}</small></> : null}</td>
              <td>{TX_STATUS_LABEL[x.status] ?? x.status}</td>
              <td>{x.order ? <code>{x.order.code}</code> : '—'}</td>
              <td>{can('billing.manage') && x.status !== 'MATCHED' && x.status !== 'IGNORED' && <MatchTransaction txId={x.id} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
