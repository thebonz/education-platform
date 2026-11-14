import { readdir, readFile, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '../config/env';

/** Đọc file trạng thái JSON do script vận hành ghi (ops/backup-offsite.sh, ops/restore-test.sh). */
export async function readStatusFile(name: string): Promise<Record<string, unknown> | null> {
  const dir = env().STATUS_DIR;
  if (!dir) return null;
  try {
    const v = JSON.parse(await readFile(join(dir, name), 'utf8'));
    return v && typeof v === 'object' ? v : null;
  } catch { return null; }
}

/** Đếm file .wav trong thư mục đệm giọng đọc (thư mục con 2 ký tự). */
export async function countWav(dir: string): Promise<number> {
  let n = 0;
  for (const sub of await readdir(dir).catch(() => [] as string[])) {
    if (!/^[0-9a-f]{2}$/.test(sub)) continue;
    n += (await readdir(join(dir, sub)).catch(() => [] as string[])).filter((f) => f.endsWith('.wav')).length;
  }
  return n;
}

export async function freeBytes(path: string): Promise<number | null> {
  try { const s = await statfs(path); return s.bavail * s.bsize; } catch { return null; }
}

const HOUR = 3_600_000;
export const hoursSince = (iso: unknown) => (typeof iso === 'string' && !Number.isNaN(Date.parse(iso)) ? (Date.now() - Date.parse(iso)) / HOUR : null);
