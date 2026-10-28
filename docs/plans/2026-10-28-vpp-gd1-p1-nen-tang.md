# VPP GĐ1 — Plan 1: Nền tảng (E0 · E1 · khung web)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng được app VPP chạy trên `docker compose` với đăng nhập PMH ID / SA cục bộ, phân quyền theo group, nhật ký, cấu hình, danh bạ, tệp ảnh, danh mục món + kho + xuất lẻ, và khung web hai shell song ngữ — nền để Plan 2 thêm phiếu đăng ký.

**Architecture:** Copy-and-trim phần "vô hình" từ QLTS_DE (NestJS BFF, phiên server-side, migration SQL thuần có checksum), sửa 4 điểm đã chốt sau review (role tính mỗi request từ `users.groups`, SA lockout theo (IP, user), webhook HMAC v2, `TRUST_PROXY_HOPS`), viết mới module `files` với luật đọc theo tham chiếu, và module `catalog` (items, item_categories, stock_movements). Web React 19 + Vite dùng token CSS từ `design-preview/final/tokens.css`, hai shell (member/admin) theo `_SPEC.md`.

**Tech Stack:** Node 24 (`node:24.22.1-alpine`), NestJS 11, `pg` 8 + drizzle-orm (schemaless), jose 6, openid-client 6, nestjs-pino, @nestjs/throttler, @nestjs/schedule, class-validator, multer; React 19, Vite 8, TS 6, TanStack Query 5, react-router 7, react-i18next, Radix Dialog, vitest, oxlint, Playwright; PostgreSQL 18; nginx 1.30.

**Spec:** `docs/prd.md` (§6.1, §6.2, §6.6 FR-50…54, §6.9, §6.10, §7 BR-10/14, §9), `docs/architecture.md` (§2–5, §8, §12–16), `docs/backlog/epic-0-nen-tang.md`, `epic-1-danh-muc-kho.md`, `epic-6-thong-bao-ho-so-i18n.md` S3–S4, `design-preview/_SPEC.md`.

**Nguồn copy:** QLTS_DE clone tại `/tmp/claude-1000/-home-ims-Desktop-VPP/887cedeb-f48a-4aee-9803-801920921afb/scratchpad/repos/QLTS_DE` (mất thì `git clone --depth 1 https://github.com/youtranken/QLTS_DE.git` vào đúng chỗ). Dưới đây gọi tắt là `$QLTS`.

## Global Constraints

- Repo đích `/home/ims/Desktop/VPP`, nhánh `main`, remote `origin` đã trỏ `youtranken/QLVPP_DE`; commit cục bộ từng task, **không push**. `.env` nằm trong `.gitignore`; secret chỉ qua env.
- `COMPOSE_PROJECT_NAME=vpp`; chỉ service `web` lên mạng `edge` với alias `vpp-web`; `api`/`postgres` chỉ ở mạng default; `api` có `extra_hosts: ["de-admin.pmh.com.vn:host-gateway"]`; `postgres` không publish cổng ở prod compose (override dev publish `127.0.0.1:5492`).
- Cookie phiên `vpp_sid` (httpOnly/Secure/SameSite=Strict/30 ngày), cookie tx `vpp_oidc_tx`; API prefix `/api`; lỗi dạng `{code, message, …}`; mutate cần header `X-CSRF-Token`; guard thứ tự `IdentityGuard → CsrfGuard → RolesGuard`.
- Env bắt buộc (`:?` trong compose, assert lúc boot): `POSTGRES_USER/PASSWORD/DB`, `DATABASE_URL`, `APP_BASE_URL`, `PMH_ISSUER_URL`, `PMH_CLIENT_ID`, `PMH_CLIENT_SECRET`, `PMH_WEBHOOK_SECRET`, `LOCAL_SA_USERNAME`, `LOCAL_SA_PASSWORD_HASH`, `TRUST_PROXY_HOPS`, `WEBHOOK_TS_SKEW_SEC`; `AUTH_DEV_MODE=true` chỉ hợp lệ khi `NODE_ENV ∈ {development, test}` (khác → app từ chối khởi động).
- Vai: `sa` (phiên SA) · `admin` (`users.groups ∩ config.admin_group`, mặc định `vpp-admin`, không phân biệt hoa thường, tính **mỗi request**) · `member`. SA không xuất hiện trong danh bạ.
- ĐVT món ∈ `{cai, hop, cay, ram, cuon, loc, bich, chai, bo}`; `max_qty > 0` mặc định 20; `stock_qty ≥ 0`; ảnh jpeg/png/webp ≤ 5 MB, kiểm magic bytes, tên tệp `<uuid>.<ext>` trong `/data/files`.
- Web: tiếng Việt mặc định, en thứ hai; không chuỗi cứng trong component; token màu từ `design-preview/final/tokens.css` (brand `#059669`, `--ink-3: #667a70`); member font Nunito, admin IBM Plex Sans; không AntD; gọi vai admin là **Hành chính** trong UI; nút chính đăng nhập "Đăng nhập bằng tài khoản công ty (PMH ID)".
- Migration: `NNNN_ten.sql`, không sửa file đã apply (checksum); số 0001–0013 nền, 0100 catalog.

## Review Focus

1. Ảnh HEIC từ iPhone (trình duyệt không decode được bằng canvas) → FE phải báo "Chọn ảnh JPG/PNG/WebP" trước khi gửi, server trả `FILE_TYPE_INVALID`; không được treo spinner. → test ở Task 10 và Task 7.
2. `PUT admin/config` với body thiếu khóa → chỉ cập nhật khóa gửi lên, không xóa khóa khác; `registration_last_day: "10"` (chuỗi) → `CONFIG_INVALID`. → test ở Task 5.
3. Nhập mua và xuất lẻ cùng lúc trên một món (tồn 1, hai request issue 1) → đúng một thành công, tồn 0, không âm. → test ở Task 8.
4. Tên món/nhóm toàn khoảng trắng hoặc dài 300 ký tự → 400 có `code`, không 500; tên nhóm trùng khác hoa thường → 409 `CATEGORY_EXISTS`. → test ở Task 8.
5. `X-Forwarded-For` giả từ client khi `TRUST_PROXY_HOPS=2` (`"1.2.3.4, 10.0.0.9, <edge>"`) → `req.ip` vẫn là `10.0.0.9` (phần tử thứ 2 từ phải), không phải `1.2.3.4`. → test ở Task 3.

---

### Task 1: Khung repo, compose, Dockerfile, env

**Files:**
- Create: `api/package.json`, `api/tsconfig*.json`, `api/nest-cli.json`, `api/eslint.config.mjs`, `api/jest.config` (trong package.json), `api/Dockerfile`, `api/src/main.ts` (tạm: boot NestFactory + `/api/health`), `api/src/app.module.ts`, `api/src/health/health.controller.ts`
- Create: `web/package.json`, `web/vite.config.ts`, `web/tsconfig*.json`, `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx` (tạm "VPP"), `web/Dockerfile`, `web/nginx.conf`, `web/proxy-api-headers.conf`
- Create: `docker-compose.yml`, `docker-compose.override.yml`, `.env.example`, `update-vpp.sh`, `ops/backup/*`, `README.md`
- Modify: `.gitignore` (đã có), `.nvmrc` (đã có)

**Interfaces:**
- Produces: `GET /api/health → 200 {status:'ok'}`; compose services `api` (3000), `web` (80, alias `vpp-web` trên `edge`), `postgres` (18), `backup-cron`; volume `pgdata`, `filesdata`; `.env.example` đủ khóa ở Global Constraints + `BACKUP_*`, `*_MEM_LIMIT`, `NODE_ENV`.

- [ ] **Step 1: Copy skeleton** — từ `$QLTS`: `api/{package.json,tsconfig.json,tsconfig.build.json,nest-cli.json,eslint.config.mjs,Dockerfile}`, `web/{package.json,vite.config.ts,tsconfig*.json,index.html,Dockerfile,nginx.conf,proxy-api-headers.conf}`, `docker-compose.yml`, `.env.example`, `ops/backup/`, `update-qlts.sh → update-vpp.sh`. Trong `api/package.json` xóa deps `bullmq`, `ioredis`, `nodemailer` và script `worker*`; đổi `name` thành `vpp-api`/`vpp-web`. Trong `web/package.json` xóa `@tanstack/react-table` nếu không dùng (giữ nếu Task 10 dùng data-table của QLTS — giữ). Thêm `@nestjs/schedule`, `multer`, `@types/multer` vào api.
- [ ] **Step 2: Compose** — xóa service `worker`, `redis`, `edge` (nếu là network ngoài thì giữ khai báo `networks: edge: external: true`), volume `redisdata`; `web` có `networks: {default: {}, edge: {aliases: [vpp-web]}}`; `api` giữ `extra_hosts`, thêm env `TRUST_PROXY_HOPS=${TRUST_PROXY_HOPS:?}`, `WEBHOOK_TS_SKEW_SEC=${WEBHOOK_TS_SKEW_SEC:-300}`; `nginx.conf` đổi `server_name de-vpp.pmh.com.vn`, giữ `resolver 127.0.0.11` + biến upstream `api`. `docker-compose.override.yml`: `postgres.ports: ["127.0.0.1:5492:5432"]`, `api.environment.AUTH_DEV_MODE=true`, `NODE_ENV=development`.
- [ ] **Step 3: `.env.example`** — bỏ `REDIS_*`, `SMTP_*`, `MAIL_ENC_KEY`, `WORKER_MEM_LIMIT`; thêm `TRUST_PROXY_HOPS=2`, `WEBHOOK_TS_SKEW_SEC=300`, `DATABASE_URL=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}`; giá trị mẫu `APP_BASE_URL=https://de-vpp.pmh.com.vn:8443`, `PMH_ISSUER_URL=https://de-admin.pmh.com.vn:8443/oidc`, `PMH_CLIENT_ID=project-vpp`, `COMPOSE_PROJECT_NAME=vpp`.
- [ ] **Step 4: api tối thiểu** — `main.ts` boot `AppModule` với `setGlobalPrefix('api')`, `HealthController` (`@Get('health')` → `{status:'ok'}`), test `api/test/health.e2e-spec.ts`: `request(app).get('/api/health').expect(200)` dùng `createTestApp` copy từ `$QLTS/api/test/test-app.helper.ts` (+ `jest-e2e.json`, `jest-db.json`).
- [ ] **Step 5: Verify** — `cd api && npm ci && npm run build && npm run test:e2e -- health` → PASS; `cd web && npm ci && npm run build` → `dist/`; `docker compose config` → không lỗi, không còn chữ `redis`/`worker`; `cp .env.example .env` (điền giá trị dev) → `docker compose up -d --build` → `curl -s localhost:$(docker compose port web 80 | cut -d: -f2)/api/health` → `{"status":"ok"}`.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "chore: khung repo api/web, compose, env theo QLTS_DE (bỏ redis/worker)"`.

### Task 2: Database module, migration runner, migrations nền 0001–0013

**Files:**
- Create: `api/src/database/{database.module.ts,migration-runner.ts}` (copy), `api/src/migrations/0001_config.sql` … `0013_files.sql`
- Test: `api/test/migrations.db-spec.ts`

**Interfaces:**
- Produces: providers `PG_POOL` (`pg.Pool`), `DRIZZLE_DB`; `runMigrations(pool, dir, logger)` chạy lúc boot (trong `main.ts` trước `listen`); bảng: `config`, `users(+department)`, `sessions(+id_token, local sa)`, `audit_log` (append-only, no truncate), `processed_webhook_events(event_id PK, received_at)`, `in_app_notifications(id, user_sub, event_id, topic, params jsonb, link, created_at, read_at, UNIQUE(event_id,user_sub))`, `files(id uuid PK, original_name text, mime text, size_bytes int, purpose text CHECK (purpose IN ('item_image','line_image')), uploaded_by_sub text NOT NULL, created_at timestamptz DEFAULT now())`, `_migrations`.
- Test DB: `DATABASE_URL=postgres://<user>:<pass>@127.0.0.1:5492/vpp_test` (tạo bằng `docker compose exec postgres createdb -U $POSTGRES_USER vpp_test`); `npm run test:db` chạy `*.db-spec.ts` tuần tự.

- [ ] **Step 1: Test** — `migrations.db-spec.ts`:
  - `runMigrations` trên DB sạch rồi chạy lại → lần 2 không áp thêm (đếm `_migrations` không đổi);
  - sửa nội dung file 0003 trong thư mục tạm rồi chạy → reject với message chứa `checksum`;
  - `UPDATE audit_log`, `DELETE FROM audit_log`, `TRUNCATE audit_log` → mỗi lệnh reject;
  - `SELECT key FROM config` ⊇ `registration_last_day, default_max_qty, admin_group, authorized_groups, low_stock_notify, signers, admin_contact` với `admin_group = '"vpp-admin"'`, `registration_last_day = '10'`;
  - `INSERT files(purpose='other')` reject; `INSERT in_app_notifications` hai lần cùng `(event_id,user_sub)` → lần 2 reject 23505.
- [ ] **Step 2: Run** — `npm run test:db -- migrations` → FAIL (module chưa có).
- [ ] **Step 3: Implement** — copy `database/*`; migrations theo `architecture.md` §16: `0001_config.sql` viết mới (bảng `config` giống QLTS + seed VPP ở §5), `0002` = QLTS `0002_users.sql`, `0003` = `0003_audit_log.sql`, `0004` = `0004_sessions.sql`, `0005` = `0005_audit_append_only.sql`, `0006` = `0006_audit_no_truncate.sql`, `0007` = `0007_users_role_check.sql`, `0008` = phần `processed_webhook_events` của `0026_offboarding.sql`, `0009` = `0028_session_id_token.sql`, `0010` = `0032_sessions_local_sa.sql`, `0011` = `0050_users_department.sql`, `0012` = `0053_in_app_notifications.sql` (+ `event_id` + UNIQUE nếu bản gốc thiếu), `0013_files.sql` mới. Gọi `runMigrations` trong `main.ts`.
- [ ] **Step 4: Run** — `npm run test:db -- migrations` → PASS; `docker compose up -d --build api && docker compose logs api | grep -c applied` ≥ 13.
- [ ] **Step 5: Commit** — `git commit -am "feat(db): migration runner + 13 migration nền (config seed VPP, files, webhook events)"`.

### Task 3: Module auth/users/audit/config copy + boot fail-closed + `TRUST_PROXY_HOPS`

**Files:**
- Create (copy từ `$QLTS/api/src`): `modules/auth/*` (trừ thay đổi ở Task 4–5), `modules/users/*` (bỏ `user_permissions`), `modules/audit/*`, `modules/config/{config.module,config.schema,system-config.service,config-admin.service,config.controller}.ts` (bỏ `mail-settings`, `smtp-config`), `common/{global-exception.filter,user-throttler.guard,sql}.ts`, `net-ipv4-first.ts`, `app.setup.ts`, `scripts/sa-hash.mjs`
- Modify: `api/src/main.ts` (assert env), `api/src/app.setup.ts` (trust proxy), `api/src/app.module.ts`
- Test: copy `*.spec.ts` đi kèm; `api/test/auth.e2e-spec.ts`, `api/test/trust-proxy.e2e-spec.ts`

**Interfaces:**
- Produces: `Identity {sub, role: 'member'|'admin'|'sa', email, fullName, department, csrfToken, sessionId}` gắn `req.identity`; decorators `@Public()`, `@Roles('admin','sa')`; `AuditWriterService.append(entry: {actorSub, action, targetType?, targetId?, before?, after?, ip?})` và `appendWithin(client, entry)`; `SystemConfigService.get<T>(key)` (cache 30 s), `getAuthorizedGroups()`, `getAdminGroup(): Promise<string>` (mới), `getInt(key)`; `UsersService.upsertFromClaims(claims)`, `findBySub(sub)`; endpoints `GET auth/me → {sub, role, csrfToken, fullName, email, department, employeeCode, locale, config: {registration_last_day, default_max_qty, admin_contact}}`, `POST auth/logout`, `GET auth/login`, `GET auth/callback`, `GET auth/switch-account`, `POST admin/directory/sync`, `GET admin/users` (phân trang `?limit&cursor`, không có `local:sa`), `GET admin/audit?actor&action&from&to&limit&cursor`.
- Env: `assertAuthEnvSafe`, `assertLocalSaConfigured`, thêm `assertTrustProxyHops(env)` (số nguyên 0–5).

- [ ] **Step 1: Tests** — `auth.e2e-spec.ts`: `GET /api/auth/callback?error=access_denied&state=x` → 302 `Location` kết thúc `/?login=forbidden`; `POST /api/auth/logout` không `X-CSRF-Token` với phiên dev → 403 với `code` của CsrfGuard (giữ tên QLTS); `GET /api/auth/me` (dev admin) có `config.admin_contact`; `GET /api/admin/users` với header dev `x-dev-role: member` → 403; với `admin` → 200 và không có `sub = 'local:sa'`. `trust-proxy.e2e-spec.ts`: app tạo với `TRUST_PROXY_HOPS=2`, route test `@Public() GET /api/_ip` (chỉ đăng ký khi `NODE_ENV=test`) trả `req.ip`; gửi `X-Forwarded-For: 1.2.3.4, 10.0.0.9, 172.18.0.2` → `10.0.0.9`; với `TRUST_PROXY_HOPS=1` → `172.18.0.2`. Unit `auth-env.spec.ts`: `AUTH_DEV_MODE=true` + `NODE_ENV=production` → throw.
- [ ] **Step 2: Run** — `npm run test:e2e -- auth trust-proxy` → FAIL.
- [ ] **Step 3: Implement** — copy các module; `app.setup.ts`: `express.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS))`; đổi tên cookie `qlts_sid → vpp_sid`, `qlts_oidc_tx → vpp_oidc_tx` (grep `qlts` phải về 0 trong `api/src`); `SystemConfigService.getAdminGroup()` đọc `config.admin_group`; `main.ts` gọi ba assert trước `NestFactory.create`.
- [ ] **Step 4: Run** — `npm run test && npm run test:e2e` → PASS (gồm spec copy từ QLTS); `grep -ri qlts api/src | wc -l` → 0.
- [ ] **Step 5: Commit** — `git commit -am "feat(auth): copy module auth/users/audit/config từ QLTS, trust proxy theo số hop, boot fail-closed"`.

### Task 4: Role mỗi request từ `users.groups`; SA lockout theo (IP, username) + toàn cục

**Files:**
- Modify: `api/src/modules/auth/session-auth.service.ts` (`toIdentity`), `modules/auth/local-sa.service.ts`, `modules/users/directory-sync.service.ts`, `modules/auth/webhook.controller.ts` (nhánh `groups_changed` chỉ ghi `groups`)
- Test: `session-auth.service.spec.ts`, `local-sa.service.spec.ts`, `api/test/role.e2e-spec.ts`

**Interfaces:**
- Produces: `resolveRole(groups: string[], adminGroup: string): 'admin'|'member'` (export thuần trong `modules/auth/role.ts`); `LocalSaService.recordFailure(ip, username)`, `isLocked(ip, username): boolean` với ngưỡng `PAIR_MAX=5`, `GLOBAL_MAX=50`, cửa sổ 15′.

- [ ] **Step 1: Tests** — `role.spec.ts`: `resolveRole(['VPP-Admin'],'vpp-admin') === 'admin'`, `resolveRole(['x'],'vpp-admin') === 'member'`. `session-auth.service.spec.ts`: phiên của user có `groups=['vpp-admin']` → identity `admin`; `UPDATE users SET groups='[]'` (mock repo) → request kế `member` không cần refresh. `local-sa.service.spec.ts`: 5 sai (ip A, user X) → `isLocked(A,X)=true`, `isLocked(B,X)=false`; 50 sai rải 10 IP → `isLocked(bất kỳ)=true`; sau 15′ (fake timers) mở lại. `role.e2e-spec.ts` (db): seed user groups `['vpp-admin']`, header dev → `GET auth/me.role === 'admin'`; webhook `user.groups_changed {groups: []}` → `GET auth/me.role === 'member'`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — `toIdentity` đọc `users.groups` + `getAdminGroup()` rồi `resolveRole`; bỏ mọi chỗ ghi `users.role` làm nguồn quyền (giữ cột, cập nhật cho hiển thị cùng chỗ); `LocalSaService` giữ `Map<string, number[]>` theo khóa `${ip}|${username}` và `'*'`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(auth): role tính mỗi request từ groups; SA lockout theo (ip,user) + toàn cục"`.

### Task 5: Webhook HMAC v2 + BCL; cấu hình admin có validate

**Files:**
- Modify: `api/src/modules/auth/webhook.controller.ts`, `modules/auth/webhook-signature.ts` (mới, thuần), `modules/config/config-admin.service.ts`, `modules/config/config.controller.ts`
- Test: `webhook-signature.spec.ts`, `webhook.controller.spec.ts`, `api/test/config-admin.e2e-spec.ts`

**Interfaces:**
- Produces: `verifyV2({secret, ts, rawBody, signature, nowSec, skewSec}): {ok: boolean, reason?: 'missing'|'skew'|'mismatch'}`; `@Public() GET /api/public-config → {admin_contact}` (cho trang từ chối trước khi có phiên); `GET admin/config → {registration_last_day, default_max_qty, admin_group, authorized_groups, low_stock_notify, signers: {preparer, head, approver}, admin_contact}`; `PUT admin/config` (partial merge) → 400 `CONFIG_INVALID {field}` khi `registration_last_day ∉ [3,28]` hoặc không phải số nguyên, `default_max_qty ∉ [1,999]`, `admin_group` rỗng; audit `config.updated {before, after}`.

- [ ] **Step 1: Tests** — `webhook-signature.spec.ts`: vector tự tính (`secret='s'`, `ts='1761609600'`, body `{"event_id":"e1","type":"user.locked","sub":"u1"}`, expected = `createHmac('sha256','s').update('1761609600.'+body).digest('hex')`) → `ok`; `nowSec = ts+301` → `skew`; thiếu header → `missing`. **Bước bắt buộc:** `gh api repos/youtranken/PMH_IDE/contents/docs/integration --jq '.[].name'` rồi đọc file webhook; nếu tài liệu có vector mẫu, thêm nó làm test thứ hai (giá trị thật của PMH ID). `webhook.controller.spec.ts`: chỉ header `x-pmh-signature` (v1) → 401; `event_id` lặp → lần 2 `{duplicate:true}` không xử lý lại. BCL e2e (copy từ QLTS, đổi tên cookie): `logout_token` hợp lệ cho `sub` có 2 phiên → cả hai `GET auth/me` 401. `config-admin.e2e-spec.ts`: `GET /api/public-config` không phiên → 200 `{admin_contact}`; `PUT {registration_last_day: 29}` → 400 `CONFIG_INVALID`; `PUT {registration_last_day: "10"}` → 400; `PUT {signers: {preparer:'A'}}` → `GET` vẫn còn `admin_group`; audit có bản ghi `config.updated`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — controller đọc `X-PMH-Signature-V2`, `X-PMH-Timestamp`, env `WEBHOOK_TS_SKEW_SEC`; so sánh `timingSafeEqual`; xóa nhánh v1. Config: whitelist khóa + validator từng khóa; merge từng khóa trong một transaction.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(auth): webhook HMAC v2 có timestamp; config admin validate + merge"`.

### Task 6: Module `files` (viết mới) với luật đọc theo tham chiếu

**Files:**
- Create: `api/src/modules/files/{files.module,files.controller,files.service,file-access.policy,file-validation,files-cleanup.job}.ts`
- Copy: `$QLTS/api/src/modules/files/file-validation.ts` (+ spec) làm điểm xuất phát
- Test: `file-validation.spec.ts`, `api/test/files.e2e-spec.ts`

**Interfaces:**
- Produces: `POST /api/files` multipart field `file` + body `purpose` → `201 {id, mime, size_bytes}`; lỗi `FILE_TYPE_INVALID`, `FILE_TOO_LARGE` (> 5 MB), `PURPOSE_INVALID`; `GET /api/files/:id` → stream `inline`, mime thật, `nosniff`, `Cache-Control: private, max-age=86400`, 404 khi không được phép; `FileAccessPolicy.canRead(fileId, identity): Promise<boolean>` = admin/sa ∨ `uploaded_by_sub = me` ∨ `∃ checker.references(fileId, identity)`; `FileAccessPolicy.registerReference(checker: {references(fileId, identity): Promise<boolean>})` — Task 8 đăng ký `ItemImageReference`, Plan 2 đăng ký `LineImageReference`; `FilesService.assertOwnedBy(fileId, sub, purpose)` → throw `FILE_FORBIDDEN`; `FilesCleanupJob.run(now)` xóa tệp `created_at < now − 24 h` không được tham chiếu (danh sách bảng tham chiếu cũng qua `registerReference(...).orphanQuery`), cron `0 3 * * *` giờ VN.
- Throttle upload 20/phút/user.

- [ ] **Step 1: Tests** — `files.e2e-spec.ts` (db): upload PNG 1×1 thật → 201; `.exe` đổi đuôi → `FILE_TYPE_INVALID`; buffer 5 MB + 1 → `FILE_TOO_LARGE`; `purpose='x'` → `PURPOSE_INVALID`; member A upload → A GET 200 `Content-Disposition: inline`, header `Content-Type: image/png`; member B GET → 404; admin GET → 200; không có bản ghi `audit_log` action bắt đầu `files.` sau GET; `FilesCleanupJob.run(now + 25 h)` xóa tệp A (chưa tham chiếu) và tệp biến mất trên đĩa; gọi upload 21 lần/phút → 429.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** — multer memory; `file-validation.sniff(buffer) → 'image/jpeg'|'image/png'|'image/webp'|null`; ghi `FILES_DIR` (env, mặc định `/data/files`); policy một truy vấn SQL `EXISTS` ghép từ các checker; cleanup dùng `NOT EXISTS` các bảng đã đăng ký.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(files): upload ảnh có kiểm magic bytes, luật đọc theo tham chiếu, dọn tệp mồ côi"`.

### Task 7: Migration `0100_vpp_catalog.sql` + db-spec ràng buộc

**Files:**
- Create: `api/src/migrations/0100_vpp_catalog.sql`
- Test: `api/test/catalog-schema.db-spec.ts`

**Interfaces:**
- Produces: bảng `item_categories`, `items`, `stock_movements` **đúng DDL `architecture.md` §5** (gồm `unit` CHECK, `pack_note`, `low_stock_notified_at`, `reason IN ('purchase','delivery','issue','return','adjust')`, `recipient_sub`, `ref_line_id` **chưa có FK** (bảng `request_lines` tới Plan 2 sẽ `ADD CONSTRAINT … ON DELETE RESTRICT`), `ref_movement_id`, CHECK theo `reason`), unique `lower(name)` nhóm, index `stock_movements(item_id, created_at)`.

- [ ] **Step 1: Test** — `INSERT items(stock_qty=-1)` reject; `max_qty=0` reject; `unit='thung'` reject; `code` trùng reject; nhóm `'Giấy'` rồi `'giấy'` reject; movement `purchase, delta=-1` reject; `adjust` không `note` reject; `issue, delta=-2, note='người mới'` OK; `return` thiếu `ref_movement_id` reject.
- [ ] **Step 2: Run** → FAIL. **Step 3:** viết SQL. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(db): 0100 catalog — item_categories, items, stock_movements"`.

### Task 8: Module `catalog` — nhóm, món, kho, xuất lẻ, sổ cái

**Files:**
- Create: `api/src/modules/catalog/{catalog.module,categories.controller,items.controller,items-admin.controller,stock.controller,catalog.service,stock.service,item-image.reference,item-usage.hook,catalog.dto}.ts`
- Test: `api/test/catalog.e2e-spec.ts`, `api/test/stock.db-spec.ts`

**Interfaces:**
- Consumes: `AuditWriterService.appendWithin`, `FilesService.assertOwnedBy`, `FileAccessPolicy.registerReference`, `SystemConfigService.getInt('default_max_qty')`.
- Produces:
  - `GET /api/item-categories` (M) → `[{id, name, name_en, sort_order, active}]` (chỉ active với member, tất cả với admin `?all=1`); `POST|PATCH /api/admin/item-categories[/:id]` → `CATEGORY_EXISTS` (409), `VALIDATION` (400) với tên rỗng/`> 120` ký tự.
  - `GET /api/items?include_inactive_ids=a,b` (M) → `[{id, code, name, name_en, unit, pack_note, category_id, image_file_id, admin_only, max_qty, stock_qty, min_stock, active, sort_order}]` — member không thấy `admin_only`, không thấy `active=false` trừ id liệt kê; admin thấy tất cả.
  - `POST /api/admin/items` → `IMAGE_REQUIRED`, `UNIT_REQUIRED`, `VALIDATION`; `PATCH /api/admin/items/:id`; `DELETE /api/admin/items/:id` → `ITEM_IN_USE` nếu `ItemUsageHook.isUsed(id)` (Plan 1: luôn `false`; Plan 2 cài kiểm `request_lines`).
  - `POST /api/admin/items/:id/stock {delta, reason: 'purchase'|'adjust', note}` → movement; `adjust` không `note` → `REASON_REQUIRED`; `reason` khác → `VALIDATION`; `purchase` reset `low_stock_notified_at = NULL`.
  - `POST /api/admin/items/:id/issue {qty, recipient_sub?, reason}` → `UPDATE items SET stock_qty = stock_qty - $q WHERE id=$1 AND stock_qty >= $q` (0 dòng → `STOCK_INSUFFICIENT {available}`), movement `issue`; thiếu `reason` → `REASON_REQUIRED`; `recipient_sub` không `active` → `USER_INACTIVE`.
  - `GET /api/admin/items/:id/movements?limit&cursor` → `{items: [{id, delta, reason, note, actor_sub, recipient_sub, created_at}], next_cursor}`; `GET /api/admin/issues?ym=YYYY-MM`; `GET /api/me/issues` (M).
  - `GET /api/admin/stock/low` → món `stock_qty ≤ min_stock AND active`.
  - `ItemImageReference.references(fileId)` = `EXISTS items WHERE image_file_id = fileId` (mọi identity).
  - Audit: `item.created/updated/deactivated`, `category.*`, `stock.purchase/adjust/issue` (có `before/after stock_qty`).

- [ ] **Step 1: Tests** — `catalog.e2e-spec.ts`: tạo nhóm "Giấy" → 201, tạo "giấy" → 409 `CATEGORY_EXISTS`, tên `'   '` → 400, tên 300 ký tự → 400; tạo món không `image_file_id` → `IMAGE_REQUIRED`; không `unit` → `UNIT_REQUIRED`; `image_file_id` của người khác/purpose sai → `FILE_FORBIDDEN`; đủ → 201 và member `GET /files/:image` → 200; món `admin_only` không có trong `GET /items` của member, có với admin; `PATCH active=false` → member không thấy, `?include_inactive_ids=` thấy; `DELETE` → 204 (hook false). `stock.db-spec.ts`: purchase +100 → `stock_qty=100`, movement `purchase`; adjust không note → `REASON_REQUIRED`; issue 3 cho user active → tồn 97, movement có `recipient_sub`; issue 200 → `STOCK_INSUFFICIENT {available: 97}`; tồn 1 + hai issue 1 song song (`Promise.all`) → một 2xx, một `STOCK_INSUFFICIENT`, tồn 0; set `min_stock=97` → món xuất hiện ở `/admin/stock/low`; purchase sau khi `low_stock_notified_at` set → về NULL.
- [ ] **Step 2: Run** → FAIL. **Step 3:** implement, đăng ký `ItemImageReference` trong `CatalogModule.onModuleInit`. **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(catalog): nhóm, món, kho, xuất lẻ, sổ cái"`.

### Task 9: Seed danh mục ban đầu (idempotent)

**Files:**
- Create: `api/scripts/seed-catalog.mjs`, `api/seed/catalog.json` (nhóm: Giấy & sổ · Bút & viết · Kẹp & dán · Lưu trữ · Khác; ~25 món thường dùng với `code`, `name`, `name_en`, `unit`, `max_qty`, `admin_only` (Giấy A4 = true)), script `npm run seed:catalog`
- Test: `api/test/seed-catalog.db-spec.ts`

- [ ] **Step 1: Test** — chạy seed 2 lần → số `items` không đổi; món không ảnh có `image_file_id IS NULL`; `GET /admin/items` trả cờ `missing_image: true` cho chúng.
- [ ] **Step 2–4:** FAIL → implement (upsert theo `code`) → PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(catalog): seed danh mục ban đầu"`.

### Task 10: Web khung — lib, token, i18n, đăng nhập, hai shell, trang từ chối, "Tôi"

**Files:**
- Copy: `$QLTS/web/src/lib/{api-client,session-relogin,me,i18n,fetch-json}.ts` (+ test), `ui/{dialog,confirm-*,load-state,chunk-error-boundary,data-table}.tsx`, `test/*`
- Create: `web/src/css/{tokens.css (copy design-preview/final/tokens.css),base.css,member.css,admin.css}`, `web/src/locales/{vi,en}.ts`, `web/src/shell/{login-screen.tsx,forbidden-screen.tsx,member-shell.tsx,bottom-nav.tsx,admin-shell.tsx,require-role.tsx,app-routes.tsx}`, `web/src/features/profile/profile-page.tsx`, `web/src/lib/image-compress.ts`, `web/playwright/smoke.spec.ts`, `web/playwright.config.ts`
- Test: `login-screen.test.tsx`, `member-shell.test.tsx`, `admin-shell.test.tsx`, `image-compress.test.ts`

**Interfaces:**
- Consumes: `GET /api/auth/me` (Task 3) và `GET /api/public-config` (Task 5) cho trang từ chối khi chưa có phiên.
- Produces: `apiFetch<T>(path, init?)`; `useMe()`; routes: `/` (member, Plan 2 đổ nội dung; Plan 1 hiện thẻ "Sắp có"), `/history`, `/me`, `/forbidden`, `/admin/*` (RequireRole admin|sa; Plan 1: `/admin/catalog`, `/admin/categories`, `/admin/stock`, `/admin/users`, `/admin/audit`, `/admin/config`, mục khác hiện "Sắp có"); `compressImage(file: File, {maxEdge: 1600, maxBytes: 1_048_576}): Promise<{blob: Blob, mime: 'image/jpeg'|'image/png'|'image/webp'} | {error: 'UNSUPPORTED'}>` áp EXIF (dùng `createImageBitmap(file, {imageOrientation: 'from-image'})`); `t()` keys theo cấu trúc `auth.*, nav.*, catalog.*, stock.*, users.*, audit.*, config.*, common.*`.
- Copy đúng `_SPEC.md`: nút "Đăng nhập bằng tài khoản công ty (PMH ID)" → `location.href = '/api/auth/login'`; dòng "Bạn sẽ được đưa sang trang đăng nhập chung của công ty rồi quay lại đây."; liên kết "Gợi ý tài khoản (tùy chọn)" mở ô email → `login?login_hint=`; liên kết "Dành cho IT" mở form `username` (`type=text`) + `password` → `POST /api/auth/sa-login`; trang forbidden tiêu đề "Tài khoản chưa được cấp quyền dùng VPP Công trình", đoạn có `{email}` và `{admin_contact}`, nút "Đăng nhập bằng tài khoản khác" → `/api/auth/switch-account`.
- Member shell: thanh trên 64 px (desktop); ≤ 900 px ẩn tab trên, hiện `BottomNav` 3 mục *Đăng ký · Lịch sử · Tôi*. Admin shell: sidebar 224 px theo nhóm trong `_SPEC.md`, mục "Phiếu của tôi ↗" → `/`.

- [ ] **Step 1: Tests** — `login-screen.test.tsx`: render có nút chính đúng chữ, **không** có `input[type=email]` hiển thị mặc định; bấm "Dành cho IT" → có `input[name=username][type=text]`; `?login=forbidden` → render `ForbiddenScreen` gọi `/api/public-config` và hiện `admin_contact`. `member-shell.test.tsx`: viewport 390 (matchMedia mock) → có `nav[aria-label="Điều hướng chính"]` với 3 link; viewport 1280 → tab trên, không bottom nav. `admin-shell.test.tsx`: role member vào `/admin/catalog` → chuyển `/`. `image-compress.test.ts`: PNG 2400×1800 → cạnh dài 1600; fixture JPEG orientation 6 (`web/src/test/fixtures/exif6.jpg`) → kết quả `height > width`; `File` type `image/heic` → `{error:'UNSUPPORTED'}`.
- [ ] **Step 2: Run** — `npm test` → FAIL.
- [ ] **Step 3: Implement** — theo `_SPEC.md`; `i18n.ts` giữ `savedLanguage/setLanguage`; mọi chuỗi qua `t()`; `base.css` nhập font Google (Nunito, IBM Plex Sans) và áp `--font-app`/`--font-ui` theo shell.
- [ ] **Step 4: Run** — `npm test && npm run lint && npm run build` → PASS; Playwright `smoke.spec.ts` (api dev với `AUTH_DEV_MODE=true`, header dev qua `extraHTTPHeaders`): mở `/` 390 px thấy bottom nav; mở `/admin/catalog` với role admin thấy sidebar; đổi ngôn ngữ en → tiêu đề sidebar đổi; chụp `playwright-report/`.
- [ ] **Step 5: Commit** — `git commit -am "feat(web): khung app — đăng nhập, forbidden, member/admin shell, i18n, nén ảnh"`.

### Task 11: Web admin — Danh mục & Nhóm

**Files:**
- Create: `web/src/features/catalog/{catalog-page.tsx,item-form.tsx,category-page.tsx,image-field.tsx,unit-select.tsx,catalog.api.ts}`
- Test: `item-form.test.tsx`, `catalog-page.test.tsx`

**Interfaces:**
- Consumes: Task 8 endpoints; `compressImage`; `POST /api/files {purpose:'item_image'}`.
- Produces: trang `/admin/catalog` (bảng: ảnh thumbnail 40 px hoặc ô "thiếu ảnh", tên + `pack_note`, ĐVT, nhóm, tối đa/tháng, tồn, cờ Hành chính, trạng thái; lọc nhóm, tìm, "Hiện món đã ngừng"); nút "Thêm món" mở `ItemForm` (Radix Dialog): tên vi/en, ĐVT (`UnitSelect` 9 giá trị, nhãn song ngữ), quy cách, nhóm, ảnh (`ImageField`: chọn/chụp → nén → upload → preview; HEIC → thông báo "Chọn ảnh JPG, PNG hoặc WebP"), Hành chính mới được đặt, tối đa/tháng (mặc định 20), mức tối thiểu, thứ tự; sửa; "Ngừng món"/"Mở lại" qua confirm; `/admin/categories` CRUD + kéo thứ tự (nút lên/xuống, không drag).
- Lỗi server → hiển thị theo `code` (`catalog.errors.IMAGE_REQUIRED` …).

- [ ] **Step 1: Tests** — `item-form.test.tsx`: submit không ảnh → nút bị vô hiệu + chữ "Cần có ảnh"; chọn file HEIC → thông báo đúng; server trả `UNIT_REQUIRED` → thông báo gắn vào ô ĐVT. `catalog-page.test.tsx`: món `missing_image` hiện nhãn "thiếu ảnh"; lọc "đã ngừng" gọi API với `?all=1` và hiện nhãn.
- [ ] **Step 2–4:** FAIL → implement → `npm test` PASS; Playwright: tạo nhóm + món có ảnh (fixture PNG) → xuất hiện trong bảng với thumbnail (GET /files 200).
- [ ] **Step 5: Commit** — `git commit -am "feat(web): trang Danh mục và Nhóm món"`.

### Task 12: Web admin — Kho (tồn, nhập, điều chỉnh, xuất lẻ, sổ cái)

**Files:**
- Create: `web/src/features/stock/{stock-page.tsx,stock-dialogs.tsx,movements-drawer.tsx,user-picker.tsx,stock.api.ts}`
- Test: `stock-dialogs.test.tsx`

**Interfaces:**
- Consumes: `POST admin/items/:id/stock`, `POST admin/items/:id/issue`, `GET admin/items/:id/movements`, `GET admin/stock/low`, `GET admin/users?q=` (cho `UserPicker`).
- Produces: `/admin/stock`: bảng món với tồn, mức tối thiểu, nhãn đỏ "Sắp hết" khi `stock ≤ min`; bộ lọc "Sắp hết"; mỗi hàng nút "Nhập mua…" (số lượng, ghi chú), "Điều chỉnh…" (±, lý do bắt buộc), "Xuất lẻ…" (số lượng, `UserPicker` hoặc ô chọn "Dùng chung", lý do bắt buộc), "Sổ cái" mở drawer phân trang với nhãn màu theo `reason` (`issue` → "Xuất lẻ · tên người").

- [ ] **Step 1: Test** — `stock-dialogs.test.tsx`: điều chỉnh không lý do → nút vô hiệu; xuất lẻ server `STOCK_INSUFFICIENT {available: 2}` → thông báo "Chỉ còn 2"; "Dùng chung" gửi body không `recipient_sub`.
- [ ] **Step 2–4:** FAIL → implement → PASS; Playwright: nhập 10 → tồn 10; xuất lẻ 3 cho user dev → tồn 7; sổ cái hiện 2 dòng.
- [ ] **Step 5: Commit** — `git commit -am "feat(web): trang Kho — nhập, điều chỉnh, xuất lẻ, sổ cái"`.

### Task 13: Web admin — Danh bạ, Nhật ký, Cấu hình; member — Tôi

**Files:**
- Create: `web/src/features/admin/{users-page.tsx,audit-page.tsx,config-page.tsx,admin.api.ts}`, `web/src/features/profile/profile-page.tsx` (hoàn thiện)
- Test: `config-page.test.tsx`, `profile-page.test.tsx`

**Interfaces:**
- Consumes: `GET admin/users`, `POST admin/directory/sync → {created, updated}`, `GET admin/audit`, `GET|PUT admin/config`, `GET auth/me`, `POST auth/logout`.
- Produces: `/admin/users` (tìm, trạng thái, phòng ban, nhóm, lần đăng nhập cuối; nút "Đồng bộ ngay" hiện kết quả); `/admin/audit` (lọc người/hành động/khoảng ngày, phân trang cursor, xem `before/after` dạng JSON gọn); `/admin/config` (ngày hạn 3–28 với chú thích "Chỉ áp dụng cho kỳ tạo sau; kỳ đang mở giữ hạn cũ", tối đa mặc định, group admin, 3 tên người ký, liên hệ Hành chính; lưu từng nhóm, lỗi `CONFIG_INVALID {field}` gắn đúng ô); `/me` (tên, email, mã NV, phòng ban chỉ đọc; chọn ngôn ngữ; "Đăng xuất"; dòng "Dữ liệu từ PMH ID, không sửa trong app").
- Member `/me` nằm trong bottom nav "Tôi".

- [ ] **Step 1: Tests** — `config-page.test.tsx`: nhập 29 → lỗi tại ô trước khi gửi; server `CONFIG_INVALID {field:'admin_group'}` → lỗi gắn ô group. `profile-page.test.tsx`: đổi ngôn ngữ gọi `setLanguage('en')` và nhãn đổi; "Đăng xuất" gọi `POST /api/auth/logout` rồi về màn vào.
- [ ] **Step 2–4:** FAIL → implement → PASS; Playwright: lưu `admin_contact` → trang forbidden (mở `/?login=forbidden`) hiện đúng tên.
- [ ] **Step 5: Commit** — `git commit -am "feat(web): Danh bạ, Nhật ký, Cấu hình, trang Tôi"`.

### Task 14: Smoke Plan 1 toàn luồng + README + mốc

**Files:**
- Modify: `web/playwright/smoke.spec.ts`, `README.md`, `update-vpp.sh`
- Test: toàn bộ

- [ ] **Step 1: Smoke** — một spec nối tiếp trên `docker compose` dev: SA login (`LOCAL_SA_*` dev) → tạo nhóm → tạo món có ảnh → nhập 10 → xuất lẻ 3 → sổ cái 2 dòng → Cấu hình lưu tên người ký → đăng xuất → dev-identity member 390 px thấy bottom nav, vào `/me`, đổi en, ảnh món tải được (`GET /files/:id` 200); dev-identity member GET `/admin/catalog` → chuyển về `/`.
- [ ] **Step 2: Verify đầy đủ** — `cd api && npm test && npm run test:e2e && npm run test:db`; `cd web && npm test && npm run lint && npm run build`; `docker compose up -d --build` → `/api/health` 200; `npx playwright test` → PASS; `grep -ri "qlts" api web --exclude-dir=node_modules | wc -l` → 0; kiểm chuỗi cứng (E6-S4): `grep -rlP "[ăâđêôơưàảãáạ]" web/src --include=*.tsx --exclude-dir=locales --exclude-dir=test | wc -l` → 0; `git status` không có `.env`.
- [ ] **Step 3: README** — cách chạy dev (compose override, `createdb vpp_test`, `npm run sa:hash`, `AUTH_DEV_MODE`), lệnh test, cấu trúc thư mục, liên kết `docs/`.
- [ ] **Step 4: Commit** — `git commit -am "chore: smoke Plan 1, README"` — rồi dừng, báo chủ dự án để review toàn nhánh trước khi viết Plan 2.
