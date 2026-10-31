import { ResetForm } from '@/components/auth-forms';
import { requestHost } from '@/lib/server-api';
import { basePath } from '@/lib/sites';

export default async function AdminReset({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const base = basePath('admin', await requestHost());
  const { token } = await searchParams;
  return <main className="admin-login"><ResetForm site="admin" base={base} token={token ?? null} /></main>;
}
