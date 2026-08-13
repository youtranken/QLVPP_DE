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
  mock-idp/   IdP OIDC giả lập PMH ID (CHỈ demo/dev)      — @vpp/mock-idp
  docker-compose.dev.yml   PostgreSQL cho dev
```

## Yêu cầu

- **Node.js ≥ 20** (khuyến nghị 20/22/24)
- **pnpm** (bật qua Corepack: `corepack enable`)

## Khởi động local

```bash
# 1) Cài dependency (từ thư mục gốc)
pnpm install

# 2) Cấu hình môi trường
cp .env.example .env        # Windows: copy .env.example .env

# 3) Dựng CSDL rồi tạo bảng + dữ liệu mẫu
docker compose -f deploy/docker-compose.dev.yml up -d
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

Thử đăng nhập: mở `http://localhost:3000/api/auth/login` → chọn một user demo
(`admin@pmh.com.vn` là admin) → quay lại app. Sau đó `GET /api/me` trả vai trò và
phòng ban, `GET /api/catalog` trả danh mục đã seed.

> **Cổng:** `.env.example` dùng `APP_BASE_URL=http://localhost:8080` (giống demo Docker,
> nginx proxy `/api` → api). Khi chạy API trực tiếp chưa có web, đặt
> `APP_BASE_URL=http://localhost:3000` trong `.env` để redirect OIDC quay đúng về API.
> Nếu máy đã có dịch vụ khác chiếm 3000/8080/5432, đổi `API_PORT` / `APP_BASE_URL` /
> `DATABASE_URL` trong `.env` — mock-idp đọc chung `.env` nên tự khớp theo.

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
