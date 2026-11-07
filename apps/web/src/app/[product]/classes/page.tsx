import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CreateClassForm } from '@/components/classes/class-forms';
import { SiteHeader } from '@/components/site-header';
import type { ClassList } from '@/lib/classes';
import { dict } from '@/lib/i18n';
import { productContext } from '@/lib/page-context';
import { apiGet } from '@/lib/server-api';

export default async function ClassesPage({ params }: { params: Promise<{ product: string }> }) {
  const { product, base, me } = await productContext(params);
  if (!me) redirect(`${base}/login?next=${encodeURIComponent(`${base}/classes`)}`);
  const t = dict(product).classes;
  const res = await apiGet<ClassList>('/classes');
  const classes = res.ok ? res.data.classes.filter((c) => c.product.slug === product) : [];
  return (
    <main className={`product-page ${product}`}>
      <SiteHeader product={product} base={base} me={me} />
      <section className="pricing-wrap">
        <h1>{t.title}</h1>
        <p className="muted">{t.lead}</p>
        <CreateClassForm product={product} base={base} />
        {classes.length === 0 ? <p className="muted" data-testid="no-classes">{t.none}</p> : (
          <ul className="class-list" data-testid="class-list">
            {classes.map((c) => (
              <li key={c.id} className={`panel ${c.isArchived ? 'archived' : ''}`}>
                <Link href={`${base}/classes/${c.id}`} data-testid="class-link"><strong>{c.name}</strong></Link>
                <small className="muted">{[c.gradeLabel, `${c.students} ${t.students}`, `${c.games} ${t.games}`, `${t.code}: ${c.joinCode}`, c.isArchived ? t.archived : null].filter(Boolean).join(' · ')}</small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
