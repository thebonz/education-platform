import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(4000),
  DATABASE_URL: z.string().min(1),

  // Gốc URL của từng site. Chế độ domain: https://english.happyclass.asia
  // Chế độ đường dẫn (chạy local): http://localhost:3100/english
  SITE_ENGLISH_URL: z.string().url().default('http://localhost:3100/english'),
  SITE_VIETNAMESE_URL: z.string().url().default('http://localhost:3100/vietnamese'),
  SITE_ADMIN_URL: z.string().url().default('http://localhost:3100/admin'),
  // Origin bổ sung được phép gọi API (phân tách bằng dấu phẩy)
  EXTRA_ALLOWED_ORIGINS: z.string().default(''),

  SESSION_COOKIE_NAME: z.string().default('hc_session'),
  // Ví dụ .happyclass.asia để dùng chung phiên giữa các subdomain. Để trống khi chạy local.
  COOKIE_DOMAIN: z.string().default(''),
  COOKIE_SECURE: bool.default('false'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),

  // Số proxy đứng trước API (Next.js = 1; thêm Caddy/Cloudflare thì tăng)
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(10),

  // Email: log (in ra console, chỉ dev), memory (test), smtp (thật)
  MAIL_TRANSPORT: z.enum(['log', 'memory', 'smtp']).default('log'),
  MAIL_FROM: z.string().default('HappyClass <no-reply@happyclass.asia>'),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  SMTP_SECURE: bool.default('false'),

  TERMS_VERSION: z.string().default('2026-11-01'),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Cấu hình môi trường không hợp lệ: ${names}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production') {
    if (!env.COOKIE_SECURE) throw new Error('COOKIE_SECURE phải là true ở production');
    if (env.MAIL_TRANSPORT !== 'smtp') throw new Error('MAIL_TRANSPORT phải là smtp ở production');
  }
  return env;
}

export function env(): Env {
  if (!cached) cached = loadEnv();
  return cached;
}

/** Chỉ dùng trong test để đọc lại process.env. */
export function resetEnvCache() {
  cached = null;
}

export type SiteKey = 'english' | 'vietnamese' | 'admin';

export function siteUrl(site: SiteKey): string {
  const e = env();
  const url = site === 'english' ? e.SITE_ENGLISH_URL : site === 'vietnamese' ? e.SITE_VIETNAMESE_URL : e.SITE_ADMIN_URL;
  return url.replace(/\/+$/, '');
}

export function allowedOrigins(): Set<string> {
  const e = env();
  const origins = new Set<string>();
  for (const url of [e.SITE_ENGLISH_URL, e.SITE_VIETNAMESE_URL, e.SITE_ADMIN_URL]) origins.add(new URL(url).origin);
  for (const extra of e.EXTRA_ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)) {
    origins.add(new URL(extra).origin);
  }
  return origins;
}
