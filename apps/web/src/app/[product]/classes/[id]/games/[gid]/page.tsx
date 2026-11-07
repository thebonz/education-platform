import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { TemplateKey } from '@happyclass/game-core/templates';
import { ClassGameEditor } from '@/components/classes/class-game-editor';
import { SiteHeader } from '@/components/site-header';
import { dict } from '@/lib/i18n';
import { productContext } from '@/lib/page-context';
import { apiGet } from '@/lib/server-api';

type ClassGame = { id: string; title: string; templateKey: TemplateKey; accessLevel: string; isActive: boolean; content: unknown };

export default async function ClassGamePage({ params }: { params: Promise<{ product: string; id: string; gid: string }> }) {
  const { product, base, me } = await productContext(params);
  const { id, gid } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f-]{36}$/i.test(gid)) notFound();
  if (!me) redirect(`${base}/login?next=${encodeURIComponent(`${base}/classes/${id}/games/${gid}`)}`);
  const res = await apiGet<ClassGame>(`/classes/${id}/games/${gid}`);
  if (!res.ok) notFound();
  const t = dict(product).classes;
  return (
    <main className={`product-page ${product}`}>
      <SiteHeader product={product} base={base} me={me} />
      <section className="pricing-wrap wide">
        <Link href={`${base}/classes/${id}`} className="back-link">{t.back}</Link>
        <ClassGameEditor product={product} classId={id} game={res.data} />
      </section>
    </main>
  );
}
