'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { apiSend } from '@/lib/client-api';
import { dict, errorText } from '@/lib/i18n';
import type { Site } from '@/lib/sites';

type Status = { kind: 'idle' | 'busy' | 'error' | 'done'; message?: string };

function useForm(site: Site) {
  const t = dict(site);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const fail = (res: { status: number; data: { error?: string } | null }) =>
    setStatus({ kind: 'error', message: errorText(t, res.status, res.data?.error) });
  return { t, status, setStatus, fail };
}

function Message({ status }: { status: Status }) {
  if (status.kind === 'error') return <p className="form-error" role="alert">{status.message}</p>;
  if (status.kind === 'done') return <p className="form-success" role="status">{status.message}</p>;
  return null;
}

const field = (form: HTMLFormElement, name: string) => (form.elements.namedItem(name) as HTMLInputElement).value;
const checked = (form: HTMLFormElement, name: string) => (form.elements.namedItem(name) as HTMLInputElement).checked;

/** Chỉ cho phép chuyển hướng nội bộ để tránh open redirect. */
function safeNext(next: string | null, fallback: string) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

export function LoginForm({ site, base, next }: { site: Site; base: string; next: string | null }) {
  const { t, status, setStatus, fail } = useForm(site);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus({ kind: 'busy' });
    const res = await apiSend('POST', '/auth/login', { email: field(e.currentTarget, 'email'), password: field(e.currentTarget, 'password') });
    if (!res.ok) return fail(res);
    window.location.assign(safeNext(next, site === 'admin' ? base || '/' : `${base}/account`));
  }
  return (
    <form className="auth-card" onSubmit={onSubmit}>
      <h1>{t.loginTitle}</h1>
      <label>{t.email}<input name="email" type="email" autoComplete="email" required /></label>
      <label>{t.password}<input name="password" type="password" autoComplete="current-password" required /></label>
      <Message status={status} />
      <button className="primary-button" disabled={status.kind === 'busy'}>{t.login}</button>
      <div className="auth-links">
        <Link href={`${base}/forgot-password`}>{t.forgot}</Link>
        {site !== 'admin' && <span>{t.noAccount} <Link href={`${base}/register`}>{t.register}</Link></span>}
      </div>
    </form>
  );
}

export function RegisterForm({ site, base }: { site: Exclude<Site, 'admin'>; base: string }) {
  const { t, status, setStatus, fail } = useForm(site);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = e.currentTarget;
    setStatus({ kind: 'busy' });
    const res = await apiSend('POST', '/auth/register', {
      email: field(f, 'email'),
      password: field(f, 'password'),
      displayName: field(f, 'displayName'),
      acceptTerms: checked(f, 'acceptTerms'),
      confirmAdult: checked(f, 'confirmAdult'),
      site,
    });
    if (!res.ok) return fail(res);
    f.reset();
    setStatus({ kind: 'done', message: t.registerDone });
  }
  return (
    <form className="auth-card" onSubmit={onSubmit}>
      <h1>{t.registerTitle}</h1>
      <label>{t.displayName}<input name="displayName" maxLength={80} autoComplete="name" required /></label>
      <label>{t.email}<input name="email" type="email" autoComplete="email" required /></label>
      <label>{t.password}<input name="password" type="password" minLength={10} maxLength={128} autoComplete="new-password" required /><small>{t.passwordHint}</small></label>
      <label className="check"><input name="acceptTerms" type="checkbox" required /> {t.acceptTerms}</label>
      <label className="check"><input name="confirmAdult" type="checkbox" required /> {t.confirmAdult}</label>
      <Message status={status} />
      <button className="primary-button" disabled={status.kind === 'busy'}>{t.register}</button>
      <div className="auth-links"><span>{t.haveAccount} <Link href={`${base}/login`}>{t.login}</Link></span></div>
    </form>
  );
}

export function ForgotForm({ site }: { site: Site }) {
  const { t, status, setStatus, fail } = useForm(site);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus({ kind: 'busy' });
    const res = await apiSend('POST', '/auth/forgot-password', { email: field(e.currentTarget, 'email'), site });
    if (!res.ok) return fail(res);
    setStatus({ kind: 'done', message: t.forgotDone });
  }
  return (
    <form className="auth-card" onSubmit={onSubmit}>
      <h1>{t.forgotTitle}</h1>
      <label>{t.email}<input name="email" type="email" autoComplete="email" required /></label>
      <Message status={status} />
      <button className="primary-button" disabled={status.kind === 'busy'}>{t.send}</button>
    </form>
  );
}

export function ResetForm({ site, base, token }: { site: Site; base: string; token: string | null }) {
  const { t, status, setStatus, fail } = useForm(site);
  if (!token) return <div className="auth-card"><h1>{t.resetTitle}</h1><p className="form-error">{t.invalidToken}</p></div>;
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus({ kind: 'busy' });
    const res = await apiSend('POST', '/auth/reset-password', { token, password: field(e.currentTarget, 'password') });
    if (!res.ok) return fail(res);
    setStatus({ kind: 'done', message: t.resetDone });
  }
  return (
    <form className="auth-card" onSubmit={onSubmit}>
      <h1>{t.resetTitle}</h1>
      <label>{t.newPassword}<input name="password" type="password" minLength={10} maxLength={128} autoComplete="new-password" required /><small>{t.passwordHint}</small></label>
      <Message status={status} />
      {status.kind === 'done' ? <Link className="primary-button" href={`${base}/login`}>{t.login}</Link> : <button className="primary-button" disabled={status.kind === 'busy'}>{t.save}</button>}
    </form>
  );
}

export function VerifyEmail({ site, base, token }: { site: Site; base: string; token: string | null }) {
  const t = dict(site);
  const [state, setState] = useState<'busy' | 'ok' | 'error'>(token ? 'busy' : 'error');
  const sent = useRef(false);
  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true; // React dev chạy effect hai lần; token chỉ dùng được một lần
    apiSend('POST', '/auth/verify-email', { token }).then((res) => setState(res.ok ? 'ok' : 'error'));
  }, [token]);
  return (
    <div className="auth-card">
      <h1>{t.verifyTitle}</h1>
      {state === 'busy' && <p>{t.verifying}</p>}
      {state === 'ok' && <p className="form-success">{t.verifyDone}</p>}
      {state === 'error' && <p className="form-error">{t.invalidToken}</p>}
      <Link className="primary-button" href={`${base}/account`}>{t.account}</Link>
    </div>
  );
}
