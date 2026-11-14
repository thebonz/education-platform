'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TemplateKey } from '@happyclass/game-core/templates';
import { GameShell } from '@/games/shell/game-shell';
import type { Product } from '@/lib/sites';

type PackGame = { slug: string; title: string; summary: string; templateKey: TemplateKey; premium: boolean; level: string | null; category: string | null; version: number; data: unknown };
type Pack = { product: Product; issuedAt: number; expiresAt: number; premiumUntil: number | null; license: string; games: PackGame[]; media: string[] };
type Status = { kind: 'none' } | { kind: 'ok'; pack: Pack } | { kind: 'expired'; pack: Pack } | { kind: 'invalid' } | { kind: 'clock' };

const PACKS = 'hc-packs-v1';
const PAGES = 'hc-offline-v1-pages';
const STATIC = 'hc-offline-v1-static';
const MEDIA = 'hc-media-v1';
const packKey = (p: Product) => `/__hc/offline-pack/${p}.json`;
const keyKey = '/__hc/offline-public-key.json';
const LAST_SEEN = 'hc.offline.lastSeen';
const QUEUE_MAX = 500;
const queueKey = (p: Product) => `hc.offline.queue.${p}`;

type QueuedResult = { id: string; slug: string; playedAt: number; score: number; maxScore: number; mistakes: number; stars: 1 | 2 | 3; durationMs: number };

function readQueue(p: Product): QueuedResult[] {
  try { const v = JSON.parse(localStorage.getItem(queueKey(p)) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
function writeQueue(p: Product, q: QueuedResult[]) {
  try { localStorage.setItem(queueKey(p), JSON.stringify(q.slice(-QUEUE_MAX))); return true; } catch { return false; }
}

const S = {
  vi: {
    title: 'Chơi offline', lead: 'Tải game về máy để chơi khi không có mạng (lớp học, đi xa). Giấy phép offline cần gia hạn 30 ngày một lần khi có mạng.',
    download: 'Tải / cập nhật game offline', downloading: 'Đang tải…', none: 'Chưa tải game offline trên thiết bị này.',
    needLogin: 'Đăng nhập để tải game offline.', online: 'Đang có mạng', offline: 'Đang offline', validUntil: 'Giấy phép offline đến',
    premiumUntil: 'Game trả phí đến', noPremium: 'Chỉ có game miễn phí', expired: 'Giấy phép offline đã hết hạn. Kết nối mạng và bấm “Tải / cập nhật” để gia hạn.',
    invalid: 'Dữ liệu offline không hợp lệ. Hãy tải lại khi có mạng.', clock: 'Đồng hồ thiết bị bị lùi bất thường. Hãy chỉnh lại ngày giờ rồi mở lại.',
    games: 'game', back: '← Danh sách game', locked: 'Gói đã hết hạn', remove: 'Xoá dữ liệu offline', notSupported: 'Trình duyệt này không hỗ trợ chơi offline.',
    saved: 'Đã tải {n} game. Bạn có thể tắt mạng và mở lại trang này.',
    resultSaved: 'Đã lưu kết quả trên máy – sẽ tự gửi khi có mạng.', pending: '{n} kết quả chơi offline chờ gửi', sendNow: 'Gửi ngay',
    synced: 'Đã gửi {n} kết quả chơi offline.', syncLogin: 'Đăng nhập để gửi kết quả chơi offline.',
  },
  en: {
    title: 'Play offline', lead: 'Download games to this device to play without internet (classrooms, travel). The offline licence must be renewed online every 30 days.',
    download: 'Download / update offline games', downloading: 'Downloading…', none: 'No offline games on this device yet.',
    needLogin: 'Log in to download offline games.', online: 'Online', offline: 'Offline', validUntil: 'Offline licence valid until',
    premiumUntil: 'Premium games until', noPremium: 'Free games only', expired: 'The offline licence has expired. Go online and tap “Download / update” to renew.',
    invalid: 'Offline data is invalid. Please download again when online.', clock: 'The device clock went backwards. Please fix the date and time.',
    games: 'games', back: '← Game list', locked: 'Membership ended', remove: 'Remove offline data', notSupported: 'This browser does not support offline play.',
    saved: 'Downloaded {n} games. You can go offline and reopen this page.',
    resultSaved: 'Result saved on this device – it will be sent when you are online.', pending: '{n} offline results waiting to be sent', sendNow: 'Send now',
    synced: 'Sent {n} offline results.', syncLogin: 'Log in to send offline results.',
  },
};

const b64urlBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));

/** Kiểm tra chữ ký giấy phép bằng khóa công khai (WebCrypto ECDSA P-256). */
async function verifyLicense(license: string, jwk: JsonWebKey): Promise<Record<string, unknown> | null> {
  try {
    const [body, sig] = license.split('.');
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64urlBytes(sig), new TextEncoder().encode(body));
    return ok ? JSON.parse(new TextDecoder().decode(b64urlBytes(body))) : null;
  } catch { return null; }
}

function readLastSeen() { try { return Number(localStorage.getItem(LAST_SEEN) || 0); } catch { return 0; } }
function writeLastSeen(n: number) { try { localStorage.setItem(LAST_SEEN, String(n)); } catch { /* chế độ riêng tư */ } }

export function OfflinePlayer({ product, loggedIn }: { product: Product; loggedIn: boolean }) {
  const lang = product === 'english' ? 'en' : 'vi';
  const t = S[lang];
  const fmt = new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'medium' });
  const [status, setStatus] = useState<Status | null>(null);
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [playing, setPlaying] = useState<PackGame | null>(null);
  const [supported, setSupported] = useState(true);
  const [pending, setPending] = useState(0);
  const syncing = useRef(false);

  /** Gửi hàng đợi kết quả offline lên máy chủ; giữ lại nếu mất mạng hoặc chưa đăng nhập. */
  const sync = useCallback(async (manual = false) => {
    const queue = readQueue(product);
    setPending(queue.length);
    if (!queue.length || syncing.current || !navigator.onLine) return;
    syncing.current = true;
    try {
      let sent = 0;
      for (let i = 0; i < queue.length; i += 200) {
        const batch = queue.slice(i, i + 200);
        const res = await fetch('/api/offline/sync', {
          method: 'POST', credentials: 'same-origin', cache: 'no-store',
          headers: { 'content-type': 'application/json' }, body: JSON.stringify({ product, results: batch }),
        });
        if (res.status === 401) { if (manual) setMsg(t.syncLogin); break; }
        if (!res.ok) break;
        const data = (await res.json()) as { accepted: string[]; rejected: { id: string }[]; saved: number };
        const done = new Set([...data.accepted, ...data.rejected.map((r) => r.id)]);
        writeQueue(product, readQueue(product).filter((r) => !done.has(r.id)));
        sent += data.saved;
      }
      if (sent) setMsg(t.synced.replace('{n}', String(sent)));
    } catch { /* mất mạng giữa chừng – thử lại lần sau */ } finally {
      syncing.current = false;
      setPending(readQueue(product).length);
    }
  }, [product, t]);

  const saveResult = useCallback(async (slug: string, r: Omit<QueuedResult, 'id' | 'slug' | 'playedAt'>) => {
    const item: QueuedResult = { id: crypto.randomUUID(), slug, playedAt: Date.now(), ...r };
    const ok = writeQueue(product, [...readQueue(product), item]);
    setPending(readQueue(product).length);
    if (ok) void sync();
    return ok;
  }, [product, sync]);

  const load = useCallback(async () => {
    if (!('caches' in window)) { setStatus({ kind: 'none' }); return; }
    const cache = await caches.open(PACKS);
    const [packRes, keyRes] = await Promise.all([cache.match(packKey(product)), cache.match(keyKey)]);
    if (!packRes || !keyRes) { setStatus({ kind: 'none' }); return; }
    const pack = (await packRes.json()) as Pack;
    const { jwk } = (await keyRes.json()) as { jwk: JsonWebKey };
    const claims = await verifyLicense(pack.license, jwk);
    // Giấy phép phải khớp đúng gói đang lưu (không sửa được hạn hay danh sách game bằng tay).
    if (!claims || claims.exp !== pack.expiresAt || claims.premiumUntil !== pack.premiumUntil || claims.product !== product
      || JSON.stringify(claims.games) !== JSON.stringify(pack.games.map((g) => `${g.slug}@${g.version}`))) { setStatus({ kind: 'invalid' }); return; }
    const now = Date.now();
    const last = readLastSeen();
    if (last && now < last - 86_400_000) { setStatus({ kind: 'clock' }); return; }
    writeLastSeen(Math.max(now, last));
    setStatus(now > pack.expiresAt ? { kind: 'expired', pack } : { kind: 'ok', pack });
  }, [product]);

  useEffect(() => {
    setOnline(navigator.onLine);
    setSupported('caches' in window && 'serviceWorker' in navigator && !!window.crypto?.subtle);
    const on = () => { setOnline(true); void sync(); }, off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
    load();
    void sync();
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [load, sync]);

  async function download() {
    setBusy(true); setMsg(null);
    try {
      const [packRes, keyRes] = await Promise.all([
        fetch(`/api/offline/pack?product=${product}`, { credentials: 'same-origin', cache: 'no-store' }),
        fetch('/api/offline/public-key', { cache: 'no-store' }),
      ]);
      if (!packRes.ok || !keyRes.ok) throw new Error(String(packRes.status));
      const pack = (await packRes.clone().json()) as Pack;
      const packs = await caches.open(PACKS);
      await packs.put(packKey(product), new Response(JSON.stringify(pack), { headers: { 'content-type': 'application/json' } }));
      await packs.put(keyKey, new Response(await keyRes.text(), { headers: { 'content-type': 'application/json' } }));
      // Lưu sẵn trang này + file tĩnh đang dùng + ảnh của game, để mở lại được khi mất mạng.
      const pages = await caches.open(PAGES);
      const page = await fetch(location.pathname, { credentials: 'same-origin' });
      if (page.ok) await pages.put(location.pathname, page);
      const assets = performance.getEntriesByType('resource').map((e) => new URL(e.name)).filter((u) => u.origin === location.origin && u.pathname.startsWith('/_next/static/'));
      const stat = await caches.open(STATIC);
      await Promise.all([...new Set(assets.map((u) => u.href))].map((href) => stat.add(href).catch(() => undefined)));
      const media = await caches.open(MEDIA);
      await Promise.all(pack.media.map((m) => media.add(m).catch(() => undefined)));
      setMsg(t.saved.replace('{n}', String(pack.games.length)));
      await load();
    } catch {
      setMsg(`${t.invalid}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const packs = await caches.open(PACKS);
    await packs.delete(packKey(product));
    setStatus({ kind: 'none' });
  }

  if (playing && status?.kind === 'ok') {
    return (
      <div data-testid="offline-playing">
        <button type="button" className="back-link link-button" onClick={() => setPlaying(null)}>{t.back}</button>
        <GameShell product={product} slug={playing.slug} title={playing.title} templateKey={playing.templateKey} data={playing.data}
          instructions={typeof (playing.data as { instructions?: unknown }).instructions === 'string' ? (playing.data as { instructions: string }).instructions : undefined}
          loggedIn={false} libraryHref="#" loginHref="#" savedLabel={t.resultSaved} onBack={() => setPlaying(null)}
          onResult={(r) => saveResult(playing.slug, r)} />
      </div>
    );
  }

  const pack = status && (status.kind === 'ok' || status.kind === 'expired') ? status.pack : null;
  const premiumOk = !!pack?.premiumUntil && Date.now() < pack.premiumUntil;
  return (
    <div className="offline-player" data-testid="offline-player" data-status={status?.kind ?? 'loading'}>
      <h1>{t.title}</h1>
      <p className="muted">{t.lead}</p>
      <p><span className={`net-dot ${online ? 'on' : 'off'}`} /> {online ? t.online : t.offline}</p>
      {!supported && <p className="form-error">{t.notSupported}</p>}
      <div className="actions-row">
        {loggedIn ? (
          <button type="button" className="primary-button" disabled={busy || !online || !supported} onClick={download} data-testid="offline-download">{busy ? t.downloading : t.download}</button>
        ) : <p className="muted">{t.needLogin}</p>}
        {pack && <button type="button" className="link-button" onClick={remove}>{t.remove}</button>}
      </div>
      {msg && <p className="form-success" role="status" data-testid="offline-message">{msg}</p>}
      {pending > 0 && (
        <p className="muted" data-testid="offline-pending" data-count={pending}>
          {t.pending.replace('{n}', String(pending))}{' '}
          {online && <button type="button" className="link-button" onClick={() => sync(true)} data-testid="offline-sync">{t.sendNow}</button>}
        </p>
      )}
      {status?.kind === 'none' && <p className="muted" data-testid="offline-none">{t.none}</p>}
      {status?.kind === 'invalid' && <p className="form-error">{t.invalid}</p>}
      {status?.kind === 'clock' && <p className="form-error">{t.clock}</p>}
      {status?.kind === 'expired' && <p className="form-error" data-testid="offline-expired">{t.expired}</p>}
      {pack && (
        <>
          <p className="panel license-box" data-testid="offline-license">
            {t.validUntil}: <strong>{fmt.format(new Date(pack.expiresAt))}</strong> · {pack.premiumUntil ? <>{t.premiumUntil}: <strong>{fmt.format(new Date(pack.premiumUntil))}</strong></> : t.noPremium} · {pack.games.length} {t.games}
          </p>
          {status?.kind === 'ok' && (
            <ul className="join-game-grid" data-testid="offline-games">
              {pack.games.map((g) => {
                const locked = g.premium && !premiumOk;
                return (
                  <li key={g.slug}>
                    <button type="button" disabled={locked} onClick={() => setPlaying(g)} data-testid="offline-game" data-slug={g.slug}>
                      <strong>{g.title}</strong>{g.premium ? ' ★' : ''}<br /><small className="muted">{[g.level, g.category].filter(Boolean).join(' · ')}{locked ? ` · ${t.locked}` : ''}</small>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
