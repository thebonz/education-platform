'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AVATARS, type ClassDetail, type ClassResults, type ClassSummary } from '@/lib/classes';
import { apiSend } from '@/lib/client-api';
import { dict } from '@/lib/i18n';
import type { Product } from '@/lib/sites';

const ERR: Record<string, string> = {
  class_limit_reached: 'Đã đạt số lớp tối đa.', student_limit_reached: 'Lớp đã đủ số học sinh tối đa.', game_limit_reached: 'Lớp đã đủ số game tối đa.',
  membership_required: 'Game này cần gói thành viên.', game_not_found: 'Không tìm thấy game.', validation_failed: 'Thông tin chưa hợp lệ.',
};
const errText = (status: number, data: { error?: string } | null) => ERR[data?.error ?? ''] ?? `Lỗi ${status}`;

export function CreateClassForm({ product, base }: { product: Product; base: string }) {
  const t = dict(product).classes;
  const router = useRouter();
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="panel inline-form" data-testid="create-class" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setError(null);
      const res = await apiSend<{ id: string }>('POST', '/classes', { product, name: name.trim().normalize('NFC'), ...(grade.trim() ? { gradeLabel: grade.trim().normalize('NFC') } : {}) });
      setBusy(false);
      if (!res.ok || !res.data) { setError(errText(res.status, res.data)); return; }
      router.push(`${base}/classes/${res.data.id}`);
    }}>
      <label>{t.name}<input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required placeholder={t.namePh} data-testid="class-name" /></label>
      <label>{t.grade}<input value={grade} onChange={(e) => setGrade(e.target.value)} maxLength={30} /></label>
      <button className="primary-button" disabled={busy} data-testid="class-create">{t.create}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}

type LibraryGame = { id: string; title: string; accessLevel: 'FREE' | 'PREMIUM'; access: { allowed: boolean } };

export function ClassManager({ product, base, cls, library, joinUrl, qrSvg, results }: {
  product: Product; base: string; cls: ClassDetail; library: LibraryGame[]; joinUrl: string; qrSvg: string; results: ClassResults | null;
}) {
  const t = dict(product).classes;
  const router = useRouter();
  const [tab, setTab] = useState<'games' | 'students' | 'results' | 'share'>('games');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pick, setPick] = useState('');
  const [names, setNames] = useState('');
  const [busy, setBusy] = useState(false);

  async function act(fn: () => ReturnType<typeof apiSend>, ok: string) {
    setBusy(true); setMsg(null);
    const res = await fn();
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: ok } : { ok: false, text: errText(res.status, res.data) });
    if (res.ok) router.refresh();
    return res.ok;
  }

  const studentName = (id: string | null) => cls.students.find((s) => s.id === id);
  const cell = (sid: string | null, gid: string) => results?.cells.find((c) => c.studentId === sid && c.classGameId === gid);

  return (
    <div className="class-manager" data-testid="class-manager">
      <div className="tabs" role="tablist">
        {(['games', 'students', 'results', 'share'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)} data-testid={`tab-${k}`}>
            {k === 'games' ? t.tabGames : k === 'students' ? t.tabStudents : k === 'results' ? t.tabResults : t.tabShare}
          </button>
        ))}
      </div>
      {msg && <p className={msg.ok ? 'form-success' : 'form-error'} role="status" data-testid="class-message">{msg.text}</p>}

      {tab === 'games' && (
        <div className="panel">
          <form className="inline-form" onSubmit={(e) => { e.preventDefault(); if (pick) act(() => apiSend('POST', `/classes/${cls.id}/games`, { gameId: pick }), t.added).then((ok) => ok && setPick('')); }}>
            <label>{t.addGame}
              <select value={pick} onChange={(e) => setPick(e.target.value)} data-testid="pick-game">
                <option value="">—</option>
                {library.map((g) => (
                  <option key={g.id} value={g.id} disabled={!g.access.allowed}>
                    {g.title}{g.accessLevel === 'PREMIUM' ? ' ★' : ''}{!g.access.allowed ? ` (${t.lockedPremium})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-button" disabled={busy || !pick} data-testid="add-game">{t.add}</button>
          </form>
          {cls.games.length === 0 ? <p className="muted">{t.noGames}</p> : (
            <ul className="class-games" data-testid="class-games">
              {cls.games.map((g) => (
                <li key={g.id} className={g.isActive ? '' : 'inactive'} data-game={g.sourceGame?.slug ?? g.id}>
                  <div><strong>{g.title}</strong>{g.locked && <span className="review-tag pending">{t.lockedPremium}</span>}<br /><small className="muted">{g.sourceGame?.title ?? ''}</small></div>
                  <div className="actions-row">
                    <a className="secondary-button small" href={`${base}/classes/${cls.id}/games/${g.id}`} data-testid="edit-class-game">{t.edit}</a>
                    <button type="button" className="link-button" disabled={busy} onClick={() => act(() => apiSend('PATCH', `/classes/${cls.id}/games/${g.id}`, { isActive: !g.isActive }), t.saved)}>{g.isActive ? t.hide : t.show}</button>
                    <button type="button" className="link-button" disabled={busy} onClick={() => act(() => apiSend('DELETE', `/classes/${cls.id}/games/${g.id}`), t.saved)}>{t.remove}</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="muted"><small>{cls.games.length} / {cls.limits.gamesPerClass}</small></p>
        </div>
      )}

      {tab === 'students' && (
        <div className="panel">
          <p className="muted">{t.studentsHint}</p>
          <form onSubmit={(e) => {
            e.preventDefault();
            const list = names.split('\n').map((x) => x.trim().normalize('NFC')).filter(Boolean).slice(0, cls.limits.studentsPerClass);
            if (!list.length) return;
            const offset = cls.students.length;
            act(() => apiSend('POST', `/classes/${cls.id}/students`, { students: list.map((nickname, i) => ({ nickname: nickname.slice(0, 30), avatar: AVATARS[(offset + i) % AVATARS.length] })) }), t.saved)
              .then((ok) => ok && setNames(''));
          }}>
            <textarea rows={5} value={names} onChange={(e) => setNames(e.target.value)} placeholder={'An\nBình\nChi'} data-testid="student-names" />
            <button className="primary-button" disabled={busy} data-testid="add-students">{t.addStudents}</button>
          </form>
          {cls.students.length === 0 ? <p className="muted">{t.noStudents}</p> : (
            <ul className="student-chips" data-testid="student-list">
              {cls.students.map((s) => (
                <li key={s.id}><span className="avatar">{s.avatar}</span>{s.nickname}
                  <button type="button" aria-label={`${t.remove} ${s.nickname}`} className="link-button" disabled={busy}
                    onClick={() => act(() => apiSend('DELETE', `/classes/${cls.id}/students/${s.id}`), t.saved)}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'results' && (
        <div className="panel">
          {!results || results.recent.length === 0 ? <p className="muted" data-testid="results-empty">{t.resultsEmpty}</p> : (
            <>
              <div className="table-scroll">
                <table className="admin-table results-table" data-testid="results-table">
                  <thead><tr><th></th>{cls.games.map((g) => <th key={g.id}>{g.title}</th>)}</tr></thead>
                  <tbody>
                    {[...cls.students.map((s) => s.id), null].map((sid) => {
                      const s = studentName(sid);
                      if (!s && sid !== null) return null;
                      return (
                        <tr key={sid ?? 'anon'}>
                          <th>{s ? `${s.avatar} ${s.nickname}` : t.join.anonymous}</th>
                          {cls.games.map((g) => { const c = cell(sid, g.id); return <td key={g.id}>{c ? `${'★'.repeat(c.bestStars)} · ${c.plays} ${t.plays}` : '—'}</td>; })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <h3>{t.recent}</h3>
              <ul className="session-list">
                {results.recent.map((r) => (
                  <li key={r.id}><span>{r.student ? `${r.student.avatar} ${r.student.nickname}` : t.join.anonymous} · {r.classGame.title}</span><small>{r.score}/{r.maxScore} · {'★'.repeat(r.stars)} · {new Date(r.createdAt).toLocaleString('vi-VN')}</small></li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {tab === 'share' && (
        <div className="panel share-panel">
          <p className="muted">{t.shareHint}</p>
          <div className="share-grid">
            <div className="qr" role="img" aria-label="QR" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            <div>
              <p className="join-code" data-testid="join-code">{cls.joinCode}</p>
              <p><code data-testid="join-url">{joinUrl}</code></p>
              <div className="actions-row">
                <button type="button" className="secondary-button" onClick={() => navigator.clipboard?.writeText(joinUrl).catch(() => undefined)}>{t.copyLink}</button>
                <button type="button" className="link-button" disabled={busy} data-testid="rotate-code"
                  onClick={() => { if (window.confirm(t.rotateConfirm)) act(() => apiSend('POST', `/classes/${cls.id}/rotate-code`), t.saved); }}>{t.rotate}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Nút "Thêm vào lớp" trên trang game của thư viện. */
export function AddToClass({ product, base, gameId }: { product: Product; base: string; gameId: string }) {
  const t = dict(product).classes;
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!open || classes) return;
    fetch('/api/classes', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : { classes: [] }))
      .then((d: { classes: ClassSummary[] }) => setClasses(d.classes.filter((c) => c.product.slug === product && !c.isArchived)))
      .catch(() => setClasses([]));
  }, [open, classes, product]);
  return (
    <div className="add-to-class">
      <button type="button" className="secondary-button small" onClick={() => setOpen(!open)} data-testid="add-to-class">🏫 {t.addToClass}</button>
      {open && (
        <div className="add-to-class-menu">
          {classes === null ? <small className="muted">…</small> : classes.length === 0 ? <a href={`${base}/classes`}>{t.needClass}</a> : classes.map((c) => (
            <button key={c.id} type="button" className="link-button" data-testid="add-to-class-option" onClick={async () => {
              const res = await apiSend('POST', `/classes/${c.id}/games`, { gameId });
              setMsg(res.ok ? `${t.added} (${c.name})` : errText(res.status, res.data));
            }}>{c.name}</button>
          ))}
          {msg && <small className="muted" role="status">{msg}</small>}
        </div>
      )}
    </div>
  );
}
