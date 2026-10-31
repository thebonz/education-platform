export type SendResult<T = unknown> = { ok: boolean; status: number; data: (T & { error?: string; fields?: string[] }) | null };

/** Gọi API từ trình duyệt qua proxy cùng origin /api. */
export async function apiSend<T = unknown>(method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, body?: unknown): Promise<SendResult<T>> {
  try {
    const res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'network_error' } as T & { error: string } };
  }
}
