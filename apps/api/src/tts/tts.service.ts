import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, ServiceUnavailableException } from '@nestjs/common';
import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';

/** Phiên bản giọng + tham số: đổi giọng thì đổi chuỗi này để không dùng lại file cũ. */
export const TTS_VOICE = 'vi_VN-vais1000-medium@1.15';
export const TTS_MAX_CHARS = 300;
export const TTS_TEXT = /^[\p{L}\p{M}\p{N}\p{P}\p{Zs}]+$/u;

export const normalizeTtsText = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim();

/** Các trường nội dung game được đọc to (khớp với audio.say() trong các template của Web). */
const SPOKEN_KEYS = new Set(['say', 'word', 'text', 'prompt', 'answer', 'sentence', 'pictureAnswer']);

/** Câu sẽ được đọc trong một game (giữ nguyên dạng gốc vì trình duyệt dùng đúng chuỗi này làm URL). */
export function spokenTexts(data: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(data)) data.forEach((x) => spokenTexts(x, out));
  else if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'string') {
        const n = normalizeTtsText(v);
        if (SPOKEN_KEYS.has(k) && n && n.length <= TTS_MAX_CHARS && TTS_TEXT.test(n)) out.add(v);
      } else spokenTexts(v, out);
    }
  }
  return out;
}

/** URL mà trình duyệt gọi để nghe một câu (phải giống hệt GameAudio.say() để dùng chung bộ nhớ đệm). */
export const ttsUrl = (text: string) => `/api/tts?lang=vi&text=${encodeURIComponent(text)}`;

/**
 * Tạo và lưu đệm file WAV giọng Bắc (dịch vụ tts nội bộ chạy Piper).
 * Sau khi API khởi động và mỗi 6 giờ: tạo sẵn âm thanh cho mọi câu của game tiếng Việt đã xuất bản,
 * để học sinh nghe ngay và tải được về máy khi chơi offline.
 */
@Injectable()
export class TtsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger('TTS');
  private timer: NodeJS.Timeout | null = null;
  private warming = false;

  constructor(private readonly prisma: PrismaService) {}

  private pathFor(text: string) {
    const key = createHash('sha256').update(`${TTS_VOICE}|${normalizeTtsText(text)}`).digest('hex');
    const dir = resolve(env().TTS_CACHE_DIR, key.slice(0, 2));
    return { key, dir, path: join(dir, `${key}.wav`) };
  }

  /** Trả file WAV (từ bộ nhớ đệm hoặc tạo mới). Lỗi dịch vụ → 503. */
  async get(text: string): Promise<{ key: string; wav: Buffer }> {
    const { key, dir, path } = this.pathFor(text);
    const cached: Buffer | null = await readFile(path).catch(() => null);
    if (cached) return { key, wav: cached };
    const wav = await this.synthesize(normalizeTtsText(text));
    await mkdir(dir, { recursive: true });
    const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, wav);
    await rename(tmp, path);
    return { key, wav };
  }

  async isCached(text: string) {
    return access(this.pathFor(text).path).then(() => true, () => false);
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

  /** Câu đọc to của mọi game tiếng Việt đang xuất bản (dùng cho tạo sẵn). */
  async publishedTexts(): Promise<string[]> {
    const versions = await this.prisma.gameVersion.findMany({
      where: { isPublished: true, game: { isPublished: true, product: { slug: 'vietnamese' } } },
      select: { content: true },
    });
    const out = new Set<string>();
    versions.forEach((v) => spokenTexts(v.content, out));
    return [...out];
  }

  /** Tạo sẵn lần lượt từng câu chưa có (một câu một lúc để không chiếm CPU). Trả số câu đã tạo. */
  async warm(): Promise<number> {
    if (this.warming || !env().TTS_URL) return 0;
    this.warming = true;
    let made = 0;
    try {
      for (const text of await this.publishedTexts()) {
        if (await this.isCached(text)) continue;
        try { await this.get(text); made++; } catch { break; /* dịch vụ tts chưa sẵn sàng – thử lại lần sau */ }
      }
      if (made) this.logger.log(`Đã tạo sẵn ${made} câu đọc tiếng Việt`);
    } finally {
      this.warming = false;
    }
    return made;
  }

  onApplicationBootstrap() {
    if (!env().TTS_URL || env().NODE_ENV === 'test') return;
    const run = () => { void this.warm().catch(() => undefined); };
    setTimeout(run, 20_000).unref();
    this.timer = setInterval(run, 6 * 3_600_000);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }
}
