import type { Metadata } from 'next';
import Link from 'next/link';
import { GameCard } from '@/components/game-card';
import { SiteHeader } from '@/components/site-header';
import type { CatalogGame, CatalogProduct, Taxonomy } from '@/lib/catalog';
import { matchesSkill, SKILL_GROUPS } from '@/lib/discovery';
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
  const activities = SKILL_GROUPS[product]
    .map((group) => ({ ...group, count: games.ok ? games.data.filter((g) => matchesSkill(g.templateKey, group)).length : 0 }))
    .filter((group) => group.count > 0);
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
          <div className="hero-actions">
            <Link href={`${base}/games`} className="primary-button">{copy.button} <b>→</b></Link>
            <Link href={`${base}/pricing`} className="secondary-button">
              {isEnglish ? 'Explore membership' : 'Khám phá gói học'} ↗
            </Link>
          </div>
          {games.ok && <div className="hero-proof"><span>✦</span>{isEnglish ? `${games.data.length} games · ${freeCount} free to play` : `${games.data.length} trò chơi · ${freeCount} trò miễn phí`}</div>}
        </div>
        <div className="hero-illustration" aria-hidden="true">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="hero-orb">{isEnglish ? 'Aa' : 'Ăă'}<small>{isEnglish ? 'PLAY' : 'HỌC VUI'}</small></div>
          <div className="float-shape shape-one">✨</div>
          <div className="float-shape shape-two">{isEnglish ? 'A · B · C' : 'A · Ă · Â'}</div>
          <div className="float-shape shape-three">🌈</div>
        </div>
      </section>

      {activities.length > 0 && (
        <section className="featured-section">
          <div className="section-heading">
            <div><span className="eyebrow">{isEnglish ? 'PLAY YOUR WAY' : 'VỪA HỌC VỪA CHƠI'}</span>
              <h2>{isEnglish ? 'Choose a learning adventure' : 'Học theo cách bé thích'}</h2></div>
            <Link href={`${base}/games`} className="all-games-link">{isEnglish ? 'All activities' : 'Tất cả trò chơi'} ↗</Link>
          </div>
          <div className="skill-chips" data-testid="homepage-skills">
            {activities.map((group) => (
              <Link key={group.key} href={`${base}/games?skill=${group.key}`} className="skill-chip" data-testid={`home-skill-${group.key}`}>
                <span aria-hidden="true">{group.icon}</span><b>{group.label}</b>
                <small>{group.count} {isEnglish ? (group.count === 1 ? 'game' : 'games') : 'trò'}</small>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="featured-section">
        <div className="teacher-tool-spotlight" data-testid="teacher-picker-link">
          <div className="teacher-tool-icon" aria-hidden="true">🎡</div>
          <div>
            <span className="eyebrow">{isEnglish ? 'TEACHER TOOLBOX' : 'GÓC GIÁO VIÊN'}</span>
            <h2>{isEnglish ? 'Make every student part of the game' : 'Cả lớp cùng tham gia thật vui'}</h2>
            <p>{isEnglish
              ? 'Pick a student at random, without repeating names. No roster upload or sign-in needed.'
              : 'Gọi tên ngẫu nhiên, không lặp trong một lượt. Không cần tải danh sách học sinh lên máy chủ.'}</p>
          </div>
          <Link href={`${base}/tools/random-picker`} className="primary-button" data-testid="open-student-picker">
            {isEnglish ? 'Try student picker' : 'Thử gọi tên'} ↗
          </Link>
        </div>
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
      <footer className="product-footer"><span>{info.data.name}</span><span><Link href={`${base}/terms`}>{isEnglish ? 'Terms' : 'Điều khoản'}</Link> · <Link href={`${base}/privacy`}>{isEnglish ? 'Privacy' : 'Quyền riêng tư'}</Link> · HappyClass</span></footer>
    </main>
  );
}
