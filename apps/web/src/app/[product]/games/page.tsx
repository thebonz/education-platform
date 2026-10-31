import { GameLibrary } from '@/components/game-library';
import { SiteHeader } from '@/components/site-header';
import type { CatalogGame } from '@/lib/catalog';
import { productContext } from '@/lib/page-context';
import { apiGet } from '@/lib/server-api';

export default async function GamesPage({ params }: { params: Promise<{ product: string }> }) {
  const { product, base, me } = await productContext(params);
  const games = await apiGet<CatalogGame[]>(`/catalog/products/${product}/games`);
  const isEnglish = product === 'english';
  return (
    <main className={`product-page ${product}`}>
      <SiteHeader product={product} base={base} me={me} />
      <section className="library-hero">
        <span className="eyebrow">{isEnglish ? 'FIND YOUR NEXT FAVORITE' : 'CHỌN TRÒ CHƠI BÉ YÊU THÍCH'}</span>
        <h1>{isEnglish ? 'The Game Library' : 'Thư viện trò chơi'}</h1>
        {games.ok && <div className="library-count">{games.data.length} {isEnglish ? 'games' : 'trò chơi'}</div>}
      </section>
      <section className="library-section">
        {games.ok ? <GameLibrary games={games.data} product={product} base={base} /> : <div className="empty-state">{isEnglish ? 'Could not load games.' : 'Không tải được thư viện game.'}</div>}
      </section>
    </main>
  );
}
