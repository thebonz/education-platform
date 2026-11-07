'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type MediaItem = {
  id: string; kind: 'IMAGE' | 'AUDIO'; mimeType: string; byteSize: number; width: number | null; height: number | null;
  originalName: string; alt: string | null; source: string; createdAt: string; url: string; duplicate?: boolean;
};

const ERRORS: Record<string, string> = {
  unsupported_media: 'Chỉ nhận ảnh PNG, JPEG, WebP, GIF hoặc âm thanh MP3, OGG, WAV.',
  file_too_large: 'File quá lớn.',
  file_required: 'Chưa chọn file.',
  forbidden: 'Tài khoản không có quyền tải file lên.',
};

export async function uploadMedia(file: File, alt: string, source: 'upload' | 'ai'): Promise<{ ok: true; item: MediaItem } | { ok: false; message: string }> {
  const form = new FormData();
  form.append('file', file);
  if (alt.trim()) form.append('alt', alt.trim().normalize('NFC'));
  form.append('source', source);
  try {
    const res = await fetch('/api/admin/media', { method: 'POST', body: form, credentials: 'same-origin' });
    const data = await res.json().catch(() => null);
    if (res.ok) return { ok: true, item: data as MediaItem };
    const code = (data as { error?: string } | null)?.error ?? '';
    return { ok: false, message: ERRORS[code] ?? (res.status === 413 ? ERRORS.file_too_large : `Tải lên thất bại (mã ${res.status}).`) };
  } catch {
    return { ok: false, message: 'Không kết nối được máy chủ.' };
  }
}

const kb = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

/** Lưới ảnh/âm thanh + form tải lên. Dùng cho trang Thư viện media và hộp chọn ảnh trong Game Builder. */
export function MediaLibrary({ kind, canUpload, onPick }: { kind?: 'IMAGE' | 'AUDIO'; canUpload: boolean; onPick?: (item: MediaItem) => void }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [alt, setAlt] = useState('');
  const [aiMade, setAiMade] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ pageSize: '60', ...(kind ? { kind } : {}), ...(q.trim() ? { q: q.trim() } : {}) });
    const res = await fetch(`/api/admin/media?${qs}`, { credentials: 'same-origin' }).catch(() => null);
    const data = res?.ok ? ((await res.json()) as { items: MediaItem[] }) : null;
    setItems(data?.items ?? []);
    setLoading(false);
  }, [kind, q]);

  useEffect(() => { const h = setTimeout(load, 250); return () => clearTimeout(h); }, [load]);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setMessage({ kind: 'error', text: ERRORS.file_required }); return; }
    setBusy(true);
    const r = await uploadMedia(file, alt, aiMade ? 'ai' : 'upload');
    setBusy(false);
    if (!r.ok) { setMessage({ kind: 'error', text: r.message }); return; }
    setMessage({ kind: 'ok', text: r.item.duplicate ? 'File này đã có trong thư viện – dùng lại bản cũ.' : 'Đã tải lên.' });
    setAlt('');
    if (fileRef.current) fileRef.current.value = '';
    await load();
    if (onPick && r.item.kind === 'IMAGE') onPick(r.item);
  }

  return (
    <div className="media-library" data-testid="media-library">
      {canUpload && (
        <div className="media-upload panel">
          <label>File {kind === 'IMAGE' ? 'ảnh (PNG, JPEG, WebP, GIF)' : '(ảnh PNG/JPEG/WebP/GIF, âm thanh MP3/OGG/WAV)'}
            <input ref={fileRef} type="file" accept={kind === 'IMAGE' ? 'image/png,image/jpeg,image/webp,image/gif' : 'image/png,image/jpeg,image/webp,image/gif,audio/mpeg,audio/ogg,audio/wav'} data-testid="media-file" />
          </label>
          <label>Mô tả
            <input type="text" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={160} placeholder="ví dụ: con mèo vàng đang ngồi" data-testid="media-alt" />
          </label>
          <label className="check"><input type="checkbox" checked={aiMade} onChange={(e) => setAiMade(e.target.checked)} /> Do AI tạo</label>
          <button type="button" className="primary-button" onClick={upload} disabled={busy} data-testid="media-upload">{busy ? 'Đang tải…' : 'Tải lên'}</button>
          {message && <p className={message.kind === 'ok' ? 'form-success' : 'form-error'} role="status">{message.text}</p>}
        </div>
      )}
      <input type="search" className="media-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm theo tên file hoặc mô tả" />
      {loading ? <p className="muted">Đang tải…</p> : items.length === 0 ? <p className="muted">Chưa có file nào.</p> : (
        <ul className="media-grid">
          {items.map((m) => (
            <li key={m.id} data-testid="media-item" data-id={m.id}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.kind === 'IMAGE' ? <img src={m.url} alt={m.alt ?? ''} loading="lazy" /> : <audio src={m.url} controls preload="none" />}
              <span className="media-name" title={m.originalName}>{m.alt || m.originalName}</span>
              <small className="muted">{m.width && m.height ? `${m.width}×${m.height} · ` : ''}{kb(m.byteSize)}{m.source === 'ai' ? ' · AI' : ''}</small>
              {onPick ? (
                <button type="button" className="secondary-button" onClick={() => onPick(m)} data-testid="media-pick">Chọn</button>
              ) : (
                <button type="button" className="link-button" onClick={() => navigator.clipboard?.writeText(m.url)}>Sao chép đường dẫn</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
