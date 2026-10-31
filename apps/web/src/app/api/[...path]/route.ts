import { NextRequest } from 'next/server';

/**
 * Proxy /api/* → API nội bộ. Nhờ vậy trình duyệt chỉ nói chuyện với một origin
 * (không cần CORS) và cookie phiên được đặt cho đúng domain của site.
 * Địa chỉ API đọc lúc chạy từ API_INTERNAL_URL.
 */
export const dynamic = 'force-dynamic';

const FORWARD_REQUEST_HEADERS = ['accept', 'accept-language', 'content-type', 'cookie', 'origin', 'referer', 'user-agent', 'x-forwarded-for'];
const DROP_RESPONSE_HEADERS = new Set(['connection', 'keep-alive', 'transfer-encoding', 'content-encoding', 'content-length', 'set-cookie']);

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const base = (process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000/api').replace(/\/+$/, '');
  const target = `${base}/${path.map(encodeURIComponent).join('/')}${request.nextUrl.search}`;

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const hasBody = !['GET', 'HEAD'].includes(request.method);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch {
    return Response.json({ error: 'api_unavailable' }, { status: 502 });
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!DROP_RESPONSE_HEADERS.has(key.toLowerCase())) responseHeaders.set(key, value);
  });
  for (const cookie of upstream.headers.getSetCookie()) responseHeaders.append('set-cookie', cookie);

  const body = upstream.status === 204 || upstream.status === 304 ? null : await upstream.arrayBuffer();
  return new Response(body, { status: upstream.status, headers: responseHeaders });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
