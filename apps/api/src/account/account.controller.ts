import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Put, Req } from '@nestjs/common';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../auth/session.service';
import { CurrentAuth, RequireAuth } from '../common/decorators';
import type { AppRequest, AuthContext } from '../common/request';
import { clientInfo } from '../common/request';
import { parse, text } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

const profileSchema = z.object({ displayName: text(1, 80) });

const gameCardSelect = {
  id: true, slug: true, title: true, templateKey: true, accessLevel: true,
  product: { select: { slug: true } },
  level: { select: { name: true } },
  category: { select: { name: true } },
} as const;

@Controller('account')
@RequireAuth()
export class AccountController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  @Get('profile')
  async profile(@CurrentAuth() auth: AuthContext) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: auth.userId },
      select: { id: true, email: true, displayName: true, emailVerifiedAt: true, createdAt: true, lastLoginAt: true },
    });
    return { user, roles: auth.roles };
  }

  @Patch('profile')
  async updateProfile(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    const { displayName } = parse(profileSchema, body);
    await this.prisma.user.update({ where: { id: auth.userId }, data: { displayName } });
    await this.audit.record({ actorId: auth.userId, action: 'account.profile_updated', entityType: 'user', entityId: auth.userId, ip: clientInfo(req).ip });
    return { ok: true };
  }

  @Get('sessions')
  async listSessions(@CurrentAuth() auth: AuthContext) {
    const rows = await this.prisma.userSession.findMany({
      where: { userId: auth.userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, ipAddress: true, createdAt: true, lastSeenAt: true, expiresAt: true },
      orderBy: { lastSeenAt: 'desc' },
    });
    return { sessions: rows.map((s) => ({ ...s, current: s.id === auth.sessionId })) };
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  async revokeSession(@Param('id', ParseUUIDPipe) id: string, @CurrentAuth() auth: AuthContext) {
    const result = await this.prisma.userSession.updateMany({
      where: { id, userId: auth.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException();
  }

  /** Game yêu thích (chỉ game đang xuất bản). */
  @Get('favorites')
  async favorites(@CurrentAuth() auth: AuthContext) {
    const rows = await this.prisma.gameFavorite.findMany({
      where: { userId: auth.userId, game: { isPublished: true } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, game: { select: gameCardSelect } },
    });
    return { favorites: rows.map((r) => ({ ...r.game, product: r.game.product.slug, favoritedAt: r.createdAt })) };
  }

  @Put('favorites/:gameId')
  @HttpCode(204)
  async addFavorite(@Param('gameId', ParseUUIDPipe) gameId: string, @CurrentAuth() auth: AuthContext) {
    const game = await this.prisma.game.findFirst({ where: { id: gameId, isPublished: true }, select: { id: true } });
    if (!game) throw new NotFoundException();
    await this.prisma.gameFavorite.upsert({
      where: { userId_gameId: { userId: auth.userId, gameId } },
      update: {},
      create: { userId: auth.userId, gameId },
    });
  }

  @Delete('favorites/:gameId')
  @HttpCode(204)
  async removeFavorite(@Param('gameId', ParseUUIDPipe) gameId: string, @CurrentAuth() auth: AuthContext) {
    await this.prisma.gameFavorite.deleteMany({ where: { userId: auth.userId, gameId } });
  }

  /** Game đã chơi gần đây: mỗi game một dòng, kèm kết quả tốt nhất. */
  @Get('recent-games')
  async recentGames(@CurrentAuth() auth: AuthContext) {
    const sessions = await this.prisma.gameSession.findMany({
      where: { userId: auth.userId, game: { isPublished: true } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { gameId: true, stars: true, score: true, maxScore: true, createdAt: true, game: { select: gameCardSelect } },
    });
    const byGame = new Map<string, { game: (typeof sessions)[number]['game']; lastPlayedAt: Date; bestStars: number; plays: number; lastScore: number; lastMaxScore: number }>();
    for (const s of sessions) {
      const entry = byGame.get(s.gameId);
      if (!entry) {
        byGame.set(s.gameId, { game: s.game, lastPlayedAt: s.createdAt, bestStars: s.stars, plays: 1, lastScore: s.score, lastMaxScore: s.maxScore });
      } else {
        entry.plays++;
        entry.bestStars = Math.max(entry.bestStars, s.stars);
      }
    }
    return {
      games: [...byGame.values()].slice(0, 10).map(({ game, ...rest }) => ({ ...game, product: game.product.slug, ...rest })),
    };
  }
}
