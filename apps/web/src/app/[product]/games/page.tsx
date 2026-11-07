import type { Metadata } from 'next';
import { Suspense } from 'react';
import { GameLibrary } from '@/components/game-library';
import { SiteHeader } from '@/components/site-header';
import type { CatalogGame, Taxonomy } from '@/lib/catalog';
import { productContext } from '@/lib/page-context';
import { apiGet } from '@/lib/server-api';

export async function generateMetadata({ params }: { params: Promise<{ product: string }> }): Promise<Metadata> {
  const { product } = await params;
  return product === 'english'
    ? { title: 'Game Library – English games for kids and ESL classrooms', description: 'Bingo, phonics, vocabulary, spelling and team games for young English learners.' }
    : { title: 'Thư viện trò chơi tiếng Việt cho học sinh tiểu học', description: 'Trò chơi học chữ cái, dấu thanh, chính tả và từ vựng tiếng Việt.' };
}

export default async function GamesPage({ params }: { params: Promise<{ product: string }> }) {
  const { product, base, me } = await productContext(params);
  const [games, taxonomy] = await Promise.all([
    apiGet<CatalogGame[]>(`/catalog/products/${product}/games`),
    apiGet<Taxonomy>(`/catalog/products/${product}/taxonomy`),
  ]);
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
        {games.ok && taxonomy.ok ? (
          <Suspense><GameLibrary games={games.data} taxonomy={taxonomy.data} product={product} base={base} /></Suspense>
        ) : <div className="empty-state">{isEnglish ? 'Could not load games.' : 'Không tải được thư viện game.'}</div>}
      </section>
    </main>
  );
}
