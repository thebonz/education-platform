import 'server-only';
import { cookies, headers } from 'next/headers';

export type Me = {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  roles: string[];
  permissions: string[];
};

export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; data: { error?: string } | null };

/** Gọi API từ server component, chuyển tiếp cookie phiên của người dùng. */
export async function apiGet<T>(path: string): Promise<ApiResult<T>> {
  const base = (process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000/api').replace(/\/+$/, '');
  const cookieHeader = (await cookies()).toString();
  try {
    const res = await fetch(`${base}${path}`, {
      headers: cookieHeader ? { cookie: cookieHeader } : {},
      cache: 'no-store',
    });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    return res.ok ? { ok: true, status: res.status, data: data as T } : { ok: false, status: res.status, data };
  } catch {
    return { ok: false, status: 502, data: { error: 'api_unavailable' } };
  }
}

export async function getMe(): Promise<Me | null> {
  const res = await apiGet<{ user: Me }>('/auth/me');
  return res.ok ? res.data.user : null;
}

export async function requestHost(): Promise<string | null> {
  return (await headers()).get('host');
}
