import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { allowedOrigins } from '../config/env';
import { SKIP_ORIGIN_CHECK } from './decorators';
import type { AppRequest } from './request';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Chống CSRF: mọi request thay đổi dữ liệu phải đến từ một origin của chính hệ thống.
 * Kết hợp với cookie SameSite=Lax.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AppRequest>();
    if (SAFE_METHODS.has(req.method)) return true;
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_ORIGIN_CHECK, [context.getHandler(), context.getClass()]);
    if (skip) return true;

    const origin = headerOrigin(req.headers.origin) ?? headerOrigin(req.headers.referer);
    if (!origin || !allowedOrigins().has(origin)) {
      throw new ForbiddenException({ error: 'origin_not_allowed' });
    }
    return true;
  }
}

function headerOrigin(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string' || !value || value === 'null') return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}
