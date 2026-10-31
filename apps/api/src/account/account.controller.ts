import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Req } from '@nestjs/common';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../auth/session.service';
import { CurrentAuth, RequireAuth } from '../common/decorators';
import type { AppRequest, AuthContext } from '../common/request';
import { clientInfo } from '../common/request';
import { parse, text } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';

const profileSchema = z.object({ displayName: text(1, 80) });

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
}
