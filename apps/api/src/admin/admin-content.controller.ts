import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { Prisma, ReviewStatus } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { CurrentAuth, RequirePermissions } from '../common/decorators';
import type { AppRequest, AuthContext } from '../common/request';
import { clientInfo } from '../common/request';
import { parse, text } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

const listQuery = z.object({
  product: z.enum(['english', 'vietnamese']).optional(),
  review: z.nativeEnum(ReviewStatus).optional(),
  level: z.string().regex(/^[a-z0-9-]{1,40}$/).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

const reviewBody = z
  .object({
    status: z.enum([ReviewStatus.APPROVED, ReviewStatus.CHANGES_REQUESTED]),
    note: text(0, 1000).optional(),
  })
  .strict()
  .refine((b) => b.status !== ReviewStatus.CHANGES_REQUESTED || (b.note?.trim().length ?? 0) > 0, {
    path: ['note'], message: 'Cần ghi chú nội dung cần sửa',
  });

/** Quản lý nội dung (giai đoạn 4: xem và duyệt; Game Builder ở giai đoạn 5). */
@Controller('admin/games')
export class AdminContentController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions('admin.access', 'games.read_all')
  async list(@Query() query: unknown) {
    const { page, pageSize, ...f } = parse(listQuery, query);
    const where: Prisma.GameWhereInput = {
      ...(f.product ? { product: { slug: f.product } } : {}),
      ...(f.review ? { reviewStatus: f.review } : {}),
      ...(f.level ? { level: { slug: f.level } } : {}),
    };
    const [total, games, counts] = await this.prisma.$transaction([
      this.prisma.game.count({ where }),
      this.prisma.game.findMany({
        where,
        select: {
          id: true, slug: true, title: true, templateKey: true, accessLevel: true, isPublished: true, reviewStatus: true, reviewedAt: true,
          product: { select: { slug: true, name: true } },
          level: { select: { slug: true, name: true, sortOrder: true } },
          category: { select: { slug: true, name: true } },
          versions: { where: { isPublished: true }, select: { versionNumber: true }, take: 1 },
        },
        orderBy: [{ product: { slug: 'asc' } }, { level: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.game.groupBy({ by: ['reviewStatus'], where: f.product ? { product: { slug: f.product } } : {}, _count: { _all: true }, orderBy: { reviewStatus: 'asc' } }),
    ]);
    return {
      total, page, pageSize,
      reviewCounts: Object.fromEntries(counts.map((c) => [c.reviewStatus, (c._count as { _all: number })._all])),
      games: games.map(({ versions, ...g }) => ({ ...g, version: versions[0]?.versionNumber ?? null })),
    };
  }

  /** Chi tiết + nội dung phiên bản đang phát hành, để giáo viên đọc soát. */
  @Get(':id')
  @RequirePermissions('admin.access', 'games.read_all')
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    const game = await this.prisma.game.findUnique({
      where: { id },
      include: {
        product: { select: { slug: true, name: true } },
        level: { select: { slug: true, name: true } },
        category: { select: { slug: true, name: true } },
        versions: { where: { isPublished: true }, select: { versionNumber: true, content: true, createdAt: true }, take: 1 },
      },
    });
    if (!game) throw new NotFoundException();
    const reviewer = game.reviewedById
      ? await this.prisma.user.findUnique({ where: { id: game.reviewedById }, select: { id: true, displayName: true, email: true } })
      : null;
    const { versions, ...rest } = game;
    return { ...rest, reviewer, version: versions[0] ?? null };
  }

  @Post(':id/review')
  @HttpCode(200)
  @RequirePermissions('admin.access', 'games.review')
  async review(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    const input = parse(reviewBody, body);
    const game = await this.prisma.game.findUnique({
      where: { id },
      select: { id: true, slug: true, versions: { where: { isPublished: true }, select: { versionNumber: true }, take: 1 } },
    });
    if (!game) throw new NotFoundException();
    const version = game.versions[0]?.versionNumber;
    if (!version) throw new BadRequestException({ error: 'no_published_version' });
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.game.update({
        where: { id },
        data: { reviewStatus: input.status, reviewedAt: new Date(), reviewedById: auth.userId, reviewNote: input.note?.trim() || null },
        select: { id: true, reviewStatus: true, reviewedAt: true, reviewNote: true },
      });
      await this.audit.record({
        actorId: auth.userId, action: 'admin.game_reviewed', entityType: 'game', entityId: id, ip: clientInfo(req).ip,
        metadata: { slug: game.slug, version, status: input.status },
      }, tx);
      return row;
    });
    return updated;
  }
}
