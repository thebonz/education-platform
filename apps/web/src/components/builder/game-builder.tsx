'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { describeTemplate } from '@happyclass/game-core/describe';
import { validateGameData, type TemplateKey } from '@happyclass/game-core/templates';
import { GameShell } from '@/games/shell/game-shell';
import { apiSend } from '@/lib/client-api';
import { labelFor } from './labels';
import { MediaLibrary, type MediaItem } from './media-library';
import { SchemaForm, type Issues, type PickImage } from './schema-form';

export type BuilderVersion = { versionNumber: number; isPublished: boolean; createdAt: string; note: string | null; createdBy: string | null };
export type BuilderGame = {
  id: string; slug: string; title: string; templateKey: TemplateKey; product: 'english' | 'vietnamese';
  publishedVersion: number | null; isPublished: boolean;
};

const fmt = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

/** "items.0.word" → "Danh sách › 1 › Từ / tiếng" để người soạn đọc được. */
function readablePath(path: string) {
  if (!path) return 'Toàn bộ nội dung';
  return path.split('.').map((p) => (/^\d+$/.test(p) ? String(Number(p) + 1) : labelFor(p))).join(' › ');
}

export function GameBuilder({ game, initial, versions, can }: {
  game: BuilderGame;
  initial: { versionNumber: number; content: unknown };
  versions: BuilderVersion[];
  can: { edit: boolean; publish: boolean; upload: boolean };
}) {
  const router = useRouter();
  const node = useMemo(() => describeTemplate(game.templateKey), [game.templateKey]);
  const [content, setContent] = useState<unknown>(initial.content);
  const [baseVersion, setBaseVersion] = useState(initial.versionNumber);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<'form' | 'json'>('form');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [preview, setPreview] = useState<{ data: unknown; key: number } | null>(() => {
    const r = validateGameData(game.templateKey, initial.content);
    return r.ok ? { data: r.data, key: 1 } : null;
  });
  const [picker, setPicker] = useState<{ resolve: (v: { src: string; alt: string } | null) => void } | null>(null);

  const validation = useMemo(() => validateGameData(game.templateKey, content), [game.templateKey, content]);
  const issues: Issues = useMemo(() => {
    const m = new Map<string, string[]>();
    if (!validation.ok) for (const i of validation.issues) m.set(i.path, [...(m.get(i.path) ?? []), i.message]);
    return m;
  }, [validation]);

  const change = useCallback((v: unknown) => { setContent(v); setDirty(true); setMessage(null); }, []);

  const pickImage: PickImage = () => new Promise((resolve) => setPicker({ resolve }));
  const closePicker = (item: MediaItem | null) => {
    picker?.resolve(item ? { src: item.url, alt: item.alt ?? '' } : null);
    setPicker(null);
  };

  function switchTab(next: 'form' | 'json') {
    if (next === 'json') { setJsonText(JSON.stringify(content, null, 2)); setJsonError(null); }
    if (next === 'form' && tab === 'json' && !applyJson()) return;
    setTab(next);
  }
  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText);
      change(parsed);
      setJsonError(null);
      return true;
    } catch (e) {
      setJsonError(`JSON không hợp lệ: ${(e as Error).message}`);
      return false;
    }
  }

  async function save(publishAfter: boolean) {
    if (tab === 'json' && !applyJson()) return;
    if (!validation.ok) { setMessage({ kind: 'error', text: `Còn ${validation.issues.length} lỗi cần sửa trước khi lưu.` }); return; }
    setBusy(true);
    const res = await apiSend<{ versionNumber: number }>('POST', `/admin/games/${game.id}/versions`, { content: validation.data, ...(note.trim() ? { note: note.trim() } : {}) });
    if (!res.ok || !res.data) {
      setBusy(false);
      setMessage({ kind: 'error', text: res.status === 409 ? 'Có người vừa lưu phiên bản khác. Tải lại trang rồi lưu lại.' : `Lưu thất bại (mã ${res.status}).` });
      return;
    }
    const n = res.data.versionNumber;
    let text = `Đã lưu phiên bản ${n} (bản nháp).`;
    if (publishAfter) {
      const pub = await apiSend('POST', `/admin/games/${game.id}/versions/${n}/publish`);
      text = pub.ok ? `Đã lưu và phát hành phiên bản ${n}. Nội dung chờ giáo viên duyệt lại.` : `Đã lưu phiên bản ${n} nhưng phát hành thất bại (mã ${pub.status}).`;
    }
    setBusy(false);
    setBaseVersion(n);
    setDirty(false);
    setNote('');
    setMessage({ kind: 'ok', text });
    router.refresh();
  }

  async function openVersion(n: number) {
    if (dirty && !window.confirm('Nội dung đang sửa chưa lưu sẽ mất. Mở phiên bản khác?')) return;
    const res = await fetch(`/api/admin/games/${game.id}/versions/${n}`, { credentials: 'same-origin' });
    if (!res.ok) { setMessage({ kind: 'error', text: `Không mở được phiên bản ${n}.` }); return; }
    const data = (await res.json()) as { content: unknown };
    setContent(data.content);
    setBaseVersion(n);
    setDirty(false);
    if (tab === 'json') setJsonText(JSON.stringify(data.content, null, 2));
    setMessage({ kind: 'ok', text: `Đang soạn từ phiên bản ${n}.` });
  }

  async function publishVersion(n: number) {
    setBusy(true);
    const res = await apiSend<{ changed: boolean }>('POST', `/admin/games/${game.id}/versions/${n}/publish`);
    setBusy(false);
    if (!res.ok) {
      const issuesCount = (res.data as { issues?: unknown[] } | null)?.issues?.length;
      setMessage({ kind: 'error', text: issuesCount ? `Phiên bản ${n} không còn hợp lệ (${issuesCount} lỗi). Mở ra sửa rồi lưu bản mới.` : `Phát hành thất bại (mã ${res.status}).` });
      return;
    }
    setMessage({ kind: 'ok', text: res.data?.changed ? `Đã phát hành phiên bản ${n}.` : `Phiên bản ${n} đang được phát hành.` });
    router.refresh();
  }

  return (
    <div className="builder" data-testid="game-builder">
      <div className="builder-main">
        <div className="builder-toolbar">
          <div className="tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'form'} className={tab === 'form' ? 'active' : ''} onClick={() => switchTab('form')}>Soạn bằng form</button>
            <button type="button" role="tab" aria-selected={tab === 'json'} className={tab === 'json' ? 'active' : ''} onClick={() => switchTab('json')} data-testid="tab-json">JSON (nâng cao)</button>
          </div>
          <span className="muted">Soạn từ phiên bản {baseVersion}{dirty ? ' · có thay đổi chưa lưu' : ''}</span>
        </div>

        <div className={`validation ${validation.ok ? 'ok' : 'bad'}`} data-testid="validation" role="status">
          {validation.ok ? '✓ Nội dung hợp lệ' : (
            <>
              <strong>{validation.issues.length} lỗi cần sửa</strong>
              <ul>{validation.issues.slice(0, 8).map((i, k) => <li key={k}><b>{readablePath(i.path)}:</b> {i.message}</li>)}</ul>
            </>
          )}
        </div>

        {tab === 'form' ? (
          <fieldset disabled={!can.edit} className="builder-form">
            <SchemaForm node={node} value={content} onChange={change} issues={issues} pickImage={pickImage} />
          </fieldset>
        ) : (
          <div className="builder-json">
            <textarea value={jsonText} onChange={(e) => setJsonText(e.target.value)} onBlur={applyJson} spellCheck={false} rows={28} data-testid="json-editor" readOnly={!can.edit} />
            {jsonError && <p className="form-error">{jsonError}</p>}
          </div>
        )}

        {can.edit && (
          <div className="builder-save panel">
            <label>Ghi chú phiên bản
              <input type="text" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="ví dụ: sửa đáp án câu 3" data-testid="version-note" />
            </label>
            <div className="actions-row">
              <button type="button" className="secondary-button" disabled={busy || !dirty} onClick={() => save(false)} data-testid="save-draft">Lưu bản nháp</button>
              {can.publish && <button type="button" className="primary-button" disabled={busy || !dirty} onClick={() => save(true)} data-testid="save-publish">Lưu và phát hành</button>}
            </div>
            {message && <p className={message.kind === 'ok' ? 'form-success' : 'form-error'} role="status" data-testid="builder-message">{message.text}</p>}
          </div>
        )}
      </div>

      <aside className="builder-side">
        <div className="panel builder-preview">
          <div className="builder-toolbar">
            <h2>Xem trước</h2>
            <button type="button" className="secondary-button" disabled={!validation.ok} data-testid="refresh-preview"
              onClick={() => validation.ok && setPreview({ data: validation.data, key: (preview?.key ?? 0) + 1 })}>
              Cập nhật xem trước
            </button>
          </div>
          {preview ? (
            <div className="preview-frame" data-testid="preview">
              <GameShell key={preview.key} preview product={game.product} slug={game.slug} title={game.title} templateKey={game.templateKey}
                data={preview.data} instructions={typeof (preview.data as { instructions?: unknown }).instructions === 'string' ? (preview.data as { instructions: string }).instructions : undefined}
                loggedIn={false} libraryHref="#" loginHref="#" />
            </div>
          ) : <p className="muted">Sửa hết lỗi rồi bấm “Cập nhật xem trước”.</p>}
          <small className="muted">Xem trước không lưu kết quả chơi.</small>
        </div>

        <div className="panel">
          <h2>Phiên bản</h2>
          <ul className="version-list" data-testid="version-list">
            {versions.map((v) => (
              <li key={v.versionNumber} data-version={v.versionNumber} className={v.isPublished ? 'published' : ''}>
                <div>
                  <strong>Phiên bản {v.versionNumber}</strong> {v.isPublished && <span className="review-tag approved">Đang phát hành</span>}
                  <br /><small className="muted">{fmt.format(new Date(v.createdAt))}{v.createdBy ? ` · ${v.createdBy}` : ' · nạp sẵn'}{v.note ? ` · ${v.note}` : ''}</small>
                </div>
                <div className="actions-row">
                  <button type="button" className="link-button" onClick={() => openVersion(v.versionNumber)} data-testid="open-version">Mở</button>
                  {can.publish && !v.isPublished && (
                    <button type="button" className="link-button" disabled={busy} onClick={() => publishVersion(v.versionNumber)} data-testid="publish-version">Phát hành</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {picker && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Chọn ảnh" data-testid="image-picker">
          <div className="modal">
            <div className="builder-toolbar">
              <h2>Chọn ảnh</h2>
              <button type="button" className="secondary-button" onClick={() => closePicker(null)}>Đóng</button>
            </div>
            <MediaLibrary kind="IMAGE" canUpload={can.upload} onPick={(m) => closePicker(m)} />
          </div>
        </div>
      )}
    </div>
  );
}
