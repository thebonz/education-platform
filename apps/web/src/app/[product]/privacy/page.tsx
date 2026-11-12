import type { Metadata } from 'next';
import { legalTitle, PrivacyContent } from '@/components/legal';
import { SiteHeader } from '@/components/site-header';
import { isProduct } from '@/lib/sites';
import { productContext } from '@/lib/page-context';

export async function generateMetadata({ params }: { params: Promise<{ product: string }> }): Promise<Metadata> {
  const { product } = await params;
  return isProduct(product) ? { title: legalTitle('privacy', product) } : {};
}

export default async function PrivacyPage({ params }: { params: Promise<{ product: string }> }) {
  const { product, base, me } = await productContext(params);
  return (
    <main className={`product-page ${product}`}>
      <SiteHeader product={product} base={base} me={me} />
      <section className="pricing-wrap"><PrivacyContent product={product} base={base} /></section>
    </main>
  );
}
