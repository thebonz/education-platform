'use client';

import { FormEvent, useState } from 'react';
import { apiSend } from '@/lib/client-api';
import { dict, errorText } from '@/lib/i18n';
import type { Site } from '@/lib/sites';

type Session = { id: string; userAgent: string | null; ipAddress: string | null; lastSeenAt: string; current: boolean };

function useStatus() {
  return useState<{ ok: boolean; text: string } | null>(null);
}
function Note({ value }: { value: { ok: boolean; text: string } | null }) {
  if (!value) return null;
  return <p className={value.ok ? 'form-success' : 'form-error'} role={value.ok ? 'status' : 'alert'}>{value.text}</p>;
}

export function ProfilePanel({ site, displayName }: { site: Site; displayName: string }) {
  const t = dict(site);
  const [note, setNote] = useStatus();
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = (e.currentTarget.elements.namedItem('displayName') as HTMLInputElement).value;
    const res = await apiSend('PATCH', '/account/profile', { displayName: value });
    setNote(res.ok ? { ok: true, text: t.saved } : { ok: false, text: errorText(t, res.status, res.data?.error) });
  }
  return (
    <form className="panel" onSubmit={onSubmit}>
      <h2>{t.profile}</h2>
      <label>{t.displayName}<input name="displayName" defaultValue={displayName} maxLength={80} required /></label>
      <Note value={note} />
      <button className="primary-button">{t.save}</button>
    </form>
  );
}

export function VerifyBanner({ site }: { site: Site }) {
  const t = dict(site);
  const [note, setNote] = useStatus();
  return (
    <div className="banner">
      <span>{t.emailNotVerified}</span>
      <button
        type="button"
        className="secondary-button"
        onClick={async () => {
          const res = await apiSend('POST', '/auth/resend-verification', { site });
          setNote(res.ok ? { ok: true, text: t.resent } : { ok: false, text: errorText(t, res.status, res.data?.error) });
        }}
      >
        {t.resend}
      </button>
      <Note value={note} />
    </div>
  );
}

export function PasswordPanel({ site }: { site: Site }) {
  const t = dict(site);
  const [note, setNote] = useStatus();
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    const get = (n: string) => (f.elements.namedItem(n) as HTMLInputElement).value;
    const res = await apiSend('POST', '/auth/change-password', { currentPassword: get('currentPassword'), newPassword: get('newPassword') });
    if (res.ok) f.reset();
    setNote(res.ok ? { ok: true, text: t.passwordChanged } : { ok: false, text: errorText(t, res.status, res.data?.error) });
  }
  return (
    <form className="panel" onSubmit={onSubmit}>
      <h2>{t.changePassword}</h2>
      <label>{t.currentPassword}<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
      <label>{t.newPassword}<input name="newPassword" type="password" minLength={10} maxLength={128} autoComplete="new-password" required /><small>{t.passwordHint}</small></label>
      <Note value={note} />
      <button className="primary-button">{t.save}</button>
    </form>
  );
}

export function SessionsPanel({ site, sessions, logoutTarget }: { site: Site; sessions: Session[]; logoutTarget: string }) {
  const t = dict(site);
  const [list, setList] = useState(sessions);
  const fmt = new Intl.DateTimeFormat(site === 'english' ? 'en-GB' : 'vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <div className="panel">
      <h2>{t.sessions}</h2>
      <ul className="session-list">
        {list.map((s) => (
          <li key={s.id}>
            <div>
              <b>{s.current ? t.thisDevice : (s.userAgent ?? '—').slice(0, 60)}</b>
              <small>{fmt.format(new Date(s.lastSeenAt))}{s.ipAddress ? ` · ${s.ipAddress}` : ''}</small>
            </div>
            {!s.current && (
              <button type="button" className="link-button" onClick={async () => {
                const res = await apiSend('DELETE', `/account/sessions/${s.id}`);
                if (res.ok) setList((l) => l.filter((x) => x.id !== s.id));
              }}>{t.signOutDevice}</button>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="secondary-button" onClick={async () => {
        await apiSend('POST', '/auth/logout-all');
        window.location.assign(logoutTarget);
      }}>{t.signOutAll}</button>
    </div>
  );
}
