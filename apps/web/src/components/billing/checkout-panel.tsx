'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fill, formatDate, formatVnd, type OrderView } from '@/lib/billing';
import { apiSend } from '@/lib/client-api';
import { dict } from '@/lib/i18n';
import type { Product } from '@/lib/sites';

function CopyRow({ label, value, display, copyLabel, copiedLabel, testId }: { label: string; value: string; display?: string; copyLabel: string; copiedLabel: string; testId: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="transfer-row">
      <span className="muted">{label}</span>
      <strong data-testid={testId}>{display ?? value}</strong>
      <button type="button" className="link-button" onClick={async () => {
        try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* trình duyệt chặn clipboard */ }
      }}>{done ? copiedLabel : copyLabel}</button>
    </div>
  );
}

function remaining(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} giờ ${m} phút` : `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Màn thanh toán: QR + thông tin chuyển khoản, tự hỏi trạng thái đơn mỗi 4 giây đến khi tiền về. */
export function CheckoutPanel({ product, base, initial, qrSvg }: { product: Product; base: string; initial: OrderView; qrSvg: string | null }) {
  const t = dict(product).billing;
  const lang = product === 'english' ? 'en' : 'vi';
  const [order, setOrder] = useState(initial);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (order.status !== 'PENDING') return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      const res = await fetch(`/api/billing/orders/${order.code}`, { credentials: 'same-origin', cache: 'no-store' }).catch(() => null);
      if (res?.ok) {
        const next = (await res.json()) as OrderView;
        setOrder((cur) => ({ ...next, transfer: next.transfer ?? (next.status === 'PENDING' ? cur.transfer : null) }));
      }
    }, 4000);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, [order.status, order.code]);

  const tr = order.transfer;
  return (
    <div className="checkout" data-testid="checkout" data-status={order.status}>
      <h1>{fill(t.orderTitle, { code: order.code })}</h1>
      <p className="muted">{order.product?.name} · {order.planName} · <strong>{formatVnd(order.amountVnd)}</strong></p>

      {order.status === 'PAID' && (
        <div className="panel checkout-done" data-testid="checkout-paid">
          <div className="complete-star">🎉</div>
          <h2>{t.paid}</h2>
          {order.membership && <p>{fill(t.paidUntil, { date: formatDate(order.membership.endsAt, lang) })}</p>}
          <Link className="primary-button" href={`${base}/games`}>{t.goPlay}</Link>
        </div>
      )}
      {order.status === 'EXPIRED' && <p className="panel" data-testid="checkout-expired">{t.expired} <Link href={`${base}/pricing`}>{t.newOrder}</Link></p>}
      {order.status === 'CANCELLED' && <p className="panel" data-testid="checkout-cancelled">{t.cancelled} <Link href={`${base}/pricing`}>{t.newOrder}</Link></p>}

      {order.status === 'PENDING' && tr && (
        <>
          {tr.mode === 'sandbox' && <p className="sandbox-banner" role="alert" data-testid="sandbox-banner">{t.sandbox}</p>}
          <div className="checkout-grid">
            <div className="panel qr-panel">
              <h2>{t.scan}</h2>
              {qrSvg && <div className="qr" role="img" aria-label="VietQR" data-testid="qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />}
              <p className="muted">{fill(t.expiresIn, { time: remaining(new Date(order.expiresAt).getTime() - now) })}</p>
            </div>
            <div className="panel">
              <h2>{t.orTransfer}</h2>
              <CopyRow label={t.bank} value={tr.bankName} copyLabel={t.copy} copiedLabel={t.copied} testId="tr-bank" />
              <CopyRow label={t.accountNumber} value={tr.accountNumber} copyLabel={t.copy} copiedLabel={t.copied} testId="tr-account" />
              <CopyRow label={t.accountName} value={tr.accountName} copyLabel={t.copy} copiedLabel={t.copied} testId="tr-name" />
              <CopyRow label={t.amount} value={String(tr.amountVnd)} display={formatVnd(tr.amountVnd)} copyLabel={t.copy} copiedLabel={t.copied} testId="tr-amount" />
              <CopyRow label={t.content} value={tr.content} copyLabel={t.copy} copiedLabel={t.copied} testId="tr-content" />
              <p className="form-hint">⚠️ {t.contentWarn}</p>
              <p className="waiting" aria-live="polite"><span className="spinner" aria-hidden="true" /> {t.waiting}</p>
              <button type="button" className="link-button" data-testid="cancel-order" onClick={async () => {
                const res = await apiSend('POST', `/billing/orders/${order.code}/cancel`);
                if (res.ok) setOrder({ ...order, status: 'CANCELLED', transfer: null });
              }}>{t.cancel}</button>
              {order.contact?.zalo && <a className="link-button" href={order.contact.zalo} target="_blank" rel="noreferrer" data-testid="zalo-help">💬 {t.help}</a>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
