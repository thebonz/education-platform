import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { env } from '../config/env';
import { REQUIRE_AUTH, REQUIRE_PERMISSIONS } from '../common/decorators';
import type { AppRequest } from '../common/request';
import type { Permission } from '../rbac/permissions';
import { SessionService } from './session.service';

/**
 * Guard toàn cục: đọc cookie phiên, gắn req.auth, rồi áp @RequireAuth / @RequirePermissions.
 * Quyền luôn được quyết định ở backend, không tin dữ liệu từ frontend.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AppRequest>();
    const token = req.cookies?.[env().SESSION_COOKIE_NAME] as string | undefined;
    req.auth = await this.sessions.resolve(token);

    const targets = [context.getHandler(), context.getClass()];
    const permissions = this.reflector.getAllAndOverride<Permission[] | undefined>(REQUIRE_PERMISSIONS, targets);
    const requireAuth = this.reflector.getAllAndOverride<boolean | undefined>(REQUIRE_AUTH, targets) || !!permissions?.length;

    if (!requireAuth) return true;
    if (!req.auth) throw new UnauthorizedException({ error: 'not_authenticated' });
    if (permissions?.length && !permissions.every((p) => req.auth!.permissions.includes(p))) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
    return true;
  }
}
