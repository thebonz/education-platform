import { siteForHost, siteUrl } from '@/lib/sites';

export const dynamic = 'force-dynamic';

type Game = { slug: string };

/** Sitemap theo tên miền: mỗi site (English / Vietnamese) có sitemap riêng. */
export async function GET(request: Request) {
  const host = request.headers.get('host');
  const site = siteForHost(host);
  const products = site === 'english' || site === 'vietnamese' ? [site] : (['english', 'vietnamese'] as const);
  const base = (process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000/api').replace(/\/+$/, '');
  const urls: string[] = [];
  for (const product of products) {
    const root = siteUrl(product);
    const prefix = `${root.origin}${root.pathname.replace(/\/$/, '')}`;
    urls.push(prefix || root.origin, `${prefix}/games`);
    try {
      const res = await fetch(`${base}/catalog/products/${product}/games`, { cache: 'no-store' });
      if (res.ok) for (const g of (await res.json()) as Game[]) urls.push(`${prefix}/games/${g.slug}`);
    } catch { /* API chưa sẵn sàng: trả sitemap tối thiểu */ }
  }
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
