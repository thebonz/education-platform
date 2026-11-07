// Đọc kết quả Jest (--json) và in annotation cho GitHub Actions: tổng kết + từng test lỗi.
// (Log của Actions không xem được từ môi trường làm việc, nên lỗi phải hiện qua annotation.)
import { existsSync, readFileSync } from 'node:fs';

const file = process.argv[2] ?? '/tmp/jest.json';
if (!existsSync(file)) {
  console.log('::error title=Jest::Không có file kết quả – Jest dừng trước khi chạy test (lỗi cấu hình/biên dịch?)');
  process.exit(0);
}
const r = JSON.parse(readFileSync(file, 'utf8'));
const clean = (s) => s.replace(/\u001b\[[0-9;]*m/g, '').replace(/%/g, '%25').replace(/\r?\n/g, '%0A');
let shown = 0;
for (const suite of r.testResults ?? []) {
  const name = suite.name.split('/apps/api/').pop();
  const failed = (suite.assertionResults ?? []).filter((a) => a.status === 'failed');
  if (!failed.length && suite.status === 'failed' && suite.message && shown < 10) {
    console.log(`::error title=Jest ${name}::${clean(suite.message.slice(0, 1500))}`);
    shown++;
  }
  for (const a of failed) {
    if (shown >= 10) break;
    console.log(`::error title=Jest ${name}::${clean(`${a.fullName}\n${(a.failureMessages ?? []).join('\n').split('\n').slice(0, 18).join('\n')}`).slice(0, 1800)}`);
    shown++;
  }
}
console.log(`::notice title=Jest::suites ${r.numPassedTestSuites}/${r.numTotalTestSuites}, tests passed ${r.numPassedTests}, failed ${r.numFailedTests}, total ${r.numTotalTests}`);
