import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Controller, Get, Logger, Query, Res, ServiceUnavailableException, StreamableFile } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { parse } from '../common/validation';
import { env } from '../config/env';

/** Phiên bản giọng + tham số: đổi giọng thì đổi chuỗi này để không dùng lại file cũ. */
export const TTS_VOICE = 'vi_VN-vais1000-medium@1.15';

const normalize = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim();
const ttsQuery = z.object({
  lang: z.literal('vi'),
  // Chỉ chữ, dấu, số, dấu câu và khoảng trắng; tối đa 300 ký tự (một câu trong game)
  text: z.string().transform(normalize).pipe(z.string().min(1).max(300).regex(/^[\p{L}\p{M}\p{N}\p{P}\p{Zs}]+$/u, 'Ký tự không hợp lệ')),
});

/**
 * Đọc tiếng Việt giọng Bắc: tạo file WAV bằng dịch vụ tts nội bộ (Piper), lưu đệm theo SHA-256 của câu,
 * lần sau trả ngay từ ổ đĩa. Trình duyệt và service worker lưu lâu dài vì nội dung không đổi theo URL.
 * Nếu dịch vụ tts không chạy: 503, trình duyệt chuyển sang giọng tiếng Việt của máy (nếu có).
 */
@Controller('tts')
export class TtsController {
  private readonly logger = new Logger('TTS');

  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async speak(@Query() query: unknown, @Res({ passthrough: true }) res: Response) {
    const { text } = parse(ttsQuery, query);
    const key = createHash('sha256').update(`${TTS_VOICE}|${text}`).digest('hex');
    const dir = resolve(env().TTS_CACHE_DIR, key.slice(0, 2));
    const path = join(dir, `${key}.wav`);
    let wav = await readFile(path).catch(() => null);
    if (!wav) {
      wav = await this.synthesize(text);
      await mkdir(dir, { recursive: true });
      const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tmp, wav);
      await rename(tmp, path);
    }
    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': String(wav.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'same-site',
      ETag: `"${key}"`,
    });
    return new StreamableFile(wav, { type: 'audio/wav', length: wav.length });
  }

  private async synthesize(text: string): Promise<Buffer> {
    const url = env().TTS_URL;
    if (!url) throw new ServiceUnavailableException({ error: 'tts_unavailable' });
    try {
      const r = await fetch(`${url.replace(/\/$/, '')}/synthesize`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(30_000),
      });
      const buf = Buffer.from(await r.arrayBuffer());
      if (!r.ok || buf.subarray(0, 4).toString('latin1') !== 'RIFF') throw new Error(`HTTP ${r.status}`);
      return buf;
    } catch (e) {
      this.logger.warn(`Không tạo được âm thanh: ${(e as Error).message}`);
      throw new ServiceUnavailableException({ error: 'tts_unavailable' });
    }
  }
}
