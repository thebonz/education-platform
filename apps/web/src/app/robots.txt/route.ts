import { siteForHost } from '@/lib/sites';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const host = request.headers.get('host');
  const site = siteForHost(host);
  const lines = site === 'admin'
    ? ['User-agent: *', 'Disallow: /']
    : ['User-agent: *', 'Allow: /', 'Disallow: /api/', 'Disallow: /account', 'Disallow: /admin', ...(host ? [`Sitemap: https://${host}/sitemap.xml`] : [])];
  return new Response(`${lines.join('\n')}\n`, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
