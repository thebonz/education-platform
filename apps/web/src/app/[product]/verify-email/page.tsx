import { VerifyEmail } from '@/components/auth-forms';
import { SiteHeader } from '@/components/site-header';
import { firstParam, productContext } from '@/lib/page-context';

export default async function VerifyPage({ params, searchParams }: { params: Promise<{ product: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { product, base, me } = await productContext(params);
  const token = firstParam((await searchParams).token);
  return <main className={`product-page ${product}`}><SiteHeader product={product} base={base} me={me} /><section className="auth-wrap"><VerifyEmail site={product} base={base} token={token} /></section></main>;
}
