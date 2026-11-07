'use client';

import { useMemo, useState } from 'react';
import { describeTemplate } from '@happyclass/game-core/describe';
import { validateGameData, type TemplateKey } from '@happyclass/game-core/templates';
import { labelFor } from '@/components/builder/labels';
import { SchemaForm, type Issues, type PickImage } from '@/components/builder/schema-form';
import { GameShell } from '@/games/shell/game-shell';
import { apiSend } from '@/lib/client-api';
import { dict } from '@/lib/i18n';
import type { Product } from '@/lib/sites';

const readable = (path: string) => (path ? path.split('.').map((p) => (/^\d+$/.test(p) ? String(Number(p) + 1) : labelFor(p))).join(' › ') : '—');

/** Giáo viên sửa bản sao game của lớp: cùng form với Game Builder, lưu thẳng vào bản của lớp. */
export function ClassGameEditor({ product, classId, game }: {
  product: Product; classId: string; game: { id: string; title: string; templateKey: TemplateKey; content: unknown };
}) {
  const t = dict(product).classes;
  const node = useMemo(() => describeTemplate(game.templateKey), [game.templateKey]);
  const [title, setTitle] = useState(game.title);
  const [content, setContent] = useState<unknown>(game.content);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const validation = useMemo(() => validateGameData(game.templateKey, content), [game.templateKey, content]);
  const [preview, setPreview] = useState(() => ({ key: 1, data: validation.ok ? validation.data : null }));
  const issues: Issues = useMemo(() => {
    const m = new Map<string, string[]>();
    if (!validation.ok) for (const i of validation.issues) m.set(i.path, [...(m.get(i.path) ?? []), i.message]);
    return m;
  }, [validation]);

  // Giáo viên không tải ảnh lên thư viện chung; dùng emoji hoặc dán đường dẫn ảnh https.
  const pickImage: PickImage = async (current) => {
    const src = window.prompt('Dán đường dẫn ảnh (bắt đầu bằng https://)', current.src ?? '');
    return src && /^https:\/\//.test(src) ? { src, alt: current.alt ?? '' } : null;
  };

  async function save() {
    if (!validation.ok) { setMsg({ ok: false, text: `${validation.issues.length} lỗi` }); return; }
    setBusy(true);
    const res = await apiSend('PATCH', `/classes/${classId}/games/${game.id}`, { title: title.trim().normalize('NFC'), content: validation.data });
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: t.saved } : { ok: false, text: `Lỗi ${res.status}` });
    if (res.ok) { setDirty(false); setPreview({ key: preview.key + 1, data: validation.data }); }
  }

  return (
    <div className="builder" data-testid="class-game-editor">
      <div className="builder-main">
        <label className="title-field">{labelFor('title')}
          <input value={title} maxLength={120} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} data-testid="class-game-title" />
        </label>
        <div className={`validation ${validation.ok ? 'ok' : 'bad'}`} role="status" data-testid="validation">
          {validation.ok ? '✓' : <ul>{validation.issues.slice(0, 6).map((i, k) => <li key={k}><b>{readable(i.path)}:</b> {i.message}</li>)}</ul>}
        </div>
        <div className="builder-form">
          <SchemaForm node={node} value={content} onChange={(v) => { setContent(v); setDirty(true); setMsg(null); }} issues={issues} pickImage={pickImage} />
        </div>
        <div className="builder-save panel">
          <div className="actions-row">
            <button type="button" className="primary-button" disabled={busy || !dirty} onClick={save} data-testid="class-game-save">{t.save}</button>
          </div>
          {msg && <p className={msg.ok ? 'form-success' : 'form-error'} role="status" data-testid="class-game-message">{msg.text}</p>}
        </div>
      </div>
      <aside className="builder-side">
        <div className="panel builder-preview">
          <button type="button" className="secondary-button" disabled={!validation.ok} onClick={() => validation.ok && setPreview({ key: preview.key + 1, data: validation.data })}>↻</button>
          {preview.data ? (
            <div className="preview-frame">
              <GameShell key={preview.key} preview product={product} slug={game.id} title={title} templateKey={game.templateKey} data={preview.data}
                instructions={typeof (preview.data as { instructions?: unknown }).instructions === 'string' ? (preview.data as { instructions: string }).instructions : undefined}
                loggedIn={false} libraryHref="#" loginHref="#" />
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
