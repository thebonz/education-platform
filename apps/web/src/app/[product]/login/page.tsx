import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth-forms';
import { SiteHeader } from '@/components/site-header';
import { firstParam, productContext } from '@/lib/page-context';

export default async function LoginPage({ params, searchParams }: { params: Promise<{ product: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { product, base, me } = await productContext(params);
  if (me) redirect(`${base}/account`);
  const next = firstParam((await searchParams).next);
  return <main className={`product-page ${product}`}><SiteHeader product={product} base={base} me={me} /><section className="auth-wrap"><LoginForm site={product} base={base} next={next} /></section></main>;
}
