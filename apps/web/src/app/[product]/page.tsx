import type { Metadata } from 'next';
import Link from 'next/link';
import { GameCard } from '@/components/game-card';
import { SiteHeader } from '@/components/site-header';
import type { CatalogGame, CatalogProduct, Taxonomy } from '@/lib/catalog';
import { productContext } from '@/lib/page-context';
import { productCopy } from '@/lib/product-copy';
import { apiGet } from '@/lib/server-api';

export async function generateMetadata({ params }: { params: Promise<{ product: string }> }): Promise<Metadata> {
  const { product } = await params;
  return product === 'english'
    ? { title: 'English Games for Kids – ESL classroom games for teachers', description: 'Playful English games for young learners: alphabet bingo, phonics, vocabulary, spelling and team quizzes for the classroom.' }
    : { title: 'Trò chơi tiếng Việt cho học sinh tiểu học', description: 'Trò chơi học chữ cái, dấu thanh, vần, chính tả và từ vựng tiếng Việt cho học sinh lớp 1 đến lớp 5.' };
}

export default async function ProductHome({ params }: { params: Promise<{ product: string }> }) {
  const { product, base, me } = await productContext(params);
  const [info, games, taxonomy] = await Promise.all([
    apiGet<CatalogProduct>(`/catalog/products/${product}`),
    apiGet<CatalogGame[]>(`/catalog/products/${product}/games`),
    apiGet<Taxonomy>(`/catalog/products/${product}/taxonomy`),
  ]);
  if (!info.ok) {
    return <main className="connection-error"><h1>Chưa kết nối được nền tảng</h1><p>API hoặc cơ sở dữ liệu chưa sẵn sàng.</p></main>;
  }
  const copy = productCopy[product];
  const isEnglish = product === 'english';
  const lang = isEnglish ? 'en' : 'vi';
  const freeCount = games.ok ? games.data.filter((g) => g.accessLevel === 'FREE').length : 0;
  const steps = isEnglish
    ? [['🎲', 'Pick a game', 'Filter by level, skill or category.'], ['🖥️', 'Play on any screen', 'Projector, tablet or phone – press F for fullscreen.'], ['🔊', 'Listen and learn', 'Every word can be read aloud in British or American English.']]
    : [['🎲', 'Chọn trò chơi', 'Lọc theo lớp, kỹ năng hoặc chủ đề.'], ['🖥️', 'Chơi trên mọi màn hình', 'Máy chiếu, máy tính bảng hay điện thoại – nhấn F để toàn màn hình.'], ['⭐', 'Ghi nhận tiến bộ', 'Đăng nhập để lưu kết quả và game yêu thích.']];
  return (
    <main className={`product-page ${product}`}>
      <SiteHeader product={product} base={base} me={me} />
      <section className="product-hero">
        <div className="hero-copy">
          <span className="eyebrow">{copy.eyebrow}</span>
          <h1>{copy.headline.split('\n').map((line) => <span key={line}>{line}<br /></span>)}</h1>
          <p>{copy.description}</p>
          <Link href={`${base}/games`} className="primary-button">{copy.button} <b>→</b></Link>
          {games.ok && <div className="hero-proof"><span>✦</span>{isEnglish ? `${games.data.length} games · ${freeCount} free to play` : `${games.data.length} trò chơi · ${freeCount} trò miễn phí`}</div>}
        </div>
        <div className="hero-illustration"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="hero-orb">{isEnglish ? 'Aa' : 'Ăă'}<small>{isEnglish ? 'PLAY' : 'HỌC VUI'}</small></div></div>
      </section>

      {taxonomy.ok && taxonomy.data.categories.length > 0 && (
        <section className="featured-section">
          <div className="section-heading"><div><span className="eyebrow">{isEnglish ? 'GAME COLLECTIONS' : 'BỘ SƯU TẬP'}</span><h2>{isEnglish ? 'Browse by category' : 'Chọn theo chủ đề'}</h2></div></div>
          <div className="collection-grid">
            {taxonomy.data.categories.map((c) => (
              <Link key={c.slug} href={`${base}/games?category=${c.slug}`} className="collection-card"><b>{c.name}</b><small>{c.games} {isEnglish ? (c.games > 1 ? 'games' : 'game') : 'trò chơi'}</small></Link>
            ))}
          </div>
        </section>
      )}

      <section className="featured-section">
        <div className="section-heading"><div><span className="eyebrow">{isEnglish ? 'PICK YOUR NEXT ADVENTURE' : 'BÉ MUỐN CHƠI GÌ HÔM NAY?'}</span><h2>{isEnglish ? 'Featured games' : 'Trò chơi nổi bật'}</h2></div><Link href={`${base}/games`} className="all-games-link">{isEnglish ? 'View all games' : 'Xem tất cả'} ↗</Link></div>
        {games.ok && games.data.length
          ? <div className="game-grid">{games.data.slice(0, 6).map((g) => <GameCard key={g.id} game={g} base={base} lang={lang} />)}</div>
          : <div className="empty-state">{isEnglish ? 'Game library is being prepared.' : 'Thư viện trò chơi đang được chuẩn bị.'}</div>}
      </section>

      <section className="featured-section how-it-works">
        <div className="section-heading"><div><span className="eyebrow">{isEnglish ? 'HOW IT WORKS' : 'CÁCH SỬ DỤNG'}</span><h2>{isEnglish ? 'Three small steps to big fun' : 'Ba bước đơn giản'}</h2></div></div>
        <div className="steps-grid">{steps.map(([icon, title, text], i) => <div key={title} className="step-card"><span>{icon}</span><small>0{i + 1}</small><b>{title}</b><p>{text}</p></div>)}</div>
      </section>
      <footer className="product-footer"><span>{info.data.name}</span><span>HappyClass</span></footer>
    </main>
  );
}
