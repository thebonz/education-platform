import { adminContext } from '@/lib/admin-context';
import { apiGet } from '@/lib/server-api';

type Check = { key: string; level: 'ok' | 'warn' | 'error'; title: string; detail: string };
type Status = { version: { commit: string | null; node: string; uptimeHours: number }; summary: { error: number; warn: number }; checks: Check[] };

const LABEL = { ok: 'Ổn', warn: 'Cần xem', error: 'Cần xử lý' } as const;

export const dynamic = 'force-dynamic';

/** Tình trạng hệ thống: chủ sở hữu xem nhanh sao lưu, giọng đọc, thanh toán, email… không cần vào máy chủ. */
export default async function SystemStatusPage() {
  const { can } = await adminContext();
  if (!can('system.read')) return <p className="form-error">Bạn không có quyền xem trang này.</p>;
  const res = await apiGet<Status>('/admin/system/status');
  if (!res.ok) return <p className="form-error">Không tải được tình trạng hệ thống.</p>;
  const s = res.data;
  const order = { error: 0, warn: 1, ok: 2 } as const;
  const checks = [...s.checks].sort((a, b) => order[a.level] - order[b.level]);
  return (
    <>
      <h1 data-testid="system-status">Tình trạng hệ thống</h1>
      <p className="muted">
        {s.summary.error === 0 && s.summary.warn === 0 ? 'Mọi thứ đều ổn.' : `${s.summary.error} việc cần xử lý · ${s.summary.warn} việc cần xem.`}
        {' '}Phiên bản {s.version.commit ?? 'không rõ'} · Node {s.version.node} · chạy {s.version.uptimeHours} giờ.
      </p>
      <ul className="status-list">
        {checks.map((c) => (
          <li key={c.key} className={`status-item ${c.level}`} data-testid={`status-${c.key}`} data-level={c.level}>
            <span className="status-badge">{LABEL[c.level]}</span>
            <div><strong>{c.title}</strong><p>{c.detail}</p></div>
          </li>
        ))}
      </ul>
      <p className="muted">Hướng dẫn chi tiết: docs/BACKUP.md, docs/VOICE.md, docs/GO-LIVE.md trong mã nguồn.</p>
    </>
  );
}
