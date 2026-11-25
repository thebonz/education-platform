import Link from 'next/link';
import { CatalogGame, TEMPLATE_EMOJI } from '@/lib/catalog';

const POSTER_TITLES: Record<string, [string, string]> = {
  bingo: ['B', 'I N G O'],
  'picture-match': ['A', 'MATCH'],
  'hidden-picture': ['?', 'DISCOVER'],
  'mystery-doors': ['?', 'MYSTERY'],
  'bubble-spelling': ['A', 'SPELL'],
  spelling: ['Aa', 'WORDS'],
  quiz: ['?', 'QUIZ TIME'],
  'trail-board': ['★', 'ADVENTURE'],
  'syllable-builder': ['Ă', 'LETTERS'],
  'tone-finder': ['Á', 'LISTEN'],
  'word-sort': ['A', 'SORT'],
  'sentence-order': ['Aa', 'STORY'],
};

/**
 * Tất cả poster là layout/CSS gốc của HappyClass. Không dùng ảnh, tranh, thương
 * hiệu hoặc asset của bất kỳ site tham khảo nào.
 */
export function GameCard({ game, base, lang }: { game: CatalogGame; base: string; lang: 'en' | 'vi' }) {
  const free = game.accessLevel === 'FREE';
  const [letter, label] = POSTER_TITLES[game.templateKey] ?? ['★', 'PLAY'];
  const pending = game.reviewStatus !== 'APPROVED';
  return (
    <Link href={`${base}/games/${game.slug}`} className="game-card game-poster-card" data-testid="game-card">
      <div className={`game-card-art game-poster-art art-${game.templateKey}`}>
        <span className="poster-spark spark-a" aria-hidden="true">✦</span>
        <span className="poster-spark spark-b" aria-hidden="true">✿</span>
        <span className="poster-spark spark-c" aria-hidden="true">✧</span>
        <div className="poster-center" aria-hidden="true">
          <span className="poster-speech">{letter}</span>
          <span className="poster-icon">{TEMPLATE_EMOJI[game.templateKey] || '🎮'}</span>
        </div>
        <span className="poster-genre" aria-hidden="true">{label}</span>
        <i className={free ? 'badge-free' : 'badge-premium'}>{free ? (lang === 'en' ? 'FREE' : 'MIỄN PHÍ') : 'PREMIUM'}</i>
      </div>
      <div className="game-card-body">
        <div className="game-card-meta"><span>{game.category?.name ?? ''}</span><span>{game.level?.name ?? ''}</span></div>
        <h3>{game.title}</h3>
        <p>{game.summary}</p>
        {pending && <span className="game-review-pill" data-testid="game-review-pill">
          📝 {lang === 'en' ? 'Teacher review pending' : 'Đang chờ giáo viên duyệt'}
        </span>}
        <span className="play-link">{lang === 'en' ? 'Play now' : 'Chơi ngay'} <b>→</b></span>
      </div>
    </Link>
  );
}
