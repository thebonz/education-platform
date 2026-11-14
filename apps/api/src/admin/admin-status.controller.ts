import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '../common/decorators';
import { env } from '../config/env';
import { signingKey } from '../offline/offline.controller';
import { PrismaService } from '../prisma/prisma.service';
import { TtsService } from '../tts/tts.service';
import { countWav, freeBytes, hoursSince, readStatusFile } from './system-status';

type Level = 'ok' | 'warn' | 'error';
type Check = { key: string; level: Level; title: string; detail: string };

const GB = 1024 ** 3;

/**
 * Tình trạng hệ thống cho chủ sở hữu: sao lưu, giọng đọc, thanh toán, email, chế độ chạy, ổ đĩa.
 * Chỉ trả về trạng thái và cờ bật/tắt – không bao giờ trả mật khẩu, khoá hay số tài khoản.
 */
@Controller('admin/system')
export class AdminStatusController {
  constructor(private readonly prisma: PrismaService, private readonly tts: TtsService) {}

  @Get('status')
  @RequirePermissions('admin.access', 'system.read')
  async status() {
    const e = env();
    const checks: Check[] = [];
    const add = (key: string, level: Level, title: string, detail: string) => checks.push({ key, level, title, detail });

    // Database
    const t0 = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    const dbMs = Date.now() - t0;
    const [migration] = await this.prisma.$queryRaw<{ migration_name: string; finished_at: Date | null }[]>`
      SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC NULLS LAST LIMIT 1`;
    add('database', 'ok', 'Cơ sở dữ liệu', `Phản hồi ${dbMs} ms · migration mới nhất ${migration?.migration_name ?? '—'}`);

    // Sao lưu ngoài máy chủ
    const backup = await readStatusFile('backup.json');
    const restore = await readStatusFile('restore-test.json');
    const bh = hoursSince(backup?.lastSuccess);
    if (bh === null) add('backup', 'error', 'Sao lưu ngoài máy chủ', 'Chưa có lần sao lưu nào. Chạy ops/configure-backup.sh rồi ops/install-backup-timer.sh (docs/BACKUP.md).');
    else add('backup', bh > 48 ? 'error' : 'ok', 'Sao lưu ngoài máy chủ', `Lần gần nhất ${Math.round(bh)} giờ trước (${String(backup?.provider ?? '')}) · ${String(backup?.mediaFiles ?? '?')} file media`);
    const rh = hoursSince(restore?.lastSuccess);
    if (rh === null) add('restore', 'warn', 'Diễn tập khôi phục', 'Chưa diễn tập lần nào. Chạy ops/restore-test.sh.');
    else add('restore', rh > 8 * 24 ? 'warn' : 'ok', 'Diễn tập khôi phục', `Thành công ${Math.round(rh / 24)} ngày trước`);

    // Giọng đọc tiếng Việt
    let ttsHealthy = false;
    if (e.TTS_URL) {
      try { ttsHealthy = (await fetch(`${e.TTS_URL.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(2_000) })).ok; } catch { ttsHealthy = false; }
    }
    const texts = await this.tts.publishedTexts();
    let cached = 0;
    for (const x of texts) if (await this.tts.isCached(x)) cached++;
    const wavFiles = await countWav(e.TTS_CACHE_DIR);
    if (!e.TTS_URL) add('tts', 'error', 'Giọng đọc tiếng Việt', 'Chưa bật dịch vụ tts – máy không có giọng Việt sẽ không nghe được.');
    else if (!ttsHealthy) add('tts', 'error', 'Giọng đọc tiếng Việt', 'Dịch vụ tts không phản hồi. Kiểm tra: sudo docker compose ps tts');
    else add('tts', cached < texts.length ? 'warn' : 'ok', 'Giọng đọc tiếng Việt',
      `Giọng Bắc (Piper) đang chạy · đã tạo sẵn ${cached}/${texts.length} câu của game đã xuất bản · ${wavFiles} file trong bộ đệm`);

    // Thanh toán
    const lastTx = await this.prisma.bankTransaction.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
    const mode = e.PAYMENT_MODE;
    add('payments', mode === 'live' ? 'ok' : 'warn', 'Thanh toán',
      `${mode === 'live' ? 'Đang nhận tiền thật' : mode === 'sandbox' ? 'Chế độ thử (sandbox)' : 'Đang tắt'}`
      + `${lastTx ? ` · giao dịch ngân hàng gần nhất ${Math.round(hoursSince(lastTx.createdAt.toISOString())!)} giờ trước` : ' · chưa nhận giao dịch nào'}`);

    // Email
    add('mail', e.MAIL_TRANSPORT === 'smtp' && e.SMTP_HOST ? 'ok' : 'warn', 'Email',
      e.MAIL_TRANSPORT === 'smtp' ? `Gửi qua SMTP (${e.SMTP_HOST})` : 'Chưa có SMTP – email chỉ ghi vào log, người dùng chưa nhận được email xác thực/đặt lại mật khẩu.');

    // Chế độ chạy, khoá offline, liên hệ
    add('mode', e.NODE_ENV === 'production' ? 'ok' : 'warn', 'Chế độ chạy',
      `${e.NODE_ENV === 'production' ? 'production' : `${e.NODE_ENV} (chạy thử)`} · cookie ${e.COOKIE_SECURE ? 'Secure (HTTPS)' : 'không Secure'}`);
    const ephemeral = signingKey().ephemeral;
    add('offline', ephemeral ? 'error' : 'ok', 'Khoá ký gói offline',
      ephemeral ? 'Đang dùng khoá tạm – giấy phép offline mất hiệu lực khi khởi động lại. Chạy ops/deploy-test.sh để tạo OFFLINE_SIGNING_KEY.' : 'Đã cấu hình');
    add('contact', e.CONTACT_ZALO ? 'ok' : 'warn', 'Liên hệ Zalo', e.CONTACT_ZALO ? 'Đã đặt số Zalo' : 'Chưa đặt – chạy ops/set-contact.sh');

    // Ổ đĩa dữ liệu
    const free = await freeBytes(e.MEDIA_DIR);
    if (free !== null) add('disk', free < 5 * GB ? 'error' : free < 20 * GB ? 'warn' : 'ok', 'Ổ đĩa dữ liệu', `Còn trống ${(free / GB).toFixed(1)} GB`);

    return {
      version: { commit: e.GIT_COMMIT || null, node: process.version, uptimeHours: Math.round(process.uptime() / 360) / 10 },
      summary: { error: checks.filter((c) => c.level === 'error').length, warn: checks.filter((c) => c.level === 'warn').length },
      checks,
    };
  }
}
