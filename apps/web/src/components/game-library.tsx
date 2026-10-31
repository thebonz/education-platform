'use client';

import { useMemo, useState } from 'react';
import type { CatalogGame } from '@/lib/catalog';
import { GameCard } from './game-card';

/** Bỏ dấu tiếng Việt để tìm "chinh ta" vẫn ra "Chính tả". */
export function fold(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

export function GameLibrary({ games, product, base }: { games: CatalogGame[]; product: string; base: string }) {
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState('all');
  const levels = useMemo(() => Array.from(new Set(games.map((g) => g.gradeLevel).filter(Boolean))) as string[], [games]);
  const q = fold(query.trim());
  const filtered = games.filter((g) => {
    const matchesQuery = !q || fold(`${g.title} ${g.summary} ${g.category?.name || ''}`).includes(q);
    return matchesQuery && (level === 'all' || g.gradeLevel === level);
  });
  const isEn = product === 'english';
  return (
    <>
      <div className="library-tools">
        <label className="search-box"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={isEn ? 'Search games, skills...' : 'Tìm trò chơi, kỹ năng...'} /></label>
        <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label={isEn ? 'Filter by level' : 'Lọc theo lớp'}>
          <option value="all">{isEn ? 'All levels' : 'Tất cả các lớp'}</option>
          {levels.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      {filtered.length
        ? <div className="game-grid">{filtered.map((g) => <GameCard key={g.id} game={g} base={base} />)}</div>
        : <div className="empty-state">{isEn ? 'No games match your search.' : 'Không tìm thấy trò chơi phù hợp.'}</div>}
    </>
  );
}
