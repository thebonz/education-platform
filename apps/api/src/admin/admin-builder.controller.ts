import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Param,
  ParseIntPipe, ParseUUIDPipe, Patch, Post, Req,
} from '@nestjs/common';
import { starterContent, TEMPLATE_KEYS, TEMPLATES, validateGameData, type TemplateKey } from '@happyclass/game-core';
import { AccessLevel, Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { CurrentAuth, RequirePermissions } from '../common/decorators';
import type { AppRequest, AuthContext } from '../common/request';
import { clientInfo } from '../common/request';
import { parse, text } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug chỉ gồm a-z, 0-9 và dấu gạch ngang').max(60);
const taxSlug = z.string().regex(/^[a-z0-9-]{1,40}$/);
const difficulty = z.enum(['easy', 'medium', 'hard']);

const createBody = z.object({
  product: z.enum(['english', 'vietnamese']),
  slug,
  title: text(1, 120),
  summary: text(1, 300),
  templateKey: z.enum(TEMPLATE_KEYS as [TemplateKey, ...TemplateKey[]]),
  level: taxSlug.nullish(),
  category: taxSlug.nullish(),
  accessLevel: z.nativeEnum(AccessLevel).default(AccessLevel.FREE),
  difficulty: difficulty.nullish(),
  content: z.unknown().optional(),
}).strict();

const patchBody = z.object({
  title: text(1, 120).optional(),
  summary: text(1, 300).optional(),
  level: taxSlug.nullable().optional(),
  category: taxSlug.nullable().optional(),
  accessLevel: z.nativeEnum(AccessLevel).optional(),
  difficulty: difficulty.nullable().optional(),
  sortOrder: z.number().int().min(0).max(100_000).optional(),
  isPublished: z.boolean().optional(),
}).strict();

const versionBody = z.object({ content: z.unknown(), note: text(0, 200).optional() }).strict();
const duplicateBody = z.object({ slug, title: text(1, 120) }).strict();

type Tx = Prisma.TransactionClient;

/**
 * Game Builder: tạo game, sửa thông tin, lưu phiên bản nháp, phát hành phiên bản, nhân bản.
 * Mọi thay đổi của người soạn đặt managedBySeed = false để seed sau này không ghi đè.
 */
@Controller('admin')
export class AdminBuilderController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private invalid(issues: { path: string; message: string }[]) {
    return new BadRequestException({ error: 'invalid_content', issues: issues.slice(0, 100) });
  }

  private async product(slugValue: string) {
    const p = await this.prisma.product.findUnique({ where: { slug: slugValue }, select: { id: true, slug: true, locale: true } });
    if (!p) throw new BadRequestException({ error: 'product_not_found' });
    return p;
  }

  private async taxonomy(productId: string, level: string | null | undefined, category: string | null | undefined) {
    const out: { levelId?: string | null; gradeLevel?: string | null; categoryId?: string | null } = {};
    if (level !== undefined) {
      if (level === null) Object.assign(out, { levelId: null, gradeLevel: null });
      else {
        const row = await this.prisma.level.findUnique({ where: { productId_slug: { productId, slug: level } } });
        if (!row) throw new BadRequestException({ error: 'level_not_found', fields: ['level'] });
        Object.assign(out, { levelId: row.id, gradeLevel: row.name });
      }
    }
    if (category !== undefined) {
      if (category === null) out.categoryId = null;
      else {
        const row = await this.prisma.gameCategory.findUnique({ where: { productId_slug: { productId, slug: category } } });
        if (!row) throw new BadRequestException({ error: 'category_not_found', fields: ['category'] });
        out.categoryId = row.id;
      }
    }
    return out;
  }

  private assertTemplateFits(templateKey: TemplateKey, locale: string) {
    if (!(TEMPLATES[templateKey].languages as readonly string[]).includes(locale)) {
      throw new BadRequestException({ error: 'template_not_for_product', fields: ['templateKey'] });
    }
  }

  private async nextSortOrder(tx: Tx, productId: string) {
    const max = await tx.game.aggregate({ where: { productId }, _max: { sortOrder: true } });
    return (max._max.sortOrder ?? 0) + 1;
  }

  private async loadGame(id: string) {
    const game = await this.prisma.game.findUnique({
      where: { id },
      include: { product: { select: { slug: true, locale: true } }, versions: { orderBy: { versionNumber: 'desc' }, take: 1, select: { versionNumber: true } } },
    });
    if (!game) throw new NotFoundException();
    return game;
  }

  /** Sản phẩm, toàn bộ cấp độ/danh mục và template dùng được – cho form tạo/sửa game. */
  @Get('builder/options')
  @RequirePermissions('admin.access', 'games.read_all')
  async options() {
    const products = await this.prisma.product.findMany({
      orderBy: { slug: 'asc' },
      select: {
        slug: true, name: true, locale: true,
        levels: { select: { slug: true, name: true }, orderBy: { sortOrder: 'asc' } },
        categories: { select: { slug: true, name: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    return {
      products: products.map((p) => ({
        ...p,
        templates: TEMPLATE_KEYS.filter((k) => (TEMPLATES[k].languages as readonly string[]).includes(p.locale))
          .map((k) => ({ key: k, name: TEMPLATES[k].name.vi })),
      })),
    };
  }

  @Post('games')
  @HttpCode(201)
  @RequirePermissions('admin.access', 'games.edit')
  async create(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    const input = parse(createBody, body);
    const product = await this.product(input.product);
    this.assertTemplateFits(input.templateKey, product.locale);
    const raw = input.content === undefined ? starterContent(input.templateKey, product.locale as 'en' | 'vi') : input.content;
    const content = validateGameData(input.templateKey, raw);
    if (!content.ok) throw this.invalid(content.issues);
    const tax = await this.taxonomy(product.id, input.level ?? null, input.category ?? null);

    try {
      const game = await this.prisma.$transaction(async (tx) => {
        const row = await tx.game.create({
          data: {
            productId: product.id, slug: input.slug, title: input.title, summary: input.summary, templateKey: input.templateKey,
            accessLevel: input.accessLevel, difficulty: input.difficulty ?? null, ...tax,
            sortOrder: await this.nextSortOrder(tx, product.id), isPublished: false, managedBySeed: false, seedRevision: 0,
            versions: { create: { versionNumber: 1, content: content.data as Prisma.InputJsonValue, isPublished: false, createdById: auth.userId, note: 'Tạo mới' } },
          },
          select: { id: true, slug: true },
        });
        await this.audit.record({
          actorId: auth.userId, action: 'admin.game_created', entityType: 'game', entityId: row.id, ip: clientInfo(req).ip,
          metadata: { product: product.slug, slug: row.slug, templateKey: input.templateKey },
        }, tx);
        return row;
      });
      return { id: game.id, slug: game.slug, version: 1 };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ error: 'slug_taken', fields: ['slug'] });
      throw e;
    }
  }

  @Patch('games/:id')
  @RequirePermissions('admin.access', 'games.edit')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    const input = parse(patchBody, body);
    const game = await this.prisma.game.findUnique({ where: { id }, select: { id: true, productId: true, slug: true } });
    if (!game) throw new NotFoundException();
    if (input.isPublished !== undefined && !auth.permissions.includes('games.publish')) throw new ForbiddenException({ error: 'forbidden' });
    if (input.isPublished) {
      const published = await this.prisma.gameVersion.count({ where: { gameId: id, isPublished: true } });
      if (!published) throw new BadRequestException({ error: 'no_published_version' });
    }
    const { level, category, ...rest } = input;
    const tax = await this.taxonomy(game.productId, level, category);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.game.update({
        where: { id },
        data: { ...rest, ...tax, managedBySeed: false },
        select: { id: true, slug: true, title: true, summary: true, accessLevel: true, difficulty: true, isPublished: true, sortOrder: true, levelId: true, categoryId: true },
      });
      await this.audit.record({
        actorId: auth.userId, action: 'admin.game_updated', entityType: 'game', entityId: id, ip: clientInfo(req).ip,
        metadata: { slug: game.slug, fields: Object.keys(input) },
      }, tx);
      return row;
    });
    return updated;
  }

  @Get('games/:id/versions')
  @RequirePermissions('admin.access', 'games.read_all')
  async versions(@Param('id', ParseUUIDPipe) id: string) {
    await this.loadGame(id);
    const rows = await this.prisma.gameVersion.findMany({
      where: { gameId: id }, orderBy: { versionNumber: 'desc' }, take: 100,
      select: { versionNumber: true, isPublished: true, createdAt: true, note: true, createdById: true },
    });
    const ids = [...new Set(rows.map((r) => r.createdById).filter((x): x is string => !!x))];
    const users = new Map((await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true } })).map((u) => [u.id, u.displayName]));
    return { versions: rows.map(({ createdById, ...r }) => ({ ...r, createdBy: createdById ? users.get(createdById) ?? null : null })) };
  }

  @Get('games/:id/versions/:n')
  @RequirePermissions('admin.access', 'games.read_all')
  async version(@Param('id', ParseUUIDPipe) id: string, @Param('n', ParseIntPipe) n: number) {
    const row = await this.prisma.gameVersion.findUnique({ where: { gameId_versionNumber: { gameId: id, versionNumber: n } } });
    if (!row) throw new NotFoundException();
    return { versionNumber: row.versionNumber, isPublished: row.isPublished, createdAt: row.createdAt, note: row.note, content: row.content };
  }

  /** Lưu nội dung thành phiên bản nháp mới (chưa phát hành). */
  @Post('games/:id/versions')
  @HttpCode(201)
  @RequirePermissions('admin.access', 'games.edit')
  async saveVersion(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    const input = parse(versionBody, body);
    const game = await this.loadGame(id);
    const content = validateGameData(game.templateKey, input.content);
    if (!content.ok) throw this.invalid(content.issues);
    const next = (game.versions[0]?.versionNumber ?? 0) + 1;
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.gameVersion.create({
          data: { gameId: id, versionNumber: next, content: content.data as Prisma.InputJsonValue, isPublished: false, createdById: auth.userId, note: input.note?.trim() || null },
        });
        await tx.game.update({ where: { id }, data: { managedBySeed: false } });
        await this.audit.record({
          actorId: auth.userId, action: 'admin.game_version_saved', entityType: 'game', entityId: id, ip: clientInfo(req).ip,
          metadata: { slug: game.slug, version: next },
        }, tx);
      });
    } catch (e) {
      // Hai người lưu cùng lúc: một người phải lưu lại.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ error: 'version_conflict' });
      throw e;
    }
    return { versionNumber: next, isPublished: false };
  }

  /** Phát hành một phiên bản: thay phiên bản đang chạy; nội dung đổi → chờ giáo viên duyệt lại. */
  @Post('games/:id/versions/:n/publish')
  @HttpCode(200)
  @RequirePermissions('admin.access', 'games.publish')
  async publish(@Param('id', ParseUUIDPipe) id: string, @Param('n', ParseIntPipe) n: number, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    const game = await this.loadGame(id);
    const target = await this.prisma.gameVersion.findUnique({ where: { gameId_versionNumber: { gameId: id, versionNumber: n } } });
    if (!target) throw new NotFoundException();
    // Phát hành lại bản lỗi thời có thể đã sai schema mới: kiểm tra lại trước khi đưa ra người chơi.
    const content = validateGameData(game.templateKey, target.content);
    if (!content.ok) throw this.invalid(content.issues);
    if (target.isPublished) return { versionNumber: n, isPublished: true, changed: false };
    await this.prisma.$transaction(async (tx) => {
      await tx.gameVersion.updateMany({ where: { gameId: id, isPublished: true }, data: { isPublished: false } });
      await tx.gameVersion.update({ where: { id: target.id }, data: { isPublished: true } });
      await tx.game.update({
        where: { id },
        data: { managedBySeed: false, reviewStatus: 'PENDING', reviewedAt: null, reviewedById: null, reviewNote: null },
      });
      await this.audit.record({
        actorId: auth.userId, action: 'admin.game_version_published', entityType: 'game', entityId: id, ip: clientInfo(req).ip,
        metadata: { slug: game.slug, version: n },
      }, tx);
    });
    return { versionNumber: n, isPublished: true, changed: true };
  }

  /** Nhân bản thành game mới (chưa xuất bản) trong cùng sản phẩm, từ phiên bản đang phát hành hoặc bản mới nhất. */
  @Post('games/:id/duplicate')
  @HttpCode(201)
  @RequirePermissions('admin.access', 'games.edit')
  async duplicate(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    const input = parse(duplicateBody, body);
    const source = await this.prisma.game.findUnique({
      where: { id },
      include: { versions: { orderBy: [{ isPublished: 'desc' }, { versionNumber: 'desc' }], take: 1 } },
    });
    if (!source) throw new NotFoundException();
    const from = source.versions[0];
    if (!from) throw new BadRequestException({ error: 'no_version' });
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.game.create({
          data: {
            productId: source.productId, slug: input.slug, title: input.title, summary: source.summary, templateKey: source.templateKey,
            accessLevel: source.accessLevel, difficulty: source.difficulty, levelId: source.levelId, gradeLevel: source.gradeLevel,
            categoryId: source.categoryId, thumbnail: source.thumbnail, sortOrder: await this.nextSortOrder(tx, source.productId),
            isPublished: false, managedBySeed: false, seedRevision: 0,
            versions: { create: { versionNumber: 1, content: from.content as Prisma.InputJsonValue, isPublished: false, createdById: auth.userId, note: `Nhân bản từ ${source.slug} (phiên bản ${from.versionNumber})` } },
          },
          select: { id: true, slug: true },
        });
        await this.audit.record({
          actorId: auth.userId, action: 'admin.game_duplicated', entityType: 'game', entityId: created.id, ip: clientInfo(req).ip,
          metadata: { from: source.slug, fromVersion: from.versionNumber, slug: created.slug },
        }, tx);
        return created;
      });
      return { id: row.id, slug: row.slug, version: 1 };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException({ error: 'slug_taken', fields: ['slug'] });
      throw e;
    }
  }
}
