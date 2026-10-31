import Link from 'next/link';
import { adminContext } from '@/lib/admin-context';
import { apiGet } from '@/lib/server-api';

type Log = { id: string; action: string; entityType: string; entityId: string | null; actorEmail: string | null; ipAddress: string | null; createdAt: string; metadata: unknown };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string; page?: string }> }) {
  const { can } = await adminContext();
  if (!can('audit.read')) return <p className="form-error">Không có quyền.</p>;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  if (sp.action) qs.set('action', sp.action);
  if (sp.page) qs.set('page', sp.page);
  const res = await apiGet<{ total: number; page: number; pageSize: number; logs: Log[] }>(`/admin/audit-logs?${qs}`);
  if (!res.ok) return <p className="form-error">Không tải được nhật ký.</p>;
  const fmt = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' });
  const { logs, total, page, pageSize } = res.data;
  return (
    <>
      <h1>Nhật ký thao tác <small>({total})</small></h1>
      <form className="admin-search"><input name="action" defaultValue={sp.action ?? ''} placeholder="Lọc theo hành động, ví dụ admin. hoặc auth.login" /><button className="secondary-button">Lọc</button></form>
      <table className="admin-table">
        <thead><tr><th>Thời gian</th><th>Hành động</th><th>Người thực hiện</th><th>Đối tượng</th><th>IP</th><th>Chi tiết</th></tr></thead>
        <tbody>{logs.map((l) => (
          <tr key={l.id}>
            <td>{fmt.format(new Date(l.createdAt))}</td><td><code>{l.action}</code></td><td>{l.actorEmail ?? '—'}</td>
            <td>{l.entityType}{l.entityId ? ` ${l.entityId.slice(0, 8)}…` : ''}</td><td>{l.ipAddress ?? '—'}</td>
            <td><code>{l.metadata ? JSON.stringify(l.metadata).slice(0, 120) : ''}</code></td>
          </tr>
        ))}</tbody>
      </table>
      <div className="pager">
        {page > 1 && <Link href={`?${new URLSearchParams({ ...(sp.action ? { action: sp.action } : {}), page: String(page - 1) })}`}>← Trước</Link>}
        <span>Trang {page} / {Math.max(1, Math.ceil(total / pageSize))}</span>
        {page * pageSize < total && <Link href={`?${new URLSearchParams({ ...(sp.action ? { action: sp.action } : {}), page: String(page + 1) })}`}>Sau →</Link>}
      </div>
    </>
  );
}
