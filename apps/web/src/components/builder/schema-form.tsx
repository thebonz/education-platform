'use client';

import { emptyValue, type FieldNode, type ObjectField } from '@happyclass/game-core/describe';
import { CHOICE_LABELS, FIELD_LABELS, labelFor } from './labels';

/**
 * Form dựng tự động từ mô tả schema của template. Giá trị luôn là JSON thuần; kiểm tra hợp lệ
 * do validateGameData làm ở component cha, lỗi được chuyển xuống theo đường dẫn trường ("items.0.word").
 */
export type Issues = Map<string, string[]>;
export type PickImage = (current: { src?: string; alt?: string }) => Promise<{ src: string; alt: string } | null>;

type Ctx = { issues: Issues; pickImage: PickImage };

const join = (path: string, key: string | number) => (path ? `${path}.${key}` : String(key));
const nfc = (v: string) => v.normalize('NFC');

function FieldIssues({ ctx, path }: { ctx: Ctx; path: string }) {
  const list = ctx.issues.get(path);
  if (!list?.length) return null;
  return <ul className="field-issues" data-testid="field-issue" data-path={path}>{list.map((m, i) => <li key={i}>{m}</li>)}</ul>;
}

function uniqueId(items: unknown[], base: string) {
  const used = new Set(items.map((x) => (x && typeof x === 'object' ? String((x as { id?: unknown }).id ?? '') : '')));
  for (let n = items.length + 1; ; n++) if (!used.has(`${base}${n}`)) return `${base}${n}`;
}

export function SchemaForm({ node, value, onChange, issues, pickImage }: { node: FieldNode; value: unknown; onChange: (v: unknown) => void; issues: Issues; pickImage: PickImage }) {
  return <Node node={node} value={value} onChange={onChange} path="" ctx={{ issues, pickImage }} fieldKey="" />;
}

function Node({ node, value, onChange, path, ctx, fieldKey }: { node: FieldNode; value: unknown; onChange: (v: unknown) => void; path: string; ctx: Ctx; fieldKey: string }) {
  switch (node.type) {
    case 'string': {
      const v = typeof value === 'string' ? value : '';
      const long = (node.max ?? 0) > 120;
      const common = {
        value: v, maxLength: node.max ?? undefined, 'data-path': path, 'aria-invalid': ctx.issues.has(path) || undefined,
      };
      return long
        ? <textarea {...common} rows={3} onChange={(e) => onChange(nfc(e.target.value))} />
        : <input {...common} type="text" onChange={(e) => onChange(nfc(e.target.value))} />;
    }
    case 'number':
      return (
        <input type="number" data-path={path} value={typeof value === 'number' ? value : ''} min={node.min ?? undefined} max={node.max ?? undefined}
          step={node.int ? 1 : 'any'} onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))} />
      );
    case 'boolean':
      return <input type="checkbox" data-path={path} checked={value === true} onChange={(e) => onChange(e.target.checked)} />;
    case 'choice':
      return (
        <select data-path={path} value={String(value ?? node.options[0])}
          onChange={(e) => onChange(node.options.find((o) => String(o) === e.target.value))}>
          {node.options.map((o) => <option key={String(o)} value={String(o)}>{CHOICE_LABELS[String(o)] ?? String(o)}</option>)}
        </select>
      );
    case 'array':
      return <ArrayNode node={node} value={Array.isArray(value) ? value : []} onChange={onChange} path={path} ctx={ctx} fieldKey={fieldKey} />;
    case 'object':
      return <ObjectNode fields={node.fields} value={value && typeof value === 'object' ? (value as Record<string, unknown>) : {}} onChange={onChange} path={path} ctx={ctx} />;
    case 'variant': {
      const obj = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
      const tag = String(obj[node.discriminator] ?? Object.keys(node.options)[0]);
      const fields = node.options[tag] ?? [];
      const isImage = fieldKey === 'picture' && tag === 'image';
      return (
        <div className="variant">
          <select data-path={join(path, node.discriminator)} value={tag}
            onChange={(e) => onChange(emptyValue({ ...node, options: { [e.target.value]: node.options[e.target.value] } }))}>
            {Object.keys(node.options).map((k) => <option key={k} value={k}>{CHOICE_LABELS[k] ?? k}</option>)}
          </select>
          {isImage ? (
            <ImageField value={obj} onChange={onChange} path={path} ctx={ctx} />
          ) : (
            <ObjectNode fields={fields} value={obj} onChange={(v) => onChange({ ...(v as object), [node.discriminator]: tag })} path={path} ctx={ctx} inline />
          )}
        </div>
      );
    }
    default:
      return <p className="muted">Trường này chỉ sửa được ở chế độ JSON.</p>;
  }
}

function ImageField({ value, onChange, path, ctx }: { value: Record<string, unknown>; onChange: (v: unknown) => void; path: string; ctx: Ctx }) {
  const src = typeof value.src === 'string' ? value.src : '';
  const alt = typeof value.alt === 'string' ? value.alt : '';
  return (
    <div className="image-field">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={alt} className="thumb" /> : <span className="thumb empty">Chưa có ảnh</span>}
      <div className="image-field-body">
        <button type="button" className="secondary-button" data-testid="pick-image" data-path={join(path, 'src')}
          onClick={async () => { const r = await ctx.pickImage({ src, alt }); if (r) onChange({ kind: 'image', src: r.src, alt: alt || r.alt }); }}>
          {src ? 'Đổi ảnh' : 'Chọn ảnh'}
        </button>
        <label>{labelFor('alt')}
          <input type="text" value={alt} maxLength={120} data-path={join(path, 'alt')} onChange={(e) => onChange({ kind: 'image', src, alt: nfc(e.target.value) })} />
        </label>
        <FieldIssues ctx={ctx} path={join(path, 'src')} />
        <FieldIssues ctx={ctx} path={join(path, 'alt')} />
      </div>
    </div>
  );
}

function ObjectNode({ fields, value, onChange, path, ctx, inline }: { fields: ObjectField[]; value: Record<string, unknown>; onChange: (v: unknown) => void; path: string; ctx: Ctx; inline?: boolean }) {
  const set = (key: string, v: unknown) => {
    const next = { ...value };
    if (v === undefined || (v === '' && fields.find((f) => f.key === key)?.optional)) delete next[key];
    else next[key] = v;
    onChange(next);
  };
  return (
    <div className={inline ? 'obj inline' : 'obj'}>
      {fields.map((f) => {
        const p = join(path, f.key);
        const present = value[f.key] !== undefined;
        const complex = ['array', 'object', 'variant'].includes(f.node.type);
        const shown = present ? value[f.key] : f.default;
        const help = FIELD_LABELS[f.key]?.help;
        // Trường tuỳ chọn phức tạp (hình, mảnh, gây nhiễu…): ẩn cho gọn, bấm "Thêm" mới hiện.
        if (complex && f.optional && !present && f.default === undefined) {
          return (
            <div key={f.key} className="field optional-off">
              <button type="button" className="link-button" data-testid="add-optional" data-path={p} onClick={() => set(f.key, emptyValue(f.node))}>+ {labelFor(f.key)}</button>
            </div>
          );
        }
        return (
          <div key={f.key} className={`field field-${f.node.type}`}>
            <div className="field-head">
              <span className="field-label">{labelFor(f.key)}{!f.optional && <span className="req" aria-hidden="true"> *</span>}</span>
              {complex && f.optional && present && <button type="button" className="link-button" onClick={() => set(f.key, undefined)}>Bỏ</button>}
            </div>
            {help && <small className="field-help">{help}</small>}
            <Node node={f.node} value={shown} onChange={(v) => set(f.key, v)} path={p} ctx={ctx} fieldKey={f.key} />
            <FieldIssues ctx={ctx} path={p} />
          </div>
        );
      })}
    </div>
  );
}

function ArrayNode({ node, value, onChange, path, ctx, fieldKey }: { node: Extract<FieldNode, { type: 'array' }>; value: unknown[]; onChange: (v: unknown) => void; path: string; ctx: Ctx; fieldKey: string }) {
  const scalar = node.item.type === 'string' || node.item.type === 'number';
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => {
    let item = emptyValue(node.item);
    if (item && typeof item === 'object' && 'id' in (item as object)) item = { ...(item as object), id: uniqueId(value, fieldKey === 'questions' ? 'q' : 'm') };
    onChange([...value, item]);
  };
  const full = node.max !== null && value.length >= node.max;
  return (
    <div className={`arr ${scalar ? 'scalar' : ''}`} data-path={path}>
      {value.map((item, i) => (
        <div key={i} className="arr-item" data-testid="array-item">
          <div className="arr-tools">
            <span className="arr-index">{i + 1}</span>
            <button type="button" aria-label="Lên" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
            <button type="button" aria-label="Xuống" onClick={() => move(i, 1)} disabled={i === value.length - 1}>↓</button>
            <button type="button" aria-label="Xoá" data-testid="remove-item" onClick={() => onChange(value.filter((_, k) => k !== i))}>✕</button>
          </div>
          <div className="arr-body">
            <Node node={node.item} value={item} onChange={(v) => onChange(value.map((x, k) => (k === i ? v : x)))} path={join(path, i)} ctx={ctx} fieldKey={fieldKey} />
            <FieldIssues ctx={ctx} path={join(path, i)} />
          </div>
        </div>
      ))}
      <div className="arr-foot">
        <button type="button" className="secondary-button" data-testid="add-item" data-path={path} onClick={add} disabled={full}>+ Thêm</button>
        <small className="muted">{value.length}{node.max !== null ? ` / tối đa ${node.max}` : ''}{node.min ? ` · tối thiểu ${node.min}` : ''}</small>
      </div>
    </div>
  );
}
