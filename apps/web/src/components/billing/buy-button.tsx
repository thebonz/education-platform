'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiSend } from '@/lib/client-api';

export function BuyButton({ planId, base, label, busyLabel, highlight }: { planId: string; base: string; label: string; busyLabel: string; highlight?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button type="button" className={highlight ? 'primary-button' : 'secondary-button'} disabled={busy} data-testid="buy-plan"
        onClick={async () => {
          setBusy(true); setError(null);
          const res = await apiSend<{ code: string }>('POST', '/billing/orders', { planId });
          if (res.ok && res.data) { router.push(`${base}/checkout/${res.data.code}`); return; }
          setBusy(false);
          setError(res.data?.error === 'too_many_pending_orders' ? 'Bạn có quá nhiều đơn đang chờ. Hãy thanh toán hoặc huỷ bớt.' : `Lỗi ${res.status}`);
        }}>
        {busy ? busyLabel : label}
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  );
}
