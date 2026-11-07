'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { apiSend } from '@/lib/client-api';

function useAction() {
  const router = useRouter();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function run(fn: () => ReturnType<typeof apiSend>, success: string) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    setNote(res.ok ? { ok: true, text: success } : { ok: false, text: `Thất bại (${res.status}${res.data?.error ? `: ${res.data.error}` : ''})` });
    if (res.ok) router.refresh();
  }
  const view = note ? <p className={note.ok ? 'form-success' : 'form-error'}>{note.text}</p> : null;
  return { run, busy, view };
}

export function UserStatusActions({ userId, isActive, canLock, canRevoke }: { userId: string; isActive: boolean; canLock: boolean; canRevoke: boolean }) {
  const { run, busy, view } = useAction();
  const [reason, setReason] = useState('');
  return (
    <div className="panel">
      <h2>Trạng thái</h2>
      {canLock && (isActive ? (
        <form onSubmit={(e) => { e.preventDefault(); run(() => apiSend('POST', `/admin/users/${userId}/lock`, { reason }), 'Đã khóa tài khoản và đăng xuất mọi thiết bị.'); }}>
          <label>Lý do khóa (bắt buộc)<input value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} maxLength={300} required /></label>
          <button className="danger-button" disabled={busy}>Khóa tài khoản</button>
        </form>
      ) : (
        <button className="secondary-button" disabled={busy} onClick={() => run(() => apiSend('POST', `/admin/users/${userId}/unlock`), 'Đã mở khóa.')}>Mở khóa</button>
      ))}
      {canRevoke && <button className="secondary-button" disabled={busy} onClick={() => run(() => apiSend('POST', `/admin/users/${userId}/revoke-sessions`), 'Đã đăng xuất mọi thiết bị.')}>Đăng xuất mọi thiết bị</button>}
      {view}
    </div>
  );
}

export function RolesEditor({ userId, current, all }: { userId: string; current: string[]; all: { key: string; name: string }[] }) {
  const { run, busy, view } = useAction();
  const [selected, setSelected] = useState(new Set(current));
  function toggle(key: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }
  return (
    <form className="panel" onSubmit={(e: FormEvent) => { e.preventDefault(); run(() => apiSend('PUT', `/admin/users/${userId}/roles`, { roles: [...selected] }), 'Đã cập nhật vai trò.'); }}>
      <h2>Vai trò</h2>
      <div className="role-grid">
        {all.map((r) => <label key={r.key} className="check"><input type="checkbox" checked={selected.has(r.key)} onChange={() => toggle(r.key)} /> {r.name} <code>{r.key}</code></label>)}
      </div>
      <button className="primary-button" disabled={busy}>Lưu vai trò</button>
      {view}
    </form>
  );
}

type Theme = { accent: string; accentSoft: string; background: string };

export function ProductEditor({ product }: { product: { id: string; slug: string; name: string; description: string | null; isActive: boolean; theme: Theme | null } }) {
  const { run, busy, view } = useAction();
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? '');
  const [isActive, setActive] = useState(product.isActive);
  const [theme, setTheme] = useState<Theme>(product.theme ?? { accent: '#e85d9e', accentSoft: '#fff0f7', background: '#fffaf3' });
  return (
    <form className="panel" onSubmit={(e) => { e.preventDefault(); run(() => apiSend('PATCH', `/admin/products/${product.id}`, { name, description, isActive, theme }), 'Đã lưu sản phẩm.'); }}>
      <h2>{product.name} <code>{product.slug}</code></h2>
      <label>Tên hiển thị<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required /></label>
      <label>Mô tả<textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={2} /></label>
      <div className="color-row">
        {(['accent', 'accentSoft', 'background'] as const).map((k) => (
          <label key={k}>{k}<input type="color" value={theme[k]} onChange={(e) => setTheme({ ...theme, [k]: e.target.value })} /></label>
        ))}
      </div>
      <label className="check"><input type="checkbox" checked={isActive} onChange={(e) => setActive(e.target.checked)} /> Đang hoạt động</label>
      <button className="primary-button" disabled={busy}>Lưu</button>
      {view}
    </form>
  );
}

export function DomainEditor({ productId, domains }: { productId: string; domains: { id: string; hostname: string; isPrimary: boolean }[] }) {
  const { run, busy, view } = useAction();
  const [hostname, setHostname] = useState('');
  return (
    <div className="panel">
      <h3>Tên miền</h3>
      <ul className="session-list">
        {domains.map((d) => (
          <li key={d.id}><span>{d.hostname}{d.isPrimary ? ' (chính)' : ''}</span>
            <button className="link-button" disabled={busy} onClick={() => run(() => apiSend('DELETE', `/admin/domains/${d.id}`), 'Đã xóa tên miền.')}>Xóa</button></li>
        ))}
      </ul>
      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); run(() => apiSend('POST', `/admin/products/${productId}/domains`, { hostname, isPrimary: domains.length === 0 }), 'Đã thêm tên miền.'); setHostname(''); }}>
        <input value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="english.happyclass.asia" required />
        <button className="secondary-button" disabled={busy}>Thêm</button>
      </form>
      <p className="muted">Bảng này lưu tên miền để quản lý và SEO. Định tuyến thực tế đọc từ biến môi trường SITE_*_URL.</p>
      {view}
    </div>
  );
}

export function ReviewActions({ gameId }: { gameId: string }) {
  const { run, busy, view } = useAction();
  const [note, setNote] = useState('');
  return (
    <form className="panel" data-testid="review-actions" onSubmit={(e) => e.preventDefault()}>
      <h2>Duyệt nội dung</h2>
      <label>Ghi chú cho người soạn (bắt buộc khi yêu cầu sửa)
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} data-testid="review-note-input" />
      </label>
      <div className="actions-row">
        <button type="button" className="primary-button" disabled={busy} data-testid="review-approve"
          onClick={() => run(() => apiSend('POST', `/admin/games/${gameId}/review`, { status: 'APPROVED', ...(note.trim() ? { note } : {}) }), 'Đã duyệt nội dung.')}>
          Duyệt
        </button>
        <button type="button" className="danger-button" disabled={busy || !note.trim()} data-testid="review-request-changes"
          onClick={() => run(() => apiSend('POST', `/admin/games/${gameId}/review`, { status: 'CHANGES_REQUESTED', note }), 'Đã gửi yêu cầu sửa.')}>
          Yêu cầu sửa
        </button>
      </div>
      {view}
    </form>
  );
}

export function OrderActions({ orderId, status }: { orderId: string; status: string }) {
  const { run, busy, view } = useAction();
  const [note, setNote] = useState('');
  if (status === 'PAID') return null;
  return (
    <div className="order-actions" data-testid="order-actions">
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú (bắt buộc)" maxLength={300} data-testid="order-note" />
      <button type="button" className="primary-button small" disabled={busy || note.trim().length < 3} data-testid="order-confirm"
        onClick={() => run(() => apiSend('POST', `/admin/billing/orders/${orderId}/confirm`, { note: note.trim() }), 'Đã xác nhận thanh toán và cấp gói.')}>Xác nhận đã nhận tiền</button>
      {status === 'PENDING' && (
        <button type="button" className="secondary-button small" disabled={busy || note.trim().length < 3}
          onClick={() => run(() => apiSend('POST', `/admin/billing/orders/${orderId}/cancel`, { note: note.trim() }), 'Đã huỷ đơn.')}>Huỷ đơn</button>
      )}
      {view}
    </div>
  );
}

export function MatchTransaction({ txId }: { txId: string }) {
  const { run, busy, view } = useAction();
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  return (
    <form className="order-actions" onSubmit={(e) => { e.preventDefault(); run(() => apiSend('POST', `/admin/billing/transactions/${txId}/match`, { orderCode: code.trim().toUpperCase(), note: note.trim() }), 'Đã gán giao dịch vào đơn.'); }}>
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Mã đơn HC…" maxLength={10} required pattern="[Hh][Cc][2-9A-Za-z]{8}" />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú (bắt buộc)" maxLength={300} required minLength={3} />
      <button className="primary-button small" disabled={busy}>Gán vào đơn</button>
      {view}
    </form>
  );
}

export function PlanEditor({ plan, canEdit }: { plan: { id: string; name: string; priceVnd: number; isActive: boolean }; canEdit: boolean }) {
  const { run, busy, view } = useAction();
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(String(plan.priceVnd));
  const [active, setActive] = useState(plan.isActive);
  return (
    <form className="plan-editor" data-testid="plan-editor" onSubmit={(e: FormEvent) => {
      e.preventDefault();
      run(() => apiSend('PATCH', `/admin/billing/plans/${plan.id}`, { name: name.trim().normalize('NFC'), priceVnd: Number(price), isActive: active }), 'Đã lưu. Đơn đã tạo trước đó giữ giá cũ.');
    }}>
      <fieldset disabled={!canEdit || busy}>
        <label>Tên gói<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required /></label>
        <label>Giá (đồng)<input type="number" min={1000} max={100000000} step={1000} value={price} onChange={(e) => setPrice(e.target.value)} required data-testid="plan-price" /></label>
        <label className="check"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Đang bán</label>
        {canEdit && <button className="primary-button small" data-testid="plan-save">Lưu</button>}
      </fieldset>
      {view}
    </form>
  );
}

export function GrantMembership({ userId }: { userId: string }) {
  const { run, busy, view } = useAction();
  const [product, setProduct] = useState('vietnamese');
  const [months, setMonths] = useState('1');
  const [note, setNote] = useState('');
  return (
    <form className="panel" onSubmit={(e) => { e.preventDefault(); run(() => apiSend('POST', `/admin/billing/users/${userId}/grant`, { product, months: Number(months), note: note.trim() }), 'Đã cấp gói.'); }}>
      <h2>Tặng gói</h2>
      <label>Sản phẩm<select value={product} onChange={(e) => setProduct(e.target.value)}><option value="english">English Games</option><option value="vietnamese">Vietnamese Games</option></select></label>
      <label>Số tháng<input type="number" min={1} max={36} value={months} onChange={(e) => setMonths(e.target.value)} required /></label>
      <label>Lý do (bắt buộc)<input value={note} onChange={(e) => setNote(e.target.value)} minLength={3} maxLength={300} required placeholder="ví dụ: giáo viên dùng thử" /></label>
      <button className="primary-button" disabled={busy}>Cấp gói</button>
      {view}
    </form>
  );
}
