import { createTestApp, createUser, login, ORIGIN_ADMIN, ORIGIN_EN, ORIGIN_VI, TestApp } from './helpers';

const PW = 'Correct-Horse-42';
const KEY = 'test-sepay-key-0123456789abcdef';
// Số tài khoản GIẢ cho test (repo công khai – không bao giờ dùng số thật ở đây).
const ACCOUNT = '100000000001';
const PAY_ENV = { PAYMENT_MODE: 'sandbox', PAYMENT_BANK_ACCOUNT: ACCOUNT, PAYMENT_BANK_ACCOUNT_NAME: 'NGUYEN VAN TEST', SEPAY_WEBHOOK_KEY: KEY };

describe('Gói thành viên và thanh toán', () => {
  let t: TestApp;
  let member: string;
  let other: string;
  let accountant: string;
  let premiumSlug: string;
  let txSeq = 1000;

  const webhook = (content: string, amount: number, extra: Record<string, unknown> = {}) =>
    t.http().post('/api/webhooks/sepay').set('Authorization', `Apikey ${KEY}`).send({
      id: ++txSeq, gateway: 'VietinBank', transactionDate: '2026-11-08 10:15:00', accountNumber: ACCOUNT, code: null,
      content, transferType: 'in', transferAmount: amount, accumulated: 0, subAccount: null, referenceCode: `FT${txSeq}`, description: '', ...extra,
    });

  beforeAll(async () => {
    t = await createTestApp(PAY_ENV);
    await createUser(t.prisma, 'member@example.com', PW);
    await createUser(t.prisma, 'other@example.com', PW);
    await createUser(t.prisma, 'accountant@example.com', PW, ['accountant']);
    member = await login(t, 'member@example.com', PW, ORIGIN_EN);
    other = await login(t, 'other@example.com', PW, ORIGIN_EN);
    accountant = await login(t, 'accountant@example.com', PW, ORIGIN_ADMIN);
    // Một game English trả phí để kiểm tra quyền chơi
    const g = await t.prisma.game.findFirstOrThrow({ where: { product: { slug: 'english' }, isPublished: true } });
    await t.prisma.game.update({ where: { id: g.id }, data: { accessLevel: 'PREMIUM' } });
    premiumSlug = g.slug;
  });
  afterAll(async () => {
    await t.close();
    for (const k of Object.keys(PAY_ENV)) delete process.env[k];
  });

  const post = (cookie: string, url: string, body: object = {}, origin = ORIGIN_EN) => t.http().post(url).set('Origin', origin).set('Cookie', cookie).send(body);
  const plan = async (code: string) => (await t.prisma.plan.findUniqueOrThrow({ where: { code } })).id;

  it('bảng giá theo từng sản phẩm, đúng giá nạp sẵn', async () => {
    const res = await t.http().get('/api/billing/plans?product=english').expect(200);
    expect(res.body.paymentsEnabled).toBe(true);
    expect(res.body.plans.map((p: { code: string; priceVnd: number }) => [p.code, p.priceVnd])).toEqual([['english-year', 599000], ['english-month', 55000]]);
    await t.http().get('/api/billing/plans?product=abc').expect(400);
  });

  it('chưa mua: game trả phí bị khóa', async () => {
    const res = await t.http().get(`/api/catalog/products/english/games/${premiumSlug}/play`).set('Cookie', member);
    expect(res.status).toBe(403);
  });

  let code: string;
  it('tạo đơn cần đăng nhập; bấm lại dùng lại đơn đang chờ; chỉ chủ đơn xem được', async () => {
    const planId = await plan('english-year');
    await t.http().post('/api/billing/orders').set('Origin', ORIGIN_EN).send({ planId }).expect(401);
    const a = await post(member, '/api/billing/orders', { planId }).expect(201);
    const b = await post(member, '/api/billing/orders', { planId }).expect(201);
    expect(a.body.code).toMatch(/^HC[2-9A-HJKMNP-Z]{8}$/);
    expect(b.body).toEqual({ code: a.body.code, reused: true });
    code = a.body.code;

    const view = await t.http().get(`/api/billing/orders/${code}`).set('Cookie', member).expect(200);
    expect(view.body).toMatchObject({ status: 'PENDING', amountVnd: 599000, months: 12, product: { slug: 'english' } });
    expect(view.body.transfer).toMatchObject({ accountNumber: ACCOUNT, accountName: 'NGUYEN VAN TEST', bankName: 'VietinBank', content: code, amountVnd: 599000, mode: 'sandbox' });
    expect(view.body.transfer.qrPayload).toContain(code);
    await t.http().get(`/api/billing/orders/${code}`).set('Cookie', other).expect(404);
  });

  it('webhook: sai khóa bị từ chối; không cần Origin', async () => {
    await t.http().post('/api/webhooks/sepay').set('Authorization', 'Apikey sai-khoa').send({}).expect(401);
    await t.http().post('/api/webhooks/sepay').send({}).expect(401);
  });

  it('chuyển thiếu tiền: không cấp quyền, giao dịch chờ đối soát', async () => {
    const res = await webhook(`CT ${code.toLowerCase()} nguyen van a`, 500000).expect(200);
    expect(res.body).toEqual({ success: true, result: 'amount_too_low' });
    const order = await t.prisma.order.findUniqueOrThrow({ where: { code } });
    expect(order.status).toBe('PENDING');
    const tx = await t.prisma.bankTransaction.findFirstOrThrow({ where: { providerTxId: String(txSeq) } });
    expect(tx.status).toBe('AMOUNT_MISMATCH');
  });

  it('chuyển đủ tiền: đơn PAID, cấp quyền 12 tháng, mở game trả phí của đúng sản phẩm', async () => {
    const res = await webhook(`MBVCB.1 ${code} chuyen khoan`, 599000).expect(200);
    expect(res.body).toEqual({ success: true, result: 'matched' });
    const order = await t.prisma.order.findUniqueOrThrow({ where: { code }, include: { entitlement: true } });
    expect(order).toMatchObject({ status: 'PAID', paymentMethod: 'sepay', paidAmountVnd: 599000 });
    const days = (order.entitlement!.endsAt.getTime() - order.entitlement!.startsAt.getTime()) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(365);
    expect(days).toBeLessThanOrEqual(366);

    await t.http().get(`/api/catalog/products/english/games/${premiumSlug}/play`).set('Cookie', member).expect(200);
    const view = await t.http().get(`/api/billing/orders/${code}`).set('Cookie', member).expect(200);
    expect(view.body.status).toBe('PAID');
    expect(view.body.transfer).toBeNull();
    const me = await t.http().get('/api/billing/me').set('Cookie', member).expect(200);
    expect(me.body.memberships).toEqual([expect.objectContaining({ product: expect.objectContaining({ slug: 'english' }) })]);
    // Gói English không mở game Tiếng Việt trả phí
    const vi = await t.prisma.game.findFirstOrThrow({ where: { product: { slug: 'vietnamese' }, isPublished: true } });
    await t.prisma.game.update({ where: { id: vi.id }, data: { accessLevel: 'PREMIUM' } });
    const vm = await login(t, 'member@example.com', PW, ORIGIN_VI);
    await t.http().get(`/api/catalog/products/vietnamese/games/${vi.slug}/play`).set('Cookie', vm).expect(403);
    await t.prisma.game.update({ where: { id: vi.id }, data: { accessLevel: 'FREE' } });
  });

  it('SePay gửi lại cùng giao dịch: không cấp quyền hai lần', async () => {
    const payload = { id: 777777, transactionDate: '2026-11-08 10:20:00', accountNumber: ACCOUNT, content: code, transferType: 'in', transferAmount: 599000 };
    const r1 = await t.http().post('/api/webhooks/sepay').set('Authorization', `Apikey ${KEY}`).send(payload).expect(200);
    const r2 = await t.http().post('/api/webhooks/sepay').set('Authorization', `Apikey ${KEY}`).send(payload).expect(200);
    expect(r1.body.result).toBe('already_paid'); // khách chuyển 2 lần cho đơn đã trả: chờ xử lý tay
    expect(r2.body.result).toBe('duplicate');
    expect(await t.prisma.entitlement.count({ where: { order: { code } } })).toBe(1);
  });

  it('giao dịch ra, sai tài khoản, không có mã đơn: lưu lại để đối soát', async () => {
    expect((await webhook(code, 599000, { transferType: 'out' })).body.result).toBe('ignored');
    expect((await webhook(code, 599000, { accountNumber: '999999999' })).body.result).toBe('ignored');
    expect((await webhook('chuyen tien an trua', 50000)).body.result).toBe('unmatched');
  });

  it('gia hạn nối tiếp: mua thêm 1 tháng khi còn hạn thì cộng từ ngày hết hạn', async () => {
    const before = await t.prisma.entitlement.findFirstOrThrow({ where: { order: { code } } });
    const res = await post(member, '/api/billing/orders', { planId: await plan('english-month') }).expect(201);
    await webhook(res.body.code, 55000).expect(200);
    const renewal = await t.prisma.entitlement.findFirstOrThrow({ where: { order: { code: res.body.code } } });
    expect(renewal.startsAt.toISOString()).toBe(before.endsAt.toISOString());
  });

  it('đổi giá: chỉ người có quyền; đơn cũ giữ giá lúc đặt; ghi nhật ký', async () => {
    const planId = await plan('english-month');
    const pending = await post(other, '/api/billing/orders', { planId }).expect(201);
    await t.http().patch(`/api/admin/billing/plans/${planId}`).set('Origin', ORIGIN_ADMIN).set('Cookie', accountant).send({ priceVnd: 60000 }).expect(403);
    const sa = await createUser(t.prisma, 'sa@example.com', PW, ['super_admin']).then(() => login(t, 'sa@example.com', PW, ORIGIN_ADMIN));
    await t.http().patch(`/api/admin/billing/plans/${planId}`).set('Origin', ORIGIN_ADMIN).set('Cookie', sa).send({ priceVnd: 60000 }).expect(200);
    const old = await t.http().get(`/api/billing/orders/${pending.body.code}`).set('Cookie', other).expect(200);
    expect(old.body.amountVnd).toBe(55000);
    const fresh = await post(other, '/api/billing/orders', { planId }).expect(201);
    expect(fresh.body.code).not.toBe(pending.body.code);
    const log = await t.prisma.auditLog.findFirstOrThrow({ where: { action: 'billing.plan_updated' } });
    expect(log.metadata).toMatchObject({ before: { priceVnd: 55000 }, after: { priceVnd: 60000 } });
  });

  it('kế toán: xem đơn, gán giao dịch chưa khớp, xác nhận tay (bắt buộc ghi chú), tặng gói', async () => {
    await t.http().get('/api/admin/billing/orders').set('Cookie', member).expect(403);
    const list = await t.http().get('/api/admin/billing/orders?status=PENDING').set('Cookie', accountant).expect(200);
    expect(list.body.orders.every((o: { status: string }) => o.status === 'PENDING')).toBe(true);
    const target = list.body.orders.find((o: { user: { email: string }; amountVnd: number }) => o.user.email === 'other@example.com' && o.amountVnd === 55000);

    // Khách ghi sai nội dung: giao dịch không khớp → kế toán gán vào đơn
    await webhook('nop tien goi thang', 55000).expect(200);
    const txs = await t.http().get('/api/admin/billing/transactions?status=UNMATCHED').set('Cookie', accountant).expect(200);
    const tx = txs.body.transactions.find((x: { content: string }) => x.content.includes('nop tien goi thang'));
    await post(accountant, `/api/admin/billing/transactions/${tx.id}/match`, { orderCode: target.code }, ORIGIN_ADMIN).expect(400); // thiếu ghi chú
    const m = await post(accountant, `/api/admin/billing/transactions/${tx.id}/match`, { orderCode: target.code, note: 'Khách ghi sai nội dung' }, ORIGIN_ADMIN).expect(200);
    expect(m.body.status).toBe('MATCHED');
    expect((await t.prisma.order.findUniqueOrThrow({ where: { code: target.code } })).status).toBe('PAID');

    // Xác nhận tay đơn khác
    const fresh = list.body.orders.find((o: { user: { email: string }; amountVnd: number }) => o.user.email === 'other@example.com' && o.amountVnd === 60000);
    await post(accountant, `/api/admin/billing/orders/${fresh.id}/confirm`, { note: 'Chuyển tiền mặt tại văn phòng' }, ORIGIN_ADMIN).expect(200);
    await post(accountant, `/api/admin/billing/orders/${fresh.id}/confirm`, { note: 'lần hai' }, ORIGIN_ADMIN).expect(400);

    // Tặng 1 tháng Tiếng Việt
    const otherUser = await t.prisma.user.findUniqueOrThrow({ where: { email: 'other@example.com' } });
    const g = await post(accountant, `/api/admin/billing/users/${otherUser.id}/grant`, { product: 'vietnamese', months: 1, note: 'Giáo viên dùng thử' }, ORIGIN_ADMIN).expect(201);
    expect(g.body.product).toBe('vietnamese');
    const ms = await t.http().get(`/api/admin/billing/users/${otherUser.id}/memberships`).set('Cookie', accountant).expect(200);
    expect(ms.body.map((x: { source: string }) => x.source).sort()).toEqual(['manual', 'order', 'order']);

    const actions = (await t.prisma.auditLog.findMany({ where: { action: { startsWith: 'billing.' } } })).map((l) => l.action);
    expect(actions).toEqual(expect.arrayContaining(['billing.order_created', 'billing.order_paid', 'billing.order_confirmed_manually', 'billing.membership_granted']));
    const summary = await t.http().get('/api/admin/billing/summary').set('Cookie', accountant).expect(200);
    expect(summary.body.paidOrders30d).toBeGreaterThanOrEqual(4);
  });

  it('khách tự huỷ đơn đang chờ', async () => {
    const res = await post(member, '/api/billing/orders', { planId: await plan('vietnamese-month') }).expect(201);
    await post(member, `/api/billing/orders/${res.body.code}/cancel`).expect(200);
    const v = await t.http().get(`/api/billing/orders/${res.body.code}`).set('Cookie', member).expect(200);
    expect(v.body.status).toBe('CANCELLED');
    await post(member, `/api/billing/orders/${res.body.code}/cancel`).expect(403);
  });
});

describe('Thanh toán đang tắt', () => {
  let t: TestApp;
  beforeAll(async () => { t = await createTestApp({ PAYMENT_MODE: 'disabled' }); });
  afterAll(async () => { await t.close(); delete process.env.PAYMENT_MODE; });

  it('không tạo được đơn, webhook bị từ chối, bảng giá báo chưa mở bán', async () => {
    await createUser(t.prisma, 'm@example.com', PW);
    const c = await login(t, 'm@example.com', PW, ORIGIN_EN);
    const planId = (await t.prisma.plan.findUniqueOrThrow({ where: { code: 'english-year' } })).id;
    await t.http().post('/api/billing/orders').set('Origin', ORIGIN_EN).set('Cookie', c).send({ planId }).expect(503);
    await t.http().post('/api/webhooks/sepay').set('Authorization', `Apikey ${KEY}`).send({}).expect(401);
    expect((await t.http().get('/api/billing/plans?product=vietnamese').expect(200)).body.paymentsEnabled).toBe(false);
  });
});
