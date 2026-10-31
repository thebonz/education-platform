/**
 * Cấu hình site đọc từ biến môi trường lúc chạy (không hardcode domain).
 *   Chế độ domain:     SITE_ENGLISH_URL=https://english.happyclass.asia
 *   Chế độ đường dẫn:  SITE_ENGLISH_URL=http://localhost:3100/english
 */
export const SITES = ['english', 'vietnamese', 'admin'] as const;
export type Site = (typeof SITES)[number];
export type Product = Exclude<Site, 'admin'>;

export function isProduct(value: string): value is Product {
  return value === 'english' || value === 'vietnamese';
}

const ENV_KEYS: Record<Site, string> = {
  english: 'SITE_ENGLISH_URL',
  vietnamese: 'SITE_VIETNAMESE_URL',
  admin: 'SITE_ADMIN_URL',
};
const DEFAULTS: Record<Site, string> = {
  english: 'http://localhost:3100/english',
  vietnamese: 'http://localhost:3100/vietnamese',
  admin: 'http://localhost:3100/admin',
};

export function siteUrl(site: Site): URL {
  return new URL(process.env[ENV_KEYS[site]] || DEFAULTS[site]);
}

/** Site nào đang chạy ở chế độ domain riêng và trùng với host của request. */
export function siteForHost(host: string | null): Site | null {
  if (!host) return null;
  const h = host.toLowerCase();
  for (const site of SITES) {
    const url = siteUrl(site);
    if ((url.pathname === '/' || url.pathname === '') && url.host.toLowerCase() === h) return site;
  }
  return null;
}

/** Tiền tố đường dẫn cho link nội bộ: '' khi đang ở domain riêng của site, '/english' khi chạy theo đường dẫn. */
export function basePath(site: Site, host: string | null): string {
  return siteForHost(host) === site ? '' : `/${site}`;
}
