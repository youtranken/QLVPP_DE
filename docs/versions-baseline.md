# Phiên bản ghim — QLVPP

Nguồn đích chung: `bao-cao-phan-mem/data/nang-cap/dich-chung.json` (chốt 12/11/2026), cùng định dạng với PMH ID, QLTS, QLHS.
Test `ops/versions-baseline.test.mjs` đối chiếu bảng này với repo:
- gói npm: bản trong `package-lock.json` (`packages["node_modules/<tên>"].version` — đúng thứ `npm ci` trong Docker cài)
  phải bằng bản ghim, và range khai báo trong package.json phải là `~x.y.z` (hoặc `x.y.z`) cùng major.minor —
  `^`/`>=`/`*` bị từ chối vì cho trôi sang minor khác;
- phụ: nếu đã `npm ci` thì so thêm bản đã cài trong `api/node_modules`, `web/node_modules` (chưa cài thì bỏ qua, không đỏ);
- image so với mọi `FROM`/`image:`, và chặn tag trôi trong mọi Dockerfile/compose.

Đổi bản ở đâu thì sửa dòng tương ứng ở đây trong cùng commit.

Chạy: `cd api && npm run test:versions` (không cần gói nào thêm, không cần `npm ci`).

Sau khi nâng gói phía api, chạy thêm `cd api && npm run build && npm run smoke:dist`: require từng module trong `dist/`
(bỏ `main.js` vì nó bootstrap app; bỏ `migrations/*.sql`) để bắt `ERR_PACKAGE_PATH_NOT_EXPORTED` — lỗi chỉ lộ khi chạy
bản build CommonJS (`module: commonjs` + `moduleResolution: bundler` để tsc nhận đường import mà `require()` không nhận).
Không cần DB hay env: các kiểm tra env chỉ chạy trong bootstrap, không chạy lúc nạp module.

| Thành phần | Bản ghim | Nơi ghim |
| --- | --- | --- |
| node-image | 26.13.1-alpine | api/Dockerfile, web/Dockerfile |
| nvmrc | 26.13.1 | .nvmrc |
| nginx-image | 1.30.7-alpine | web/Dockerfile |
| postgres-image | 18.7-alpine | docker-compose.yml, ops/backup/Dockerfile |
| @nestjs/core | 12.4.2 | api/package.json |
| @nestjs/common | 12.4.2 | api/package.json |
| @nestjs/platform-express | 12.4.2 | api/package.json |
| @nestjs/testing | 12.4.2 | api/package.json |
| @nestjs/cli | 12.0.12 | api/package.json |
| nestjs-pino | 5.3.1 | api/package.json |
| drizzle-orm | 0.45.4 | api/package.json |
| typescript | 6.0.3 | api/package.json, web/package.json |
| @types/node | 26.6.6 | api/package.json, web/package.json |
| jest | 30.5.2 | api/package.json |
| eslint | 10.14.0 | api/package.json |
| typescript-eslint | 8.72.2 | api/package.json |
| react | 19.3.1 | web/package.json |
| react-dom | 19.3.1 | web/package.json |
| vite | 8.3.8 | web/package.json |
| vitest | 5.1.0 | web/package.json |
| jsdom | 31.0.0 | web/package.json |
| i18next | 26.3.4 | web/package.json |

Ghi chú:
- npm giữ nguyên (không pnpm/corepack) nên không có dòng `pnpm`; không có CI nên không có dòng `node-ci`.
- `engines.node` của api/web để `>=24`: image chạy Node 26, máy dev Node 24 vẫn chạy được test.
- Hoãn theo đích chung: TypeScript 7 (chờ 7.1, emitDecoratorMetadata), i18next 27 (dòng `i18next` ghim 26 để không lỡ tay nâng).
  QLVPP dùng `pg`, không dùng postgres.js.
- Image tự build trong repo (`vpp-api:latest`, `vpp-backup:latest` trong compose) không kéo từ registry nên không cần dòng.
