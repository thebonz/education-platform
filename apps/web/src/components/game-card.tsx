import Link from 'next/link';
import type { CatalogGame } from '@/lib/catalog';

const emojiByTemplate: Record<string, string> = {
  bingo: '🎯', matching: '🧩', 'hidden-picture': '🖼️', 'letter-builder': '🫧', spelling: '✍️', quiz: '⚡',
};

export function GameCard({ game, base }: { game: CatalogGame; base: string }) {
  return (
    <Link href={`${base}/games/${game.slug}`} className="game-card">
      <div className={`game-card-art art-${game.templateKey}`}>
        <span>{emojiByTemplate[game.templateKey] || '🎮'}</span>
        <i>{game.accessLevel === 'FREE' ? 'FREE' : 'PREMIUM'}</i>
      </div>
      <div className="game-card-body">
        <div className="game-card-meta"><span>{game.category?.name || 'Learning game'}</span><span>{game.gradeLevel || 'All levels'}</span></div>
        <h3>{game.title}</h3>
        <p>{game.summary}</p>
        <span className="play-link">Play game <b>→</b></span>
      </div>
    </Link>
  );
}
