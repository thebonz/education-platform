import { redirect } from 'next/navigation';
import { PasswordPanel, ProfilePanel, SessionsPanel, VerifyBanner } from '@/components/account-panels';
import { SiteHeader } from '@/components/site-header';
import { dict } from '@/lib/i18n';
import { productContext } from '@/lib/page-context';
import { apiGet } from '@/lib/server-api';

type SessionRow = { id: string; userAgent: string | null; ipAddress: string | null; lastSeenAt: string; current: boolean };

export default async function AccountPage({ params }: { params: Promise<{ product: string }> }) {
  const { product, base, me } = await productContext(params);
  if (!me) redirect(`${base}/login?next=${encodeURIComponent(`${base}/account`)}`);
  const t = dict(product);
  const sessions = await apiGet<{ sessions: SessionRow[] }>('/account/sessions');
  return (
    <main className={`product-page ${product}`}>
      <SiteHeader product={product} base={base} me={me} />
      <section className="account-wrap">
        <h1 data-testid="account-heading">{t.account}</h1>
        <p className="account-email">{me.email}{me.emailVerified ? ` · ✓ ${t.verified}` : ''} · {t.roles}: {me.roles.join(', ')}</p>
        {!me.emailVerified && <VerifyBanner site={product} />}
        <div className="account-grid">
          <ProfilePanel site={product} displayName={me.displayName} />
          <PasswordPanel site={product} />
          <SessionsPanel site={product} sessions={sessions.ok ? sessions.data.sessions : []} logoutTarget={`${base}/login`} />
        </div>
      </section>
    </main>
  );
}
