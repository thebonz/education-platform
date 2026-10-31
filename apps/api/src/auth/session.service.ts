import { Injectable } from '@nestjs/common';
import type { CookieOptions, Response } from 'express';
import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { permissionsFor } from '../rbac/permissions';
import type { AuthContext } from '../common/request';
import { hashToken, newToken } from './crypto';

const TOUCH_INTERVAL_MS = 10 * 60 * 1000;

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, info: { ip: string | null; userAgent: string | null }) {
    const token = newToken();
    const expiresAt = new Date(Date.now() + env().SESSION_TTL_DAYS * 86_400_000);
    await this.prisma.userSession.create({
      data: { userId, tokenHash: hashToken(token), expiresAt, ipAddress: info.ip, userAgent: info.userAgent },
    });
    return { token, expiresAt };
  }

  /** Trả về ngữ cảnh đăng nhập nếu cookie hợp lệ, ngược lại null. Không bao giờ ném lỗi. */
  async resolve(token: string | undefined): Promise<AuthContext | null> {
    if (!token || token.length > 200) return null;
    const session = await this.prisma.userSession.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { include: { roles: { include: { role: true } } } } },
    });
    const now = new Date();
    if (!session || session.revokedAt || session.expiresAt <= now || !session.user.isActive) return null;

    if (now.getTime() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await this.prisma.userSession.update({ where: { id: session.id }, data: { lastSeenAt: now } }).catch(() => undefined);
    }
    const roles = session.user.roles.map((r) => r.role.key).sort();
    return {
      userId: session.user.id,
      sessionId: session.id,
      email: session.user.email,
      displayName: session.user.displayName,
      emailVerified: !!session.user.emailVerifiedAt,
      roles,
      permissions: permissionsFor(roles),
    };
  }

  revoke(sessionId: string) {
    return this.prisma.userSession.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  revokeAllForUser(userId: string, exceptSessionId?: string) {
    return this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      data: { revokedAt: new Date() },
    });
  }

  setCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie(env().SESSION_COOKIE_NAME, token, { ...cookieBase(), expires: expiresAt });
  }

  clearCookie(res: Response) {
    res.clearCookie(env().SESSION_COOKIE_NAME, cookieBase());
  }
}

function cookieBase(): CookieOptions {
  const e = env();
  return {
    httpOnly: true,
    secure: e.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    ...(e.COOKIE_DOMAIN ? { domain: e.COOKIE_DOMAIN } : {}),
  };
}
