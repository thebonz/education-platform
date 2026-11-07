'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiSend } from '@/lib/client-api';

export type BuilderOptions = {
  products: {
    slug: 'english' | 'vietnamese'; name: string; locale: string;
    levels: { slug: string; name: string }[];
    categories: { slug: string; name: string }[];
    templates: { key: string; name: string }[];
  }[];
};

const ERRORS: Record<string, string> = {
  slug_taken: 'Đường dẫn (slug) này đã có game khác dùng trong sản phẩm.',
  template_not_for_product: 'Template này không dùng cho sản phẩm đã chọn.',
  level_not_found: 'Cấp độ không tồn tại.',
  category_not_found: 'Danh mục không tồn tại.',
  no_published_version: 'Cần phát hành ít nhất một phiên bản nội dung trước khi mở game cho người chơi.',
  validation_failed: 'Thông tin chưa hợp lệ, kiểm tra lại các ô.',
};
const errorText = (status: number, data: { error?: string } | null) => ERRORS[data?.error ?? ''] ?? `Thao tác thất bại (mã ${status}).`;

/** Chuyển tên game thành slug: bỏ dấu, chữ thường, gạch ngang. */
export function slugify(title: string) {
  return title.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

export function NewGameForm({ options, base, defaultProduct }: { options: BuilderOptions; base: string; defaultProduct?: string }) {
  const router = useRouter();
  const [product, setProduct] = useState(options.products.find((p) => p.slug === defaultProduct)?.slug ?? options.products[0]?.slug);
  const p = options.products.find((x) => x.slug === product)!;
  const [templateKey, setTemplateKey] = useState(p.templates[0]?.key ?? '');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [summary, setSummary] = useState('');
  const [level, setLevel] = useState('');
  const [category, setCategory] = useState('');
  const [accessLevel, setAccessLevel] = useState<'FREE' | 'PREMIUM'>('FREE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickProduct(next: string) {
    const np = options.products.find((x) => x.slug === next)!;
    setProduct(np.slug);
    if (!np.templates.some((t) => t.key === templateKey)) setTemplateKey(np.templates[0]?.key ?? '');
    setLevel(''); setCategory('');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const res = await apiSend<{ id: string }>('POST', '/admin/games', {
      product, templateKey, slug, title: title.trim().normalize('NFC'), summary: summary.trim().normalize('NFC'), accessLevel,
      ...(level ? { level } : {}), ...(category ? { category } : {}),
    });
    setBusy(false);
    if (!res.ok || !res.data) { setError(errorText(res.status, res.data)); return; }
    router.push(`${base}/games/${res.data.id}/edit`);
  }

  return (
    <form className="panel admin-form" onSubmit={submit} data-testid="new-game-form">
      <label>Sản phẩm
        <select value={product} onChange={(e) => pickProduct(e.target.value)} data-testid="new-product">
          {options.products.map((x) => <option key={x.slug} value={x.slug}>{x.name}</option>)}
        </select>
      </label>
      <label>Kiểu chơi (template)
        <select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} data-testid="new-template">
          {p.templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
        </select>
      </label>
      <label>Tên game
        <input type="text" required maxLength={120} value={title} data-testid="new-title"
          onChange={(e) => { setTitle(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} />
      </label>
      <label>Đường dẫn (slug)
        <input type="text" required maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} data-testid="new-slug"
          onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} />
        <small className="muted">Địa chỉ game: …/games/{slug || 'ten-game'}</small>
      </label>
      <label>Mô tả ngắn
        <textarea required maxLength={300} rows={2} value={summary} onChange={(e) => setSummary(e.target.value)} data-testid="new-summary" />
      </label>
      <div className="form-row">
        <label>Cấp độ
          <select value={level} onChange={(e) => setLevel(e.target.value)} data-testid="new-level">
            <option value="">— Chưa chọn —</option>
            {p.levels.map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}
          </select>
        </label>
        <label>Danh mục
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">— Chưa chọn —</option>
            {p.categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </label>
        <label>Quyền truy cập
          <select value={accessLevel} onChange={(e) => setAccessLevel(e.target.value as 'FREE' | 'PREMIUM')}>
            <option value="FREE">Miễn phí</option>
            <option value="PREMIUM">Thành viên trả phí</option>
          </select>
        </label>
      </div>
      <p className="muted">Game mới bắt đầu bằng nội dung mẫu của template và ở trạng thái chưa xuất bản. Bấm tạo để vào trình soạn.</p>
      <button type="submit" className="primary-button" disabled={busy || !templateKey} data-testid="new-submit">{busy ? 'Đang tạo…' : 'Tạo và soạn nội dung'}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}

export type GameMeta = {
  id: string; title: string; summary: string; accessLevel: 'FREE' | 'PREMIUM'; difficulty: string | null; isPublished: boolean;
  level: string | null; category: string | null; hasPublishedVersion: boolean;
};

export function GameMetaForm({ game, levels, categories, can }: {
  game: GameMeta; levels: { slug: string; name: string }[]; categories: { slug: string; name: string }[];
  can: { edit: boolean; publish: boolean };
}) {
  const router = useRouter();
  const [v, setV] = useState(game);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function patch(body: Record<string, unknown>, okText: string) {
    setBusy(true); setMsg(null);
    const res = await apiSend('PATCH', `/admin/games/${game.id}`, body);
    setBusy(false);
    if (!res.ok) { setMsg({ kind: 'error', text: errorText(res.status, res.data) }); return false; }
    setMsg({ kind: 'ok', text: okText });
    router.refresh();
    return true;
  }

  return (
    <form className="panel admin-form" data-testid="meta-form" onSubmit={(e) => {
      e.preventDefault();
      patch({
        title: v.title.trim().normalize('NFC'), summary: v.summary.trim().normalize('NFC'), accessLevel: v.accessLevel,
        difficulty: v.difficulty || null, level: v.level || null, category: v.category || null,
      }, 'Đã lưu thông tin game.');
    }}>
      <h2>Thông tin game</h2>
      <fieldset disabled={!can.edit || busy}>
        <label>Tên game<input type="text" required maxLength={120} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} data-testid="meta-title" /></label>
        <label>Mô tả ngắn<textarea required maxLength={300} rows={2} value={v.summary} onChange={(e) => setV({ ...v, summary: e.target.value })} /></label>
        <div className="form-row">
          <label>Cấp độ
            <select value={v.level ?? ''} onChange={(e) => setV({ ...v, level: e.target.value || null })}>
              <option value="">— Chưa chọn —</option>
              {levels.map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}
            </select>
          </label>
          <label>Danh mục
            <select value={v.category ?? ''} onChange={(e) => setV({ ...v, category: e.target.value || null })}>
              <option value="">— Chưa chọn —</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </label>
          <label>Độ khó
            <select value={v.difficulty ?? ''} onChange={(e) => setV({ ...v, difficulty: e.target.value || null })}>
              <option value="">—</option><option value="easy">Dễ</option><option value="medium">Vừa</option><option value="hard">Khó</option>
            </select>
          </label>
          <label>Quyền truy cập
            <select value={v.accessLevel} onChange={(e) => setV({ ...v, accessLevel: e.target.value as 'FREE' | 'PREMIUM' })}>
              <option value="FREE">Miễn phí</option><option value="PREMIUM">Thành viên trả phí</option>
            </select>
          </label>
        </div>
        <button type="submit" className="secondary-button" data-testid="meta-save">Lưu thông tin</button>
      </fieldset>
      {can.publish && (
        <div className="visibility">
          <p>Hiển thị cho người chơi: <strong data-testid="visibility">{game.isPublished ? 'Đang mở' : 'Đang ẩn'}</strong></p>
          <button type="button" className={game.isPublished ? 'danger-button' : 'primary-button'} disabled={busy || (!game.isPublished && !game.hasPublishedVersion)}
            data-testid="toggle-visibility" onClick={() => patch({ isPublished: !game.isPublished }, game.isPublished ? 'Đã ẩn game.' : 'Đã mở game cho người chơi.')}>
            {game.isPublished ? 'Ẩn game' : 'Mở cho người chơi'}
          </button>
          {!game.hasPublishedVersion && <small className="muted">Cần phát hành một phiên bản nội dung trước.</small>}
        </div>
      )}
      {msg && <p className={msg.kind === 'ok' ? 'form-success' : 'form-error'} role="status" data-testid="meta-message">{msg.text}</p>}
    </form>
  );
}

export function DuplicateGameForm({ gameId, title, base }: { gameId: string; title: string; base: string }) {
  const router = useRouter();
  const [newTitle, setNewTitle] = useState(`${title} (bản sao)`);
  const [slug, setSlug] = useState(slugify(`${title} ban sao`));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="panel admin-form" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError(null);
      const res = await apiSend<{ id: string }>('POST', `/admin/games/${gameId}/duplicate`, { slug, title: newTitle.trim().normalize('NFC') });
      setBusy(false);
      if (!res.ok || !res.data) { setError(errorText(res.status, res.data)); return; }
      router.push(`${base}/games/${res.data.id}/edit`);
    }}>
      <h2>Nhân bản</h2>
      <label>Tên game mới<input type="text" required maxLength={120} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} /></label>
      <label>Đường dẫn (slug)<input type="text" required maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={slug} onChange={(e) => setSlug(e.target.value)} /></label>
      <button type="submit" className="secondary-button" disabled={busy}>Nhân bản thành game mới</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}
