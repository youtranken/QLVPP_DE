# Bản đồ mã nguồn VPP

> Cập nhật cuối mỗi task (xem `CLAUDE.md` mục "Bản đồ mã nguồn"). Một dòng cho mỗi module/feature: trách nhiệm · file chính · endpoint/bảng sở hữu · phụ thuộc. Trạng thái: ⬜ chưa có · 🟨 đang làm · ✅ có test xanh.

## Hạ tầng

| Module | TT | Trách nhiệm | File chính | Sở hữu | Phụ thuộc |
|---|---|---|---|---|---|
| compose/env | ✅ | Dịch vụ api·web·postgres·backup-cron (+`backup` profile); env bắt buộc `:?`; override dev (AUTH_DEV_MODE, web cổng ngẫu nhiên, Postgres `127.0.0.1:5492`); backup/restore | `docker-compose.yml`, `docker-compose.override.yml`, `.env.example`, `update-vpp.sh`, `ops/backup/*` | mạng `edge` alias `vpp-web`; volume `pgdata`, `filesdata` | — |
| api bootstrap | ✅ | Assert env fail-closed (`assertAuthEnvSafe`, `assertLocalSaConfigured`, `assertTrustProxyHops` 0–5) → migrate → Nest (pino, rawBody) → listen; `configureApp`: trust proxy = `TRUST_PROXY_HOPS`, cookie-parser, prefix `/api`, ValidationPipe, `GlobalExceptionFilter` `{statusCode, code, message}`; pino redact cookie/authorization/set-cookie + bỏ query khỏi URL; throttler 300/phút/user; route test `GET _ip` chỉ khi `NODE_ENV=test` | `api/src/main.ts`, `app.setup.ts`, `app.module.ts`, `net-ipv4-first.ts`, `common/{trust-proxy,logger.config,client-ip.controller,global-exception.filter,user-throttler.guard,cursor,sql}.ts`, `health/health.controller.ts`; test `api/test/{health,trust-proxy}.e2e-spec.ts`, `test-app.helper.ts` | `GET health` (public) | database, auth |
| database | ✅ | `DatabaseModule` global (`PG_POOL`, `DRIZZLE_DB`, kiểu `Database`); `runMigrations` checksum sha256 + advisory lock, mỗi file một transaction; migration nền 0001–0013 | `api/src/database/{database.module,migration-runner}.ts`, `api/src/migrations/0001…0013_*.sql`; test `api/test/migrations.db-spec.ts` | `_migrations`; tạo `config` (seed VPP), `users`, `sessions`, `audit_log` (append-only + chặn TRUNCATE), `processed_webhook_events`, `in_app_notifications`, `files` | — |
| web serve | ✅ | nginx tĩnh + proxy `/api` giữ `$request_uri`; body ≤ 6m; xóa header dev-identity | `web/nginx.conf`, `web/proxy-api-headers.conf`, `web/Dockerfile`, `web/vite.config.ts` | — | api |

## API — nền (copy QLTS, đã cắt)

| Module | TT | Trách nhiệm | File chính | Sở hữu | Phụ thuộc |
|---|---|---|---|---|---|
| auth | 🟨 | OIDC PKCE, phiên cookie `vpp_sid` (tx `vpp_oidc_tx`), refresh single-flight, guard toàn cục Identity → Csrf → Roles, `@Public()`/`@Roles()`, dev-identity (`x-dev-user-sub`/`x-dev-role` khi AUTH_DEV_MODE + development/test), SA local, BCL, webhook. Vai tính mỗi request trong `toIdentity`: `resolveRole(users.groups, config.admin_group)` (`role.ts`, không phân biệt hoa thường; `users.role` không quyết định quyền). SA lockout in-memory cửa sổ trượt 15′: cặp `(ip, username)` 5 sai, toàn cục 50 sai → 429 `SA_LOGIN_LOCKED`; đúng mật khẩu chỉ xóa bộ đếm cặp. Còn bản QLTS: webhook HMAC v1 (Task 5) | `api/src/modules/auth/*` (`identity.types.ts` = `RequestIdentity`/`AuthedRequest`, `role.ts`, `local-sa.service.ts`); test `api/test/{auth,dev-identity,role,sa-lockout}.e2e-spec.ts` + spec unit | `sessions`, `processed_webhook_events`; `auth/{login,callback,sa-login,me,logout,switch-account}`, `backchannel-logout`, `webhooks/pmh-id` | users, config, audit |
| users | ✅ | Bảng users (upsert theo `sub`), danh bạ PMH ID (`DirectoryClient` M2M), `DirectorySyncService` một transaction, scheduler 60′ (hằng) theo marker `config.directory_sync_last_at` — kiểm lúc boot + tick 5′, giữ nhịp qua restart; gate `authorized_groups` + self-heal; danh sách ẩn `deleted` và `local:sa`, cursor `?search&limit&cursor` | `api/src/modules/users/*` | `users`; `GET admin/users`, `POST admin/directory/sync` | config, audit, oidc |
| audit | ✅ | `AuditWriterService.append/appendWithin({actor, action, objectType?, objectId?, detail?})`, `@Audited` + interceptor, truy vấn keyset `?actor&action&from&to&limit&cursor` (ngày VN) | `api/src/modules/audit/*`; test `api/test/audit.e2e-spec.ts` | `audit_log`; `GET admin/audit` | database |
| config | 🟨 | `SystemConfigService.get/getInt` (cache 30 s), `getAdminGroup`, `get/setAuthorizedGroups`, `get/setDirectorySyncLastAt` (marker runtime); `GET/PUT admin/config` khóa VPP (validate đầy đủ, `public-config`: Task 5) | `api/src/modules/config/*` | `config`; `admin/config` | audit |
| files | ⬜ | Upload ảnh (magic bytes, ≤ 5 MB), đọc theo tham chiếu (`FileAccessPolicy`), dọn mồ côi | `api/src/modules/files/*` | `files`; `files`, `files/:id` | auth |

## API — nghiệp vụ VPP

| Module | TT | Trách nhiệm | File chính | Sở hữu | Phụ thuộc |
|---|---|---|---|---|---|
| catalog | ⬜ | Nhóm, món (ĐVT chuẩn, ảnh bắt buộc, `admin_only`), kho: nhập/điều chỉnh/xuất lẻ, sổ cái, sắp hết | `api/src/modules/catalog/*` | `item_categories`, `items`, `stock_movements`; `items`, `item-categories`, `admin/items*`, `admin/issues`, `me/issues` | files, users, config, audit |
| requests (P2) | ⬜ | Kỳ (`periods.deadline`), `ClockService`, phiếu + dòng (diff theo id), chép lại, review món ngoài DM | `api/src/modules/requests/*`, `common/period.ts`, `common/clock.service.ts` | `periods`, `requests`, `request_lines`; `periods/current`, `me/request*`, `admin/requests*`, `admin/review`, `admin/lines/:id/review` | catalog, files, notifications |
| delivery (P3) | ⬜ | Giao từng dòng/giao tất cả (idempotent), hoàn tác, hủy nợ, còn nợ | `api/src/modules/delivery/*` | `deliveries`; `admin/lines/:id/deliver`, `admin/requests/:id/deliver-all`, `admin/movements/:id/undo`, `admin/backlog` | requests, catalog, notifications |
| reports (P3) | ⬜ | Báo cáo sống + bản chốt, Excel 2 sheet, trang in | `api/src/modules/reports/*` | `report_snapshots`; `admin/reports/*` | requests, catalog |
| notifications (P3) | ⬜ | Chuông in-app, `event_id` tất định, cron mỗi giờ | `api/src/modules/notifications/*` | `in_app_notifications`; `me/notifications*` | users, config |

## Web

| Feature | TT | Trách nhiệm | File chính | Gọi API | Phụ thuộc |
|---|---|---|---|---|---|
| lib | ⬜ | `apiFetch` + CSRF + 401 relogin, `useMe`, i18n, nén ảnh EXIF | `web/src/lib/*` | `auth/me` | — |
| shell | ⬜ | Đăng nhập (PMH ID / Dành cho IT), forbidden, MemberShell (thanh trên + bottom nav 390 px), AdminShell (sidebar), RequireRole | `web/src/shell/*` | `public-config`, `auth/*` | lib |
| ui | ⬜ | Dialog, drawer, confirm, stepper, kpi-strip, data-table, load-state — không biết nghiệp vụ | `web/src/ui/*` | — | — |
| catalog | ⬜ | Trang Danh mục, Nhóm, ItemForm, ImageField, UnitSelect | `web/src/features/catalog/*` | `items*`, `item-categories*`, `files` | lib, ui |
| stock | ⬜ | Trang Kho: nhập, điều chỉnh, xuất lẻ, sổ cái, UserPicker | `web/src/features/stock/*` | `admin/items/:id/stock|issue|movements`, `admin/stock/low` | lib, ui |
| admin | ⬜ | Danh bạ, Nhật ký, Cấu hình | `web/src/features/admin/*` | `admin/users`, `admin/audit`, `admin/config` | lib, ui |
| profile | ⬜ | Trang Tôi: hồ sơ, ngôn ngữ, đăng xuất | `web/src/features/profile/*` | `auth/me`, `auth/logout` | lib |
| request (P2) | ⬜ | Trang Đăng ký (thẻ ảnh, giỏ, trạng thái lưu), Lịch sử | `web/src/features/request/*` | `periods/current`, `me/request*` | lib, ui |
| summary/review (P2) | ⬜ | Tổng hợp kỳ, ngăn điều chỉnh, hộp review riêng | `web/src/features/summary/*`, `review/*` | `admin/periods/*`, `admin/requests/*`, `admin/review` | lib, ui |
| delivery/reports (P3) | ⬜ | Giao hàng, Còn nợ, Báo cáo + bản chốt + in | `web/src/features/delivery/*`, `reports/*` | `admin/lines/*`, `admin/backlog`, `admin/reports/*` | lib, ui |

## Sơ đồ

`docs/diagrams/` — vẽ lại bằng archify cuối mỗi plan (chưa có).
