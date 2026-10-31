import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { TemplateKey } from '@happyclass/game-core/templates';
import { FavoriteButton } from '@/components/favorite-button';
import { SiteHeader } from '@/components/site-header';
import { GameShell } from '@/games/shell/game-shell';
import type { CatalogGame, PlayPayload } from '@/lib/catalog';
import { dict } from '@/lib/i18n';
import { productContext } from '@/lib/page-context';
import { apiGet, requestHost } from '@/lib/server-api';
import { isProduct, siteUrl } from '@/lib/sites';

type Params = Promise<{ product: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { product, slug } = await params;
  if (!isProduct(product)) return {};
  const meta = await apiGet<CatalogGame>(`/catalog/products/${product}/games/${encodeURIComponent(slug)}`);
  if (!meta.ok) return {};
  const site = siteUrl(product);
  const canonical = `${site.origin}${site.pathname.replace(/\/$/, '')}/games/${slug}`;
  return {
    title: `${meta.data.title} – ${product === 'english' ? 'English Games' : 'Vietnamese Games'}`,
    description: meta.data.summary,
    alternates: { canonical },
    openGraph: { title: meta.data.title, description: meta.data.summary, url: canonical, type: 'website' },
  };
}

export default async function GamePage({ params }: { params: Params }) {
  const p = await params;
  const { product, base, me } = await productContext(Promise.resolve(p));
  const t = dict(product);
  const lang = product === 'english' ? 'en' : 'vi';
  const meta = await apiGet<CatalogGame>(`/catalog/products/${product}/games/${encodeURIComponent(p.slug)}`);
  if (!meta.ok) notFound();
  const game = meta.data;
  // Quyền chơi do API quyết định; nội dung chỉ được trả khi được phép.
  const play = game.access.allowed ? await apiGet<PlayPayload>(`/catalog/products/${product}/games/${encodeURIComponent(p.slug)}/play`) : null;
  const host = await requestHost();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: game.title,
    description: game.summary,
    inLanguage: lang,
    learningResourceType: 'Game',
    educationalLevel: game.level?.name,
    isAccessibleForFree: game.accessLevel === 'FREE',
    url: host ? `https://${host}${base}/games/${game.slug}` : undefined,
  };

  return (
    <main className={`product-page ${product}`}>
      <SiteHeader product={product} base={base} me={me} />
      <section className="game-detail-heading">
        <Link href={`${base}/games`} className="back-link">← {t.library}</Link>
        <span className="eyebrow">{[game.category?.name, game.level?.name].filter(Boolean).join(' · ')}</span>
        <h1>{game.title}</h1>
        <p>{game.summary}</p>
        {me && <FavoriteButton gameId={game.id} initial={!!game.favorite} labels={lang === 'en' ? { add: 'Add to favourites', remove: 'Favourite' } : { add: 'Thêm vào yêu thích', remove: 'Đã yêu thích' }} />}
      </section>
      <section className="player-wrap">
        {play?.ok ? (
          <GameShell
            product={product}
            slug={game.slug}
            title={game.title}
            templateKey={play.data.game.templateKey as TemplateKey}
            data={play.data.data}
            instructions={typeof play.data.data.instructions === 'string' ? play.data.data.instructions : undefined}
            loggedIn={!!me}
            libraryHref={`${base}/games`}
            loginHref={`${base}/login?next=${encodeURIComponent(`${base}/games/${game.slug}`)}`}
          />
        ) : (
          <div className="locked-panel" data-testid="locked-panel">
            <div className="complete-star">🔒</div>
            <h3>{t.game.locked}</h3>
            {game.access.reason === 'login_required'
              ? <Link className="primary-button" href={`${base}/login?next=${encodeURIComponent(`${base}/games/${game.slug}`)}`}>{t.game.loginToPlay}</Link>
              : <p>{t.game.membershipSoon}</p>}
          </div>
        )}
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    </main>
  );
}
