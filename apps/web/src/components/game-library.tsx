'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { foldForSearch } from '@happyclass/game-core/text';
import type { CatalogGame, Taxonomy } from '@/lib/catalog';
import { matchesSkill, SKILL_GROUPS } from '@/lib/discovery';
import { GameCard } from './game-card';

/** Thư viện game có bộ lọc theo danh mục, cấp độ, miễn phí/trả phí và tìm kiếm không dấu. Bộ lọc lưu trên URL để chia sẻ được. */
export function GameLibrary({ games, taxonomy, product, base }: { games: CatalogGame[]; taxonomy: Taxonomy; product: string; base: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const isEn = product === 'english';
  const [query, setQuery] = useState(params.get('q') ?? '');
  const category = params.get('category') ?? 'all';
  const level = params.get('level') ?? 'all';
  const access = params.get('access') ?? 'all';
  const skill = params.get('skill') ?? 'all';
  const skillGroups = SKILL_GROUPS[isEn ? 'english' : 'vietnamese'];
  const selectedSkill = skillGroups.find((group) => group.key === skill);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === 'all' || !value) next.delete(key); else next.set(key, value);
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  }

  const q = foldForSearch(query.trim());
  const filtered = useMemo(() => games.filter((g) =>
    (!q || foldForSearch(`${g.title} ${g.summary} ${g.category?.name ?? ''} ${g.level?.name ?? ''}`).includes(q))
    && (category === 'all' || g.category?.slug === category)
    && (level === 'all' || g.level?.slug === level)
    && (access === 'all' || g.accessLevel === access)
    && (!selectedSkill || matchesSkill(g.templateKey, selectedSkill))),
    [games, q, category, level, access, selectedSkill]);

  return (
    <>
      <div className="library-tools">
        <label className="search-box"><span>⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} onBlur={() => setParam('q', query.trim())}
            placeholder={isEn ? 'Search games, skills...' : 'Tìm trò chơi, kỹ năng...'} aria-label={isEn ? 'Search' : 'Tìm kiếm'} />
        </label>
        <select value={level} onChange={(e) => setParam('level', e.target.value)} aria-label={isEn ? 'Level' : 'Lớp'} data-testid="filter-level">
          <option value="all">{isEn ? 'All levels' : 'Tất cả các lớp'}</option>
          {taxonomy.levels.map((l) => <option key={l.slug} value={l.slug}>{l.name} ({l.games})</option>)}
        </select>
        <select value={access} onChange={(e) => setParam('access', e.target.value)} aria-label={isEn ? 'Access' : 'Loại'}>
          <option value="all">{isEn ? 'Free & Premium' : 'Miễn phí & trả phí'}</option>
          <option value="FREE">{isEn ? 'Free' : 'Miễn phí'}</option>
          <option value="PREMIUM">Premium</option>
        </select>
      </div>
      <div className="skill-section">
        <div className="skill-section-heading">
          <div><span className="eyebrow">{isEn ? 'CHOOSE YOUR ACTIVITY' : 'CHỌN CÁCH HỌC BÉ THÍCH'}</span>
            <h2>{isEn ? 'What would you like to practice?' : 'Hôm nay bé muốn luyện gì?'}</h2></div>
          <p>{isEn ? 'Find games by how you learn.' : 'Chọn kỹ năng để tìm trò chơi phù hợp.'}</p>
        </div>
        <div className="skill-chips" role="group" aria-label={isEn ? 'Learning activities' : 'Kỹ năng học'}>
          <button type="button" data-testid="skill-chip-all" className={!selectedSkill ? 'skill-chip active' : 'skill-chip'}
            aria-pressed={!selectedSkill} onClick={() => setParam('skill', 'all')}>
            <span aria-hidden="true">✨</span><b>{isEn ? 'All games' : 'Tất cả'}</b><small>{games.length}</small>
          </button>
          {skillGroups.map((group) => {
            const count = games.filter((g) => matchesSkill(g.templateKey, group)).length;
            if (!count) return null;
            return (
              <button key={group.key} type="button" data-testid={`skill-chip-${group.key}`}
                className={skill === group.key ? 'skill-chip active' : 'skill-chip'}
                aria-pressed={skill === group.key} onClick={() => setParam('skill', group.key)}>
                <span aria-hidden="true">{group.icon}</span><b>{group.label}</b><small>{count}</small>
              </button>
            );
          })}
        </div>
      </div>
      <div className="category-chips" role="group" aria-label={isEn ? 'Categories' : 'Danh mục'}>
        <button type="button" className={category === 'all' ? 'chip active' : 'chip'} onClick={() => setParam('category', 'all')}>{isEn ? 'All' : 'Tất cả'} ({games.length})</button>
        {taxonomy.categories.map((c) => (
          <button key={c.slug} type="button" className={category === c.slug ? 'chip active' : 'chip'} onClick={() => setParam('category', c.slug)} data-testid={`chip-${c.slug}`}>{c.name} ({c.games})</button>
        ))}
      </div>
      {filtered.length
        ? <div className="game-grid">{filtered.map((g) => <GameCard key={g.id} game={g} base={base} lang={isEn ? 'en' : 'vi'} />)}</div>
        : <div className="empty-state">{isEn ? 'No games match your search.' : 'Không tìm thấy trò chơi phù hợp.'}</div>}
    </>
  );
}
