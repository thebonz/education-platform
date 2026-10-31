import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthTokenType, Prisma } from '@prisma/client';
import { env, SiteKey, siteUrl } from '../config/env';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { accountExistsMail, resetPasswordMail, verifyEmailMail } from '../mail/templates';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_ROLE } from '../rbac/permissions';
import { burnPasswordCheck, hashPassword, hashToken, newToken, verifyPassword } from './crypto';
import { SessionService } from './session.service';

const VERIFY_TTL_MS = 24 * 3_600_000;
const RESET_TTL_MS = 3_600_000;

type ClientInfo = { ip: string | null; userAgent: string | null };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Đăng ký. Luôn trả kết quả giống nhau dù email đã tồn tại hay chưa,
   * để không lộ danh sách người dùng; email đã tồn tại sẽ nhận thư thông báo.
   */
  async register(
    input: { email: string; password: string; displayName: string; site: SiteKey },
    info: ClientInfo,
  ): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      const mail = accountExistsMail(input.site, `${siteUrl(input.site)}/forgot-password`);
      await this.mail.send({ to: input.email, ...mail });
      return;
    }

    const passwordHash = await hashPassword(input.password);
    const termsVersion = env().TERMS_VERSION;
    let userId: string;
    try {
      userId = await this.prisma.$transaction(async (tx) => {
        const role = await tx.role.findUniqueOrThrow({ where: { key: DEFAULT_ROLE } });
        const user = await tx.user.create({
          data: {
            email: input.email,
            passwordHash,
            displayName: input.displayName,
            roles: { create: { roleId: role.id } },
            consents: {
              create: [
                { kind: 'terms', version: termsVersion, ipAddress: info.ip },
                { kind: 'privacy', version: termsVersion, ipAddress: info.ip },
                { kind: 'adult_account', version: termsVersion, ipAddress: info.ip },
              ],
            },
          },
        });
        await this.audit.record({ actorId: user.id, action: 'auth.register', entityType: 'user', entityId: user.id, ip: info.ip, metadata: { site: input.site } }, tx);
        return user.id;
      });
    } catch (error) {
      // Hai request đăng ký cùng email chạy song song: bản ghi thứ hai vi phạm UNIQUE.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
      throw error;
    }
    await this.sendVerification(userId, input.site);
  }

  async sendVerification(userId: string, site: SiteKey): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.emailVerifiedAt) return;
    const token = await this.issueToken(userId, AuthTokenType.VERIFY_EMAIL, VERIFY_TTL_MS);
    const mail = verifyEmailMail(site, user.displayName, `${siteUrl(site)}/verify-email?token=${token}`);
    await this.mail.send({ to: user.email, ...mail });
  }

  async verifyEmail(token: string, info: ClientInfo): Promise<void> {
    const record = await this.consumeToken(token, AuthTokenType.VERIFY_EMAIL);
    await this.prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
    await this.audit.record({ actorId: record.userId, action: 'auth.email_verified', entityType: 'user', entityId: record.userId, ip: info.ip });
  }

  async login(input: { email: string; password: string }, info: ClientInfo) {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      await burnPasswordCheck(input.password);
      throw new UnauthorizedException({ error: 'invalid_credentials' });
    }
    const ok = await verifyPassword(user.passwordHash, input.password);
    if (!ok) {
      await this.audit.record({ actorId: user.id, action: 'auth.login_failed', entityType: 'user', entityId: user.id, ip: info.ip });
      throw new UnauthorizedException({ error: 'invalid_credentials' });
    }
    if (!user.isActive) {
      await this.audit.record({ actorId: user.id, action: 'auth.login_blocked', entityType: 'user', entityId: user.id, ip: info.ip });
      throw new UnauthorizedException({ error: 'account_locked' });
    }
    const session = await this.sessions.create(user.id, info);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.record({ actorId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id, ip: info.ip });
    return session;
  }

  /** Luôn trả kết quả giống nhau để không lộ email nào đã đăng ký. */
  async forgotPassword(input: { email: string; site: SiteKey }): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !user.isActive) return;
    const token = await this.issueToken(user.id, AuthTokenType.RESET_PASSWORD, RESET_TTL_MS);
    const mail = resetPasswordMail(input.site, user.displayName, `${siteUrl(input.site)}/reset-password?token=${token}`);
    await this.mail.send({ to: user.email, ...mail });
  }

  async resetPassword(input: { token: string; password: string }, info: ClientInfo): Promise<void> {
    const record = await this.consumeToken(input.token, AuthTokenType.RESET_PASSWORD);
    const passwordHash = await hashPassword(input.password);
    // Đặt lại mật khẩu qua email cũng chứng minh người dùng sở hữu email.
    await this.prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, emailVerifiedAt: record.user.emailVerifiedAt ?? new Date() },
    });
    await this.sessions.revokeAllForUser(record.userId);
    await this.audit.record({ actorId: record.userId, action: 'auth.password_reset', entityType: 'user', entityId: record.userId, ip: info.ip });
  }

  async changePassword(userId: string, sessionId: string, input: { currentPassword: string; newPassword: string }, info: ClientInfo) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw new BadRequestException({ error: 'current_password_incorrect' });
    }
    if (input.currentPassword === input.newPassword) throw new ConflictException({ error: 'password_unchanged' });
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(input.newPassword) } });
    await this.sessions.revokeAllForUser(userId, sessionId);
    await this.audit.record({ actorId: userId, action: 'auth.password_changed', entityType: 'user', entityId: userId, ip: info.ip });
  }

  private async issueToken(userId: string, type: AuthTokenType, ttlMs: number): Promise<string> {
    const token = newToken();
    await this.prisma.$transaction([
      // Token cũ cùng loại hết hiệu lực khi phát token mới.
      this.prisma.authToken.updateMany({ where: { userId, type, usedAt: null }, data: { usedAt: new Date() } }),
      this.prisma.authToken.create({ data: { userId, type, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + ttlMs) } }),
    ]);
    return token;
  }

  /** Dùng token một lần: đánh dấu đã dùng bằng UPDATE có điều kiện để chống dùng lại song song. */
  private async consumeToken(token: string, type: AuthTokenType) {
    const tokenHash = hashToken(token);
    const now = new Date();
    const updated = await this.prisma.authToken.updateMany({
      where: { tokenHash, type, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (updated.count !== 1) throw new BadRequestException({ error: 'invalid_or_expired_token' });
    return this.prisma.authToken.findUniqueOrThrow({ where: { tokenHash }, include: { user: true } });
  }
}
