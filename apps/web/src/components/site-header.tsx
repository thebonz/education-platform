import Link from 'next/link';
import type { Me } from '@/lib/server-api';
import { dict } from '@/lib/i18n';
import type { Product } from '@/lib/sites';
import { LogoutButton } from './logout-button';

export function SiteHeader({ product, base, me }: { product: Product; base: string; me: Me | null }) {
  const t = dict(product);
  const isEnglish = product === 'english';
  return (
    <header className="site-header">
      <Link href={base || '/'} className="site-brand">
        <span className={`brand-icon ${product}`}>{isEnglish ? '✦' : '✿'}</span>
        <span>{isEnglish ? 'English Games' : 'Vietnamese Games'}<small>{isEnglish ? 'PLAY · LEARN · GROW' : 'HỌC VUI MỖI NGÀY'}</small></span>
      </Link>
      <nav className="site-nav">
        <Link href={base || '/'}>{t.home}</Link>
        <Link href={`${base}/games`}>{t.library}</Link>
        {me ? (
          <>
            <Link href={`${base}/account`} data-testid="account-link">{me.displayName}</Link>
            <LogoutButton label={t.logout} redirectTo={base || '/'} />
          </>
        ) : (
          <>
            <Link href={`${base}/login`}>{t.login}</Link>
            <Link href={`${base}/register`} className="nav-cta">{t.register}</Link>
          </>
        )}
      </nav>
    </header>
  );
}
