import { Controller, ForbiddenException, Get, NotFoundException, Param, UnauthorizedException } from '@nestjs/common';
import { CurrentAuth } from '../common/decorators';
import type { AuthContext } from '../common/request';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from './access.service';

const SLUG = /^[a-z0-9-]{1,80}$/;

const gameSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  templateKey: true,
  gradeLevel: true,
  difficulty: true,
  accessLevel: true,
  thumbnail: true,
  sortOrder: true,
  category: { select: { slug: true, name: true } },
} as const;

@Controller('catalog')
export class CatalogController {
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
    return { ...game, access: this.access.canPlay(auth, game) };
  }

  /** Nội dung để chơi: chỉ trả về khi backend cho phép. */
  @Get('products/:slug/games/:gameSlug/play')
  async play(@Param('slug') slug: string, @Param('gameSlug') gameSlug: string, @CurrentAuth() auth: AuthContext | null) {
    const game = await this.findGame(slug, gameSlug);
    const decision = this.access.canPlay(auth, game);
    if (!decision.allowed) {
      if (decision.reason === 'login_required') throw new UnauthorizedException({ error: decision.reason });
      throw new ForbiddenException({ error: decision.reason });
    }
    const version = await this.prisma.gameVersion.findFirst({
      where: { gameId: game.id, isPublished: true },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true, content: true },
    });
    if (!version) throw new NotFoundException({ error: 'no_published_version' });
    return { game: { slug: game.slug, title: game.title, templateKey: game.templateKey }, version: version.versionNumber, content: version.content };
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
