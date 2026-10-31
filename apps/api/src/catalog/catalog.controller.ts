import {
  Body, Controller, ForbiddenException, Get, HttpCode, InternalServerErrorException, Logger, NotFoundException, Param, Post, UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { validateGameData } from '@happyclass/game-core';
import { z } from 'zod';
import { CurrentAuth, RequireAuth } from '../common/decorators';
import type { AuthContext } from '../common/request';
import { parse } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';
import { AccessDecision, AccessService } from './access.service';

const SLUG = /^[a-z0-9-]{1,80}$/;

const gameSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  templateKey: true,
  difficulty: true,
  accessLevel: true,
  thumbnail: true,
  sortOrder: true,
  category: { select: { slug: true, name: true } },
  level: { select: { slug: true, name: true, sortOrder: true } },
} as const;

const sessionSchema = z.object({
  score: z.number().int().min(0).max(10_000),
  maxScore: z.number().int().min(0).max(10_000),
  mistakes: z.number().int().min(0).max(10_000).default(0),
  stars: z.number().int().min(1).max(3),
  durationMs: z.number().int().min(0).max(6 * 3_600_000),
}).refine((s) => s.score <= s.maxScore, { path: ['score'], message: 'score vượt quá maxScore' });

@Controller('catalog')
export class CatalogController {
  private readonly logger = new Logger(CatalogController.name);
  constructor(private readonly prisma: PrismaService, private readonly access: AccessService) {}

  @Get('products')
  products() {
    return this.prisma.product.findMany({
      where: { isActive: true },
      select: { slug: true, name: true, description: true, locale: true, theme: true },
      orderBy: { name: 'asc' },
    });
  }

  @Get('products/:slug')
  async product(@Param('slug') slug: string) {
    const product = SLUG.test(slug)
      ? await this.prisma.product.findFirst({
          where: { slug, isActive: true },
          select: { slug: true, name: true, description: true, locale: true, theme: true },
        })
      : null;
    if (!product) throw new NotFoundException({ error: 'product_not_found' });
    return product;
  }

  /** Danh mục và cấp độ có ít nhất một game đã xuất bản, kèm số lượng – dùng cho bộ lọc thư viện. */
  @Get('products/:slug/taxonomy')
  async taxonomy(@Param('slug') slug: string) {
    const product = await this.findProduct(slug);
    const published = { where: { isPublished: true } } as const;
    const [categories, levels] = await Promise.all([
      this.prisma.gameCategory.findMany({ where: { productId: product.id }, select: { slug: true, name: true, sortOrder: true, _count: { select: { games: published } } }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.level.findMany({ where: { productId: product.id }, select: { slug: true, name: true, sortOrder: true, _count: { select: { games: published } } }, orderBy: { sortOrder: 'asc' } }),
    ]);
    const shape = (rows: typeof categories) => rows.filter((r) => r._count.games > 0).map((r) => ({ slug: r.slug, name: r.name, games: r._count.games }));
    return { categories: shape(categories), levels: shape(levels) };
  }

  /** Danh sách game: chỉ metadata, KHÔNG kèm nội dung (câu hỏi, đáp án). */
  @Get('products/:slug/games')
  async games(@Param('slug') slug: string, @CurrentAuth() auth: AuthContext | null) {
    const product = await this.findProduct(slug);
    const games = await this.prisma.game.findMany({
      where: { productId: product.id, isPublished: true },
      select: gameSelect,
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
    return games.map((g) => ({ ...g, access: this.access.canPlay(auth, g) }));
  }

  @Get('products/:slug/games/:gameSlug')
  async game(@Param('slug') slug: string, @Param('gameSlug') gameSlug: string, @CurrentAuth() auth: AuthContext | null) {
    const game = await this.findGame(slug, gameSlug);
    const favorite = auth
      ? !!(await this.prisma.gameFavorite.findUnique({ where: { userId_gameId: { userId: auth.userId, gameId: game.id } } }))
      : false;
    return { ...game, access: this.access.canPlay(auth, game), favorite };
  }

  /** Nội dung để chơi: chỉ trả về khi backend cho phép, đã kiểm tra theo schema của template. */
  @Get('products/:slug/games/:gameSlug/play')
  async play(@Param('slug') slug: string, @Param('gameSlug') gameSlug: string, @CurrentAuth() auth: AuthContext | null) {
    const game = await this.findGame(slug, gameSlug);
    this.assertAllowed(this.access.canPlay(auth, game));
    const version = await this.prisma.gameVersion.findFirst({
      where: { gameId: game.id, isPublished: true },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true, content: true },
    });
    if (!version) throw new NotFoundException({ error: 'no_published_version' });
    const checked = validateGameData(game.templateKey, version.content);
    if (!checked.ok) {
      this.logger.error(`Nội dung game ${slug}/${gameSlug} v${version.versionNumber} không hợp lệ: ${checked.issues.map((i) => i.path).join(', ')}`);
      throw new InternalServerErrorException({ error: 'invalid_game_content' });
    }
    return { game: { id: game.id, slug: game.slug, title: game.title, templateKey: game.templateKey }, version: version.versionNumber, data: checked.data };
  }

  /** Lưu kết quả một lần chơi (chỉ người đã đăng nhập). */
  @Post('products/:slug/games/:gameSlug/sessions')
  @HttpCode(201)
  @RequireAuth()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async saveSession(@Param('slug') slug: string, @Param('gameSlug') gameSlug: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext) {
    const input = parse(sessionSchema, body);
    const game = await this.findGame(slug, gameSlug);
    this.assertAllowed(this.access.canPlay(auth, game));
    const row = await this.prisma.gameSession.create({
      data: { userId: auth.userId, gameId: game.id, score: input.score, maxScore: input.maxScore, mistakes: input.mistakes, stars: input.stars, durationMs: input.durationMs },
      select: { id: true, createdAt: true },
    });
    return row;
  }

  private assertAllowed(decision: AccessDecision) {
    if (decision.allowed) return;
    if (decision.reason === 'login_required') throw new UnauthorizedException({ error: decision.reason });
    throw new ForbiddenException({ error: decision.reason });
  }

  private async findProduct(slug: string) {
    const product = SLUG.test(slug) ? await this.prisma.product.findFirst({ where: { slug, isActive: true }, select: { id: true } }) : null;
    if (!product) throw new NotFoundException({ error: 'product_not_found' });
    return product;
  }

  private async findGame(slug: string, gameSlug: string) {
    const product = await this.findProduct(slug);
    const game = SLUG.test(gameSlug)
      ? await this.prisma.game.findFirst({ where: { productId: product.id, slug: gameSlug, isPublished: true }, select: gameSelect })
      : null;
    if (!game) throw new NotFoundException({ error: 'game_not_found' });
    return game;
  }
}
