import type { Metadata } from 'next';
import { OfflinePlayer } from '@/components/offline/offline-player';
import { SiteHeader } from '@/components/site-header';
import { productContext } from '@/lib/page-context';

export const metadata: Metadata = { title: 'Chơi offline – HappyClass', robots: { index: false, follow: false } };

export default async function OfflinePage({ params }: { params: Promise<{ product: string }> }) {
  const { product, base, me } = await productContext(params);
  return (
    <main className={`product-page ${product}`}>
      <SiteHeader product={product} base={base} me={me} />
      <section className="pricing-wrap">
        <OfflinePlayer product={product} loggedIn={!!me} />
      </section>
    </main>
  );
}
