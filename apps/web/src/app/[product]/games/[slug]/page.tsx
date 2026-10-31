import Link from 'next/link';
import { notFound } from 'next/navigation';
import { GamePlayer } from '@/components/game-player';
import { SiteHeader } from '@/components/site-header';
import type { CatalogGame } from '@/lib/catalog';
import { dict } from '@/lib/i18n';
import { productContext } from '@/lib/page-context';
import { apiGet } from '@/lib/server-api';

type PlayPayload = { game: { slug: string; title: string; templateKey: string }; version: number; content: Record<string, unknown> };

export default async function GamePage({ params }: { params: Promise<{ product: string; slug: string }> }) {
  const p = await params;
  const { product, base, me } = await productContext(Promise.resolve(p));
  const t = dict(product);
  const meta = await apiGet<CatalogGame>(`/catalog/products/${product}/games/${encodeURIComponent(p.slug)}`);
  if (!meta.ok) notFound();
  const game = meta.data;
  // Quyền chơi do API quyết định; nội dung chỉ được trả khi được phép.
  const play = game.access.allowed ? await apiGet<PlayPayload>(`/catalog/products/${product}/games/${encodeURIComponent(p.slug)}/play`) : null;

  return (
    <main className={`product-page ${product}`}>
      <SiteHeader product={product} base={base} me={me} />
      <section className="game-detail-heading">
        <Link href={`${base}/games`} className="back-link">← {t.library}</Link>
        <span className="eyebrow">{game.category?.name || 'Learning game'} · {game.gradeLevel || 'All levels'}</span>
        <h1>{game.title}</h1>
        <p>{game.summary}</p>
      </section>
      <section className="player-wrap">
        {play?.ok ? (
          <GamePlayer game={{ slug: game.slug, title: game.title, templateId: game.templateKey, content: play.data.content }} product={product} />
        ) : (
          <div className="locked-panel">
            <div className="complete-star">🔒</div>
            <h3>{t.game.locked}</h3>
            {game.access.reason === 'login_required'
              ? <Link className="primary-button" href={`${base}/login?next=${encodeURIComponent(`${base}/games/${game.slug}`)}`}>{t.game.loginToPlay}</Link>
              : <p>{t.game.membershipSoon}</p>}
          </div>
        )}
      </section>
    </main>
  );
}
