import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PasswordPanel, ProfilePanel, SessionsPanel, VerifyBanner } from '@/components/account-panels';
import { SiteHeader } from '@/components/site-header';
import { fill, formatDate, formatVnd, type BillingMe } from '@/lib/billing';
import { dict } from '@/lib/i18n';
import { productContext } from '@/lib/page-context';
import { apiGet } from '@/lib/server-api';
import { isProduct, siteUrl } from '@/lib/sites';

type SessionRow = { id: string; userAgent: string | null; ipAddress: string | null; lastSeenAt: string; current: boolean };
type GameRow = { id: string; slug: string; title: string; product: string; level: { name: string } | null; bestStars?: number; plays?: number; lastPlayedAt?: string };

export default async function AccountPage({ params }: { params: Promise<{ product: string }> }) {
  const { product, base, me } = await productContext(params);
  if (!me) redirect(`${base}/login?next=${encodeURIComponent(`${base}/account`)}`);
  const t = dict(product);
  const [sessions, recent, favorites, billing] = await Promise.all([
    apiGet<{ sessions: SessionRow[] }>('/account/sessions'),
    apiGet<{ games: GameRow[] }>('/account/recent-games'),
    apiGet<{ favorites: GameRow[] }>('/account/favorites'),
    apiGet<BillingMe>('/billing/me'),
  ]);
  const lang = product === 'english' ? 'en' : 'vi';
  const isEn = product === 'english';
  // Game của sản phẩm khác: dùng URL đầy đủ của site đó (có thể là tên miền khác).
  const gameHref = (g: GameRow) => {
    if (g.product === product || !isProduct(g.product)) return `${base}/games/${g.slug}`;
    const site = siteUrl(g.product);
    return `${site.origin}${site.pathname.replace(/\/$/, '')}/games/${g.slug}`;
  };
  return (
    <main className={`product-page ${product}`}>
      <SiteHeader product={product} base={base} me={me} />
      <section className="account-wrap">
        <h1 data-testid="account-heading">{t.account}</h1>
        <p className="account-email">{me.email}{me.emailVerified ? ` · ✓ ${t.verified}` : ''} · {t.roles}: {me.roles.join(', ')}</p>
        {!me.emailVerified && <VerifyBanner site={product} />}
        <div className="account-grid">
          <div className="panel" data-testid="my-plans">
            <h2>{t.billing.myPlans}</h2>
            {billing.ok && billing.data.memberships.length ? (
              <ul className="session-list">{billing.data.memberships.map((m) => (
                <li key={m.product.slug}><strong>{m.product.name}</strong><small>{fill(t.billing.until, { date: formatDate(m.endsAt, lang) })}</small></li>
              ))}</ul>
            ) : <p className="muted">{t.billing.noPlans} <Link href={`${base}/pricing`}>{t.billing.viewPricing}</Link></p>}
            <p><Link href={`${base}/offline`} data-testid="offline-link">📥 {isEn ? 'Play offline' : 'Chơi offline'}</Link></p>
            {billing.ok && billing.data.orders.length > 0 && (
              <>
                <h3>{t.billing.orders}</h3>
                <ul className="session-list">{billing.data.orders.map((o) => (
                  <li key={o.code}>
                    {o.status === 'PENDING' ? <Link href={`${base}/checkout/${o.code}`}>{o.code}</Link> : <span>{o.code}</span>}
                    <small>{o.planName} · {formatVnd(o.amountVnd)} · {t.billing.status[o.status]}</small>
                  </li>
                ))}</ul>
              </>
            )}
          </div>
          <div className="panel" data-testid="recent-games">
            <h2>{isEn ? 'Recently played' : 'Game đã chơi gần đây'}</h2>
            {recent.ok && recent.data.games.length ? (
              <ul className="session-list">{recent.data.games.map((g) => (
                <li key={g.id}><Link href={gameHref(g)}>{g.title}</Link><small>{'★'.repeat(g.bestStars ?? 0)} · {g.plays} {isEn ? 'plays' : 'lượt'}</small></li>
              ))}</ul>
            ) : <p className="muted">{isEn ? 'No games played yet.' : 'Chưa chơi game nào.'}</p>}
          </div>
          <div className="panel" data-testid="favorite-games">
            <h2>{isEn ? 'Favourite games' : 'Game yêu thích'}</h2>
            {favorites.ok && favorites.data.favorites.length ? (
              <ul className="session-list">{favorites.data.favorites.map((g) => (
                <li key={g.id}><Link href={gameHref(g)}>{g.title}</Link><small>{g.level?.name ?? ''}</small></li>
              ))}</ul>
            ) : <p className="muted">{isEn ? 'Tap ♡ on a game to save it here.' : 'Bấm ♡ ở trang game để lưu vào đây.'}</p>}
          </div>
          <ProfilePanel site={product} displayName={me.displayName} />
          <PasswordPanel site={product} />
          <SessionsPanel site={product} sessions={sessions.ok ? sessions.data.sessions : []} logoutTarget={`${base}/login`} />
        </div>
      </section>
    </main>
  );
}
