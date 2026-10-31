import 'server-only';
import { redirect } from 'next/navigation';
import { getMe, requestHost } from './server-api';
import { basePath } from './sites';

export async function adminContext() {
  const base = basePath('admin', await requestHost());
  const me = await getMe();
  if (!me) redirect(`${base}/login`);
  return { base, me, can: (p: string) => me.permissions.includes(p) };
}
