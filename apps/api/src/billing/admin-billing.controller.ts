import { BadRequestException, Body, Controller, Get, HttpCode, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import { BankTransactionStatus, OrderStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { CurrentAuth, RequirePermissions } from '../common/decorators';
import type { AppRequest, AuthContext } from '../common/request';
import { clientInfo } from '../common/request';
import { parse, text } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from './billing.service';
import { addMonths } from './order-code';

const planPatch = z.object({
  name: text(1, 80).optional(),
  priceVnd: z.number().int().min(1_000).max(100_000_000).optional(),
  isActive: z.boolean().optional(),
}).strict();
const orderQuery = z.object({
  status: z.enum(['PENDING', 'PAID', 'CANCELLED', 'EXPIRED']).optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
const confirmBody = z.object({ note: text(3, 300), paidAmountVnd: z.number().int().min(0).max(100_000_000).optional() }).strict();
const cancelBody = z.object({ note: text(3, 300) }).strict();
const txQuery = z.object({ status: z.nativeEnum(BankTransactionStatus).optional(), page: z.coerce.number().int().min(1).default(1) });
const matchBody = z.object({ orderCode: z.string().regex(/^HC[2-9A-HJKMNP-Z]{8}$/), note: text(3, 300) }).strict();
const grantBody = z.object({ product: z.enum(['english', 'vietnamese']), months: z.number().int().min(1).max(36), note: text(3, 300) }).strict();

@Controller('admin/billing')
export class AdminBillingController {
  constructor(private readonly prisma: PrismaService, private readonly billing: BillingService, private readonly audit: AuditService) {}

  @Get('summary')
  @RequirePermissions('admin.access', 'billing.read')
  async summary() {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const [paid30, pending, unmatched, active] = await Promise.all([
      this.prisma.order.aggregate({ where: { status: 'PAID', paidAt: { gte: since } }, _sum: { paidAmountVnd: true }, _count: { _all: true } }),
      this.prisma.order.count({ where: { status: 'PENDING', expiresAt: { gt: new Date() } } }),
      this.prisma.bankTransaction.count({ where: { status: { in: ['UNMATCHED', 'AMOUNT_MISMATCH'] } } }),
      this.prisma.entitlement.groupBy({ by: ['userId', 'productId'], where: { endsAt: { gt: new Date() } } }),
    ]);
    return {
      paymentsEnabled: this.billing.paymentsEnabled(),
      revenue30dVnd: paid30._sum.paidAmountVnd ?? 0, paidOrders30d: paid30._count._all,
      pendingOrders: pending, transactionsToReview: unmatched, activeMemberships: active.length,
    };
  }

  @Get('plans')
  @RequirePermissions('admin.access', 'billing.read')
  plans() {
    return this.prisma.plan.findMany({
      orderBy: [{ product: { slug: 'asc' } }, { sortOrder: 'asc' }],
      include: { product: { select: { slug: true, name: true } } },
    });
  }

  /** Đổi giá/bật tắt gói. Đơn đã tạo giữ giá lúc đặt. */
  @Patch('plans/:id')
  @RequirePermissions('admin.access', 'plans.manage')
  async updatePlan(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    const input = parse(planPatch, body);
    const before = await this.prisma.plan.findUnique({ where: { id } });
    if (!before) throw new NotFoundException();
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.plan.update({ where: { id }, data: input });
      await this.audit.record({
        actorId: auth.userId, action: 'billing.plan_updated', entityType: 'plan', entityId: id, ip: clientInfo(req).ip,
        metadata: { code: row.code, before: { name: before.name, priceVnd: before.priceVnd, isActive: before.isActive }, after: { name: row.name, priceVnd: row.priceVnd, isActive: row.isActive } },
      }, tx);
      return row;
    });
  }

  @Get('orders')
  @RequirePermissions('admin.access', 'billing.read')
  async orders(@Query() query: unknown) {
    const { status, q, page, pageSize } = parse(orderQuery, query);
    const now = new Date();
    const statusWhere: Prisma.OrderWhereInput =
      status === 'EXPIRED' ? { status: 'PENDING', expiresAt: { lte: now } }
        : status === 'PENDING' ? { status: 'PENDING', expiresAt: { gt: now } }
          : status ? { status: status as OrderStatus } : {};
    const term = q?.trim();
    const where: Prisma.OrderWhereInput = {
      ...statusWhere,
      ...(term ? { OR: [{ code: { contains: term.toUpperCase() } }, { user: { email: { contains: term.toLowerCase() } } }] } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
        include: { user: { select: { id: true, email: true, displayName: true } }, plan: { select: { product: { select: { slug: true, name: true } } } } },
      }),
    ]);
    return {
      total, page, pageSize,
      orders: rows.map((o) => ({
        id: o.id, code: o.code, status: o.status === 'PENDING' && o.expiresAt <= now ? 'EXPIRED' : o.status, planName: o.planName, months: o.months,
        amountVnd: o.amountVnd, paidAmountVnd: o.paidAmountVnd, paymentMethod: o.paymentMethod, createdAt: o.createdAt, paidAt: o.paidAt,
        expiresAt: o.expiresAt, note: o.note, user: o.user, product: o.plan.product,
      })),
    };
  }

  /** Xác nhận tay (chuyển khoản sai nội dung, webhook lỗi…). Bắt buộc ghi chú; ghi nhật ký. */
  @Post('orders/:id/confirm')
  @HttpCode(200)
  @RequirePermissions('admin.access', 'billing.manage')
  async confirm(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext) {
    const input = parse(confirmBody, body);
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException();
    const result = await this.prisma.$transaction((tx) =>
      this.billing.applyPayment(tx, id, { method: 'manual', amountVnd: input.paidAmountVnd ?? order.amountVnd, actorId: auth.userId, note: input.note }));
    if (!result.applied) throw new BadRequestException({ error: result.reason });
    return { status: 'PAID', endsAt: result.endsAt };
  }

  @Post('orders/:id/cancel')
  @HttpCode(200)
  @RequirePermissions('admin.access', 'billing.manage')
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    const { note } = parse(cancelBody, body);
    const n = await this.prisma.order.updateMany({ where: { id, status: 'PENDING' }, data: { status: 'CANCELLED', note } });
    if (!n.count) throw new BadRequestException({ error: 'order_not_pending' });
    await this.audit.record({ actorId: auth.userId, action: 'billing.order_cancelled_by_admin', entityType: 'order', entityId: id, ip: clientInfo(req).ip, metadata: { note } });
    return { status: 'CANCELLED' };
  }

  @Get('transactions')
  @RequirePermissions('admin.access', 'billing.read')
  async transactions(@Query() query: unknown) {
    const { status, page } = parse(txQuery, query);
    const where = status ? { status } : {};
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.bankTransaction.count({ where }),
      this.prisma.bankTransaction.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 50, take: 50,
        select: { id: true, provider: true, providerTxId: true, amountVnd: true, content: true, referenceCode: true, transactionDate: true, status: true, createdAt: true, order: { select: { id: true, code: true, status: true, amountVnd: true } } },
      }),
    ]);
    return { total, page, transactions: rows };
  }

  /** Gán giao dịch chưa khớp cho một đơn (khách ghi sai nội dung) và ghi nhận thanh toán. */
  @Post('transactions/:id/match')
  @HttpCode(200)
  @RequirePermissions('admin.access', 'billing.manage')
  async match(@Param('id', ParseUUIDPipe) id: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext) {
    const { orderCode, note } = parse(matchBody, body);
    const [txRow, order] = await Promise.all([
      this.prisma.bankTransaction.findUnique({ where: { id } }),
      this.prisma.order.findUnique({ where: { code: orderCode } }),
    ]);
    if (!txRow) throw new NotFoundException();
    if (!order) throw new BadRequestException({ error: 'order_not_found', fields: ['orderCode'] });
    if (txRow.status === 'MATCHED') throw new BadRequestException({ error: 'transaction_already_matched' });
    const result = await this.prisma.$transaction(async (tx) => {
      const r = await this.billing.applyPayment(tx, order.id, { method: 'manual', amountVnd: txRow.amountVnd, actorId: auth.userId, note: `${note} (giao dịch ${txRow.providerTxId})` });
      if (r.applied) await tx.bankTransaction.update({ where: { id }, data: { status: 'MATCHED', orderId: order.id } });
      return r;
    });
    if (!result.applied) throw new BadRequestException({ error: result.reason });
    return { status: 'MATCHED', orderCode, endsAt: result.endsAt };
  }

  /** Tặng/cấp quyền không qua đơn hàng (giáo viên dùng thử, bù lỗi…). */
  @Post('users/:id/grant')
  @HttpCode(201)
  @RequirePermissions('admin.access', 'billing.manage')
  async grant(@Param('id', ParseUUIDPipe) userId: string, @Body() body: unknown, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    const { product, months, note } = parse(grantBody, body);
    const [user, prod] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      this.prisma.product.findUniqueOrThrow({ where: { slug: product } }),
    ]);
    if (!user) throw new NotFoundException();
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const current = await tx.entitlement.findFirst({ where: { userId, productId: prod.id, endsAt: { gt: now } }, orderBy: { endsAt: 'desc' } });
      const startsAt = current ? current.endsAt : now;
      const row = await tx.entitlement.create({
        data: { userId, productId: prod.id, startsAt, endsAt: addMonths(startsAt, months), source: 'manual', grantedById: auth.userId, note },
      });
      await this.audit.record({
        actorId: auth.userId, action: 'billing.membership_granted', entityType: 'user', entityId: userId, ip: clientInfo(req).ip,
        metadata: { product, months, endsAt: row.endsAt.toISOString(), note },
      }, tx);
      return { product, startsAt: row.startsAt, endsAt: row.endsAt };
    });
  }

  @Get('users/:id/memberships')
  @RequirePermissions('admin.access', 'billing.read')
  async userMemberships(@Param('id', ParseUUIDPipe) userId: string) {
    const rows = await this.prisma.entitlement.findMany({
      where: { userId }, orderBy: { endsAt: 'desc' }, take: 50,
      include: { product: { select: { slug: true, name: true } }, order: { select: { code: true } } },
    });
    return rows.map((r) => ({ product: r.product, startsAt: r.startsAt, endsAt: r.endsAt, source: r.source, note: r.note, orderCode: r.order?.code ?? null, active: r.endsAt > new Date() }));
  }
}
