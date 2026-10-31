// Chuyển kết quả ESLint (JSON) thành annotation của GitHub Actions; thoát mã 1 nếu có lỗi.
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
const results = JSON.parse(readFileSync(process.argv[2], 'utf8'));
let errors = 0, warnings = 0;
for (const r of results) {
  for (const m of r.messages) {
    const level = m.severity === 2 ? 'error' : 'warning';
    if (m.severity === 2) errors++; else warnings++;
    const msg = `${m.message} (${m.ruleId ?? 'parse'})`.replace(/%/g, '%25').replace(/\r?\n/g, '%0A');
    console.log(`::${level} file=${relative(process.cwd(), r.filePath)},line=${m.line ?? 1},col=${m.column ?? 1}::${msg}`);
  }
}
console.log(`::notice title=ESLint::${results.length} file, ${errors} lỗi, ${warnings} cảnh báo`);
process.exit(errors ? 1 : 0);
