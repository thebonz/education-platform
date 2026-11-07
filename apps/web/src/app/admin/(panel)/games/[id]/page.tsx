import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ReviewActions } from '@/components/admin-actions';
import { adminContext } from '@/lib/admin-context';
import { REVIEW_LABEL, type ReviewStatus } from '@/lib/review';
import { apiGet } from '@/lib/server-api';
import { siteUrl } from '@/lib/sites';

type Detail = {
  id: string; slug: string; title: string; summary: string; templateKey: string; isPublished: boolean;
  reviewStatus: ReviewStatus; reviewedAt: string | null; reviewNote: string | null;
  reviewer: { displayName: string; email: string } | null;
  product: { slug: 'english' | 'vietnamese'; name: string }; level: { name: string } | null; category: { name: string } | null;
  version: { versionNumber: number; content: unknown; createdAt: string } | null;
};

export default async function GameAdminDetail({ params }: { params: Promise<{ id: string }> }) {
  const { base, can } = await adminContext();
  if (!can('games.read_all')) return <p className="form-error">Không có quyền xem nội dung.</p>;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const res = await apiGet<Detail>(`/admin/games/${id}`);
  if (!res.ok) notFound();
  const g = res.data;
  const site = siteUrl(g.product.slug);
  const playHref = `${site.origin}${site.pathname.replace(/\/$/, '')}/games/${g.slug}`;
  const fmt = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  return (
    <>
      <Link href={`${base}/games`} className="back-link">← Nội dung game</Link>
      <h1>{g.title}</h1>
      <p className="muted">{[g.product.name, g.level?.name, g.category?.name].filter(Boolean).join(' · ')} · <code>{g.templateKey}</code> · phiên bản {g.version?.versionNumber ?? '—'}</p>
      <p>{g.summary}</p>
      <div className="panel" data-testid="review-status">
        <h2>Trạng thái duyệt: <span className={`review-tag ${g.reviewStatus.toLowerCase()}`}>{REVIEW_LABEL[g.reviewStatus]}</span></h2>
        {g.reviewedAt && <p className="muted">Lần duyệt gần nhất: {fmt.format(new Date(g.reviewedAt))}{g.reviewer ? ` – ${g.reviewer.displayName}` : ''}</p>}
        {g.reviewNote && <p className="review-note-admin">Ghi chú: {g.reviewNote}</p>}
        <p><a className="secondary-button" href={playHref} target="_blank" rel="noreferrer">Chơi thử ↗</a></p>
      </div>
      {can('games.review') && g.version && <ReviewActions gameId={g.id} />}
      <div className="panel">
        <h2>Nội dung phiên bản đang phát hành</h2>
        <pre className="content-json" data-testid="content-json">{JSON.stringify(g.version?.content ?? null, null, 2)}</pre>
      </div>
    </>
  );
}
