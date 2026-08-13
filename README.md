# DE-VPP — Hệ thống Đăng ký Văn phòng phẩm

Website nội bộ để **nhân viên đăng ký VPP hằng tháng**; **admin duyệt → tổng hợp → xác nhận đã giao → xuất báo cáo trình ký**.
Xác thực qua **PMH ID SSO** (OIDC). Kiến trúc **Modular Monolith** (xem `docs/`).

> **Trạng thái:** M0 — khung monorepo + công cụ (chưa có nghiệp vụ đầy đủ).

## Cấu trúc

```
apps/
  api/        Backend NestJS (API + BFF auth + jobs)     — @vpp/api
  web/        Frontend React + Vite                       — @vpp/web
packages/
  shared/     Quy tắc nghiệp vụ dùng chung (TypeScript)   — @vpp/shared
docs/         PRD, SDD, ADR, SSO-INTEGRATION, ...
deploy/       (M5) Docker Compose, Dockerfile, mock-idp
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

# 3) Kiểm tra chất lượng
pnpm lint                   # ESLint
pnpm typecheck              # TypeScript (strict) — build @vpp/shared rồi typecheck
pnpm test                   # Unit test (Vitest) toàn monorepo
pnpm build                  # Build tất cả package

# 4) Chạy dev (khi đã có nghiệp vụ ở M1+)
pnpm --filter @vpp/web dev  # web: http://localhost:8080
pnpm --filter @vpp/api start
```

> **Lưu ý:** `@vpp/api` và `@vpp/web` phụ thuộc `@vpp/shared`. Các script `typecheck`/`test`/`build`
> đã tự **build `@vpp/shared` trước** nên không cần làm thủ công.

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
