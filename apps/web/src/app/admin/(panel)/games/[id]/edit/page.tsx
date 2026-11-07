import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { TemplateKey } from '@happyclass/game-core/templates';
import { GameBuilder, type BuilderVersion } from '@/components/builder/game-builder';
import { DuplicateGameForm, GameMetaForm, type BuilderOptions } from '@/components/builder/game-forms';
import { adminContext } from '@/lib/admin-context';
import { REVIEW_LABEL, type ReviewStatus } from '@/lib/review';
import { apiGet } from '@/lib/server-api';

type Detail = {
  id: string; slug: string; title: string; summary: string; templateKey: TemplateKey; isPublished: boolean; accessLevel: 'FREE' | 'PREMIUM';
  difficulty: string | null; reviewStatus: ReviewStatus; managedBySeed: boolean;
  product: { slug: 'english' | 'vietnamese'; name: string }; level: { slug: string; name: string } | null; category: { slug: string; name: string } | null;
  version: { versionNumber: number } | null; latestVersion: number | null;
};

export default async function EditGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { base, can } = await adminContext();
  if (!can('games.read_all')) return <p className="form-error">Không có quyền xem nội dung.</p>;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [detail, versions, options] = await Promise.all([
    apiGet<Detail>(`/admin/games/${id}`),
    apiGet<{ versions: BuilderVersion[] }>(`/admin/games/${id}/versions`),
    apiGet<BuilderOptions>('/admin/builder/options'),
  ]);
  if (!detail.ok || !versions.ok || !options.ok) notFound();
  const g = detail.data;
  const latest = g.latestVersion ?? 1;
  const current = await apiGet<{ versionNumber: number; content: unknown }>(`/admin/games/${id}/versions/${latest}`);
  if (!current.ok) notFound();
  const product = options.data.products.find((p) => p.slug === g.product.slug);
  const canEdit = can('games.edit');

  return (
    <>
      <Link href={`${base}/games/${g.id}`} className="back-link">← {g.title}</Link>
      <h1>Soạn game: {g.title}</h1>
      <p className="muted">
        {g.product.name} · <code>{g.templateKey}</code> · phiên bản đang phát hành: {g.version?.versionNumber ?? 'chưa có'} ·
        duyệt: <span className={`review-tag ${g.reviewStatus.toLowerCase()}`}>{REVIEW_LABEL[g.reviewStatus]}</span>
        {g.managedBySeed && ' · nội dung nạp sẵn: lưu lần đầu sẽ chuyển game sang do người soạn quản lý'}
      </p>
      <GameBuilder
        game={{ id: g.id, slug: g.slug, title: g.title, templateKey: g.templateKey, product: g.product.slug, publishedVersion: g.version?.versionNumber ?? null, isPublished: g.isPublished }}
        initial={{ versionNumber: current.data.versionNumber, content: current.data.content }}
        versions={versions.data.versions}
        can={{ edit: canEdit, publish: can('games.publish'), upload: can('media.upload') }}
      />
      <div className="builder-bottom">
        <GameMetaForm
          game={{ id: g.id, title: g.title, summary: g.summary, accessLevel: g.accessLevel, difficulty: g.difficulty, isPublished: g.isPublished,
            level: g.level?.slug ?? null, category: g.category?.slug ?? null, hasPublishedVersion: !!g.version }}
          levels={product?.levels ?? []} categories={product?.categories ?? []}
          can={{ edit: canEdit, publish: can('games.publish') }}
        />
        {canEdit && <DuplicateGameForm gameId={g.id} title={g.title} base={base} />}
      </div>
    </>
  );
}
