# VPP Công trình — Văn phòng phẩm khối Công trình (PMH)

Monorepo: `api/` (NestJS 11, Node 24) + `web/` (React 19 / Vite 8, serve qua nginx) + PostgreSQL 18,
chạy bằng Docker Compose. Cùng stack và quy ước vận hành với QLTS_DE.

## Chạy bằng một lệnh

Yêu cầu: Docker có Compose v2, mạng ngoài `edge` (1 lần: `docker network create edge`).

```bash
cp .env.example .env   # đổi các giá trị CHANGE_ME, điền PMH_* và LOCAL_SA_PASSWORD_HASH

# DEV — tự nạp docker-compose.override.yml
docker compose up -d --build
curl -s localhost:$(docker compose port web 80 | cut -d: -f2)/api/health   # {"status":"ok"}

# PROD — BẮT BUỘC chỉ định file, KHÔNG nạp override
docker compose -f docker-compose.yml up -d --build
```

> `docker compose up` không kèm `-f` sẽ **tự động nạp `docker-compose.override.yml`** (dev):
> bật `AUTH_DEV_MODE=true`, `NODE_ENV=development`, publish web ra cổng ngẫu nhiên và Postgres
> ra `127.0.0.1:5492`. Trên prod phải dùng dạng `-f docker-compose.yml`.

- Prod: https://de-vpp.pmh.com.vn:8443 — TLS do EDGE (PMH_IDE `deploy/edge`) lo; `web` chỉ join
  mạng `edge` với alias `vpp-web`, không publish cổng.
- `api`/`postgres` chỉ ở mạng default; `postgres` không publish cổng ở prod.
- Cập nhật prod: `bash update-vpp.sh` (git pull ff-only → build → chờ `/api/health` 200 qua EDGE).
- Backup: service `backup-cron` (hằng ngày lúc `BACKUP_AT`); chạy tay
  `docker compose -f docker-compose.yml --profile backup run --rm backup`; phục hồi `bash ops/backup/restore.sh`.

## Cấu trúc

```
api/        # NestJS — prefix /api
web/        # React SPA + nginx (proxy /api → api:3000)
ops/backup/ # image backup (pg_dump + file ảnh), cron-loop, restore
docker-compose.yml, docker-compose.override.yml (dev), .env.example, update-vpp.sh
```

## Dev & test (ngoài Docker)

```bash
cd api && npm ci
npm run build
npm run test:e2e   # e2e (không cần DB)
npm run test:db    # integration DB thật — cần DATABASE_URL trỏ database *_test

cd web && npm ci && npm run build
```

### Web dev + Playwright

Override dev publish api ra `127.0.0.1:3000` (chỉ dev; prod compose không publish). Vite dev proxy
`/api` → `http://127.0.0.1:3000` (đổi bằng `VITE_API_TARGET`), giữ same-origin như nginx prod.

```bash
docker compose up -d                 # api dev: NODE_ENV=development, AUTH_DEV_MODE=true
cd web
npm run dev                          # http://localhost:5173 — chưa đăng nhập thì ra màn vào
npm test && npm run lint && npm run build
npx playwright install chromium      # lần đầu (bản khớp @playwright/test 1.64.1)
npx playwright test                  # tự chạy Vite ở :5174 (PW_PORT), 2 project: 1280 px và 390 px
npm run typecheck:e2e
```

- Smoke đăng nhập bằng dev-identity: spec gắn `x-dev-user-sub`/`x-dev-role` **chỉ cho request `/api/**`**
  (`page.route`, `playwright/helpers.ts`). Cổng web nginx (`docker compose port web 80`) xóa `x-dev-*` nên
  không dùng cho smoke; gắn header toàn cục làm request font Google bị chặn CORS.
- Không mạng tải Chromium: đặt `PW_CHROMIUM_PATH=/đường/dẫn/chrome`.
- Ảnh chụp màn: `web/test-results/screens/`, báo cáo HTML: `web/playwright-report/` (không commit).
- Fixture ảnh EXIF xoay 6: `python3 web/scripts/make-exif6-fixture.py web/src/test/fixtures/exif6.jpg` (Pillow).
- Thử SA cục bộ ở dev: tạo hash bằng `cd api && npm run sa:hash`, đặt `LOCAL_SA_PASSWORD_HASH` trong `.env`
  (không commit) rồi `docker compose up -d api`. Smoke không gửi mật khẩu sai lên api (tránh đếm khóa SA toàn cục).

Seed danh mục ban đầu (idempotent, không đụng tồn kho/ảnh/trạng thái admin đã đặt): `cd api && DATABASE_URL=postgres://... npm run seed:catalog`. Trên prod: `docker compose exec api node scripts/seed-catalog.mjs`.

## AUTH_DEV_MODE

`AUTH_DEV_MODE=true` chỉ hợp lệ khi `NODE_ENV ∈ {development, test}` — bật ở môi trường khác thì
app **từ chối khởi động**.
