import { timingSafeEqual } from 'node:crypto';
import { Body, Controller, Headers, HttpCode, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { BankTransactionStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { SkipOriginCheck } from '../common/decorators';
import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from './billing.service';
import { findOrderCode } from './order-code';

/** Dữ liệu SePay gửi khi có giao dịch (chỉ lấy các trường cần dùng, giữ bản gốc trong cột raw). */
const sepayPayload = z.object({
  id: z.union([z.number().int(), z.string().regex(/^\d{1,20}$/)]).transform(String),
  gateway: z.string().max(60).optional().nullable(),
  transactionDate: z.string().max(40).optional().nullable(),
  accountNumber: z.string().max(30).optional().nullable(),
  code: z.string().max(60).optional().nullable(),
  content: z.string().max(500).optional().nullable(),
  transferType: z.enum(['in', 'out']),
  transferAmount: z.number().int().min(0).max(10_000_000_000),
  referenceCode: z.string().max(80).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
}).passthrough();

function keyMatches(header: string | undefined, expected: string): boolean {
  if (!header || !expected) return false;
  const m = header.match(/^Apikey\s+(.+)$/i);
  if (!m) return false;
  const a = Buffer.from(m[1].trim());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** "2026-11-08 14:02:37" (giờ Việt Nam) → Date. */
function vnDate(s: string | null | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return null;
  const d = new Date(`${s.replace(' ', 'T')}+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Webhook SePay: ngân hàng báo có tiền vào → đối soát theo mã đơn trong nội dung chuyển khoản.
 * Không cần Origin (máy chủ gọi máy chủ) nhưng bắt buộc khóa API. Luôn trả success cho request hợp lệ
 * (kể cả giao dịch không khớp đơn) để SePay không gửi lại; mọi giao dịch được lưu để đối soát tay.
 */
@Controller('webhooks')
export class WebhookController {
  private readonly log = new Logger('SePayWebhook');
  constructor(private readonly prisma: PrismaService, private readonly billing: BillingService) {}

  @Post('sepay')
  @HttpCode(200)
  @SkipOriginCheck()
  async sepay(@Headers('authorization') authorization: string | undefined, @Body() body: unknown) {
    const e = env();
    if (e.PAYMENT_MODE === 'disabled' || !keyMatches(authorization, e.SEPAY_WEBHOOK_KEY)) throw new UnauthorizedException({ error: 'invalid_api_key' });
    const parsed = sepayPayload.safeParse(body);
    if (!parsed.success) {
      this.log.warn('Payload SePay không đúng định dạng');
      return { success: false, error: 'invalid_payload' };
    }
    const p = parsed.data;
    const content = [p.code, p.content, p.description].filter(Boolean).join(' ').slice(0, 500);
    const base = {
      provider: 'sepay', providerTxId: p.id, amountVnd: p.transferAmount, content, referenceCode: p.referenceCode ?? null,
      transactionDate: vnDate(p.transactionDate), raw: body as Prisma.InputJsonValue,
    };

    const wrongAccount = !!p.accountNumber && p.accountNumber !== e.PAYMENT_BANK_ACCOUNT;
    const code = findOrderCode(content);
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        if (p.transferType !== 'in' || wrongAccount) {
          await tx.bankTransaction.create({ data: { ...base, status: BankTransactionStatus.IGNORED } });
          return 'ignored';
        }
        const order = code ? await tx.order.findUnique({ where: { code } }) : null;
        if (!order) {
          await tx.bankTransaction.create({ data: { ...base, status: BankTransactionStatus.UNMATCHED } });
          return 'unmatched';
        }
        const applied = await this.billing.applyPayment(tx, order.id, { method: 'sepay', amountVnd: p.transferAmount });
        const status = applied.applied ? BankTransactionStatus.MATCHED
          : applied.reason === 'amount_too_low' ? BankTransactionStatus.AMOUNT_MISMATCH : BankTransactionStatus.UNMATCHED;
        await tx.bankTransaction.create({ data: { ...base, status, orderId: order.id } });
        return applied.applied ? 'matched' : applied.reason!;
      });
      return { success: true, result };
    } catch (err) {
      // SePay gửi lại cùng giao dịch: đã xử lý rồi.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return { success: true, result: 'duplicate' };
      throw err;
    }
  }
}
