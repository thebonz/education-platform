import type { Metadata } from 'next';
import { StudentJoin } from '@/components/classes/student-join';
import { CLASS_CODE, type JoinView } from '@/lib/classes';
import { dict } from '@/lib/i18n';
import { firstParam, productContext } from '@/lib/page-context';
import { apiGet } from '@/lib/server-api';

export const dynamic = 'force-dynamic';
// Trang lớp học không đưa lên công cụ tìm kiếm.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function JoinPage({ params, searchParams }: { params: Promise<{ product: string; code: string }>; searchParams: Promise<{ s?: string | string[] }> }) {
  const { product } = await productContext(params);
  const { code: raw } = await params;
  const code = raw.toUpperCase();
  const t = dict(product).classes.join;
  const res = CLASS_CODE.test(code) ? await apiGet<JoinView>(`/class-join/${code}`) : null;
  const ok = !!res?.ok && res.data.product.slug === product;
  return (
    <main className={`product-page ${product} join-page`}>
      <section className="pricing-wrap">
        {ok && res?.ok ? (
          <>
            <h1 data-testid="join-class-name">🏫 {res.data.name}{res.data.gradeLabel ? <small> · {res.data.gradeLabel}</small> : null}</h1>
            <StudentJoin product={product} code={code} view={res.data} initialStudent={firstParam((await searchParams).s)} />
          </>
        ) : (
          <div className="panel" data-testid="join-not-found">
            <p>{t.notFound}</p>
            <form action="../lop"><input name="code" placeholder={t.codePh} maxLength={6} /><button className="primary-button">{t.go}</button></form>
          </div>
        )}
      </section>
    </main>
  );
}
