import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import {
  BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post,
  PayloadTooLargeException, Query, Req, Res, StreamableFile, UnsupportedMediaTypeException, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaKind, Prisma } from '@prisma/client';
import type { Response } from 'express';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { CurrentAuth, RequirePermissions } from '../common/decorators';
import type { AppRequest, AuthContext } from '../common/request';
import { clientInfo } from '../common/request';
import { parse, text } from '../common/validation';
import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { sniff } from './sniff';

type UploadedBlob = { buffer: Buffer; originalname: string; size: number };

const uploadBody = z.object({
  alt: text(0, 160).optional(),
  source: z.enum(['upload', 'ai']).default('upload'),
});
const listQuery = z.object({
  kind: z.nativeEnum(MediaKind).optional(),
  q: z.string().max(80).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(40),
});
const patchBody = z.object({ alt: text(0, 160) }).strict();

const mediaDir = () => resolve(env().MEDIA_DIR);
const filePath = (sha256: string, ext: string) => join(mediaDir(), sha256.slice(0, 2), `${sha256}.${ext}`);
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'audio/wav': 'wav', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3' };

/**
 * Multer/busboy đọc tên file theo latin1; trình duyệt gửi UTF-8 ("mèo.png" thành "mÃ¨o.png").
 * Đọc lại theo UTF-8; nếu ra ký tự lỗi thì giữ nguyên.
 */
export function decodeFilename(name: string): string {
  if (!/[\u0080-\u00ff]/.test(name) || [...name].some((c) => c.codePointAt(0)! > 0xff)) return name;
  const utf8 = Buffer.from(name, 'latin1').toString('utf8');
  return utf8.includes('\uFFFD') ? name : utf8;
}

/** Đường dẫn công khai dùng trong nội dung game (picture.src). */
export const mediaUrl = (id: string) => `/api/media/${id}`;

const asView = (m: { id: string; kind: MediaKind; mimeType: string; byteSize: number; width: number | null; height: number | null; originalName: string; alt: string | null; source: string; createdAt: Date }) => ({
  id: m.id, kind: m.kind, mimeType: m.mimeType, byteSize: m.byteSize, width: m.width, height: m.height,
  originalName: m.originalName, alt: m.alt, source: m.source, createdAt: m.createdAt, url: mediaUrl(m.id),
});

@Controller()
export class MediaController {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  @Post('admin/media')
  @HttpCode(201)
  @RequirePermissions('admin.access', 'media.upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10_000_000, files: 1, fields: 5, fieldSize: 2_000 } }))
  async upload(@UploadedFile() file: UploadedBlob | undefined, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    if (!file?.buffer?.length) throw new BadRequestException({ error: 'file_required' });
    const input = parse(uploadBody, body ?? {});
    const kind = sniff(file.buffer);
    if (!kind) throw new UnsupportedMediaTypeException({ error: 'unsupported_media', allowed: 'PNG, JPEG, WebP, GIF, MP3, OGG, WAV' });
    const limit = kind.kind === 'IMAGE' ? env().MEDIA_MAX_IMAGE_BYTES : env().MEDIA_MAX_AUDIO_BYTES;
    if (file.size > limit) throw new PayloadTooLargeException({ error: 'file_too_large', maxBytes: limit });

    const sha256 = createHash('sha256').update(file.buffer).digest('hex');
    const existing = await this.prisma.mediaAsset.findUnique({ where: { sha256 } });
    if (existing) return { ...asView(existing), duplicate: true };

    // Ghi tạm rồi đổi tên: không bao giờ để lại file ghi dở ở đường dẫn thật.
    const target = filePath(sha256, kind.ext);
    await mkdir(dirname(target), { recursive: true });
    const tmp = `${target}.${randomUUID()}.tmp`;
    await writeFile(tmp, file.buffer, { mode: 0o640 });
    await rename(tmp, target);

    const originalName = decodeFilename(file.originalname || 'file').normalize('NFC').replace(/[^\p{L}\p{N} ._-]/gu, '_').slice(0, 120);
    try {
      const row = await this.prisma.mediaAsset.create({
        data: {
          kind: kind.kind, mimeType: kind.mime, byteSize: file.size, sha256, width: kind.width ?? null, height: kind.height ?? null,
          originalName, alt: input.alt?.trim() || null, source: input.source, createdById: auth.userId,
        },
      });
      await this.audit.record({
        actorId: auth.userId, action: 'admin.media_uploaded', entityType: 'media', entityId: row.id, ip: clientInfo(req).ip,
        metadata: { kind: row.kind, mimeType: row.mimeType, byteSize: row.byteSize, source: row.source },
      });
      return asView(row);
    } catch (e) {
      // Hai người tải cùng một file cùng lúc: bản ghi kia thắng, dùng chung file.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return { ...asView(await this.prisma.mediaAsset.findUniqueOrThrow({ where: { sha256 } })), duplicate: true };
      }
      throw e;
    }
  }

  @Get('admin/media')
  @RequirePermissions('admin.access', 'games.read_all')
  async list(@Query() query: unknown) {
    const { kind, q, page, pageSize } = parse(listQuery, query);
    const where: Prisma.MediaAssetWhereInput = {
      ...(kind ? { kind } : {}),
      ...(q ? { OR: [{ originalName: { contains: q, mode: 'insensitive' } }, { alt: { contains: q, mode: 'insensitive' } }] } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.mediaAsset.count({ where }),
      this.prisma.mediaAsset.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return { total, page, pageSize, items: rows.map(asView) };
  }

  @Patch('admin/media/:id')
  @RequirePermissions('admin.access', 'media.upload')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    const { alt } = parse(patchBody, body);
    const row = await this.prisma.mediaAsset.update({ where: { id }, data: { alt: alt.trim() || null } }).catch(() => null);
    if (!row) throw new NotFoundException();
    return asView(row);
  }

  /** File công khai (dùng trong game). Kiểu file lấy từ bản ghi đã kiểm tra lúc tải lên, không đoán lại. */
  @Get('media/:id')
  async serve(@Param('id', ParseUUIDPipe) id: string, @Res({ passthrough: true }) res: Response) {
    const row = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!row) throw new NotFoundException();
    const path = filePath(row.sha256, EXT[row.mimeType] ?? 'bin');
    const info = await stat(path).catch(() => null);
    if (!info) throw new NotFoundException();
    res.set({
      'Content-Type': row.mimeType,
      'Content-Length': String(info.size),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'same-site',
      ETag: `"${row.sha256}"`,
    });
    return new StreamableFile(createReadStream(path), { type: row.mimeType, length: info.size });
  }
}
