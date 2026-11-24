import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { CurrentAuth, RequirePermissions } from '../common/decorators';
import type { AppRequest, AuthContext } from '../common/request';
import { clientInfo } from '../common/request';
import { parse, text } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const productPatch = z
  .object({
    name: text(1, 80).optional(),
    description: text(0, 500).optional(),
    isActive: z.boolean().optional(),
    theme: z.object({ accent: hexColor, accentSoft: hexColor, background: hexColor }).optional(),
  })
  .strict();
const domainSchema = z.object({
  hostname: z
    .string()
    .transform((s) => s.trim().toLowerCase())
    .pipe(z.string().max(253).regex(/^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/)),
  isPrimary: z.boolean().default(false),
});
const learningAnalyticsQuery = z.object({
  days: z.coerce.number().int().refine((n) => [7, 30, 90].includes(n), 'days phải là 7, 30 hoặc 90').default(30),
  product: z.enum(['english', 'vietnamese']).optional(),
});
const auditQuery = z.object({
  entityType: z.string().max(40).optional(),
  entityId: z.string().max(80).optional(),
  actorId: z.string().uuid().optional(),
  action: z.string().max(80).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

@Controller('admin')
export class AdminSystemController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Get('stats')
  @RequirePermissions('admin.access', 'stats.read')
  async stats() {
    const now = new Date();
    const since = new Date(now.getTime() - 7 * 86_400_000);
    const [users, verified, locked, newUsers7d, activeSessions, plays7d, activeTeachers, activeClasses, activeStudents, classPlays7d, products] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
      this.prisma.user.count({ where: { isActive: false } }),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.userSession.count({ where: { revokedAt: null, expiresAt: { gt: now } } }),
      this.prisma.gameSession.count({ where: { createdAt: { gte: since } } }),
      this.prisma.user.count({
        where: {
          isActive: true,
          deletedAt: null,
          roles: { some: { role: { key: { in: ['teacher', 'school_admin'] } } } },
        },
      }),
      this.prisma.classroom.count({ where: { isArchived: false } }),
      this.prisma.classStudent.count({ where: { isActive: true, classroom: { isArchived: false } } }),
      this.prisma.classPlay.count({
        where: { createdAt: { gte: since }, classGame: { classroom: { isArchived: false } } },
      }),
      this.prisma.product.findMany({
        select: { slug: true, name: true, _count: { select: { games: { where: { isPublished: true } } } } },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      users: { total: users, verified, locked, new7d: newUsers7d },
      activeSessions,
      plays7d,
      education: { activeTeachers, activeClasses, activeStudents, classPlays7d },
      products: products.map((p) => ({ slug: p.slug, name: p.name, publishedGames: p._count.games })),
      generatedAt: now.toISOString(),
    };
  }

  /** Báo cáo học tập tổng hợp; tuyệt đối không trả dữ liệu định danh học sinh. */
  @Get('learning-analytics')
  @RequirePermissions('admin.access', 'stats.read')
  async learningAnalytics(@Query() query: unknown) {
    const { days, product } = parse(learningAnalyticsQuery, query);
    const now = new Date();
    const since = new Date(now.getTime() - days * 86_400_000);
    const productClause = product ? Prisma.sql`AND p.slug = ${product}` : Prisma.empty;
    const playWhere: Prisma.ClassPlayWhereInput = {
      createdAt: { gte: since },
      classGame: {
        classroom: {
          isArchived: false,
          ...(product ? { product: { slug: product } } : {}),
        },
      },
    };

    const [productRows, trendRows, topGroups] = await Promise.all([
      this.prisma.$queryRaw<Array<{
        productSlug: string; plays: number; activeClasses: number; activeStudents: number;
        scoreTotal: number; maxScoreTotal: number; totalMistakes: number; starsTotal: number; durationTotal: number;
      }>>(Prisma.sql`
        SELECT
          p.slug AS "productSlug",
          COUNT(*)::int AS plays,
          COUNT(DISTINCT c.id)::int AS "activeClasses",
          COUNT(DISTINCT cp.student_id)::int AS "activeStudents",
          COALESCE(SUM(cp.score), 0)::float8 AS "scoreTotal",
          COALESCE(SUM(cp.max_score), 0)::float8 AS "maxScoreTotal",
          COALESCE(SUM(cp.mistakes), 0)::int AS "totalMistakes",
          COALESCE(SUM(cp.stars), 0)::float8 AS "starsTotal",
          COALESCE(SUM(cp.duration_ms), 0)::float8 AS "durationTotal"
        FROM class_plays cp
        JOIN class_games cg ON cg.id = cp.class_game_id
        JOIN classrooms c ON c.id = cg.classroom_id
        JOIN products p ON p.id = c.product_id
        WHERE cp.created_at >= ${since}
          AND c.is_archived = false
          ${productClause}
        GROUP BY p.slug
      `),
      this.prisma.$queryRaw<Array<{ day: string; productSlug: string; plays: number; activeClasses: number; activeStudents: number }>>(Prisma.sql`
        SELECT
          to_char(date_trunc('day', cp.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM-DD') AS day,
          p.slug AS "productSlug",
          COUNT(*)::int AS plays,
          COUNT(DISTINCT c.id)::int AS "activeClasses",
          COUNT(DISTINCT cp.student_id)::int AS "activeStudents"
        FROM class_plays cp
        JOIN class_games cg ON cg.id = cp.class_game_id
        JOIN classrooms c ON c.id = cg.classroom_id
        JOIN products p ON p.id = c.product_id
        WHERE cp.created_at >= ${since}
          AND c.is_archived = false
          ${productClause}
        GROUP BY 1, 2
        ORDER BY 1 ASC, 2 ASC
      `),
      this.prisma.classPlay.groupBy({
        by: ['classGameId'],
        where: playWhere,
        _count: { _all: true },
        _avg: { stars: true },
        orderBy: { _count: { classGameId: 'desc' } },
        take: 10,
      }),
    ]);

    const topGameIds = topGroups.map((g) => g.classGameId);
    const topGameRows = topGameIds.length ? await this.prisma.classGame.findMany({
      where: { id: { in: topGameIds } },
      select: { id: true, title: true, classroom: { select: { product: { select: { slug: true, name: true } } } } },
    }) : [];
    const topGameById = new Map(topGameRows.map((g) => [g.id, g]));

    const byProduct = (['english', 'vietnamese'] as const).map((slug) => {
      const row = productRows.find((r) => r.productSlug === slug);
      const plays = row?.plays ?? 0;
      return {
        product: slug,
        plays,
        activeClasses: row?.activeClasses ?? 0,
        activeStudents: row?.activeStudents ?? 0,
        averageScorePercent: row && row.maxScoreTotal > 0 ? Number((row.scoreTotal / row.maxScoreTotal * 100).toFixed(1)) : 0,
        averageStars: plays ? Number((row!.starsTotal / plays).toFixed(2)) : 0,
        averageDurationMs: plays ? Math.round(row!.durationTotal / plays) : 0,
        totalMistakes: row?.totalMistakes ?? 0,
      };
    });
    const totals = productRows.reduce((acc, row) => ({
      plays: acc.plays + row.plays,
      activeClasses: acc.activeClasses + row.activeClasses,
      activeStudents: acc.activeStudents + row.activeStudents,
      scoreTotal: acc.scoreTotal + row.scoreTotal,
      maxScoreTotal: acc.maxScoreTotal + row.maxScoreTotal,
      starsTotal: acc.starsTotal + row.starsTotal,
      durationTotal: acc.durationTotal + row.durationTotal,
      totalMistakes: acc.totalMistakes + row.totalMistakes,
    }), { plays: 0, activeClasses: 0, activeStudents: 0, scoreTotal: 0, maxScoreTotal: 0, starsTotal: 0, durationTotal: 0, totalMistakes: 0 });

    const daysByDate = new Map<string, { plays: number; activeClasses: number; activeStudents: number }>();
    for (const row of trendRows) {
      const current = daysByDate.get(row.day) ?? { plays: 0, activeClasses: 0, activeStudents: 0 };
      current.plays += row.plays;
      current.activeClasses += row.activeClasses;
      current.activeStudents += row.activeStudents;
      daysByDate.set(row.day, current);
    }

    return {
      range: { days, from: since.toISOString(), to: now.toISOString(), product: product ?? 'all' },
      summary: {
        plays: totals.plays,
        activeClasses: totals.activeClasses,
        activeStudents: totals.activeStudents,
        averageScorePercent: totals.maxScoreTotal > 0 ? Number((totals.scoreTotal / totals.maxScoreTotal * 100).toFixed(1)) : 0,
        averageStars: totals.plays ? Number((totals.starsTotal / totals.plays).toFixed(2)) : 0,
        averageDurationMs: totals.plays ? Math.round(totals.durationTotal / totals.plays) : 0,
        totalMistakes: totals.totalMistakes,
      },
      byProduct,
      trend: [...daysByDate.entries()].map(([day, value]) => ({ day, ...value })),
      topGames: topGroups.map((g) => {
        const game = topGameById.get(g.classGameId);
        return game ? {
          title: game.title,
          product: game.classroom.product,
          plays: g._count._all,
          averageStars: g._avg.stars === null ? 0 : Number(g._avg.stars.toFixed(2)),
        } : null;
      }).filter((g): g is NonNullable<typeof g> => g !== null),
      generatedAt: now.toISOString(),
    };
  }

  @Get('products')
  @RequirePermissions('admin.access', 'products.read')
  products() {
    return this.prisma.product.findMany({
      include: { domains: { orderBy: { hostname: 'asc' } }, _count: { select: { games: true } } },
      orderBy: { name: 'asc' },
    });
  }

  @Patch('products/:id')
  @RequirePermissions('admin.access', 'products.update')
  async updateProduct(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    const patch = parse(productPatch, body);
    const before = await this.prisma.product.findUnique({ where: { id } });
    if (!before) throw new NotFoundException();
    const updated = await this.prisma.product.update({ where: { id }, data: patch });
    await this.audit.record({
      actorId: auth.userId, action: 'admin.product_updated', entityType: 'product', entityId: id, ip: clientInfo(req).ip,
      metadata: { fields: Object.keys(patch) },
    });
    return updated;
  }

  @Post('products/:id/domains')
  @RequirePermissions('admin.access', 'products.update')
  async addDomain(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    const input = parse(domainSchema, body);
    if (!(await this.prisma.product.findUnique({ where: { id }, select: { id: true } }))) throw new NotFoundException();
    try {
      const domain = await this.prisma.$transaction(async (tx) => {
        if (input.isPrimary) await tx.productDomain.updateMany({ where: { productId: id }, data: { isPrimary: false } });
        return tx.productDomain.create({ data: { productId: id, hostname: input.hostname, isPrimary: input.isPrimary } });
      });
      await this.audit.record({ actorId: auth.userId, action: 'admin.domain_added', entityType: 'product', entityId: id, ip: clientInfo(req).ip, metadata: { hostname: input.hostname } });
      return domain;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException({ error: 'hostname_taken' });
      throw error;
    }
  }

  @Delete('domains/:id')
  @HttpCode(204)
  @RequirePermissions('admin.access', 'products.update')
  async removeDomain(@Param('id', ParseUUIDPipe) id: string, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    const domain = await this.prisma.productDomain.findUnique({ where: { id } });
    if (!domain) throw new NotFoundException();
    await this.prisma.productDomain.delete({ where: { id } });
    await this.audit.record({ actorId: auth.userId, action: 'admin.domain_removed', entityType: 'product', entityId: domain.productId, ip: clientInfo(req).ip, metadata: { hostname: domain.hostname } });
  }

  @Get('audit-logs')
  @RequirePermissions('admin.access', 'audit.read')
  async auditLogs(@Query() query: unknown) {
    const { page, pageSize, ...filters } = parse(auditQuery, query);
    const where: Prisma.AuditLogWhereInput = {
      ...(filters.entityType ? { entityType: filters.entityType } : {}),
      ...(filters.entityId ? { entityId: filters.entityId } : {}),
      ...(filters.actorId ? { actorId: filters.actorId } : {}),
      ...(filters.action ? { action: { startsWith: filters.action } } : {}),
    };
    const [total, logs] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    const actorIds = [...new Set(logs.map((l) => l.actorId).filter((x): x is string => !!x))];
    const actors = await this.prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true } });
    const emailById = new Map(actors.map((a) => [a.id, a.email]));
    return { total, page, pageSize, logs: logs.map((l) => ({ ...l, actorEmail: l.actorId ? emailById.get(l.actorId) ?? null : null })) };
  }
}
