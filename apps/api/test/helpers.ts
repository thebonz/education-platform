import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { hashPassword } from '../src/auth/crypto';
import { configureApp } from '../src/bootstrap';
import { seed } from '../src/cli/seed';
import { resetEnvCache } from '../src/config/env';
import { MailService } from '../src/mail/mail.service';

export const ORIGIN_EN = 'http://english.happyclass.test:3100';
export const ORIGIN_VI = 'http://vietnamese.happyclass.test:3100';
export const ORIGIN_ADMIN = 'http://admin.happyclass.test:3100';

export const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  SITE_ENGLISH_URL: ORIGIN_EN,
  SITE_VIETNAMESE_URL: ORIGIN_VI,
  SITE_ADMIN_URL: ORIGIN_ADMIN,
  COOKIE_DOMAIN: '.happyclass.test',
  COOKIE_SECURE: 'false',
  MAIL_TRANSPORT: 'memory',
  AUTH_RATE_LIMIT_PER_MINUTE: '1000',
  TRUST_PROXY_HOPS: '0',
};

export type TestApp = {
  app: INestApplication;
  prisma: PrismaClient;
  mail: MailService;
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
};

export async function createTestApp(overrides: Record<string, string> = {}): Promise<TestApp> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL chưa đặt cho test');
  if (!/test/i.test(new URL(process.env.DATABASE_URL).pathname)) {
    throw new Error('Từ chối chạy test: tên database phải chứa "test" để tránh xóa nhầm dữ liệu thật.');
  }
  Object.assign(process.env, TEST_ENV, overrides);
  resetEnvCache();

  const prisma = new PrismaClient();
  await resetDatabase(prisma);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  const mail = app.get(MailService);
  return {
    app,
    prisma,
    mail,
    http: () => request(app.getHttpServer()),
    close: async () => {
      await app.close();
      await prisma.$disconnect();
    },
  };
}

export async function resetDatabase(prisma: PrismaClient) {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) {
    await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  }
  await seed(prisma);
}

/** Lấy token từ email gần nhất gửi tới địa chỉ, theo đường dẫn (verify-email | reset-password). */
export function tokenFromMail(mail: MailService, to: string, path: string): string {
  const message = [...mail.outbox].reverse().find((m) => m.to === to && m.text.includes(`/${path}?token=`));
  if (!message) throw new Error(`Không thấy email ${path} gửi tới ${to}`);
  const match = message.text.match(new RegExp(`/${path}\\?token=([A-Za-z0-9_-]+)`));
  return match![1];
}

export function sessionCookie(res: { headers: Record<string, unknown> }): string {
  const raw = res.headers['set-cookie'] as string[] | string | undefined;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const found = list.find((c) => c.startsWith('hc_session='));
  if (!found) throw new Error('Không có cookie phiên');
  return found.split(';')[0];
}

export async function createUser(prisma: PrismaClient, email: string, password: string, roles: string[] = ['member'], verified = true) {
  const roleRows = await prisma.role.findMany({ where: { key: { in: roles } } });
  return prisma.user.create({
    data: {
      email,
      displayName: email.split('@')[0],
      passwordHash: await hashPassword(password),
      emailVerifiedAt: verified ? new Date() : null,
      roles: { create: roleRows.map((r) => ({ roleId: r.id })) },
    },
  });
}

export async function login(t: TestApp, email: string, password: string, origin = ORIGIN_EN): Promise<string> {
  const res = await t.http().post('/api/auth/login').set('Origin', origin).send({ email, password }).expect(200);
  return sessionCookie(res);
}
