import Link from 'next/link';
import { GameCard } from '@/components/game-card';
import { SiteHeader } from '@/components/site-header';
import type { CatalogGame, CatalogProduct } from '@/lib/catalog';
import { productContext } from '@/lib/page-context';
import { productCopy } from '@/lib/product-copy';
import { apiGet } from '@/lib/server-api';

export default async function ProductHome({ params }: { params: Promise<{ product: string }> }) {
  const { product, base, me } = await productContext(params);
  const [info, games] = await Promise.all([
    apiGet<CatalogProduct>(`/catalog/products/${product}`),
    apiGet<CatalogGame[]>(`/catalog/products/${product}/games`),
  ]);
  if (!info.ok) {
    return <main className="connection-error"><h1>Chưa kết nối được nền tảng</h1><p>API hoặc cơ sở dữ liệu chưa sẵn sàng.</p></main>;
  }
  const copy = productCopy[product];
  const isEnglish = product === 'english';
  return (
    <main className={`product-page ${product}`}>
      <SiteHeader product={product} base={base} me={me} />
      <section className="product-hero">
        <div className="hero-copy">
          <span className="eyebrow">{copy.eyebrow}</span>
          <h1>{copy.headline.split('\n').map((line) => <span key={line}>{line}<br /></span>)}</h1>
          <p>{copy.description}</p>
          <Link href={`${base}/games`} className="primary-button">{copy.button} <b>→</b></Link>
        </div>
        <div className="hero-illustration"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hero-orb">{isEnglish ? 'Aa' : 'Ăă'}<small>{isEnglish ? 'PLAY' : 'HỌC VUI'}</small></div></div>
      </section>
      <section className="featured-section">
        <div className="section-heading"><div><span className="eyebrow">{isEnglish ? 'PICK YOUR NEXT ADVENTURE' : 'BÉ MUỐN CHƠI GÌ HÔM NAY?'}</span><h2>{isEnglish ? 'Explore the game library' : 'Khám phá thư viện trò chơi'}</h2></div><Link href={`${base}/games`} className="all-games-link">{isEnglish ? 'View all games' : 'Xem tất cả'} ↗</Link></div>
        {games.ok && games.data.length
          ? <div className="game-grid">{games.data.slice(0, 3).map((g) => <GameCard key={g.id} game={g} base={base} />)}</div>
          : <div className="empty-state">{isEnglish ? 'Game library is being prepared.' : 'Thư viện trò chơi đang được chuẩn bị.'}</div>}
      </section>
      <footer className="product-footer"><span>{info.data.name}</span><span>HappyClass</span></footer>
    </main>
  );
}
