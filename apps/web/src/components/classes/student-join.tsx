'use client';

import { useState } from 'react';
import type { TemplateKey } from '@happyclass/game-core/templates';
import { GameShell } from '@/games/shell/game-shell';
import type { JoinView } from '@/lib/classes';
import { apiSend } from '@/lib/client-api';
import { dict } from '@/lib/i18n';
import type { Product } from '@/lib/sites';

type Playing = { id: string; title: string; templateKey: TemplateKey; data: unknown };

/** Trang của học sinh: chọn tên → chọn game → chơi; kết quả gửi về cho giáo viên. Không đăng nhập. */
export function StudentJoin({ product, code, view, initialStudent }: { product: Product; code: string; view: JoinView; initialStudent: string | null }) {
  const t = dict(product).classes.join;
  const [student, setStudent] = useState<string | null | undefined>(
    initialStudent === 'anon' ? null : view.students.some((s) => s.id === initialStudent) ? initialStudent : undefined,
  );
  const [playing, setPlaying] = useState<Playing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const me = view.students.find((s) => s.id === student);

  async function open(gid: string) {
    setError(null);
    const res = await fetch(`/api/class-join/${code}/games/${gid}`, { credentials: 'same-origin' }).catch(() => null);
    if (!res?.ok) { setError(`Lỗi ${res?.status ?? 0}`); return; }
    setPlaying((await res.json()) as Playing);
  }

  if (student === undefined) {
    return (
      <div className="join-pick" data-testid="join-pick">
        <h2>{t.pick}</h2>
        <ul className="avatar-grid">
          {view.students.map((s) => (
            <li key={s.id}><button type="button" onClick={() => setStudent(s.id)} data-testid="pick-student" data-name={s.nickname}><span className="avatar big">{s.avatar}</span>{s.nickname}</button></li>
          ))}
          <li><button type="button" onClick={() => setStudent(null)} data-testid="pick-anonymous"><span className="avatar big">👤</span>{t.anonymous}</button></li>
        </ul>
      </div>
    );
  }

  if (playing) {
    return (
      <div data-testid="join-playing">
        <button type="button" className="back-link link-button" onClick={() => setPlaying(null)}>← {t.choose}</button>
        <GameShell
          product={product} slug={playing.id} title={playing.title} templateKey={playing.templateKey} data={playing.data}
          instructions={typeof (playing.data as { instructions?: unknown }).instructions === 'string' ? (playing.data as { instructions: string }).instructions : undefined}
          loggedIn={false} libraryHref={`?s=${student ?? 'anon'}`} loginHref="#" savedLabel={t.saved}
          onResult={async (r) => (await apiSend('POST', `/class-join/${code}/games/${playing.id}/plays`, { ...r, ...(student ? { studentId: student } : {}) })).ok}
        />
      </div>
    );
  }

  return (
    <div data-testid="join-games">
      <p className="join-me">{me ? <><span className="avatar">{me.avatar}</span> <strong>{me.nickname}</strong></> : t.anonymous}
        {' · '}<button type="button" className="link-button" onClick={() => setStudent(undefined)}>{t.notMe}</button></p>
      <h2>{t.choose}</h2>
      {error && <p className="form-error" role="alert">{error}</p>}
      <ul className="join-game-grid">
        {view.games.map((g) => (
          <li key={g.id}>
            <button type="button" disabled={g.locked} onClick={() => open(g.id)} data-testid="join-game" data-title={g.title}>
              <strong>{g.title}</strong>{g.locked ? ' 🔒' : ''}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
