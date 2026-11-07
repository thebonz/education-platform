/**
 * Chuỗi VietQR (chuẩn EMVCo / NAPAS 247) để ứng dụng ngân hàng quét và điền sẵn
 * ngân hàng, số tài khoản, số tiền, nội dung chuyển khoản. Tự tạo, không gọi dịch vụ ngoài.
 */
const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;

/** CRC-16/CCITT-FALSE (poly 0x1021, khởi tạo 0xFFFF) theo chuẩn EMVCo. */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(input, 'utf8')) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function vietQrPayload(opts: { bankBin: string; account: string; amountVnd: number; content: string }): string {
  if (!/^\d{6}$/.test(opts.bankBin)) throw new Error('BIN ngân hàng không hợp lệ');
  if (!/^\d{6,19}$/.test(opts.account)) throw new Error('Số tài khoản không hợp lệ');
  if (!Number.isInteger(opts.amountVnd) || opts.amountVnd <= 0) throw new Error('Số tiền không hợp lệ');
  // Nội dung chỉ dùng chữ không dấu, số và khoảng trắng (bỏ dấu tiếng Việt) để mọi ngân hàng giữ nguyên.
  const content = opts.content.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^A-Za-z0-9 ]/g, '').slice(0, 25);
  const merchant = field('00', 'A000000727') + field('01', field('00', opts.bankBin) + field('01', opts.account)) + field('02', 'QRIBFTTA');
  const body =
    field('00', '01') + field('01', '12') + field('38', merchant) + field('53', '704') +
    field('54', String(opts.amountVnd)) + field('58', 'VN') + field('62', field('08', content)) + '6304';
  return body + crc16(body);
}
