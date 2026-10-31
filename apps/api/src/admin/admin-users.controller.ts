import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { SessionService } from '../auth/session.service';
import { CurrentAuth, RequirePermissions } from '../common/decorators';
import type { AppRequest, AuthContext } from '../common/request';
import { clientInfo } from '../common/request';
import { parse, text } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';
import { isRoleKey, ROLE_KEYS } from '../rbac/permissions';

const listSchema = z.object({
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
const lockSchema = z.object({ reason: text(3, 300) });
const rolesSchema = z.object({ roles: z.array(z.string()).max(ROLE_KEYS.length) });

@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @RequirePermissions('admin.access', 'users.read')
  async list(@Query() query: unknown) {
    const { q, page, pageSize } = parse(listSchema, query);
    const term = q?.normalize('NFC').trim();
    const where: Prisma.UserWhereInput = term
      ? { OR: [{ email: { contains: term, mode: 'insensitive' } }, { displayName: { contains: term, mode: 'insensitive' } }] }
      : {};
    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true, email: true, displayName: true, emailVerifiedAt: true, isActive: true, createdAt: true, lastLoginAt: true,
          roles: { select: { role: { select: { key: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      total, page, pageSize,
      users: users.map(({ roles, ...u }) => ({ ...u, roles: roles.map((r) => r.role.key) })),
    };
  }

  @Get(':id')
  @RequirePermissions('admin.access', 'users.read')
  async detail(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, displayName: true, emailVerifiedAt: true, isActive: true, lockedReason: true,
        createdAt: true, lastLoginAt: true,
        roles: { select: { role: { select: { key: true, name: true } } } },
        consents: { select: { kind: true, version: true, acceptedAt: true }, orderBy: { acceptedAt: 'desc' } },
      },
    });
    if (!user) throw new NotFoundException();
    const activeSessions = await this.prisma.userSession.count({ where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } } });
    return { ...user, roles: user.roles.map((r) => r.role), activeSessions };
  }

  @Post(':id/lock')
  @HttpCode(200)
  @RequirePermissions('admin.access', 'users.lock')
  async lock(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    const { reason } = parse(lockSchema, body);
    if (id === auth.userId) throw new BadRequestException({ error: 'cannot_lock_self' });
    const target = await this.requireUser(id);
    if (await this.isSuperAdmin(id) && !auth.roles.includes('super_admin')) throw new ForbiddenException({ error: 'forbidden' });
    await this.prisma.user.update({ where: { id }, data: { isActive: false, lockedReason: reason } });
    await this.sessions.revokeAllForUser(id);
    await this.audit.record({ actorId: auth.userId, action: 'admin.user_locked', entityType: 'user', entityId: target.id, ip: clientInfo(req).ip, metadata: { reason } });
    return { ok: true };
  }

  @Post(':id/unlock')
  @HttpCode(200)
  @RequirePermissions('admin.access', 'users.lock')
  async unlock(@Param('id', ParseUUIDPipe) id: string, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    await this.requireUser(id);
    await this.prisma.user.update({ where: { id }, data: { isActive: true, lockedReason: null } });
    await this.audit.record({ actorId: auth.userId, action: 'admin.user_unlocked', entityType: 'user', entityId: id, ip: clientInfo(req).ip });
    return { ok: true };
  }

  @Post(':id/revoke-sessions')
  @HttpCode(200)
  @RequirePermissions('admin.access', 'users.sessions.revoke')
  async revokeSessions(@Param('id', ParseUUIDPipe) id: string, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    await this.requireUser(id);
    const { count } = await this.sessions.revokeAllForUser(id);
    await this.audit.record({ actorId: auth.userId, action: 'admin.user_sessions_revoked', entityType: 'user', entityId: id, ip: clientInfo(req).ip, metadata: { count } });
    return { ok: true, revoked: count };
  }

  /** Thay toàn bộ vai trò của người dùng. Chỉ Super Admin cấp hoặc gỡ vai trò super_admin. */
  @Put(':id/roles')
  @RequirePermissions('admin.access', 'roles.assign')
  async setRoles(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    const requested = [...new Set(parse(rolesSchema, body).roles)];
    const unknown = requested.filter((r) => !isRoleKey(r));
    if (unknown.length) throw new BadRequestException({ error: 'unknown_roles', roles: unknown });
    await this.requireUser(id);

    const before = (await this.prisma.userRole.findMany({ where: { userId: id }, include: { role: true } })).map((r) => r.role.key).sort();
    const after = requested.sort();
    const touchesSuper = before.includes('super_admin') !== after.includes('super_admin');
    if (touchesSuper && !auth.roles.includes('super_admin')) throw new ForbiddenException({ error: 'forbidden' });

    await this.prisma.$transaction(async (tx) => {
      if (before.includes('super_admin') && !after.includes('super_admin')) {
        const supers = await tx.userRole.count({ where: { role: { key: 'super_admin' }, user: { isActive: true } } });
        if (supers <= 1) throw new BadRequestException({ error: 'last_super_admin' });
      }
      const roles = await tx.role.findMany({ where: { key: { in: after } } });
      await tx.userRole.deleteMany({ where: { userId: id } });
      if (roles.length) await tx.userRole.createMany({ data: roles.map((r) => ({ userId: id, roleId: r.id, grantedBy: auth.userId })) });
      await this.audit.record({ actorId: auth.userId, action: 'admin.user_roles_changed', entityType: 'user', entityId: id, ip: clientInfo(req).ip, metadata: { before, after } }, tx);
    });
    return { ok: true, roles: after };
  }

  private async requireUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) throw new NotFoundException();
    return user;
  }

  private async isSuperAdmin(userId: string) {
    return (await this.prisma.userRole.count({ where: { userId, role: { key: 'super_admin' } } })) > 0;
  }
}
