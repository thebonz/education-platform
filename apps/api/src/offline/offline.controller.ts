import { createPrivateKey, createPublicKey, generateKeyPairSync, KeyObject, sign } from 'node:crypto';
import { Controller, Get, Logger, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { validateGameData } from '@happyclass/game-core';
import { AccessLevel } from '@prisma/client';
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
