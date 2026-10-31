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
    const [users, verified, locked, newUsers7d, activeSessions, products] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
      this.prisma.user.count({ where: { isActive: false } }),
      this.prisma.user.count({ where: { createdAt: { gte: since } } }),
      this.prisma.userSession.count({ where: { revokedAt: null, expiresAt: { gt: now } } }),
      this.prisma.product.findMany({
        select: { slug: true, name: true, _count: { select: { games: { where: { isPublished: true } } } } },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      users: { total: users, verified, locked, new7d: newUsers7d },
      activeSessions,
      products: products.map((p) => ({ slug: p.slug, name: p.name, publishedGames: p._count.games })),
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
