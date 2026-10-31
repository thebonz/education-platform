import { createHash, randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

/** Token ngẫu nhiên 256 bit, dạng base64url. Chỉ gửi cho người dùng; DB chỉ lưu hash. */
export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

// Argon2id (mặc định của @node-rs/argon2). Tham số theo khuyến nghị OWASP: 19 MiB, 2 vòng.
const ARGON_OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Hash giả để thời gian phản hồi khi email không tồn tại gần bằng khi sai mật khẩu.
let dummyHash: Promise<string> | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('happyclass-timing-equalizer');
  await verifyPassword(await dummyHash, password);
}
