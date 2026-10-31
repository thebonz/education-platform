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
