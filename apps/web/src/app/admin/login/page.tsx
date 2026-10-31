import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth-forms';
import { getMe, requestHost } from '@/lib/server-api';
import { basePath } from '@/lib/sites';

export default async function AdminLogin() {
  const base = basePath('admin', await requestHost());
  if (await getMe()) redirect(base || '/');
  return <main className="admin-login"><LoginForm site="admin" base={base} next={null} /></main>;
}
