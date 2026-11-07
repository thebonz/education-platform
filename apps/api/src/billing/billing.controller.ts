import {
  BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Param, Post, Query, Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { z } from 'zod';
import { AuditService } from '../audit/audit.service';
import { CurrentAuth, RequireAuth } from '../common/decorators';
import type { AppRequest, AuthContext } from '../common/request';
import { clientInfo } from '../common/request';
import { parse } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';
import { BillingService } from './billing.service';

const orderBody = z.object({ planId: z.string().uuid() }).strict();
const codeParam = z.string().regex(/^HC[2-9A-HJKMNP-Z]{8}$/);
const MAX_PENDING_ORDERS = 5;

const orderView = (o: {
  code: string; status: string; planName: string; months: number; amountVnd: number; expiresAt: Date; paidAt: Date | null; createdAt: Date;
  plan?: { product: { slug: string; name: string } };
}) => ({
  code: o.code, status: o.status === 'PENDING' && o.expiresAt <= new Date() ? 'EXPIRED' : o.status,
  planName: o.planName, months: o.months, amountVnd: o.amountVnd, expiresAt: o.expiresAt, paidAt: o.paidAt, createdAt: o.createdAt,
  ...(o.plan ? { product: o.plan.product } : {}),
});

@Controller('billing')
export class BillingController {
  constructor(private readonly prisma: PrismaService, private readonly billing: BillingService, private readonly audit: AuditService) {}

  /** Bảng giá công khai của một sản phẩm. */
  @Get('plans')
  async plans(@Query('product') product: unknown) {
    const slug = parse(z.enum(['english', 'vietnamese']), product);
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true, product: { slug } },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, code: true, name: true, period: true, months: true, priceVnd: true },
    });
    return { paymentsEnabled: this.billing.paymentsEnabled(), plans };
  }

  @Post('orders')
  @HttpCode(201)
  @RequireAuth()
  async create(@Body() body: unknown, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    if (!this.billing.paymentsEnabled()) throw new ServiceUnavailableException({ error: 'payments_disabled' });
    const { planId } = parse(orderBody, body);
    const plan = await this.prisma.plan.findFirst({ where: { id: planId, isActive: true } });
    if (!plan) throw new BadRequestException({ error: 'plan_not_found' });
    const pending = await this.prisma.order.count({ where: { userId: auth.userId, status: 'PENDING', expiresAt: { gt: new Date() }, planId: { not: plan.id } } });
    if (pending >= MAX_PENDING_ORDERS) throw new BadRequestException({ error: 'too_many_pending_orders' });
    const { order, reused } = await this.billing.createOrder(auth.userId, plan);
    if (!reused) {
      await this.audit.record({
        actorId: auth.userId, action: 'billing.order_created', entityType: 'order', entityId: order.id, ip: clientInfo(req).ip,
        metadata: { code: order.code, plan: plan.code, amountVnd: order.amountVnd },
      });
    }
    return { code: order.code, reused };
  }

  /** Chi tiết đơn + thông tin chuyển khoản. Chỉ chủ đơn xem được. */
  @Get('orders/:code')
  @RequireAuth()
  async order(@Param('code') codeRaw: string, @CurrentAuth() auth: AuthContext) {
    const code = parse(codeParam, codeRaw);
    const order = await this.prisma.order.findUnique({ where: { code }, include: { plan: { select: { product: { select: { slug: true, name: true } } } } } });
    if (!order || order.userId !== auth.userId) throw new NotFoundException();
    const view = orderView(order);
    const membership = order.status === 'PAID'
      ? await this.prisma.entitlement.findUnique({ where: { orderId: order.id }, select: { startsAt: true, endsAt: true } })
      : null;
    return { ...view, membership, transfer: view.status === 'PENDING' && this.billing.paymentsEnabled() ? this.billing.transferInfo(order) : null };
  }

  @Post('orders/:code/cancel')
  @HttpCode(200)
  @RequireAuth()
  async cancel(@Param('code') codeRaw: string, @CurrentAuth() auth: AuthContext, @Req() req: AppRequest) {
    const code = parse(codeParam, codeRaw);
    const order = await this.prisma.order.findUnique({ where: { code } });
    if (!order || order.userId !== auth.userId) throw new NotFoundException();
    if (order.status !== 'PENDING') throw new ForbiddenException({ error: 'order_not_pending' });
    const n = await this.prisma.order.updateMany({ where: { id: order.id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    if (n.count) {
      await this.audit.record({ actorId: auth.userId, action: 'billing.order_cancelled', entityType: 'order', entityId: order.id, ip: clientInfo(req).ip, metadata: { code } });
    }
    return { code, status: 'CANCELLED' };
  }

  /** Gói đang dùng và lịch sử đơn của chính người dùng. */
  @Get('me')
  @RequireAuth()
  async me(@CurrentAuth() auth: AuthContext) {
    const [memberships, orders] = await Promise.all([
      this.billing.activeMemberships(auth.userId),
      this.prisma.order.findMany({
        where: { userId: auth.userId }, orderBy: { createdAt: 'desc' }, take: 20,
        include: { plan: { select: { product: { select: { slug: true, name: true } } } } },
      }),
    ]);
    return { memberships, orders: orders.map(orderView) };
  }
}
