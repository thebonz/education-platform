/**
 * Mô tả cấu trúc dữ liệu của một template (từ schema zod) để Game Builder dựng form tự động.
 * Chỉ mô tả hình dạng (kiểu, giới hạn, mặc định); quy tắc chéo (đáp án phải nằm trong lựa chọn, id không trùng…)
 * vẫn do validateGameData kiểm tra và báo lỗi theo đường dẫn trường.
 */
import { z } from 'zod';
import { TEMPLATES, type TemplateKey } from './templates';

export type FieldNode =
  | { type: 'string'; min: number; max: number | null }
  | { type: 'number'; min: number | null; max: number | null; int: boolean }
  | { type: 'boolean' }
  | { type: 'choice'; options: (string | number)[] }
  | { type: 'array'; item: FieldNode; min: number; max: number | null }
  | { type: 'object'; fields: ObjectField[] }
  | { type: 'variant'; discriminator: string; options: Record<string, ObjectField[]> }
  | { type: 'unknown' };

export type ObjectField = { key: string; optional: boolean; default?: unknown; node: FieldNode };

type AnyDef = { typeName?: string; [k: string]: unknown };
const defOf = (s: z.ZodTypeAny) => s._def as AnyDef;

/** Bỏ các lớp bọc (refine/superRefine/transform, optional, default) và ghi lại optional/default. */
function unwrap(schema: z.ZodTypeAny): { inner: z.ZodTypeAny; optional: boolean; default?: unknown } {
  let s = schema;
  let optional = false;
  let dflt: unknown;
  for (let guard = 0; guard < 20; guard++) {
    const d = defOf(s);
    if (d.typeName === 'ZodEffects') s = d.schema as z.ZodTypeAny;
    else if (d.typeName === 'ZodOptional' || d.typeName === 'ZodNullable') { optional = true; s = d.innerType as z.ZodTypeAny; }
    else if (d.typeName === 'ZodDefault') { dflt = (d.defaultValue as () => unknown)(); s = d.innerType as z.ZodTypeAny; }
    else break;
  }
  return { inner: s, optional, ...(dflt !== undefined ? { default: dflt } : {}) };
}

function objectFields(schema: z.ZodTypeAny): ObjectField[] {
  const shape = (defOf(schema).shape as () => Record<string, z.ZodTypeAny>)();
  return Object.entries(shape).map(([key, value]) => {
    const u = unwrap(value);
    return { key, optional: u.optional || u.default !== undefined, ...(u.default !== undefined ? { default: u.default } : {}), node: describeSchema(u.inner) };
  });
}

export function describeSchema(schema: z.ZodTypeAny): FieldNode {
  const { inner } = unwrap(schema);
  const d = defOf(inner);
  switch (d.typeName) {
    case 'ZodString': {
      const checks = (d.checks as { kind: string; value?: number }[]) ?? [];
      return {
        type: 'string',
        min: checks.find((c) => c.kind === 'min')?.value ?? 0,
        max: checks.find((c) => c.kind === 'max')?.value ?? null,
      };
    }
    case 'ZodNumber': {
      const checks = (d.checks as { kind: string; value?: number }[]) ?? [];
      return {
        type: 'number',
        min: checks.find((c) => c.kind === 'min')?.value ?? null,
        max: checks.find((c) => c.kind === 'max')?.value ?? null,
        int: checks.some((c) => c.kind === 'int'),
      };
    }
    case 'ZodBoolean':
      return { type: 'boolean' };
    case 'ZodEnum':
      return { type: 'choice', options: [...(d.values as string[])] };
    case 'ZodLiteral':
      return { type: 'choice', options: [d.value as string | number] };
    case 'ZodUnion': {
      const opts = (d.options as z.ZodTypeAny[]).map((o) => defOf(unwrap(o).inner));
      if (opts.every((o) => o.typeName === 'ZodLiteral')) return { type: 'choice', options: opts.map((o) => o.value as string | number) };
      return { type: 'unknown' };
    }
    case 'ZodDiscriminatedUnion': {
      const discriminator = d.discriminator as string;
      const options: Record<string, ObjectField[]> = {};
      for (const opt of d.options as z.ZodTypeAny[]) {
        const fields = objectFields(opt);
        const tag = fields.find((f) => f.key === discriminator);
        const value = tag && tag.node.type === 'choice' ? String(tag.node.options[0]) : '?';
        options[value] = fields.filter((f) => f.key !== discriminator);
      }
      return { type: 'variant', discriminator, options };
    }
    case 'ZodArray':
      return {
        type: 'array',
        item: describeSchema(d.type as z.ZodTypeAny),
        min: (d.minLength as { value: number } | null)?.value ?? 0,
        max: (d.maxLength as { value: number } | null)?.value ?? null,
      };
    case 'ZodObject':
      return { type: 'object', fields: objectFields(inner) };
    default:
      return { type: 'unknown' };
  }
}

export function describeTemplate(templateKey: TemplateKey): FieldNode {
  return describeSchema(TEMPLATES[templateKey].schema as unknown as z.ZodTypeAny);
}

/** Giá trị rỗng hợp lý cho một trường (khi người soạn bấm "Thêm"). */
export function emptyValue(node: FieldNode): unknown {
  switch (node.type) {
    case 'string': return '';
    case 'number': return node.min ?? 0;
    case 'boolean': return false;
    case 'choice': return node.options[0];
    case 'array': return [];
    case 'object': return Object.fromEntries(node.fields.filter((f) => !f.optional).map((f) => [f.key, emptyValue(f.node)]));
    case 'variant': {
      const [tag, fields] = Object.entries(node.options)[0];
      return { [node.discriminator]: tag, ...Object.fromEntries(fields.filter((f) => !f.optional).map((f) => [f.key, emptyValue(f.node)])) };
    }
    default: return null;
  }
}
