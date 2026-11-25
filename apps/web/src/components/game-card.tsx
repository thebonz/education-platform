/* eslint-disable @next/next/no-img-element -- First-party SVG assets; no bitmap optimization required. */
import Link from 'next/link';
import { CatalogGame, TEMPLATE_EMOJI } from '@/lib/catalog';

const POSTER_TITLES: Record<string, [string, string]> = {
  bingo: ['B', 'I N G O'],
  'picture-match': ['A', 'MATCH'],
  'phonics-family': ['at', 'PHONICS'],
  'classroom-explore': ['ABC', 'DISCOVER'],
  'shadow-guess': ['?', 'ANIMAL SHADOW'],
  'picture-puzzle': ['✦', 'JIGSAW'],
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

const ENGLISH_COVERS: Record<string, string> = {
  'vocabulary-matching': '/illustrations/puzzle-cat.svg',
  'sound-family-village': '/illustrations/phonics/hat.svg',
  'little-learning-classroom': '/illustrations/vocab/book.svg',
  'shadow-safari-animals': '/illustrations/vocab/rabbit.svg',
  'hidden-picture': '/illustrations/vocab/lion.svg',
  'bubble-word-garden': '/illustrations/vocab/strawberry.svg',
  'fruit-market-match': '/illustrations/puzzle-apple.svg',
  'school-treasure-match': '/illustrations/puzzle-bus.svg',
  'happyclass-picture-puzzle': '/illustrations/puzzle-bus.svg',
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
          {lang === 'en' && ENGLISH_COVERS[game.slug]
            ? <img className="poster-illustration" src={ENGLISH_COVERS[game.slug]} alt="" width="120" height="110" />
            : <span className="poster-icon">{TEMPLATE_EMOJI[game.templateKey] || '🎮'}</span>}
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
