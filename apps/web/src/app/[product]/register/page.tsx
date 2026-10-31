import { redirect } from 'next/navigation';
import { RegisterForm } from '@/components/auth-forms';
import { SiteHeader } from '@/components/site-header';
import { productContext } from '@/lib/page-context';

export default async function RegisterPage({ params }: { params: Promise<{ product: string }> }) {
  const { product, base, me } = await productContext(params);
  if (me) redirect(`${base}/account`);
  return <main className={`product-page ${product}`}><SiteHeader product={product} base={base} me={me} /><section className="auth-wrap"><RegisterForm site={product} base={base} /></section></main>;
}
