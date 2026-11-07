import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { ClassManager } from '@/components/classes/class-forms';
import { SiteHeader } from '@/components/site-header';
import type { ClassDetail, ClassResults } from '@/lib/classes';
import { dict } from '@/lib/i18n';
import { productContext } from '@/lib/page-context';
import { apiGet } from '@/lib/server-api';
import { siteUrl } from '@/lib/sites';

export const dynamic = 'force-dynamic';

type LibraryGame = { id: string; title: string; accessLevel: 'FREE' | 'PREMIUM'; access: { allowed: boolean } };

export default async function ClassPage({ params }: { params: Promise<{ product: string; id: string }> }) {
  const { product, base, me } = await productContext(params);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  if (!me) redirect(`${base}/login?next=${encodeURIComponent(`${base}/classes/${id}`)}`);
  const [cls, library, results] = await Promise.all([
    apiGet<ClassDetail>(`/classes/${id}`),
    apiGet<LibraryGame[]>(`/catalog/products/${product}/games`),
    apiGet<ClassResults>(`/classes/${id}/results`),
  ]);
  if (!cls.ok || cls.data.product.slug !== product) notFound();
  const t = dict(product).classes;
  const site = siteUrl(product);
  const joinUrl = `${site.origin}${site.pathname.replace(/\/$/, '')}/lop/${cls.data.joinCode}`;
  const qrSvg = await QRCode.toString(joinUrl, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 });
  return (
    <main className={`product-page ${product}`}>
      <SiteHeader product={product} base={base} me={me} />
      <section className="pricing-wrap">
        <Link href={`${base}/classes`} className="back-link">← {t.title}</Link>
        <h1 data-testid="class-title">{cls.data.name}{cls.data.gradeLabel ? <small> · {cls.data.gradeLabel}</small> : null}</h1>
        <ClassManager product={product} base={base} cls={cls.data} library={library.ok ? library.data : []} joinUrl={joinUrl} qrSvg={qrSvg} results={results.ok ? results.data : null} />
      </section>
    </main>
  );
}
