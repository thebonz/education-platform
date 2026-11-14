import { Controller, Get, Query, Res, StreamableFile } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { parse } from '../common/validation';
import { normalizeTtsText, TTS_MAX_CHARS, TTS_TEXT, TtsService } from './tts.service';

const ttsQuery = z.object({
  lang: z.literal('vi'),
  // Chỉ chữ, dấu, số, dấu câu và khoảng trắng; tối đa 300 ký tự (một câu trong game)
  text: z.string().refine((s) => { const n = normalizeTtsText(s); return n.length >= 1 && n.length <= TTS_MAX_CHARS && TTS_TEXT.test(n); }, 'Câu không hợp lệ'),
});

/**
 * Đọc tiếng Việt giọng Bắc: file WAV do dịch vụ tts nội bộ (Piper) tạo, lưu đệm theo SHA-256 của câu.
 * Trình duyệt và service worker lưu lâu dài vì nội dung không đổi theo URL.
 * Dịch vụ tts không chạy: 503, trình duyệt chuyển sang giọng tiếng Việt của máy (nếu có).
 */
@Controller('tts')
export class TtsController {
  constructor(private readonly tts: TtsService) {}

  @Get()
  // Rộng hơn mức thường vì tải gói offline lấy sẵn âm thanh của mọi game (đa số đã có trong bộ nhớ đệm)
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  async speak(@Query() query: unknown, @Res({ passthrough: true }) res: Response) {
    const { text } = parse(ttsQuery, query);
    const { key, wav } = await this.tts.get(text);
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
}
