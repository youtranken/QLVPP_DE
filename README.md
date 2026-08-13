# DE-VPP — Hệ thống Đăng ký Văn phòng phẩm

Website nội bộ để **nhân viên đăng ký VPP hằng tháng**; **admin duyệt → tổng hợp → xác nhận đã giao → xuất báo cáo trình ký**.
Xác thực qua **PMH ID SSO** (OIDC). Kiến trúc **Modular Monolith** (xem `docs/`).

> **Trạng thái:** **M5 xong — sẵn sàng demo.** Một lệnh `docker compose` là có cả
> hệ thống kèm dữ liệu mẫu. Còn lại **M6**: ghép PMH ID thật và tài liệu vận hành prod.

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

### Cách 1 — Toàn bộ trong Docker (dùng để DEMO)

```bash
docker compose -f deploy/docker-compose.yml --profile app up -d --build
```

Mở **`http://localhost:8100`** → bấm _Đăng nhập bằng PMH ID_ → chọn một user demo.
Đăng nhập `admin@pmh.com.vn` để xem phần quản trị.

| Dịch vụ  | Địa chỉ                 | Ghi chú                                    |
| -------- | ----------------------- | ------------------------------------------ |
| web      | `http://localhost:8100` | nginx: SPA + proxy `/api` → api            |
| mock-idp | `http://localhost:9100` | IdP giả, origin riêng như PMH ID thật      |
| postgres | `localhost:5433`        | để xem CSDL bằng công cụ ngoài             |
| api      | _không publish_         | truy cập qua nginx, đúng như lúc chạy thật |

Migration, danh mục và **dữ liệu demo** (6 người dùng, 8 đơn ở đủ trạng thái, trải 3 kỳ)
tự nạp trước khi api khởi động, nên bảng điều khiển và báo cáo có số liệu ngay.
Bước nạp dữ liệu demo tự bỏ qua nếu CSDL đã có đơn.

```bash
docker compose -f deploy/docker-compose.yml --profile app ps        # trạng thái
docker compose -f deploy/docker-compose.yml --profile app logs -f   # log
docker compose -f deploy/docker-compose.yml --profile app down      # dừng, giữ dữ liệu
docker compose -f deploy/docker-compose.yml --profile app down -v   # dừng + xoá dữ liệu
```

Stack dùng project `vpp`, mạng `vpp-net`, volume `vpp_pgdata`/`vpp_uploads` và cổng
8100/9100/5433 — **không dùng chung gì** với các stack Docker khác trên máy.

Chạy lại bộ kiểm thử vào chính stack này:

```bash
API_URL=http://localhost:8100 IDP_URL=http://localhost:9100 pnpm smoke:api
E2E_BASE_URL=http://localhost:8100 E2E_IDP_URL=http://localhost:9100 pnpm test:e2e
```

### Cách 2 — Chạy trên máy, chỉ CSDL trong Docker (có hot-reload)

```bash
# 1) Cài dependency (từ thư mục gốc)
pnpm install

# 2) Cấu hình môi trường
cp .env.example .env        # Windows: copy .env.example .env

# 3) Chỉ dựng CSDL (không có --profile app), rồi tạo bảng + dữ liệu mẫu
docker compose -f deploy/docker-compose.yml up -d
pnpm --filter @vpp/api db:migrate
pnpm --filter @vpp/api db:seed        # danh mục + phòng ban
pnpm --filter @vpp/api db:seed:demo   # user + đơn mẫu (tuỳ chọn)

# 4) Chạy 3 tiến trình (3 cửa sổ terminal)
pnpm --filter @vpp/mock-idp start   # IdP giả : http://localhost:9000
pnpm --filter @vpp/api dev          # API     : http://localhost:3000
pnpm --filter @vpp/web dev          # Web     : http://localhost:8090

# 5) Kiểm tra chất lượng
pnpm lint                   # ESLint
pnpm typecheck              # TypeScript (strict) — build @vpp/shared rồi typecheck
pnpm test                   # Unit test (Vitest) toàn monorepo
pnpm build                  # Build tất cả package
pnpm test:e2e               # E2E Playwright — cần 3 tiến trình trên đang chạy
```

Mở `http://localhost:8090` → bấm **Đăng nhập bằng PMH ID** → chọn user demo.

> **Cổng ở cách 2:** `APP_BASE_URL` phải là origin của **WEB** (mặc định
> `http://localhost:8090`), vì trình duyệt quay về đó sau khi đăng nhập và Vite
> proxy `/api` sang backend — giống hệt nginx lúc chạy thật. Nếu máy đã có dịch vụ
> khác chiếm cổng, đổi `API_PORT` / `WEB_PORT` / `WEB_API_PROXY` / `APP_BASE_URL` /
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

| Lệnh                | Tác dụng                                            |
| ------------------- | --------------------------------------------------- |
| `pnpm lint`         | ESLint toàn repo                                    |
| `pnpm format`       | Prettier ghi định dạng                              |
| `pnpm format:check` | Prettier kiểm tra (không sửa)                       |
| `pnpm typecheck`    | Kiểm kiểu TypeScript (strict) mọi package           |
| `pnpm test`         | Unit test (Vitest)                                  |
| `pnpm test:e2e`     | E2E Playwright — cần mock-idp + api + web đang chạy |
| `pnpm build`        | Build mọi package                                   |
| `pnpm smoke:api`    | Smoke test API qua HTTP thật (xem bên dưới)         |

## Màn hình

### Nhân viên (M3)

| Đường dẫn         | Màn hình                                                |
| ----------------- | ------------------------------------------------------- |
| `/dang-nhap`      | Đăng nhập PMH ID (không có ô mật khẩu)                  |
| `/khong-co-quyen` | Trang báo chưa được cấp quyền (`access_denied`)         |
| `/`               | Trang chủ: kỳ hiện tại, trạng thái đăng ký, tóm tắt đơn |
| `/dang-ky`        | Đăng ký VPP: danh mục theo nhóm, giỏ, mục "Khác" + ảnh  |
| `/don-cua-toi`    | Đơn của tôi: lịch sử theo kỳ, chi tiết, huỷ, gửi lại    |

### Quản trị viên (M4)

| Đường dẫn            | Màn hình                                                          |
| -------------------- | ----------------------------------------------------------------- |
| `/quan-tri`          | Bảng điều khiển: thống kê nhiều kỳ, theo phòng ban, tỉ lệ đã giao |
| `/quan-tri/don`      | Duyệt đơn: lọc + phân trang, duyệt/từ chối, giao, điều chỉnh      |
| `/quan-tri/tong-hop` | Tổng hợp theo món + tải Excel trình ký                            |
| `/quan-tri/danh-muc` | Quản lý nhóm và món (admin_only, tối đa, ngừng/bật)               |
| `/quan-tri/danh-ba`  | Danh bạ nhân viên + nút Đồng bộ ngay                              |
| `/quan-tri/nhat-ky`  | Nhật ký hoạt động, lọc theo hành động                             |

Khung app có menu theo vai trò, chuông thông báo (số chưa đọc), đăng xuất local/toàn hệ
và banner trạng thái cửa sổ đăng ký. Giao diện dùng **theme trung tính đặt chỗ** — đổi
màu và logo ở `apps/web/src/theme.ts` + `AppLayout.tsx` khi có tài sản thương hiệu.

Màn quản trị được **tải chậm (lazy)**: riêng ECharts đã nặng hơn phần còn lại của app,
nên nhân viên không phải tải chỗ đó.

## Scripts CSDL (`pnpm --filter @vpp/api ...`)

| Lệnh           | Tác dụng                                          |
| -------------- | ------------------------------------------------- |
| `db:generate`  | Sinh migration SQL từ schema Drizzle              |
| `db:migrate`   | Chạy migration lên CSDL                           |
| `db:seed`      | Nạp danh mục + phòng ban (chạy lại được)          |
| `db:seed:demo` | Nạp user + đơn mẫu để demo (bỏ qua nếu đã có đơn) |
| `db:studio`    | Mở Drizzle Studio để xem dữ liệu                  |

## API đã có (M1 + M2)

| Method            | Path                                           | Quyền     |
| ----------------- | ---------------------------------------------- | --------- |
| GET               | `/api/health`                                  | công khai |
| GET               | `/api/auth/login` · `/callback`                | công khai |
| POST              | `/api/auth/logout`                             | công khai |
| GET               | `/api/auth/logout-global`                      | công khai |
| POST              | `/api/auth/backchannel-logout`                 | IdP → app |
| POST              | `/api/webhooks/pmh-id`                         | IdP → app |
| GET               | `/api/me` · `/api/registration/status`         | đã login  |
| GET               | `/api/catalog` · `/api/departments`            | đã login  |
| GET/POST          | `/api/notifications[/:id/read\|/read-all]`     | đã login  |
| POST              | `/api/uploads` · GET `/api/uploads/:file`      | đã login  |
| POST              | `/api/requests`                                | đã login  |
| GET               | `/api/requests/mine` · `/api/requests/:id`     | đã login  |
| DELETE            | `/api/requests/:id` (huỷ)                      | đã login  |
| POST/PATCH/DELETE | `/api/admin/categories[/:id]` · `/items[/:id]` | admin     |
| GET               | `/api/admin/requests` · `/requests/summary`    | admin     |
| POST              | `/api/admin/requests/:id/approve` · `/reject`  | admin     |
| POST              | `.../items/:lineId/deliver` · `/deliver-all`   | admin     |
| POST              | `.../undeliver-all`                            | admin     |
| PATCH             | `/api/admin/requests/:id` (điều chỉnh)         | admin     |
| GET               | `/api/admin/users` · `/api/admin/audit`        | admin     |
| POST              | `/api/admin/directory-sync`                    | admin     |
| GET               | `/api/admin/stats`                             | admin     |
| GET               | `/api/export/requests.xlsx`                    | admin     |

### Smoke test API

`pnpm smoke:api` chạy đúng luồng người dùng qua HTTP thật trên stack đang chạy
(đăng nhập SSO → đăng ký → duyệt → giao → báo cáo → danh bạ → webhook), 35 mục kiểm.

```bash
pnpm smoke:api                                                   # stack Docker
API_URL=http://localhost:3001 IDP_URL=http://localhost:9000 pnpm smoke:api   # chạy trên máy
```

> Script **ghi dữ liệu thật** và dọn bảng đơn/thông báo/audit trước mỗi lần chạy
> (vì quy tắc 1 đơn hiệu lực/kỳ khiến lần chạy sau không tạo được đơn nữa).
> Chỉ dùng cho môi trường dev/demo.

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
