import { notFound, redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { CheckoutPanel } from '@/components/billing/checkout-panel';
import { SiteHeader } from '@/components/site-header';
import type { OrderView } from '@/lib/billing';
import { productContext } from '@/lib/page-context';
import { apiGet } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ params }: { params: Promise<{ product: string; code: string }> }) {
  const ctx = await productContext(params);
  const { product, base, me } = ctx;
  const { code } = await params;
  if (!/^HC[2-9A-HJKMNP-Z]{8}$/.test(code)) notFound();
  if (!me) redirect(`${base}/login?next=${encodeURIComponent(`${base}/checkout/${code}`)}`);
  const res = await apiGet<OrderView>(`/billing/orders/${code}`);
  if (!res.ok) notFound();
  // QR vẽ ngay trên máy chủ HappyClass (SVG), không gửi thông tin đơn cho dịch vụ bên ngoài.
  const qrSvg = res.data.transfer ? await QRCode.toString(res.data.transfer.qrPayload, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 }) : null;
  return (
    <main className={`product-page ${product}`}>
      <SiteHeader product={product} base={base} me={me} />
      <section className="pricing-wrap">
        <CheckoutPanel product={product} base={base} initial={res.data} qrSvg={qrSvg} />
      </section>
    </main>
  );
}
