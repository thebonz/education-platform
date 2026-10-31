import { ForgotForm } from '@/components/auth-forms';
import { SiteHeader } from '@/components/site-header';
import { productContext } from '@/lib/page-context';

export default async function ForgotPage({ params }: { params: Promise<{ product: string }> }) {
  const { product, base, me } = await productContext(params);
  return <main className={`product-page ${product}`}><SiteHeader product={product} base={base} me={me} /><section className="auth-wrap"><ForgotForm site={product} /></section></main>;
}
