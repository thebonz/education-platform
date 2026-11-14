import { createPrivateKey, createPublicKey, generateKeyPairSync, type JsonWebKey, KeyObject, sign } from 'node:crypto';
import { Body, Controller, Get, HttpCode, Logger, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { validateGameData } from '@happyclass/game-core';
import { AccessLevel, Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { AccessService } from '../catalog/access.service';
import { CurrentAuth, RequireAuth } from '../common/decorators';
import type { AppRequest, AuthContext } from '../common/request';
import { clientInfo } from '../common/request';
import { parse } from '../common/validation';
import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

const b64url = (b: Buffer) => b.toString('base64url');
let keyCache: { priv: KeyObject; pubJwk: JsonWebKey; kid: string; ephemeral: boolean } | null = null;

/** Khóa ký giấy phép. Thiếu cấu hình (dev/test) thì tạo khóa tạm trong bộ nhớ – giấy phép mất hiệu lực khi khởi động lại. */
export function signingKey() {
  if (keyCache) return keyCache;
  const raw = env().OFFLINE_SIGNING_KEY;
  let priv: KeyObject;
  let ephemeral = false;
  if (raw) {
    priv = createPrivateKey({ key: Buffer.from(raw, 'base64'), format: 'der', type: 'pkcs8' });
  } else {
    priv = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey;
    ephemeral = true;
    new Logger('Offline').warn('Chưa đặt OFFLINE_SIGNING_KEY – dùng khóa tạm (giấy phép offline mất hiệu lực khi khởi động lại).');
  }
  const pubJwk = createPublicKey(priv).export({ format: 'jwk' }) as JsonWebKey;
  const kid = b64url(Buffer.from(`${pubJwk.x}.${pubJwk.y}`)).slice(0, 16);
  keyCache = { priv, pubJwk, kid, ephemeral };
  return keyCache;
}

/** Giấy phép = base64url(JSON payload) + "." + chữ ký ECDSA P-256/SHA-256 dạng r||s (khớp WebCrypto). */
export function signLicense(payload: Record<string, unknown>): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = sign('sha256', Buffer.from(body), { key: signingKey().priv, dsaEncoding: 'ieee-p1363' });
  return `${body}.${b64url(sig)}`;
}

const packQuery = z.object({ product: z.enum(['english', 'vietnamese']) });

const DAY = 86_400_000;
const syncSchema = z.object({
  product: z.enum(['english', 'vietnamese']),
  results: z.array(z.object({
    id: z.string().uuid(),
    slug: z.string().regex(/^[a-z0-9-]{1,100}$/),
    playedAt: z.number().int(),
    score: z.number().int().min(0).max(10_000),
    maxScore: z.number().int().min(0).max(10_000),
    mistakes: z.number().int().min(0).max(10_000).default(0),
    stars: z.number().int().min(1).max(3),
    durationMs: z.number().int().min(0).max(6 * 3_600_000),
  }).refine((r) => r.score <= r.maxScore, { path: ['score'], message: 'score vượt quá maxScore' })).min(1).max(200),
});

/** Tìm mọi ảnh trong thư viện media mà nội dung game dùng tới, để trình duyệt tải sẵn khi chơi offline. */
function mediaUrls(data: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(data)) data.forEach((x) => mediaUrls(x, out));
  else if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      if (k === 'src' && typeof v === 'string' && /^\/api\/media\/[0-9a-f-]{36}$/.test(v)) out.add(v);
      else mediaUrls(v, out);
    }
  }
  return out;
}

/**
 * Chơi offline (PWA): trình duyệt tải một "gói" gồm nội dung các game được phép chơi + giấy phép ký số
 * có hạn 30 ngày. Hết hạn phải kết nối mạng để gia hạn; game trả phí còn bị giới hạn bởi hạn gói thành viên.
 */
@Controller('offline')
export class OfflineController {
  constructor(private readonly prisma: PrismaService, private readonly access: AccessService, private readonly audit: AuditService) {}

  @Get('public-key')
  publicKey() {
    const k = signingKey();
    return { kid: k.kid, alg: 'ES256', jwk: { kty: k.pubJwk.kty, crv: k.pubJwk.crv, x: k.pubJwk.x, y: k.pubJwk.y } };
  }

  /**
   * Gửi kết quả đã chơi khi offline. Mỗi kết quả có mã do trình duyệt sinh nên gửi lại nhiều lần không bị trùng.
   * Chỉ nhận kết quả trong thời hạn giấy phép offline (+5 ngày), không ở tương lai, của game thuộc đúng sản phẩm;
   * game trả phí phải có gói còn hạn vào lúc chơi.
   * Trả về: accepted = đã lưu (kể cả đã lưu từ trước) → trình duyệt xoá khỏi hàng đợi; rejected = không bao giờ hợp lệ → cũng xoá.
   */
  @Post('sync')
  @HttpCode(200)
  @RequireAuth()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async sync(@Body() body: unknown, @CurrentAuth() auth: AuthContext) {
    const { product, results } = parse(syncSchema, body);
    const prod = await this.prisma.product.findUniqueOrThrow({ where: { slug: product } });
    const now = Date.now();
    const oldest = now - (env().OFFLINE_LICENSE_DAYS + 5) * DAY;
    const games = await this.prisma.game.findMany({
      where: { productId: prod.id, isPublished: true, slug: { in: [...new Set(results.map((r) => r.slug))] } },
      select: { id: true, slug: true, accessLevel: true, productId: true },
    });
    const bySlug = new Map(games.map((g) => [g.slug, g]));
    const entitlements = await this.prisma.entitlement.findMany({
      where: { userId: auth.userId, productId: prod.id }, select: { startsAt: true, endsAt: true },
    });
    const hadMembership = (t: number) => entitlements.some((e) => e.startsAt.getTime() - DAY <= t && t <= e.endsAt.getTime());
    const existing = new Set((await this.prisma.gameSession.findMany({
      where: { clientId: { in: results.map((r) => r.id) } }, select: { clientId: true },
    })).map((r) => r.clientId));

    const accepted: string[] = [];
    const rejected: { id: string; reason: string }[] = [];
    const rows: Prisma.GameSessionCreateManyInput[] = [];
    const seen = new Set<string>();
    for (const r of results) {
      if (existing.has(r.id) || seen.has(r.id)) { accepted.push(r.id); continue; }
      const game = bySlug.get(r.slug);
      let reason: string | null = null;
      if (!game) reason = 'game_not_found';
      else if (r.playedAt < oldest) reason = 'too_old';
      else if (r.playedAt > now + 5 * 60_000) reason = 'in_future';
      else if (game.accessLevel === AccessLevel.PREMIUM && !this.access.canPlay(auth, game).allowed && !hadMembership(r.playedAt)) reason = 'membership_required';
      if (reason) { rejected.push({ id: r.id, reason }); continue; }
      seen.add(r.id);
      accepted.push(r.id);
      rows.push({
        userId: auth.userId, gameId: game!.id, clientId: r.id, offline: true, createdAt: new Date(r.playedAt),
        score: r.score, maxScore: r.maxScore, mistakes: r.mistakes, stars: r.stars, durationMs: r.durationMs,
      });
    }
    if (rows.length) await this.prisma.gameSession.createMany({ data: rows, skipDuplicates: true });
    return { accepted, rejected, saved: rows.length };
  }

  @Get('pack')
  @RequireAuth()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async pack(@Query() query: unknown, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    const { product } = parse(packQuery, query);
    const prod = await this.prisma.product.findUniqueOrThrow({ where: { slug: product } });
    const games = await this.prisma.game.findMany({
      where: { productId: prod.id, isPublished: true },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
      select: {
        id: true, slug: true, title: true, summary: true, templateKey: true, accessLevel: true, productId: true,
        level: { select: { name: true } }, category: { select: { name: true } },
        versions: { where: { isPublished: true }, take: 1, select: { versionNumber: true, content: true } },
      },
    });
    const now = Date.now();
    const days = env().OFFLINE_LICENSE_DAYS;
    const membership = await this.prisma.entitlement.findFirst({
      where: { userId: auth.userId, productId: prod.id, endsAt: { gt: new Date() } }, orderBy: { endsAt: 'desc' }, select: { endsAt: true },
    });
    const staff = auth.permissions.includes('games.play_premium_preview');
    const included = games.flatMap((g) => {
      if (!this.access.canPlay(auth, g).allowed) return [];
      const v = g.versions[0];
      const r = v ? validateGameData(g.templateKey, v.content) : null;
      if (!r?.ok) return [];
      return [{
        slug: g.slug, title: g.title, summary: g.summary, templateKey: g.templateKey, premium: g.accessLevel === AccessLevel.PREMIUM,
        level: g.level?.name ?? null, category: g.category?.name ?? null, version: v!.versionNumber, data: r.data,
      }];
    });
    const media = [...mediaUrls(included.map((g) => g.data))];
    const exp = now + days * 86_400_000;
    // Game trả phí offline: tới hạn gói (nhân sự xem trước: theo hạn giấy phép).
    const premiumUntil = staff ? exp : membership ? Math.min(membership.endsAt.getTime(), exp) : null;
    const license = signLicense({
      v: 1, kid: signingKey().kid, sub: auth.userId, product, iat: now, exp, premiumUntil,
      games: included.map((g) => `${g.slug}@${g.version}`),
    });
    await this.audit.record({
      actorId: auth.userId, action: 'offline.pack_downloaded', entityType: 'product', entityId: prod.id, ip: clientInfo(req).ip,
      metadata: { product, games: included.length, premium: included.filter((g) => g.premium).length, exp: new Date(exp).toISOString() },
    });
    return { product, issuedAt: now, expiresAt: exp, premiumUntil, license, games: included, media };
  }
}
