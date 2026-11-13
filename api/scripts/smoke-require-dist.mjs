// Smoke sau `npm run build`: require() từng module trong dist/ để bắt lỗi chỉ lộ ra lúc chạy bản build CommonJS,
// điển hình ERR_PACKAGE_PATH_NOT_EXPORTED (tsconfig module commonjs + moduleResolution bundler: tsc nhận đường
// import theo điều kiện "import"/"types" của exports, còn Node require() chỉ theo "require"/"default").
// Chỉ require, KHÔNG bootstrap app: không cần DB, không cần env.
//   - Bỏ dist/main.js: file này gọi bootstrap() ngay khi nạp (đọc PORT/DATABASE_URL, mở kết nối DB). Mọi module
//     main.js import đều nằm trong dist/ nên vẫn được require ở đây.
//   - Các kiểm tra env (assertAuthEnvSafe, assertClockEnv…) chỉ chạy trong bootstrap() hoặc lúc Nest dựng provider,
//     không chạy lúc nạp module — nên require với env rỗng vẫn qua. Nếu sau này có module ném lỗi env ngay khi nạp,
//     smoke sẽ đỏ kèm tên file: dời kiểm tra đó vào hàm/bootstrap thay vì nới smoke.
//   - migrations/*.sql không phải module → chỉ lấy *.js.
//   npm run build && npm run smoke:dist
import { readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const SKIP = new Set(['main.js']);

if (!existsSync(path.join(DIST, 'app.module.js'))) {
  console.error(`Chưa có bản build ở ${DIST} — chạy npm run build trước.`);
  process.exit(1);
}

const files = readdirSync(DIST, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile() && d.name.endsWith('.js'))
  .map((d) => path.relative(DIST, path.join(d.parentPath, d.name)))
  .filter((f) => !SKIP.has(f) && !f.startsWith(`migrations${path.sep}`))
  .sort();

const require = createRequire(path.join(DIST, 'noop.js'));
const loi = [];
for (const f of files) {
  try {
    require(path.join(DIST, f));
  } catch (e) {
    loi.push(`${f}: ${e.code ?? e.name}: ${e.message.split('\n')[0]}`);
  }
}

if (loi.length) {
  console.error(`smoke:dist ĐỎ — ${loi.length}/${files.length} module không require được:\n  ${loi.join('\n  ')}`);
  process.exit(1);
}
console.log(`smoke:dist xanh — require được ${files.length} module trong dist/ (bỏ ${[...SKIP].join(', ')}).`);
// Thoát hẳn: một vài thư viện có thể giữ handle (timer/socket) dù không bootstrap.
process.exit(0);
