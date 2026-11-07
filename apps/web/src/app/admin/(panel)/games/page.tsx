import Link from 'next/link';
import { adminContext } from '@/lib/admin-context';
import { REVIEW_LABEL, type ReviewStatus as Review } from '@/lib/review';
import { apiGet } from '@/lib/server-api';

type Row = {
  id: string; slug: string; title: string; templateKey: string; accessLevel: 'FREE' | 'PREMIUM'; isPublished: boolean;
  reviewStatus: Review; reviewedAt: string | null; version: number | null;
  product: { slug: string; name: string }; level: { slug: string; name: string } | null; category: { slug: string; name: string } | null;
};
type ListResult = { total: number; page: number; pageSize: number; reviewCounts: Partial<Record<Review, number>>; games: Row[] };

export default async function GamesAdminPage({ searchParams }: { searchParams: Promise<{ product?: string; review?: string; page?: string }> }) {
  const { base, can } = await adminContext();
  if (!can('games.read_all')) return <p className="form-error">Không có quyền xem nội dung.</p>;
  const sp = await searchParams;
  const filters: Record<string, string> = {};
  if (sp.product === 'english' || sp.product === 'vietnamese') filters.product = sp.product;
  if (sp.review && sp.review in REVIEW_LABEL) filters.review = sp.review;
  const qs = new URLSearchParams({ ...filters, ...(sp.page ? { page: sp.page } : {}) });
  const res = await apiGet<ListResult>(`/admin/games?${qs}`);
  if (!res.ok) return <p className="form-error">Không tải được danh sách (mã {res.status}).</p>;
  const { games, total, page, pageSize, reviewCounts } = res.data;
  const link = (patch: Record<string, string | undefined>) => {
    const next = { ...filters, ...patch };
    return `?${new URLSearchParams(Object.entries(next).filter((kv): kv is [string, string] => !!kv[1]))}`;
  };
  return (
    <>
      <h1>Nội dung game <small>({total})</small></h1>
      <p className="muted">Mỗi phiên bản nội dung mới cần giáo viên duyệt. Game chưa duyệt vẫn chơi được nhưng hiện ghi chú “chờ giáo viên duyệt”.</p>
      <div className="admin-filters" data-testid="content-filters">
        <Link className={!filters.product ? 'active' : ''} href={link({ product: undefined })}>Tất cả</Link>
        <Link className={filters.product === 'english' ? 'active' : ''} href={link({ product: 'english' })}>English</Link>
        <Link className={filters.product === 'vietnamese' ? 'active' : ''} href={link({ product: 'vietnamese' })}>Tiếng Việt</Link>
        <span className="sep" />
        <Link className={!filters.review ? 'active' : ''} href={link({ review: undefined })}>Mọi trạng thái</Link>
        {(Object.keys(REVIEW_LABEL) as Review[]).map((r) => (
          <Link key={r} className={filters.review === r ? 'active' : ''} href={link({ review: r })}>{REVIEW_LABEL[r]} ({reviewCounts[r] ?? 0})</Link>
        ))}
      </div>
      <table className="admin-table" data-testid="content-table">
        <thead><tr><th>Game</th><th>Sản phẩm</th><th>Cấp độ</th><th>Template</th><th>Phiên bản</th><th>Duyệt</th><th>Xuất bản</th></tr></thead>
        <tbody>
          {games.map((g) => (
            <tr key={g.id} data-slug={g.slug}>
              <td><Link href={`${base}/games/${g.id}`}>{g.title}</Link></td>
              <td>{g.product.name}</td>
              <td>{g.level?.name ?? '—'}</td>
              <td><code>{g.templateKey}</code></td>
              <td>{g.version ?? '—'}</td>
              <td><span className={`review-tag ${g.reviewStatus.toLowerCase()}`}>{REVIEW_LABEL[g.reviewStatus]}</span></td>
              <td>{g.isPublished ? '✓' : '—'}{g.accessLevel === 'PREMIUM' ? ' · Premium' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pager">
        {page > 1 && <Link href={link({ page: String(page - 1) })}>← Trước</Link>}
        <span>Trang {page} / {Math.max(1, Math.ceil(total / pageSize))}</span>
        {page * pageSize < total && <Link href={link({ page: String(page + 1) })}>Sau →</Link>}
      </div>
    </>
  );
}
