import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { addMonths, newOrderCode } from './order-code';
import { vietQrPayload } from './vietqr';

type Tx = Prisma.TransactionClient;
export type PaymentInput = { method: 'sepay' | 'manual'; amountVnd: number; actorId?: string | null; note?: string | null };
export type ApplyResult = { applied: boolean; reason?: 'already_paid' | 'cancelled' | 'amount_too_low'; endsAt?: Date };

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  paymentsEnabled() {
    return env().PAYMENT_MODE !== 'disabled';
  }

  /** Thông tin chuyển khoản cho một đơn (chỉ trả cho chủ đơn). */
  transferInfo(order: { code: string; amountVnd: number }) {
    const e = env();
    return {
      mode: e.PAYMENT_MODE,
      bankName: e.PAYMENT_BANK_NAME,
      bankBin: e.PAYMENT_BANK_BIN,
      accountNumber: e.PAYMENT_BANK_ACCOUNT,
      accountName: e.PAYMENT_BANK_ACCOUNT_NAME,
      amountVnd: order.amountVnd,
      content: order.code,
      qrPayload: vietQrPayload({ bankBin: e.PAYMENT_BANK_BIN, account: e.PAYMENT_BANK_ACCOUNT, amountVnd: order.amountVnd, content: order.code }),
    };
  }

  /** Đơn đang chờ thanh toán của cùng gói được dùng lại (bấm mua nhiều lần không tạo nhiều đơn). */
  async createOrder(userId: string, plan: { id: string; productId: string; name: string; months: number; priceVnd: number }) {
    const now = new Date();
    const existing = await this.prisma.order.findFirst({
      where: { userId, planId: plan.id, status: 'PENDING', expiresAt: { gt: now }, amountVnd: plan.priceVnd },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return { order: existing, reused: true };
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const order = await this.prisma.order.create({
          data: {
            code: newOrderCode(), userId, planId: plan.id, productId: plan.productId, planName: plan.name, months: plan.months,
            amountVnd: plan.priceVnd, expiresAt: new Date(now.getTime() + env().ORDER_TTL_HOURS * 3_600_000),
          },
        });
        return { order, reused: false };
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue; // trùng mã: tạo lại
        throw e;
      }
    }
    throw new Error('Không tạo được mã đơn');
  }

  /**
   * Ghi nhận đã thanh toán và cấp quyền. Chạy trong transaction; khóa dòng đơn hàng (FOR UPDATE)
   * để webhook gửi trùng hoặc xác nhận tay cùng lúc không cấp quyền hai lần.
   * Đơn đã quá hạn vẫn được ghi nhận nếu tiền đã về (khách đã chuyển thì phải được dùng).
   */
  async applyPayment(tx: Tx, orderId: string, input: PaymentInput): Promise<ApplyResult> {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.status === 'PAID') return { applied: false, reason: 'already_paid' };
    if (order.status === 'CANCELLED' && input.method !== 'manual') return { applied: false, reason: 'cancelled' };
    if (input.amountVnd < order.amountVnd && input.method !== 'manual') return { applied: false, reason: 'amount_too_low' };

    const now = new Date();
    const current = await tx.entitlement.findFirst({
      where: { userId: order.userId, productId: order.productId, endsAt: { gt: now } },
      orderBy: { endsAt: 'desc' },
    });
    // Gia hạn nối tiếp: còn hạn thì cộng từ ngày hết hạn hiện tại.
    const startsAt = current ? current.endsAt : now;
    const endsAt = addMonths(startsAt, order.months);
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'PAID', paidAt: now, paidAmountVnd: input.amountVnd, paymentMethod: input.method,
        confirmedById: input.actorId ?? null, note: input.note ?? order.note,
      },
    });
    await tx.entitlement.create({
      data: { userId: order.userId, productId: order.productId, startsAt, endsAt, source: 'order', orderId: order.id, grantedById: input.actorId ?? null },
    });
    await this.audit.record({
      actorId: input.actorId ?? null, action: input.method === 'manual' ? 'billing.order_confirmed_manually' : 'billing.order_paid',
      entityType: 'order', entityId: order.id,
      metadata: { code: order.code, amountVnd: order.amountVnd, paidAmountVnd: input.amountVnd, months: order.months, endsAt: endsAt.toISOString() },
    }, tx);
    return { applied: true, endsAt };
  }

  /** Quyền trả phí đang còn hạn của người dùng, theo sản phẩm. */
  async activeMemberships(userId: string) {
    const rows = await this.prisma.entitlement.groupBy({
      by: ['productId'],
      where: { userId, endsAt: { gt: new Date() } },
      _max: { endsAt: true },
    });
    const products = await this.prisma.product.findMany({ where: { id: { in: rows.map((r) => r.productId) } }, select: { id: true, slug: true, name: true } });
    return rows.map((r) => ({ product: products.find((p) => p.id === r.productId)!, endsAt: r._max.endsAt! }));
  }
}
