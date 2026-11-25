'use client';

import { useMemo, useState } from 'react';

/**
 * Tiện ích lớp học thuần trình duyệt.
 * Không đọc ghi localStorage, không gọi API, không gửi tên học sinh lên server.
 * Đây là hoạt động tổ chức tiết học, không ghi điểm hay dữ liệu học sinh.
 */
const LIMIT = 40;
const MAX_NAME = 36;

function normalizedNames(raw: string): { names: string[]; overflow: boolean } {
  const unique = new Set<string>();
  const names: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const name = line.normalize('NFC').replace(/\s+/g, ' ').trim();
    if (!name || name.length > MAX_NAME || /[\u0000-\u001F\u007F]/.test(name)) continue;
    const key = name.toLocaleLowerCase('vi-VN');
    if (unique.has(key)) continue;
    unique.add(key);
    names.push(name);
  }
  return { names: names.slice(0, LIMIT), overflow: names.length > LIMIT };
}

/** Unbiased uniform index using WebCrypto. Never uses a request, a saved roster, or Math.random(). */
function randomIndex(length: number): number {
  if (!Number.isSafeInteger(length) || length <= 0 || length > LIMIT) throw new RangeError('Invalid pool');
  const limit = Math.floor(0x100000000 / length) * length;
  const values = new Uint32Array(1);
  let n: number;
  do { crypto.getRandomValues(values); n = values[0]; } while (n >= limit);
  return n % length;
}

export function RandomStudentPicker({ lang }: { lang: 'en' | 'vi' }) {
  const isVi = lang === 'vi';
  const [raw, setRaw] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [repeat, setRepeat] = useState(false);
  const { names, overflow } = useMemo(() => normalizedNames(raw), [raw]);
  const available = repeat ? names : names.filter((name) => !picked.includes(name));
  const tooLong = raw.split(/\r?\n/).some((name) => name.trim().length > MAX_NAME);
  const canPick = !overflow && !tooLong && available.length > 0;

  function next() {
    if (!canPick) return;
    const chosen = available[randomIndex(available.length)];
    setCurrent(chosen);
    setPicked((prev) => [...prev, chosen]);
  }

  function reset() {
    setPicked([]);
    setCurrent(null);
  }

  return (
    <section className="picker-app" data-testid="student-picker">
      <div className="picker-intro">
        <span aria-hidden="true">🎡</span>
        <div><h2>{isVi ? 'Gọi tên bất ngờ!' : 'Surprise student pick!'}</h2>
          <p>{isVi ? 'Dùng khi cần mời một bạn tham gia hoạt động. Không cần đăng nhập hay tạo danh sách trên máy chủ.'
            : 'Invite someone to participate. No account or server-side class list needed.'}</p></div>
      </div>
      <div className="picker-layout">
        <div className="picker-input">
          <label htmlFor="picker-roster">{isVi ? 'Nhập mỗi tên trên một dòng' : 'One name per line'}</label>
          <textarea id="picker-roster" data-testid="picker-names" rows={9}
            value={raw} autoComplete="off" spellCheck={false}
            placeholder={isVi ? 'An\nBình\nChi\nDung' : 'Alex\nBen\nCharlie\nDaisy'}
            onChange={(event) => { setRaw(event.target.value); reset(); }}
            maxLength={3000} />
          <p className="picker-help">{isVi ? `${names.length}/${LIMIT} tên · Không lưu vào tài khoản, không gửi lên máy chủ`
            : `${names.length}/${LIMIT} names · Nothing saved or uploaded`}</p>
          {(overflow || tooLong) && <p role="alert" className="form-error">
            {isVi ? `Tối đa ${LIMIT} tên, mỗi tên không quá ${MAX_NAME} ký tự.` : `Maximum ${LIMIT} names and ${MAX_NAME} characters per name.`}
          </p>}
          <label className="picker-toggle">
            <input type="checkbox" checked={repeat} onChange={(e) => { setRepeat(e.target.checked); reset(); }}
              data-testid="picker-repeat" />
            <span>{isVi ? 'Có thể gọi lại bạn đã được chọn' : 'Allow choosing the same student again'}</span>
          </label>
          <div className="picker-actions">
            <button type="button" className="secondary-button" onClick={reset} disabled={!picked.length} data-testid="picker-reset">
              {isVi ? '↻ Bắt đầu lượt mới' : '↻ Reset round'}
            </button>
            <button type="button" className="secondary-button" onClick={() => { setRaw(''); reset(); }}
              disabled={!raw} data-testid="picker-clear">
              {isVi ? 'Xóa danh sách' : 'Clear names'}
            </button>
          </div>
        </div>
        <div className="picker-result">
          <div className="picker-result-orb" aria-hidden="true">⭐</div>
          <p>{isVi ? 'Bạn được chọn là…' : 'Our next student is…'}</p>
          <h3 data-testid="picker-selected" aria-live="polite" aria-atomic="true">{current ?? '✨'}</h3>
          <button type="button" className="primary-button big" onClick={next} disabled={!canPick} data-testid="picker-draw">
            🎲 {isVi ? 'Chọn một bạn' : 'Pick someone'}
          </button>
          {!repeat && names.length > 0 && <p className="picker-remaining" data-testid="picker-remaining">
            {isVi ? `Còn ${available.length} bạn chưa được chọn` : `${available.length} remaining`}
          </p>}
          {!repeat && names.length > 0 && available.length === 0 && <p className="form-success" role="status">
            {isVi ? 'Tất cả các bạn đã được chọn. Bắt đầu lượt mới nhé!' : 'Everyone had a turn. Reset to pick again!'}
          </p>}
        </div>
      </div>
      <p className="picker-privacy">
        🔒 {isVi ? 'Quyền riêng tư: danh sách chỉ nằm trong trang đang mở, đóng hoặc tải lại trang sẽ mất. Không dùng để thu thập thông tin nhạy cảm của trẻ.'
          : 'Privacy: names exist only in this open tab. Refreshing clears them. Do not enter sensitive student details.'}
      </p>
    </section>
  );
}
