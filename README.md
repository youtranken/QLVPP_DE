# DE-VPP — Hệ thống Đăng ký Văn phòng phẩm

Website nội bộ để **nhân viên đăng ký VPP hằng tháng**; **admin duyệt → tổng hợp → xác nhận đã giao → xuất báo cáo trình ký**.
Xác thực qua **PMH ID SSO** (OIDC). Kiến trúc **Modular Monolith** (xem `docs/`).

> **Trạng thái:** **M1 xong** — CSDL + đăng nhập PMH ID SSO + danh mục.
> Chưa có nghiệp vụ đơn đăng ký (M2) và giao diện (M3/M4).

## Cấu trúc

```
apps/
  api/        Backend NestJS (API + BFF auth + jobs)     — @vpp/api
  web/        Frontend React + Vite                       — @vpp/web
packages/
  shared/     Quy tắc nghiệp vụ dùng chung (TypeScript)   — @vpp/shared
docs/         PRD, SDD, ADR, SSO-INTEGRATION, ...
deploy/
  mock-idp/            IdP OIDC giả lập PMH ID (CHỈ demo/dev)  — @vpp/mock-idp
  docker-compose.yml   Stack Docker riêng của DE-VPP
```

## Yêu cầu

- **Node.js ≥ 20** (khuyến nghị 20/22/24)
- **pnpm** (bật qua Corepack: `corepack enable`)

## Khởi động

### Cách 1 — Toàn bộ trong Docker (nhanh nhất)

```bash
docker compose -f deploy/docker-compose.yml --profile app up -d --build
```

Xong là có **api** `http://localhost:3100` · **mock-idp** `http://localhost:9100` ·
**postgres** `localhost:5433`. Migration + dữ liệu mẫu tự chạy trước khi api khởi động.

Thử đăng nhập: mở `http://localhost:3100/api/auth/login` → chọn một user demo
(`admin@pmh.com.vn` là admin) → quay lại app. Sau đó `GET /api/me` trả vai trò và
phòng ban, `GET /api/catalog` trả danh mục đã seed.

```bash
docker compose -f deploy/docker-compose.yml --profile app ps        # trạng thái
docker compose -f deploy/docker-compose.yml --profile app logs -f   # log
docker compose -f deploy/docker-compose.yml --profile app down      # dừng, giữ dữ liệu
docker compose -f deploy/docker-compose.yml --profile app down -v   # dừng + xoá dữ liệu
```

Stack dùng project `vpp`, mạng `vpp-net`, volume `vpp_pgdata`/`vpp_uploads` và cổng
3100/9100/5433 — **không dùng chung gì** với các stack Docker khác trên máy.

### Cách 2 — Chạy trên máy, chỉ CSDL trong Docker (có hot-reload)

```bash
# 1) Cài dependency (từ thư mục gốc)
pnpm install

# 2) Cấu hình môi trường
cp .env.example .env        # Windows: copy .env.example .env

# 3) Chỉ dựng CSDL (không có --profile app), rồi tạo bảng + dữ liệu mẫu
docker compose -f deploy/docker-compose.yml up -d
pnpm --filter @vpp/api db:migrate
pnpm --filter @vpp/api db:seed

# 4) Chạy 2 tiến trình (2 cửa sổ terminal)
pnpm --filter @vpp/mock-idp start   # IdP giả  : http://localhost:9000
pnpm --filter @vpp/api dev          # API      : http://localhost:3000

# 5) Kiểm tra chất lượng
pnpm lint                   # ESLint
pnpm typecheck              # TypeScript (strict) — build @vpp/shared rồi typecheck
pnpm test                   # Unit test (Vitest) toàn monorepo
pnpm build                  # Build tất cả package
```

> **Cổng ở cách 2:** `.env.example` dùng `APP_BASE_URL=http://localhost:8080` (giống
> demo có nginx proxy `/api` → api). Khi chạy API trực tiếp chưa có web, đặt
> `APP_BASE_URL=http://localhost:3000` trong `.env` để redirect OIDC quay đúng về API.
> Nếu máy đã có dịch vụ khác chiếm cổng, đổi `API_PORT` / `APP_BASE_URL` /
> `DATABASE_URL` trong `.env` — mock-idp đọc chung `.env` nên tự khớp theo.

> **URL công khai vs URL nội bộ:** trình duyệt chạy ngoài Docker nên chỉ tới được
> `localhost:<cổng đã publish>`, còn container không tới được `localhost` của host.
> Vì vậy trong Docker, `OIDC_INTERNAL_ISSUER` (api → IdP) và `APP_INTERNAL_BASE_URL`
> (IdP → api, cho back-channel logout) trỏ theo tên service, còn mọi endpoint mà
> **trình duyệt** đi tới vẫn giữ URL công khai. Chạy trên máy thì để trống cả hai.

> **Lưu ý:** `@vpp/api` và `@vpp/web` phụ thuộc `@vpp/shared`. Các script `typecheck`/`test`/`build`
> đã tự **build `@vpp/shared` trước** nên không cần làm thủ công.

> **API phải chạy bằng `tsc`/`nest`, KHÔNG dùng `tsx`:** esbuild bỏ qua
> `emitDecoratorMetadata` nên NestJS sẽ inject `undefined` vào constructor.
> Các script `db:*` dùng `tsx` được vì không có decorator.

## Scripts (thư mục gốc)

| Lệnh                | Tác dụng                                  |
| ------------------- | ----------------------------------------- |
| `pnpm lint`         | ESLint toàn repo                          |
| `pnpm format`       | Prettier ghi định dạng                    |
| `pnpm format:check` | Prettier kiểm tra (không sửa)             |
| `pnpm typecheck`    | Kiểm kiểu TypeScript (strict) mọi package |
| `pnpm test`         | Unit test (Vitest)                        |
| `pnpm test:e2e`     | E2E (Playwright) — cần app đang chạy (M5) |
| `pnpm build`        | Build mọi package                         |

### Scripts CSDL (`pnpm --filter @vpp/api ...`)

| Lệnh          | Tác dụng                             |
| ------------- | ------------------------------------ |
| `db:generate` | Sinh migration SQL từ schema Drizzle |
| `db:migrate`  | Chạy migration lên CSDL              |
| `db:seed`     | Nạp dữ liệu mẫu (chạy lại được)      |
| `db:studio`   | Mở Drizzle Studio để xem dữ liệu     |

## API đã có (M1)

| Method            | Path                           | Quyền     |
| ----------------- | ------------------------------ | --------- |
| GET               | `/api/health`                  | công khai |
| GET               | `/api/auth/login`              | công khai |
| GET               | `/api/auth/callback`           | công khai |
| POST              | `/api/auth/logout`             | công khai |
| GET               | `/api/auth/logout-global`      | công khai |
| POST              | `/api/auth/backchannel-logout` | IdP → app |
| GET               | `/api/me`                      | đã login  |
| GET               | `/api/registration/status`     | đã login  |
| GET               | `/api/catalog`                 | đã login  |
| POST/PATCH/DELETE | `/api/admin/categories[/:id]`  | admin     |
| POST/PATCH/DELETE | `/api/admin/items[/:id]`       | admin     |

## Công cụ chất lượng

- **TypeScript strict** (`tsconfig.base.json`).
- **ESLint 9** (flat config) + **Prettier**.
- **Vitest** cho unit test; **Playwright** cho e2e.
- **Zod** validate biến môi trường (`apps/api/src/infra/config/env.ts`) — fail-fast khi sai.
- **Husky + lint-staged**: pre-commit tự chạy ESLint/Prettier trên file staged.
- **CI** (`.github/workflows/ci.yml`): install → lint → typecheck → test → build.

## Tài liệu

Xem `docs/` — `product/PRD.md`, `product/USER_STORIES.md`, `architecture/SDD.md`,
`architecture/SSO-INTEGRATION.md`, `architecture/ARCHITECTURE-OPTIONS.md`, `adr/`.
