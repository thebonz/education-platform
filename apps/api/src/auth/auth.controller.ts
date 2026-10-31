import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { CurrentAuth, RequireAuth } from '../common/decorators';
import type { AppRequest, AuthContext } from '../common/request';
import { clientInfo } from '../common/request';
import { email, parse, password, siteKey, text } from '../common/validation';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';

const authLimit = { default: { limit: () => env().AUTH_RATE_LIMIT_PER_MINUTE, ttl: 60_000 } };

const registerSchema = z.object({
  email,
  password,
  displayName: text(1, 80),
  site: siteKey.default('vietnamese'),
  acceptTerms: z.literal(true),
  confirmAdult: z.literal(true),
});
const loginSchema = z.object({ email, password: z.string().min(1).max(128) });
const tokenSchema = z.object({ token: z.string().min(20).max(200) });
const forgotSchema = z.object({ email, site: siteKey.default('vietnamese') });
const resetSchema = z.object({ token: z.string().min(20).max(200), password });
const changeSchema = z.object({ currentPassword: z.string().min(1).max(128), newPassword: password });
const resendSchema = z.object({ site: siteKey.default('vietnamese') });

export function publicMe(auth: AuthContext) {
  return {
    id: auth.userId,
    email: auth.email,
    displayName: auth.displayName,
    emailVerified: auth.emailVerified,
    roles: auth.roles,
    permissions: auth.permissions,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly sessions: SessionService) {}

  @Post('register')
  @HttpCode(202)
  @Throttle(authLimit)
  async register(@Body() body: unknown, @Req() req: AppRequest) {
    const input = parse(registerSchema, body);
    await this.auth.register(input, clientInfo(req));
    return { ok: true };
  }

  @Post('verify-email')
  @HttpCode(200)
  @Throttle(authLimit)
  async verifyEmail(@Body() body: unknown, @Req() req: AppRequest) {
    const { token } = parse(tokenSchema, body);
    await this.auth.verifyEmail(token, clientInfo(req));
    return { ok: true };
  }

  @Post('resend-verification')
  @HttpCode(202)
  @RequireAuth()
  @Throttle(authLimit)
  async resend(@Body() body: unknown, @CurrentAuth() auth: AuthContext) {
    const { site } = parse(resendSchema, body ?? {});
    await this.auth.sendVerification(auth.userId, site);
    return { ok: true };
  }

  @Post('login')
  @HttpCode(200)
  @Throttle(authLimit)
  async login(@Body() body: unknown, @Req() req: AppRequest, @Res({ passthrough: true }) res: Response) {
    const input = parse(loginSchema, body);
    const session = await this.auth.login(input, clientInfo(req));
    this.sessions.setCookie(res, session.token, session.expiresAt);
    const auth = await this.sessions.resolve(session.token);
    return { user: publicMe(auth!) };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentAuth() auth: AuthContext | null, @Res({ passthrough: true }) res: Response) {
    if (auth) await this.sessions.revoke(auth.sessionId);
    this.sessions.clearCookie(res);
  }

  @Post('logout-all')
  @HttpCode(204)
  @RequireAuth()
  async logoutAll(@CurrentAuth() auth: AuthContext, @Res({ passthrough: true }) res: Response) {
    await this.sessions.revokeAllForUser(auth.userId);
    this.sessions.clearCookie(res);
  }

  @Get('me')
  @RequireAuth()
  me(@CurrentAuth() auth: AuthContext) {
    return { user: publicMe(auth) };
  }

  @Post('forgot-password')
  @HttpCode(202)
  @Throttle(authLimit)
  async forgot(@Body() body: unknown) {
    await this.auth.forgotPassword(parse(forgotSchema, body));
    return { ok: true };
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle(authLimit)
  async reset(@Body() body: unknown, @Req() req: AppRequest) {
    await this.auth.resetPassword(parse(resetSchema, body), clientInfo(req));
    return { ok: true };
  }

  @Post('change-password')
  @HttpCode(200)
  @RequireAuth()
  @Throttle(authLimit)
  async change(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    await this.auth.changePassword(auth.userId, auth.sessionId, parse(changeSchema, body), clientInfo(req));
    return { ok: true };
  }
}
