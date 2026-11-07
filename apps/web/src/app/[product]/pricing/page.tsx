import Link from 'next/link';
import type { Metadata } from 'next';
import { BuyButton } from '@/components/billing/buy-button';
import { SiteHeader } from '@/components/site-header';
import { fill, formatDate, formatVnd, type BillingMe, type PlansResult } from '@/lib/billing';
import { dict } from '@/lib/i18n';
import { productContext } from '@/lib/page-context';
import { apiGet } from '@/lib/server-api';

export const metadata: Metadata = { title: 'Bảng giá – HappyClass' };

export default async function PricingPage({ params }: { params: Promise<{ product: string }> }) {
  const { product, base, me } = await productContext(params);
  const t = dict(product);
  const lang = product === 'english' ? 'en' : 'vi';
  const productName = product === 'english' ? 'English Games' : 'Vietnamese Games';
  const [plans, mine] = await Promise.all([
    apiGet<PlansResult>(`/billing/plans?product=${product}`),
    me ? apiGet<BillingMe>('/billing/me') : Promise.resolve(null),
  ]);
  const active = mine?.ok ? mine.data.memberships.find((m) => m.product.slug === product) : undefined;
  const list = plans.ok ? plans.data.plans : [];
  const monthly = list.find((p) => p.period === 'MONTH');
  return (
    <main className={`product-page ${product}`}>
      <SiteHeader product={product} base={base} me={me} />
      <section className="pricing-wrap">
        <h1>{t.billing.title}</h1>
        <p className="muted">{fill(t.billing.lead, { product: productName })}</p>
        {active && <p className="form-success" data-testid="active-membership">{fill(t.billing.active, { date: formatDate(active.endsAt, lang) })}</p>}
        {!plans.ok || !plans.data.paymentsEnabled ? (
          <p className="panel" data-testid="payments-disabled">{t.billing.disabled}</p>
        ) : (
          <div className="plan-grid">
            {list.map((p) => {
              const yearly = p.period === 'YEAR';
              const saving = yearly && monthly ? monthly.priceVnd * p.months - p.priceVnd : 0;
              return (
                <div key={p.id} className={`panel plan-card ${yearly ? 'featured' : ''}`} data-testid="plan-card" data-plan={p.code}>
                  <h2>{fill(t.billing.months, { n: p.months })}</h2>
                  <p className="plan-price"><strong>{formatVnd(p.priceVnd)}</strong> <span>{yearly ? t.billing.perYear : t.billing.perMonth}</span></p>
                  {saving > 0 && <p className="plan-saving">{t.billing.yearSaving}: {formatVnd(saving)}</p>}
                  <ul>{t.billing.includes.map((x) => <li key={x}>✓ {x}</li>)}</ul>
                  {me
                    ? <BuyButton planId={p.id} base={base} label={t.billing.buy} busyLabel={t.billing.creating} highlight={yearly} />
                    : <Link className={yearly ? 'primary-button' : 'secondary-button'} href={`${base}/login?next=${encodeURIComponent(`${base}/pricing`)}`}>{t.billing.loginToBuy}</Link>}
                </div>
              );
            })}
          </div>
        )}
        <div className="panel plan-card school" data-testid="school-plan">
          <h2>{t.billing.school}</h2>
          <p className="muted">{t.billing.schoolLead}</p>
          {plans.ok && plans.data.contact?.zalo
            ? <a className="secondary-button" href={plans.data.contact.zalo} target="_blank" rel="noreferrer" data-testid="zalo-link">💬 {t.billing.contactZalo}</a>
            : null}
        </div>
      </section>
    </main>
  );
}
