import { redirect } from 'next/navigation';
import { CLASS_CODE } from '@/lib/classes';
import { dict } from '@/lib/i18n';
import { firstParam, productContext } from '@/lib/page-context';

/** Học sinh gõ mã lớp. */
export default async function JoinCodePage({ params, searchParams }: { params: Promise<{ product: string }>; searchParams: Promise<{ code?: string | string[] }> }) {
  const { product, base } = await productContext(params);
  const code = (firstParam((await searchParams).code) ?? '').trim().toUpperCase();
  if (CLASS_CODE.test(code)) redirect(`${base}/lop/${code}`);
  const t = dict(product).classes.join;
  return (
    <main className={`product-page ${product} join-page`}>
      <section className="pricing-wrap">
        <form className="panel join-code-form" data-testid="join-code-form">
          <h1>🏫</h1>
          <input name="code" placeholder={t.codePh} maxLength={6} autoCapitalize="characters" autoComplete="off" defaultValue={code} />
          <button className="primary-button">{t.go}</button>
        </form>
      </section>
    </main>
  );
}
