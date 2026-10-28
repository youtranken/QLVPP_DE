# VPP Công trình — Văn phòng phẩm khối Công trình (PMH)

Monorepo: `api/` (NestJS 11, Node 24) + `web/` (React 19 / Vite 8, serve qua nginx) + PostgreSQL 18,
chạy bằng Docker Compose. Đăng nhập bằng PMH ID (OIDC); tài khoản SA local chỉ để IT xử lý sự cố.
Cùng stack và quy ước vận hành với QLTS_DE.

## Tài liệu

- `docs/prd.md` — yêu cầu sản phẩm · `docs/architecture.md` — kiến trúc, API, mã lỗi (§7)
- `docs/backlog/` — epic/story + AC · `docs/plans/` — kế hoạch triển khai từng giai đoạn
- `docs/map.md` — bản đồ mã nguồn (module → file chính, endpoint, bảng) · `docs/review-spec.md` — chỗ spec đã sửa
- `design-preview/_SPEC.md` + `design-preview/final/` — thiết kế UI, câu chữ, token màu
- `CLAUDE.md` — quy ước làm việc (TDD, Playwright, Definition of Done)

## Cấu trúc

```
api/src/{main,app.setup,app.module}.ts   # boot, prefix /api, guard, filter
api/src/modules/<ten>/                   # auth, users, audit, config, files, catalog
api/src/migrations/NNNN_*.sql            # SQL thuần, checksum — không sửa file đã apply
api/test/                                # *.e2e-spec.ts (app thật + supertest), *.db-spec.ts (Postgres thật)
api/scripts/, api/seed/                  # sa-hash, seed-catalog
web/src/{lib,ui,shell,features/<ten>,locales/{vi,en}}
web/playwright/                          # smoke E2E 1280 px + 390 px
ops/backup/                              # image backup (pg_dump + ảnh), cron-loop, restore
docker-compose.yml                       # prod
docker-compose.override.yml              # dev (tự nạp khi không có -f)
.env.example, update-vpp.sh
```

## Chạy dev

Yêu cầu: Docker có Compose v2, Node 24, mạng ngoài `edge` (1 lần: `docker network create edge`).

```bash
cp .env.example .env
# Sửa .env: các giá trị CHANGE_ME, NODE_ENV=development, AUTH_DEV_MODE=true, PMH_* (client SA PMH ID cấp).
# Dev không cần PMH ID thật: SA local và dev-identity đủ cho mọi màn đã có.

# Mật khẩu SA dev: in hash, dán vào LOCAL_SA_PASSWORD_HASH trong .env (không commit .env)
cd api && npm ci && npm run sa:hash -- '<mật-khẩu-dev>' && cd ..

docker compose up -d --build
curl -s localhost:$(docker compose port web 80 | cut -d: -f2)/api/health   # {"status":"ok"}
```

`docker-compose.override.yml` (chỉ dev) bật `AUTH_DEV_MODE=true`, `NODE_ENV=development`, publish web ra
cổng ngẫu nhiên `127.0.0.1`, api ra `127.0.0.1:3000` (cho Vite dev/Playwright) và Postgres ra `127.0.0.1:5492`.
Đổi hash SA hoặc biến env khác thì `docker compose up -d api` để api nạp lại.

**`AUTH_DEV_MODE`**: `=true` chỉ hợp lệ khi `NODE_ENV ∈ {development, test}` — bật ở môi trường khác thì app
**từ chối khởi động**. Khi bật, api nhận header dev-identity `x-dev-user-sub` + `x-dev-role` (`member|admin|sa`)
thay cho phiên; nginx của `web` xóa các header này, nên chỉ dùng được qua api trực tiếp (Vite dev, test).

Seed danh mục ban đầu (idempotent theo `code`, không ghi đè tồn kho/ảnh/trạng thái Hành chính đã đặt):

```bash
cd api && DATABASE_URL=postgres://<user>:<pass>@127.0.0.1:5492/<db> npm run seed:catalog   # dev
docker compose exec api node scripts/seed-catalog.mjs                                         # prod, lần deploy đầu
```

## Test

### api

```bash
docker compose exec postgres createdb -U <POSTGRES_USER> vpp_test   # 1 lần

cd api
export NODE_ENV=test DATABASE_URL=postgres://<user>:<pass>@127.0.0.1:5492/vpp_test
npm test            # unit (luật thuần)
npm run test:e2e    # test/*.e2e-spec.ts — app thật + supertest, dev-identity
npm run test:db     # test/*.db-spec.ts — Postgres thật, chạy tuần tự
```

Không `source .env` vào shell để chạy test: `.env` đặt `NODE_ENV=development`. Spec cần DB (cả một số
e2e) reset schema và từ chối chạy nếu tên database không kết thúc `_test`.

### web

```bash
cd web && npm ci
npm run dev                          # http://localhost:5173, proxy /api → 127.0.0.1:3000 (VITE_API_TARGET)
npm test && npm run lint && npm run build
npm run typecheck:e2e
```

### Playwright

```bash
docker compose up -d                       # cần api dev ở 127.0.0.1:3000
cd web
npx playwright install chromium            # lần đầu (khớp @playwright/test)
PW_SA_PASSWORD='<mật-khẩu-dev>' npx playwright test
```

- Tự chạy Vite ở `:5174` (`PW_PORT`); 2 project `desktop-1280` và `mobile-390`; axe `color-contrast` ở 390 px.
- `p1-flow.spec.ts` (smoke Plan 1) đăng nhập SA thật qua form "Dành cho IT": cần `PW_SA_PASSWORD` khớp
  `LOCAL_SA_PASSWORD_HASH` (tên tài khoản `PW_SA_USERNAME`, mặc định `sa`); thiếu thì test bị skip.
  Mỗi lần chạy đăng nhập SA đúng 2 lần (mỗi viewport 1) — `sa-login` giới hạn 10/phút/IP, đừng chạy dồn.
- Các spec còn lại dùng dev-identity: header `x-dev-*` gắn **chỉ cho `/api/**`** qua `page.route`
  (`playwright/helpers.ts`); gắn toàn cục làm request font Google bị chặn CORS.
- Spec ghi vào DB dev dùng chung: dữ liệu thử có tiền tố `PW`, được ngừng sau khi chạy; người nhận thử được
  seed bằng psql trong container `postgres`; cấu hình được trả lại giá trị gốc (khóa `acquireLock`).
- Không mạng tải Chromium: đặt `PW_CHROMIUM_PATH=/đường/dẫn/chrome`.
- Ảnh chụp màn `web/test-results/screens/`, báo cáo `web/playwright-report/` — không commit.
- Fixture ảnh EXIF xoay 6: `python3 web/scripts/make-exif6-fixture.py web/src/test/fixtures/exif6.jpg` (Pillow).

## Prod

```bash
docker compose -f docker-compose.yml up -d --build   # BẮT BUỘC -f: không nạp override dev
```

- https://de-vpp.pmh.com.vn:8443 — TLS do EDGE (PMH_IDE `deploy/edge`); `web` chỉ join mạng `edge`
  alias `vpp-web`, không publish cổng; `api`/`postgres` chỉ ở mạng default.
- Cập nhật: `bash update-vpp.sh` (repo sạch → `git pull --ff-only` → build → chờ `/api/health` 200 qua EDGE;
  migration chạy lúc api boot).
- Backup: service `backup-cron` (hằng ngày lúc `BACKUP_AT`); chạy tay
  `docker compose -f docker-compose.yml --profile backup run --rm backup`; phục hồi `bash ops/backup/restore.sh`.
