'use client';

import { useState } from 'react';
import { apiSend } from '@/lib/client-api';

export function LogoutButton({ label, redirectTo }: { label: string; redirectTo: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="link-button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await apiSend('POST', '/auth/logout');
        window.location.assign(redirectTo);
      }}
    >
      {label}
    </button>
  );
}
