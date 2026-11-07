import Link from 'next/link';
import { NewGameForm, type BuilderOptions } from '@/components/builder/game-forms';
import { adminContext } from '@/lib/admin-context';
import { apiGet } from '@/lib/server-api';

export default async function NewGamePage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { base, can } = await adminContext();
  if (!can('games.edit')) return <p className="form-error">Không có quyền tạo game.</p>;
  const options = await apiGet<BuilderOptions>('/admin/builder/options');
  if (!options.ok) return <p className="form-error">Không tải được danh sách template (mã {options.status}).</p>;
  const { product } = await searchParams;
  return (
    <>
      <Link href={`${base}/games`} className="back-link">← Nội dung game</Link>
      <h1>Tạo game mới</h1>
      <NewGameForm options={options.data} base={base} defaultProduct={product} />
    </>
  );
}
