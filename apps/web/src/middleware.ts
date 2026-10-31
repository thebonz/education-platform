import { NextRequest, NextResponse } from 'next/server';
import { siteForHost } from './lib/sites';

/** Định tuyến theo tên miền: english.happyclass.asia/games → /english/games (người dùng không thấy tiền tố). */
export function middleware(request: NextRequest) {
  const site = siteForHost(request.headers.get('host'));
  if (!site) return NextResponse.next();
  const { pathname } = request.nextUrl;
  if (pathname === `/${site}` || pathname.startsWith(`/${site}/`)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/${site}${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!api/|_next/|favicon.ico|robots.txt|sitemap.xml).*)'],
};
