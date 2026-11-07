import Link from 'next/link';
import { CatalogGame, TEMPLATE_EMOJI } from '@/lib/catalog';

export function GameCard({ game, base, lang }: { game: CatalogGame; base: string; lang: 'en' | 'vi' }) {
  const free = game.accessLevel === 'FREE';
  return (
    <Link href={`${base}/games/${game.slug}`} className="game-card" data-testid="game-card">
      <div className={`game-card-art art-${game.templateKey}`}>
        <span>{TEMPLATE_EMOJI[game.templateKey] || '🎮'}</span>
        <i className={free ? 'badge-free' : 'badge-premium'}>{free ? (lang === 'en' ? 'FREE' : 'MIỄN PHÍ') : 'PREMIUM'}</i>
      </div>
      <div className="game-card-body">
        <div className="game-card-meta"><span>{game.category?.name ?? ''}</span><span>{game.level?.name ?? ''}</span></div>
        <h3>{game.title}</h3>
        <p>{game.summary}</p>
        <span className="play-link">{lang === 'en' ? 'Play now' : 'Chơi ngay'} <b>→</b></span>
      </div>
    </Link>
  );
}
