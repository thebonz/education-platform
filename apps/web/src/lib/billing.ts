export type Plan = { id: string; code: string; name: string; period: 'MONTH' | 'YEAR'; months: number; priceVnd: number };
export type PlansResult = { paymentsEnabled: boolean; plans: Plan[] };
export type OrderStatus = 'PENDING' | 'PAID' | 'CANCELLED' | 'EXPIRED';
export type Transfer = {
  mode: 'sandbox' | 'live'; bankName: string; bankBin: string; accountNumber: string; accountName: string;
  amountVnd: number; content: string; qrPayload: string;
};
export type OrderView = {
  code: string; status: OrderStatus; planName: string; months: number; amountVnd: number; expiresAt: string; paidAt: string | null; createdAt: string;
  product?: { slug: 'english' | 'vietnamese'; name: string };
  membership?: { startsAt: string; endsAt: string } | null;
  transfer?: Transfer | null;
};
export type BillingMe = {
  memberships: { product: { id: string; slug: 'english' | 'vietnamese'; name: string }; endsAt: string }[];
  orders: OrderView[];
};

export const formatVnd = (n: number) => `${new Intl.NumberFormat('vi-VN').format(n)} đ`;
export const formatDate = (iso: string, lang: 'vi' | 'en') =>
  new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(iso));
export const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ''));
