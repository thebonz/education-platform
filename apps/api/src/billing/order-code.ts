import { randomInt } from 'node:crypto';

// Bỏ các ký tự dễ nhầm khi gõ tay: 0/O, 1/I/L.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Mã đơn dạng HC + 8 ký tự, dùng làm nội dung chuyển khoản. ~8,5e11 tổ hợp. */
export function newOrderCode(): string {
  let s = 'HC';
  for (let i = 0; i < 8; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

/** Tìm mã đơn trong nội dung chuyển khoản (ngân hàng có thể thêm tiền tố, đổi chữ thường, chèn khoảng trắng). */
export function findOrderCode(content: string): string | null {
  const compact = content.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = compact.match(new RegExp(`HC[${ALPHABET}]{8}`));
  return m ? m[0] : null;
}

/** Cộng tháng theo lịch; ngày cuối tháng được kẹp (31/01 + 1 tháng = 28 hoặc 29/02). */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}
