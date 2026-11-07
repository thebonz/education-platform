import Link from 'next/link';
import { PlanEditor } from '@/components/admin-actions';
import { adminContext } from '@/lib/admin-context';
import { apiGet } from '@/lib/server-api';

type Plan = { id: string; code: string; name: string; period: string; months: number; priceVnd: number; isActive: boolean; product: { slug: string; name: string } };

export default async function PlansPage() {
  const { base, can } = await adminContext();
  if (!can('billing.read')) return <p className="form-error">Không có quyền xem.</p>;
  const res = await apiGet<Plan[]>('/admin/billing/plans');
  if (!res.ok) return <p className="form-error">Không tải được danh sách gói.</p>;
  return (
    <>
      <Link href={`${base}/billing`} className="back-link">← Thanh toán</Link>
      <h1>Gói và giá</h1>
      <p className="muted">Đổi giá có hiệu lực ngay cho đơn mới; đơn đã tạo giữ giá lúc đặt. Mỗi lần đổi được ghi vào nhật ký thao tác.</p>
      <div className="plan-admin-grid">
        {res.data.map((p) => (
          <div key={p.id} className="panel" data-plan={p.code}>
            <h2>{p.product.name} · {p.months} tháng</h2>
            <small className="muted"><code>{p.code}</code></small>
            <PlanEditor plan={p} canEdit={can('plans.manage')} />
          </div>
        ))}
      </div>
    </>
  );
}
