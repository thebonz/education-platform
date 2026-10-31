'use client';

import { useState } from 'react';
import { apiSend } from '@/lib/client-api';

export function FavoriteButton({ gameId, initial, labels }: { gameId: string; initial: boolean; labels: { add: string; remove: string } }) {
  const [fav, setFav] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className={`fav-button ${fav ? 'on' : ''}`} aria-pressed={fav} disabled={busy} data-testid="favorite-button"
      onClick={async () => {
        setBusy(true);
        const res = await apiSend(fav ? 'DELETE' : 'PUT', `/account/favorites/${gameId}`);
        if (res.ok) setFav(!fav);
        setBusy(false);
      }}>
      {fav ? '♥' : '♡'} {fav ? labels.remove : labels.add}
    </button>
  );
}
