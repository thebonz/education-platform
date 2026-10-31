import { BadRequestException } from '@nestjs/common';
import { z, ZodTypeAny } from 'zod';

/** Kiểm tra dữ liệu đầu vào; trả lỗi 400 chỉ kèm tên trường, không lặp lại giá trị người dùng gửi. */
export function parse<T extends ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestException({
      error: 'validation_failed',
      fields: [...new Set(result.error.issues.map((i) => i.path.join('.') || '_'))],
    });
  }
  return result.data;
}

/** Chuẩn hóa chuỗi người dùng nhập: Unicode NFC và bỏ khoảng trắng thừa ở hai đầu. */
export const text = (min: number, max: number) =>
  z.string().transform((s) => s.normalize('NFC').trim()).pipe(z.string().min(min).max(max));

export const email = z
  .string()
  .transform((s) => s.normalize('NFC').trim().toLowerCase())
  .pipe(z.string().email().max(254));

export const password = z.string().min(10).max(128);

export const siteKey = z.enum(['english', 'vietnamese', 'admin']);
