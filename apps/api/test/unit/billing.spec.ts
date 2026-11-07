import { loadEnv } from '../../src/config/env';
import { addMonths, findOrderCode, newOrderCode } from '../../src/billing/order-code';
import { crc16, vietQrPayload } from '../../src/billing/vietqr';

describe('VietQR', () => {
  it('CRC-16/CCITT-FALSE đúng giá trị chuẩn', () => {
    expect(crc16('123456789')).toBe('29B1');
  });

  it('chuỗi QR đúng cấu trúc EMVCo, CRC khớp, nội dung chỉ còn chữ không dấu', () => {
    const p = vietQrPayload({ bankBin: '970415', account: '1234567890', amountVnd: 599000, content: 'HC2345ABCD' });
    expect(p.startsWith('000201010212')).toBe(true);
    expect(p).toContain('0010A000000727');
    expect(p).toContain('0006970415011012345678900208QRIBFTTA');
    expect(p).toContain('5303704540659900058' + '02VN');
    expect(p).toContain('62140810HC2345ABCD');
    expect(p.slice(-8, -4)).toBe('6304');
    expect(crc16(p.slice(0, -4))).toBe(p.slice(-4));
    expect(vietQrPayload({ bankBin: '970415', account: '1234567890', amountVnd: 1000, content: 'Thanh toán HC2345ABCD!' })).toContain('0819Thanh ton HC2345ABCD');
    expect(() => vietQrPayload({ bankBin: '97041', account: '1234567890', amountVnd: 1, content: 'x' })).toThrow();
    expect(() => vietQrPayload({ bankBin: '970415', account: '12ab', amountVnd: 1, content: 'x' })).toThrow();
    expect(() => vietQrPayload({ bankBin: '970415', account: '1234567890', amountVnd: 0, content: 'x' })).toThrow();
  });
});

describe('mã đơn và cộng tháng', () => {
  it('mã đơn không có ký tự dễ nhầm; tìm được trong nội dung chuyển khoản bị ngân hàng biến đổi', () => {
    for (let i = 0; i < 200; i++) expect(newOrderCode()).toMatch(/^HC[2-9A-HJKMNP-Z]{8}$/);
    expect(findOrderCode('MBVCB.123 hc2345abcd chuyen tien')).toBe('HC2345ABCD');
    expect(findOrderCode('NGUYEN VAN A CHUYEN KHOAN HC 2345 ABCD')).toBe('HC2345ABCD');
    expect(findOrderCode('chuyen tien an trua')).toBeNull();
    expect(findOrderCode('HC2345ABC0')).toBeNull(); // số 0 không có trong bảng mã
  });

  it('cộng tháng theo lịch, kẹp ngày cuối tháng', () => {
    expect(addMonths(new Date('2026-01-31T10:00:00Z'), 1).toISOString()).toBe('2026-02-28T10:00:00.000Z');
    expect(addMonths(new Date('2028-01-31T10:00:00Z'), 1).toISOString()).toBe('2028-02-29T10:00:00.000Z');
    expect(addMonths(new Date('2026-11-08T00:00:00Z'), 12).toISOString()).toBe('2027-11-08T00:00:00.000Z');
    expect(addMonths(new Date('2026-12-15T00:00:00Z'), 1).toISOString()).toBe('2027-01-15T00:00:00.000Z');
  });
});

describe('cấu hình thanh toán', () => {
  const base = { DATABASE_URL: 'postgresql://x@localhost/x' };
  it('mặc định tắt thanh toán', () => {
    expect(loadEnv(base).PAYMENT_MODE).toBe('disabled');
  });
  it('bật thanh toán bắt buộc có tài khoản nhận và khóa webhook đủ dài', () => {
    expect(() => loadEnv({ ...base, PAYMENT_MODE: 'sandbox' })).toThrow(/PAYMENT_BANK_ACCOUNT/);
    expect(() => loadEnv({ ...base, PAYMENT_MODE: 'live', PAYMENT_BANK_ACCOUNT: '1234567890', PAYMENT_BANK_ACCOUNT_NAME: 'A', SEPAY_WEBHOOK_KEY: 'ngan' })).toThrow(/SEPAY_WEBHOOK_KEY/);
    expect(loadEnv({ ...base, PAYMENT_MODE: 'sandbox', PAYMENT_BANK_ACCOUNT: '1234567890', PAYMENT_BANK_ACCOUNT_NAME: 'A', SEPAY_WEBHOOK_KEY: 'k'.repeat(32) }).PAYMENT_MODE).toBe('sandbox');
    expect(() => loadEnv({ ...base, PAYMENT_BANK_ACCOUNT: '12-34' })).toThrow();
  });
});
