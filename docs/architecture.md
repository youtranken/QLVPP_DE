# Architecture — VPP Công trình

> Phiên bản 1.1 · 2026-10-28 (sau review, xem `review-spec.md`) · Đi kèm `prd.md`. Khuôn mẫu kỹ thuật: **QLTS_DE** (`youtranken/QLTS_DE`); hợp đồng tích hợp: **PMH ID** (`youtranken/PMH_IDE/docs/integration/*`).

## 1. Quyết định kiến trúc (AD)

| AD | Quyết định | Lý do |
|---|---|---|
| AD-1 | Hai gói npm riêng `api/` + `web/`, Docker Compose, không monorepo pnpm | Giống QLTS_DE; một kiểu vận hành cho cả cụm |
| AD-2 | api NestJS 12 + `pg` + drizzle-orm (schemaless), migration **SQL thuần** có checksum | Đã chạy prod ở QLTS; không ORM nặng; schema drift bị chặn lúc boot |
| AD-3 | Xác thực kiểu **BFF**: api là OIDC client, phiên server-side, cookie httpOnly; trình duyệt không cầm token | Chuẩn QLTS; an toàn với SPA |
| AD-4 | Copy-and-trim module auth/users/audit/config từ QLTS_DE; module `files` viết lại (QLTS chỉ cho admin tải đính kèm) | Code đã kiểm chứng, có test; giảm rủi ro SSO |
| AD-5 | Không Redis/BullMQ/worker ở GĐ1 | Không có job nền nặng; thông báo ghi thẳng vào bảng trong cùng transaction; email GĐ2 dùng `@nestjs/schedule` + bảng outbox |
| AD-6 | Luật nghiệp vụ ép ở server và CSDL (CHECK/UNIQUE/trigger), UI chỉ hỗ trợ | NFR toàn vẹn |
| AD-7 | SA cục bộ từ `.env` (scrypt), không có trong DB; api từ chối khởi động nếu thiếu | Break-glass độc lập SSO; DB bị xâm nhập không tạo được SA |
| AD-8 | Chỉ `web` lên mạng `edge` với alias riêng; `api`/`postgres` ở mạng riêng; api gọi PMH ID qua host-gateway | Luật vàng cụm EDGE (sự cố alias `api` 2026-08-04) |
| AD-9 | web React 19 + Vite 8, CSS token riêng, không AntD | Hệ thị giác riêng; nhẹ; nhất quán với QLTS về công cụ |
| AD-10 | In báo cáo bằng CSS `@media print`; Excel bằng exceljs | Không cần dịch vụ PDF |

## 2. Stack

| Tầng | Chọn |
|---|---|
| Runtime | Node 24 (`node:24.22.1-alpine`), `.nvmrc` = 24 |
| API | NestJS 12, `pg` 8, drizzle-orm (schemaless), class-validator, nestjs-pino, @nestjs/throttler, @nestjs/schedule, jose 6, openid-client 6, multer (upload); exceljs thêm ở Plan 3 (báo cáo) |
| Web | React 19, Vite 8, TypeScript 6, TanStack Query 5, react-router 7, react-i18next, Radix Dialog, vitest + Testing Library, oxlint, Playwright (smoke) |
| DB | PostgreSQL 18 (`postgres:18-alpine`) |
| Serve | nginx 1.30 trong container `web` (tĩnh + proxy `/api`) |
| Hạ tầng | Docker Compose; EDGE nginx chung của cụm; backup-cron (copy QLTS `ops/backup`) |

## 3. Cấu trúc repo `QLVPP_DE`

```
api/
  src/
    main.ts                 assert env fail-closed → migrate → boot (copy QLTS)
    app.module.ts  app.setup.ts  net-ipv4-first.ts
    database/{database.module.ts, migration-runner.ts}
    migrations/NNNN_*.sql   0001–0099 nền (copy QLTS, đổi tên cookie/prefix), 0100+ VPP
    common/                 global-exception.filter, user-throttler.guard, sql.ts, period.ts (luật kỳ), clock.service.ts
    modules/
      auth/                 copy QLTS: identity/csrf/roles guard, session, session-auth, local-sa, oidc, bcl, webhook
      users/                copy QLTS: directory client/sync, authorized-groups, users.service
      audit/  config/  files/  notifications/
      catalog/              items, item_categories, stock
      requests/             periods, requests, request_lines, review (món ngoài DM), copy-previous
      delivery/             deliver, deliver-all, backlog (còn nợ)
      reports/              tổng hợp, export.xlsx
  test/                     *.e2e-spec.ts, *.db-spec.ts, test-app.helper.ts
  scripts/sa-hash.mjs
web/
  src/
    main.tsx  App.tsx
    lib/        api-client, session-relogin, me, i18n, period (hiển thị kỳ), format
    locales/    vi.ts  en.ts
    shell/      login-screen, member-shell (top nav), admin-shell (sidebar), notification-bell
    ui/         button, dialog, drawer, stepper, kpi-strip, data-table, load-state, confirm
    features/
      request/      member: trang đăng ký, lịch sử
      summary/      admin: tổng hợp kỳ, drawer điều chỉnh
      review/       admin: món ngoài danh mục
      delivery/     admin: giao hàng, còn nợ
      stock/  catalog/  reports/  admin/ (danh bạ, nhật ký, cấu hình)
    css/        tokens.css (từ design-preview/final), member.css, admin.css, print.css
  nginx.conf  proxy-api-headers.conf  Dockerfile  playwright/
ops/backup/   docker-compose.yml  .env.example  update-vpp.sh  docs/  design-preview/
```

## 4. Xác thực và phân quyền

Toàn bộ theo QLTS_DE `api/src/modules/auth` (đổi tên cookie `vpp_sid`, `vpp_oidc_tx`), với các điểm khác biệt ghi rõ dưới đây.

**Đăng nhập SSO** — `GET /api/auth/login` sinh `state` + PKCE verifier (cookie tx 10′, Lax, path `/api/auth`), redirect sang PMH ID; `GET /api/auth/callback`: nếu `?error=access_denied` → `/?login=forbidden`; đổi code lấy token (`ClientSecretBasic`), **verify access token offline** bằng JWKS (cache ≤ 10′); gate group `intersectsCI(claims.groups, config.authorized_groups)` với self-heal fetch `/api/v1/groups` (TTL 30 s); `users.upsertFromClaims` (cập nhật `groups`, `department`); tạo phiên `{refresh_token, access_token_exp, claims, csrf_token, id_token}`; cookie `vpp_sid` httpOnly/Secure/SameSite=Strict/30 ngày.

**Phân giải phiên mỗi request** — `IdentityGuard`: token còn hạn → dùng claims trong phiên; hết hạn → refresh **single-flight**; `invalid_grant` → hủy phiên (401); PMH ID không trả lời → 503 `SSO_UNAVAILABLE` giữ phiên; riêng route `@Public` (sa-login, public-config, health…) thì đi tiếp ẩn danh để SA break-glass vẫn vào được. Guard toàn cục theo thứ tự: `IpThrottlerGuard → IdentityGuard → CsrfGuard (X-CSRF-Token cho POST/PUT/PATCH/DELETE) → RolesGuard (@Roles) → UserThrottlerGuard`.

**Vai trò (khác QLTS)** — tính **mỗi request** trong `toIdentity`: `sa` nếu phiên SA cục bộ; `admin` nếu `users.groups` (đã đọc từ DB trong cùng lượt) giao với `config.admin_group` (không phân biệt hoa thường); còn lại `member`. Callback, webhook `user.groups_changed` và directory sync chỉ cập nhật `users.groups`; cột `users.role` không dùng cho quyền và không còn được cập nhật (chỉ giá trị mặc định lúc tạo); sẽ bỏ ở migration sau. Hệ quả: gỡ group → request kế tiếp 403, không cần đợi refresh.

**SA cục bộ** — `POST /api/auth/sa-login`; env `LOCAL_SA_USERNAME`, `LOCAL_SA_PASSWORD_HASH` = `scrypt.<salt>.<hash>` (sinh bằng `npm run sa:hash`); sub cố định `local:sa`; **khóa theo cặp (IP, username)** 5 sai/15′ + bộ đếm toàn cục 50 sai/15′ (chống dò và không bị khóa toàn cục vì một IP); idle 2 h; không hiện trong danh bạ/picker. `req.ip` đúng nhờ `TRUST_PROXY_HOPS` (xem §13).

**Đăng xuất** — `POST /api/auth/logout` hủy phiên local, **không** gọi end_session. `GET /api/auth/switch-account` (dùng ở trang forbidden) gọi end_session kèm `id_token_hint`, `post_logout_redirect_uri = APP_BASE_URL`.

**Thu hồi từ PMH ID** — `POST /api/backchannel-logout` (verify `logout_token` qua JWKS, claim `events`, không `nonce`). `POST /api/webhooks/pmh-id`: **chữ ký v2** — `X-PMH-Signature-V2 = hex(HMAC-SHA256(secret, "${X-PMH-Timestamp}.${rawBody}"))`, từ chối khi thiếu header, `|now − ts| > WEBHOOK_TS_SKEW_SEC` (300) hoặc so sánh không timing-safe khớp; **không** nhận v1 (`x-pmh-signature`). Khớp hợp đồng `PMH_IDE/docs/integration/README.md` §6 (`X-PMH-Timestamp` là unix **giây**, payload có `type`, `user_id`, `event_id`); tài liệu PMH ID không có vector mẫu nên test dùng vector tự tính (`webhook-signature.spec.ts`). Idempotent theo `event_id` trong bảng `processed_webhook_events`; `user.locked/deleted/password_changed` → hủy mọi phiên của `sub`, cập nhật `users.status`; `user.groups_changed` → cập nhật `users.groups`.

**Danh bạ** — `DirectoryClient` (client_credentials, `GET /api/v1/users?include_deleted=true`, `/api/v1/groups`), `DirectorySyncService` upsert theo `sub` trong một transaction, scheduler 60′ + nút Đồng bộ ngay.

## 5. Cơ sở dữ liệu

Nền (copy QLTS, tên giữ nguyên): `users(sub PK, email, employee_code, full_name, department, groups jsonb, status, role, first_login_at, last_login_at, …)` `sessions`, `audit_log` (append-only bằng trigger, chặn TRUNCATE), `config(key, value jsonb)`, `processed_webhook_events`, `in_app_notifications` (có `event_id`, `UNIQUE (event_id, user_sub)`), `_migrations`. Bảng `files` **viết mới**: `files(id uuid PK, original_name, mime, size_bytes, purpose text CHECK (purpose IN ('item_image','line_image')), uploaded_by_sub, created_at)`; đường dẫn vật lý = `/data/files/<id>.<ext>` suy từ `mime`, không lưu cột `path`.

Riêng VPP: `0100_vpp_catalog.sql` (nhóm, món, kho), `0101_items_restock_level.sql` (mốc sắp hết), `0102_vpp_requests.sql` (kỳ, phiếu, dòng), `0103_vpp_reports.sql` (bản chốt). PG18 có sẵn `gen_random_uuid()`; không cần `pgcrypto`/`btree_gist`.

```sql
item_categories (id uuid PK, name text NOT NULL, name_en text, sort_order int NOT NULL DEFAULT 0,
                 active bool NOT NULL DEFAULT true, created_at, updated_at)
CREATE UNIQUE INDEX item_categories_name_uq ON item_categories (lower(name));

items (id uuid PK, code text UNIQUE, name text NOT NULL, name_en text,
       unit text NOT NULL CHECK (unit IN ('cai','hop','cay','ram','cuon','loc','bich','chai','bo')),
       pack_note text,                                    -- quy cách: "hộp 12 cây"
       category_id uuid REFERENCES item_categories, image_file_id uuid REFERENCES files,
       admin_only bool NOT NULL DEFAULT false, max_qty int NOT NULL DEFAULT 20 CHECK (max_qty > 0),
       stock_qty int NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
       restock_level int CHECK (restock_level IS NULL OR restock_level > 0), -- tồn ngay sau lần nhập mua gần nhất, hoặc sau lần adjust dương đầu tiên khi còn NULL (tồn đầu kỳ); mốc sắp hết = floor(restock_level * 0.2)
       min_stock int NOT NULL DEFAULT 0,                 -- không dùng nữa (thay bằng restock_level), bỏ ở migration sau
       low_stock_notified_at timestamptz,                 -- reset khi nhập mua
       active bool NOT NULL DEFAULT true, sort_order int NOT NULL DEFAULT 0, created_at, updated_at)

periods (ym date PK,                                      -- ngày 1 của tháng
         deadline timestamptz NOT NULL,                   -- chụp từ config lúc tạo kỳ (BR-2)
         headcount int,                                   -- số user active thuộc group lúc khóa (KPI y)
         created_at)

requests (id uuid PK, period_ym date NOT NULL REFERENCES periods, user_sub text NOT NULL REFERENCES users,
          department text, note text, created_by_sub text NOT NULL, created_at, updated_at,
          UNIQUE (period_ym, user_sub))

request_lines (id uuid PK, request_id uuid NOT NULL REFERENCES requests ON DELETE CASCADE,
          item_id uuid REFERENCES items,                  -- NULL = món ngoài danh mục
          custom_name text, custom_unit text, custom_note text, image_file_id uuid REFERENCES files,  -- bắt buộc với dòng ngoài DM
          qty int NOT NULL CHECK (qty > 0),
          delivered_qty int NOT NULL DEFAULT 0 CHECK (delivered_qty >= 0 AND delivered_qty <= qty),
          cancelled_qty int NOT NULL DEFAULT 0 CHECK (cancelled_qty >= 0 AND delivered_qty + cancelled_qty <= qty),
          cancel_note text, last_delivered_at timestamptz, admin_note text,
          added_by_admin bool NOT NULL DEFAULT false,     -- dòng Hành chính thêm → member chỉ đọc
          review_status text NOT NULL DEFAULT 'n/a'
            CHECK (review_status IN ('n/a','pending','accepted','converted','rejected')),
          review_note text, reviewed_by_sub text, reviewed_at timestamptz,
          delivery_id uuid,                               -- GĐ2: phiếu giao nhận
          created_at, updated_at,
          CHECK ((item_id IS NOT NULL AND custom_name IS NULL AND review_status IN ('n/a','converted'))
              OR (item_id IS NULL AND custom_name IS NOT NULL AND custom_unit IS NOT NULL
                  AND image_file_id IS NOT NULL AND review_status IN ('pending','accepted','rejected'))))
CREATE UNIQUE INDEX request_lines_item_uq ON request_lines (request_id, item_id)
  WHERE item_id IS NOT NULL AND review_status = 'n/a';    -- dòng converted giữ nguyên bản ghi, không gộp
-- "dòng còn hiệu lực" = review_status IN ('n/a','accepted','converted'); "còn nợ" = hiệu lực AND delivered_qty + cancelled_qty < qty

stock_movements (id uuid PK, item_id uuid NOT NULL REFERENCES items, delta int NOT NULL CHECK (delta <> 0),
          reason text NOT NULL CHECK (reason IN ('purchase','delivery','issue','return','adjust')),
          ref_line_id uuid REFERENCES request_lines ON DELETE RESTRICT,
          recipient_sub text REFERENCES users,              -- issue: người nhận; NULL = dùng chung
          ref_movement_id uuid REFERENCES stock_movements,  -- return trỏ về đợt giao bị hoàn tác
          note text, actor_sub text NOT NULL, created_at,
          CHECK ((reason = 'purchase' AND delta > 0) OR (reason = 'delivery' AND delta < 0)
              OR (reason = 'issue' AND delta < 0 AND note IS NOT NULL)
              OR (reason = 'return' AND delta > 0 AND ref_movement_id IS NOT NULL)
              OR (reason = 'adjust' AND note IS NOT NULL)))

report_snapshots (id uuid PK, period_ym date NOT NULL REFERENCES periods, kind text CHECK (kind IN ('xlsx','print')),
          data jsonb NOT NULL, created_by_sub text NOT NULL, created_at)   -- bản chốt (FR-62)

deliveries (id uuid PK, period_ym date, department text, delivered_by_sub text, received_by_name text,
          note text, created_at)                          -- chỗ để sẵn cho phiếu giao nhận (GĐ2)
```

Seed `config`: `registration_last_day=10`, `default_max_qty=20`, `admin_group="vpp-admin"`, `authorized_groups=[]`, `low_stock_notify=true`, `signers={preparer:"",head:"",approver:""}`, `admin_contact=""`. Ràng buộc khi `PUT admin/config`: `registration_last_day ∈ [3,28]`, `default_max_qty ∈ [1,999]`, `admin_group` không rỗng → sai → `CONFIG_INVALID`.

Chỉ mục: `request_lines(request_id)`, `request_lines(item_id)`, partial `request_lines(item_id) WHERE review_status IN ('n/a','accepted','converted') AND delivered_qty + cancelled_qty < qty` (còn nợ), `requests(period_ym)`, `stock_movements(item_id, created_at)`, `in_app_notifications(user_sub, read_at)`, `files(created_at)` (dọn mồ côi).

## 6. Luật kỳ, ghi phiếu và đồng thời

**Đồng hồ** — `ClockService.now()` inject được ở mọi nơi cần thời gian nghiệp vụ; env `CLOCK_OFFSET_MS` chỉ được đọc khi `NODE_ENV=test` (ngoài test mà có biến này → app từ chối khởi động). Không dùng `now()` của DB cho luật kỳ; các câu lệnh nhận `$now` làm tham số.

**`common/period.ts`** (thuần, có unit test): `periodFor(now, lastDay)` → ngày 1 tháng này nếu `day ≤ lastDay` (giờ VN), ngược lại tháng sau; `deadlineOf(ym, lastDay)` → `00:00 ngày lastDay+1` giờ VN; `daysLeft(now, deadline)` = số ngày lịch VN từ hôm nay đến ngày hạn, tính cả hôm nay (ngày hạn → 1).

**Tạo kỳ** — khi lần đầu có thao tác chạm kỳ `ym`: `INSERT INTO periods(ym, deadline) VALUES ($ym, deadlineOf(ym, config.registration_last_day)) ON CONFLICT DO NOTHING`. `isOpen(ym) = now < periods.deadline`. Đổi config về sau không đổi `deadline` kỳ đã có (BR-2). **Kỳ đang mở** (`PeriodsService.openPeriod`) = kỳ có `deadline > now` với `ym` nhỏ nhất trong bảng; không có kỳ nào → `ensurePeriod(periodFor(now, lastDay))` (nếu kỳ đó đã có và đã qua hạn thì tiến sang tháng sau). Nhờ vậy đổi `registration_last_day` giữa kỳ không làm kỳ đang mở mất hiệu lực. Tiền điều kiện: chỉ tạo kỳ mà `openPeriod` trả về (hoặc kỳ quá khứ cho dữ liệu cũ) — không tạo trước kỳ tương lai, vì kỳ tương lai có sẵn sẽ chiếm chỗ "kỳ đang mở" theo luật trên. Một request đọc `now` một lần rồi truyền xuống `openPeriod(tx?, now?)` / `isOpen(ym, tx?, now?)`. `GET periods/current` trả kỳ này, `days_left = daysLeft(now, deadline)`, `previous` = tháng liền trước nếu người gọi có phiếu kỳ đó, `delivering` = phiếu còn dòng hiệu lực chưa giao/hủy đủ (`review_status IN ('n/a','accepted','converted') AND delivered_qty + cancelled_qty < qty`). Khi cron ngày khóa chạy: `UPDATE periods SET headcount = (số user active ∩ authorized_groups) WHERE ym = $ym AND headcount IS NULL`.

**`PUT me/request/lines`** (và `PUT admin/requests/:id/lines`) — body member `{ym, lines: [{id?, item_id?, custom_name?, custom_unit?, custom_note?, image_file_id?, qty}], expected_updated_at?}`; Hành chính `{lines, expected_updated_at (bắt buộc), reason?}` (member không gửi được `reason`, nhật ký chỉ ghi `reason` của Hành chính). Một transaction:
1. Phiếu: `INSERT INTO requests(period_ym, user_sub, department, created_by_sub) … ON CONFLICT (period_ym, user_sub) DO UPDATE SET updated_at = requests.updated_at RETURNING id` rồi `SELECT … FOR UPDATE` (hai tab lưu song song lần đầu không 500).
2. Kiểm: member → `isOpen` (`ym` sai dạng hoặc sau kỳ mở → `INVALID_PERIOD`; kỳ trước → `PERIOD_LOCKED {next_ym}`), phiếu là của mình; admin → kỳ chưa có dòng `periods` → `INVALID_PERIOD`; kỳ khóa: chưa có phiếu → `PERIOD_LOCKED` (BR-7, không tạo phiếu mới), có phiếu thì `reason` trim ≥ 3 ký tự bắt buộc (`REASON_REQUIRED`). Phiếu đã có mà `expected_updated_at` thiếu hoặc lệch → `STALE_UPDATE`.
3. **Diff theo `line.id`**, không DELETE+INSERT: dòng có `id` → UPDATE `qty`/ghi chú; dòng không `id` → INSERT; dòng hiện có mà không nằm trong body → DELETE **chỉ khi** `delivered_qty = 0 AND review_status IN ('n/a','pending')` và (member) `added_by_admin = false`; dòng khác giữ nguyên. Member: dòng `added_by_admin`/`converted`/đã giao của phiếu không được gửi lên thay đổi (bỏ qua nếu trùng nội dung, `LINE_READONLY` nếu khác). `qty < delivered_qty + cancelled_qty` → `QTY_BELOW_DELIVERED {delivered}`. `qty ≤ 0` hoặc không nguyên → `QTY_INVALID`. Body rỗng: chưa có phiếu → `LINES_EMPTY`; phiếu đã có → xóa các dòng xóa được, dòng không xóa được giữ nguyên, phiếu bị xóa nếu không còn dòng nào.
4. Kiểm từng dòng: `item.active` (`ITEM_INACTIVE`), member với `admin_only` (`ADMIN_ONLY_ITEM`), `qty ≤ max_qty` / `default_max_qty` (`QTY_EXCEEDS_MAX`) — dòng đã có mà qty không tăng (`after.qty ≤ before.qty`) thì bỏ kiểm max ở cả hai mode, mode admin còn bỏ kiểm active/`admin_only`; member với dòng món ngừng/`admin_only` chỉ được giữ nguyên hoặc bỏ dòng —, dòng ngoài DM thiếu ảnh → `IMAGE_REQUIRED`, `image_file_id` phải `purpose='line_image'` và (`uploaded_by_sub = actor` **hoặc** đã gắn vào một dòng thuộc phiếu của chủ phiếu — vd. ảnh Hành chính thay rồi member chép lại) (`FILE_FORBIDDEN`). Lỗi trả kèm `line_index`/`line_id`.
5. `UPDATE requests SET updated_at = $now, department = users.department` (BR-11); audit một bản ghi `request.created|updated|deleted {ym, owner_sub, added[], removed[], changed[{id, before, after}], reason?, self}` (`self` = Hành chính sửa phiếu của chính mình).

**Giao hàng** — `POST admin/lines/:id/deliver {qty, expected_delivered_qty}`: tx `SELECT request FOR UPDATE` → `UPDATE request_lines SET delivered_qty = delivered_qty + $q, last_delivered_at = $now WHERE id = $1 AND delivered_qty = $expected AND review_status IN ('n/a','accepted','converted')` (0 dòng → `STALE_UPDATE` hoặc `LINE_NOT_REVIEWED`/`LINE_REJECTED` tùy trạng thái); CHECK chặn vượt → `DELIVER_EXCEEDS_QTY`; nếu dòng có `item_id`: `UPDATE items SET stock_qty = stock_qty - $q WHERE id = $id AND stock_qty >= $q` (0 dòng → `STOCK_INSUFFICIENT {available}`) + `INSERT stock_movements(-q,'delivery',line)`; nếu phiếu đủ → thông báo `event_id = 'request_delivered:' + request_id + ':' + n` (n = số lần đủ, đếm từ audit) `ON CONFLICT DO NOTHING`. `deliver-all`: một tx, `FOR UPDATE` phiếu, lặp dòng theo `id` tăng dần với `SAVEPOINT` mỗi dòng; dòng lỗi rollback tới savepoint và vào `failed[]`, dòng khác vẫn giao. Thứ tự khóa cố định requests → request_lines → items theo id để tránh deadlock.

**Hoàn tác đợt giao** — `POST admin/movements/:id/undo {qty, reason}` (movement `delivery`): `qty ≤ |delta| − đã hoàn`; `UPDATE request_lines SET delivered_qty = delivered_qty - $qty`; `UPDATE items SET stock_qty = stock_qty + $qty`; `INSERT stock_movements(+qty,'return', ref_line, ref_movement, note=reason)`; audit.

**Xuất lẻ** — `POST admin/items/:id/issue {qty, recipient_sub?, reason}`: `UPDATE items SET stock_qty = stock_qty - $q WHERE id = $id AND stock_qty >= $q` (0 dòng → `STOCK_INSUFFICIENT`) + `INSERT stock_movements(-q,'issue', recipient_sub, note=reason)`; `recipient_sub` phải là user `active` (`USER_INACTIVE`); audit. `GET me/issues` cho người nhận xem trong Lịch sử.

**Hủy nợ** — `POST admin/lines/:id/cancel-remaining {reason}`: `cancelled_qty = qty − delivered_qty`, `cancel_note`; audit; dòng rời Còn nợ.

**Review món ngoài danh mục** — `POST admin/lines/:id/review`: một tx, khóa `requests` rồi dòng (cùng thứ tự writer); không có dòng → 404 `LINE_NOT_FOUND`; khác `pending` → 409 `LINE_ALREADY_REVIEWED`; ghi bằng `UPDATE … WHERE id = $1 AND review_status = 'pending'`. `accept` → `accepted` (`note` tùy chọn lưu `review_note`). `reject` cần `note` trim ≥ 3 (`REASON_REQUIRED`), lưu `review_note` (không đụng `reason` điều chỉnh). `convert` với `{existing_id}`: món phải có (`ITEM_NOT_FOUND`) và active (`ITEM_INACTIVE`); với món mới: `CatalogService.createItemWithin` trong cùng tx (`unit` bắt buộc → `UNIT_REQUIRED`, `category_id` bắt buộc; ảnh = `item.image_file_id` phải do admin tải purpose `item_image`, hoặc mặc định ảnh dòng — dùng thẳng, không kiểm chủ; tồn 0, không ghi biến động; thua đua → món rollback). Dòng thành `item_id = món, review_status = 'converted'`, `custom_name/custom_unit/custom_note = NULL` (CHECK), giữ `image_file_id`, `review_note` = `note` hoặc `"Từ: <custom_name>"` — **không gộp** với dòng cùng món. Mỗi nhánh đổi `requests.updated_at` (tab cũ → `STALE_UPDATE`), audit `line.review {action, before, after, item_id?}`, trả `{line, request_updated_at, item?, unit_mismatch?}` (`item` cùng hình `{id, name, name_en, unit, pack_note, image_file_id, active, admin_only, max_qty}` cho cả món có sẵn lẫn món mới; `unit_mismatch` = ĐVT món ≠ `custom_unit` gốc). `item` gửi cả `existing_id` lẫn trường món mới → 400 `VALIDATION {fields}`. Ghi chú: convert sang món `admin_only` được phép (Hành chính quyết); `IMAGE_REQUIRED` không xảy ra khi convert vì dòng ngoài DM luôn có ảnh (CHECK) và đó là ảnh mặc định; review được cả dòng thuộc kỳ đã khóa; convert không kiểm `qty` của dòng với `max_qty` món đích; `GET admin/review` chưa phân trang. Thông báo chủ phiếu `event_id = 'line_review:' + line_id` thêm ở Plan 3. `GET admin/review?status&ym` (mặc định `pending`): `previously_accepted` = cùng người có dòng `accepted` cùng `lower(trim(custom_name))` ở kỳ bất kỳ trước kỳ của dòng.

**Copy-previous** — `POST me/request/copy-previous` trả **giỏ đề xuất** (không ghi phiếu/dòng/nhật ký; có thể tạo dòng `periods` qua `openPeriod`): từ kỳ gần nhất có phiếu; bỏ món `active=false`, món `admin_only`, dòng `added_by_admin`, dòng `rejected`; dòng `accepted`/`pending` chép thành dòng ngoài danh mục mới (`image_file_id` giữ — kể cả ảnh Hành chính đã thay, vì ảnh đã nằm trên dòng của chủ phiếu nên luật ảnh ở bước 4 cho phép); dòng `converted` chép thành dòng món; `qty = min(qty, max_qty)` (ngoài DM: `default_max_qty`); cùng món nhiều dòng (n/a + converted) gộp một dòng; trả `{from_ym, lines, skipped: [{name, reason: INACTIVE\|ADMIN_ONLY\|ADDED_BY_ADMIN\|REJECTED}], capped: [{name, from, to}], previously_accepted: [custom_name]}`; không có phiếu kỳ trước → 404 `REQUEST_NOT_FOUND`.

## 7. API (prefix `/api`; mọi mutate cần `X-CSRF-Token`; lỗi `{code, message, line_id?, …}`)

Vai: **M** member (mọi người đăng nhập, kể cả admin/sa) · **A** admin + sa. Danh sách dài nhận `?limit=&cursor=` (mặc định 50, tối đa 200) và trả `{items, next_cursor}`.

| Nhóm | Vai | Endpoint |
|---|---|---|
| Auth | — | `GET public-config` → `{admin_contact}` (không cần phiên) · `GET auth/login` · `GET auth/callback` · `POST auth/sa-login` · `GET auth/me` · `POST auth/logout` · `GET auth/switch-account` · `POST backchannel-logout` · `POST webhooks/pmh-id` · `GET health` |
| Kỳ | M | `GET periods/current` → `{ym, deadline, is_open: true, days_left, previous: {ym, delivering: bool} \| null}` |
| Phiếu của tôi | M | `GET me/request?ym` (404 `REQUEST_NOT_FOUND` nếu chưa có) · `PUT me/request/lines` · `POST me/request/copy-previous` · `GET me/requests` (lịch sử, phân trang) · `GET me/issues` (nhận lẻ) |
| Danh mục | M | `GET items?include_inactive_ids=` (món active, không `admin_only` với member; ids thêm vào để hiển thị dòng cũ) · `GET item-categories` |
| Tệp | M | `POST files {purpose}` (multipart, ≤ 5 MB, 20/phút) · `GET files/:id` (luật §8) |
| Thông báo | M | `GET me/notifications?unread=` · `POST me/notifications/read {ids?: uuid[]}` (rỗng = tất cả) |
| Tổng hợp | A | `GET admin/periods/:ym/summary` (KPI: `registered` đếm mọi phiếu của kỳ kể cả người đã nghỉ — FR-34; `headcount` = `periods.headcount` nếu đã chụp, ngược lại đếm sống (`headcount_source`); `unregistered` = số người của tập sống hiện tại chưa có phiếu, đúng bằng độ dài danh sách bên dưới — nên `headcount − registered` có thể khác `unregistered`) · `GET admin/periods/:ym/requests?by=person\|item&q=&filter=` · `GET admin/periods/:ym/unregistered` (danh sách chưa đăng ký, luôn theo tập sống hiện tại: `active`, khác SA cục bộ, giao `authorized_groups` nếu không rỗng) · `GET admin/requests/:id` · `PUT admin/requests/:id/lines` → `{request: RequestView \| null}` (404 `REQUEST_NOT_FOUND`) · `POST admin/requests {user_sub, lines (≥ 1)}` → 201 `{request}` (tạo hộ, luôn vào kỳ đang mở; `USER_NOT_FOUND` 404, `USER_INACTIVE` 400, `REQUEST_EXISTS` 409 kèm `request_id` của phiếu đã có (cả khi thua đua), `LINES_EMPTY`; dòng theo luật member — `ADMIN_ONLY_ITEM`, `added_by_admin = false`; ảnh dòng phải do Hành chính tải hoặc đã có trên dòng của người đó (`FILE_FORBIDDEN`); SA cục bộ → `USER_NOT_FOUND`; tạo song song → lần sau `REQUEST_EXISTS`; `created_by_sub` = Hành chính) |
| Món ngoài DM | A | `GET admin/review?status=pending` · `POST admin/lines/:id/review {action: accept\|convert\|reject, note?, item?: {existing_id} \| {name, name_en?, unit, pack_note?, category_id, image_file_id?, max_qty?, admin_only?}}` → 200 `{line, request_updated_at, item?: {id, name, name_en, unit, pack_note, image_file_id, active, admin_only, max_qty}, unit_mismatch?}` (404 `LINE_NOT_FOUND`, 409 `LINE_ALREADY_REVIEWED`) |
| Giao | A | `POST admin/lines/:id/deliver {qty, expected_delivered_qty}` · `POST admin/requests/:id/deliver-all` → `{delivered[], failed[{line_id, code}]}` · `POST admin/movements/:id/undo {qty, reason}` · `POST admin/lines/:id/cancel-remaining {reason}` · `GET admin/backlog?by=item\|person` · `GET admin/lines/:id/deliveries` |
| Kho / DM | A | `GET\|POST\|PATCH admin/items` · `DELETE admin/items/:id` (chỉ khi chưa từng có trong phiếu, khác → `ITEM_IN_USE`) · `POST admin/items/:id/stock {delta, reason: purchase\|adjust, note}` · `POST admin/items/:id/issue {qty, recipient_sub?, reason}` · `GET admin/items/:id/movements` · `GET admin/issues?ym=` · `GET admin/stock/low` · `POST\|PATCH admin/item-categories` (`GET item-categories?all=1` cho admin xem cả nhóm đã tắt) |
| Báo cáo | A | `GET admin/reports/:ym` (sống) · `POST admin/reports/:ym/snapshots {kind}` → bản chốt · `GET admin/reports/:ym/snapshots` · `GET admin/reports/snapshots/:id/export.xlsx?lang=vi\|en` · `GET admin/reports/snapshots/:id` (dữ liệu cho trang in) |
| Quản trị | A | `POST admin/directory/sync` · `GET admin/users` · `GET admin/audit?actor=&action=&from=&to=&self=true\|false` (`self=false` gồm dòng không có cờ) · `GET\|PUT admin/config` |

`ym` phải là `YYYY-MM` hợp lệ (năm ≥ 2000), không lớn hơn kỳ đang mở → `INVALID_PERIOD`.

Mã lỗi nghiệp vụ: `PERIOD_LOCKED`, `INVALID_PERIOD`, `REQUEST_EXISTS` (409, kèm `request_id`), `REQUEST_NOT_FOUND`, `LINES_EMPTY`, `LINE_READONLY`, `QTY_INVALID`, `QTY_EXCEEDS_MAX`, `QTY_BELOW_DELIVERED`, `ADMIN_ONLY_ITEM`, `ITEM_INACTIVE`, `ITEM_IN_USE`, `STOCK_INSUFFICIENT`, `DELIVER_EXCEEDS_QTY`, `LINE_NOT_REVIEWED`, `LINE_REJECTED`, `LINE_ALREADY_REVIEWED`, `REASON_REQUIRED`, `IMAGE_REQUIRED`, `UNIT_REQUIRED`, `FILE_TOO_LARGE`, `FILE_TYPE_INVALID`, `FILE_FORBIDDEN`, `FILE_NOT_FOUND` (404, tệp không có hoặc không được xem), `PURPOSE_INVALID`, `USER_INACTIVE`, `USER_NOT_FOUND` (404; cả SA cục bộ `local:sa` khi tự lưu phiếu qua `me/request` hoặc được chọn tạo hộ — SA không thuộc danh bạ, không có phiếu), `CONFIG_INVALID`, `STALE_UPDATE`, `VALIDATION` (400, body sai DTO — kèm `fields`), `CATEGORY_EXISTS` (409, tên nhóm trùng không phân biệt hoa thường), `CATEGORY_NOT_FOUND`, `ITEM_NOT_FOUND`, `ITEM_CODE_EXISTS` (409, `items.code` trùng), `LINE_NOT_FOUND` (400, `id` dòng gửi lên không thuộc phiếu — kèm `line_index`; 404 ở `admin/lines/:id/review` khi dòng không có), `DUPLICATE_ITEM` (400, cùng `item_id` hai lần trong phiếu — kèm `line_index`).

## 8. Tệp ảnh

Module `files` **viết mới** (mượn kiểm magic bytes và hash tên từ QLTS; không dùng controller `admin/files` của QLTS vì nó chỉ cho admin, trả `attachment` và audit mỗi lần tải). Upload: multer memory → magic bytes jpeg/png/webp (`FILE_TYPE_INVALID`) → ≤ 5 MB (`FILE_TOO_LARGE`) → ghi `/data/files/<uuid>.<ext>` → bản ghi `files(purpose, uploaded_by_sub)`. FE nén ảnh trước khi tải (≤ 1600 px cạnh dài, ≤ 1 MB, áp EXIF orientation bằng canvas) nên ảnh điện thoại hiếm khi chạm 5 MB.

**Luật đọc `GET /files/:id`** (sau IdentityGuard, một truy vấn): cho phép nếu `role ∈ {admin, sa}` **hoặc** `files.uploaded_by_sub = me` **hoặc** `EXISTS (items WHERE image_file_id = :id)` **hoặc** `EXISTS (request_lines l JOIN requests r WHERE l.image_file_id = :id AND r.user_sub = me)`; khác → 404 (không lộ tồn tại). Trả `Content-Type` = mime đã kiểm, `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=86400`; **không** ghi audit cho GET.

**Dọn mồ côi** — cron hằng ngày 03:00: xóa bản ghi + tệp có `created_at < now − 24 h` và không được tham chiếu bởi `items.image_file_id` hay `request_lines.image_file_id`. Bảng tham chiếu do module sở hữu đăng ký qua `FileAccessPolicy.registerReference({name, purpose, readCondition, referencedCondition})`; cron chỉ dọn tệp có `purpose` đã có ít nhất một reference đăng ký (fail-closed: purpose chưa đăng ký thì giữ nguyên).

## 9. Thông báo

Bảng `in_app_notifications(id, user_sub, event_id, topic, params jsonb, link, created_at, read_at)`, `UNIQUE (event_id, user_sub)`; FE dịch theo i18n. Ghi trong cùng transaction với sự kiện nhưng bọc `SAVEPOINT` và nuốt lỗi có log (thông báo không được làm hỏng nghiệp vụ).

Công thức `event_id`: `period_open:<ym>` · `reminder:<ym>` · `period_locked:<ym>` (admin) · `request_delivered:<request_id>:<n>` · `line_review:<line_id>` · `custom_line_new:<line_id>` (admin) · `low_stock:<item_id>:<last_purchase_movement_id|0>`.

Lịch (`@nestjs/schedule`, `timeZone: 'Asia/Ho_Chi_Minh'` tường minh) chạy **mỗi giờ** với logic "bảo đảm đã gửi cho hôm nay" (idempotent nhờ `event_id`, nên api khởi động lại hay trượt giờ không mất thông báo): ngày 1 → `period_open` cho mọi user `active`; ngày `lastDay − 2` → `reminder` cho user `active` chưa có phiếu; ngày `lastDay + 1` → `period_locked` cho admin (user có group admin) + ghi `periods.headcount`; mỗi giờ → `low_stock` cho admin với món `restock_level > 0 AND stock_qty > 0 AND stock_qty <= floor(restock_level * 0.2) AND low_stock_notified_at IS NULL`, rồi set `low_stock_notified_at` (reset về NULL khi có movement `purchase`). Cron ngày: xóa thông báo `created_at < now − 90 ngày`; dọn tệp mồ côi (§8). "Admin" = user `active` có group ∩ `config.admin_group` (SA không nhận chuông).

GĐ2: bảng `email_outbox` + worker trong cùng process.

## 10. Báo cáo

`ReportsService.build(ym, now)` trả `{byItem: [{item, unit, pack_note, requested, backlog_prev, stock, need}], custom: [{name, unit, requested, people}], byDepartment: [{department, people: [{user, lines}]}], issues: [{item, recipient, qty, reason, at}], pending_custom_count}` với:
- dòng hiệu lực = `review_status IN ('n/a','accepted','converted')`; `remaining = qty − delivered_qty − cancelled_qty`;
- `requested` = Σ `remaining` của dòng thuộc kỳ `ym`; `backlog_prev` = Σ `remaining` của dòng thuộc kỳ `< ym`; `need = max(0, requested + backlog_prev − stock)` (BR-15); nhóm "Ngoài danh mục" (`accepted`) `stock = null`, `need = requested`;
- phần chi tiết liệt kê `qty` (số đăng ký sau điều chỉnh) theo `requests.department` → người → món.

Bấm Xuất/In: `POST admin/reports/:ym/snapshots {kind, order_qty: {item_id: n}}` lưu `data` (kết quả `build` + cột `order_qty` do admin sửa, mặc định `need` + `config.signers` + `created_by`) → FE tải `export.xlsx` hoặc mở `/admin/reports/snapshots/:id/print` từ bản chốt. Nếu `pending_custom_count > 0` FE hỏi trước. Excel: exceljs, 2 sheet, tiêu đề cột theo `?lang`. In: `print.css` (A4 dọc, lặp header bảng, chân trang 3 ô ký kèm tên từ `signers`, dòng "Lập lúc … bởi …").

## 11. Frontend

- `api-client.ts` (copy QLTS): `apiFetch` gắn `X-CSRF-Token`, 401 → `handleSessionExpired` (tự SSO lại một lần/60 s).
- Bootstrap: `GET /api/auth/me` → `{sub, role, csrfToken, fullName, department, locale, config: {registration_last_day, default_max_qty}}`. Chưa đăng nhập → màn vào (email → `/api/auth/login?login_hint=`, khác → SA).
- Hai shell: `MemberShell` (thanh trên) cho `/`, `/history`; `AdminShell` (sidebar) cho `/admin/*`; admin có mục "Phiếu của tôi" trỏ `/`. `RequireRole` chỉ là ẩn menu; server luôn 403 độc lập.
- Trạng thái kỳ: FE nhận `deadline` ISO từ server và tự đếm ngược; mọi hành động vẫn do server quyết. Giỏ theo dõi `dirty`; `beforeunload` khi có thay đổi; sau PUT thành công hiển thị `updated_at` của server.
- Ảnh: nén bằng canvas trước `POST files` (≤ 1600 px, ≤ 1 MB, áp EXIF); dòng ngoài danh mục giữ `file_id` cục bộ để lưu lại được khi mất mạng giữa chừng.
- i18n: `react-i18next`, locale lưu `localStorage`, tên món dùng `name_en` khi có.
- Token CSS: `web/src/css/tokens.css` lấy từ `design-preview/final/tokens.css`.
- Test: vitest cho stepper/giỏ/luật hiển thị; Playwright smoke chạy trên `docker compose` dev với `AUTH_DEV_MODE=true`.

## 12. Triển khai

**Compose** (`docker-compose.yml`): `api` (3000, chỉ mạng default, `extra_hosts: ["de-admin.pmh.com.vn:host-gateway"]`, volume `filesdata:/data/files`, healthcheck `/api/health`), `web` (nginx 80, mạng `default` + `edge` alias **`vpp-web`**), `postgres` (18, volume `pgdata`, không publish), `backup-cron`. `docker-compose.override.yml` cho dev publish Postgres `127.0.0.1:5492`.

**Env** (`.env.example`, biến bắt buộc dùng `:?`): `COMPOSE_PROJECT_NAME=vpp`, `POSTGRES_*`, `APP_BASE_URL=https://de-vpp.pmh.com.vn:8443`, `PMH_ISSUER_URL=https://de-admin.pmh.com.vn:8443/oidc`, `PMH_CLIENT_ID=project-vpp`, `PMH_CLIENT_SECRET`, `PMH_WEBHOOK_SECRET`, `LOCAL_SA_USERNAME`, `LOCAL_SA_PASSWORD_HASH`, `TRUST_PROXY_HOPS=2`, `WEBHOOK_TS_SKEW_SEC=300`, `AUTH_DEV_MODE=false`, `BACKUP_*`, `*_MEM_LIMIT`.

**Phía PMH_IDE (PR riêng):** `deploy/edge/conf.d/vpp.conf` (mẫu `qlts.conf`: `listen 8443 ssl`, `server_name de-vpp.pmh.com.vn`, `proxy_pass http://vpp-web:80`, `X-Forwarded-Proto https`, `client_max_body_size 6m`), alias `de-vpp.pmh.com.vn` trong `deploy/edge/docker-compose.yml`, `deploy/prod-cluster/60-vpp-up.sh` + `env-templates/vpp.env.example`, `docs/projects/project-vpp/01-nguoi-dung.md`, `02-hanh-chinh.md`.

**Đăng ký client PMH ID (Phiếu 1):** tên "VPP Công trình"; `redirect_uris = https://de-vpp.pmh.com.vn:8443/api/auth/callback` (+ dev); `app_url = https://de-vpp.pmh.com.vn:8443`; group được vào: group phòng Công trình + `vpp-admin`; Directory API: có; webhook: `…/api/webhooks/pmh-id`; BCL: `…/api/backchannel-logout`; webhook xác thực bằng HMAC v2 + timestamp (§4), không có allowlist IP.

**Cập nhật:** `update-vpp.sh` = `git pull --ff-only` → `docker compose -f docker-compose.yml up -d --build` → chờ `/api/health` 200 qua EDGE.

## 13. Bảo mật

Theo QLTS với các chỉnh sửa: **`TRUST_PROXY_HOPS`** (env; prod sau EDGE = 2: EDGE nginx → `vpp-web` nginx → api; dev = 1) thay cho `trust proxy 1` cứng — nếu sai, `req.ip` là IP EDGE và mọi giới hạn theo IP gộp thành một; `vpp.conf` ở EDGE và `web/nginx.conf` đều phải set `X-Forwarded-For` (`proxy_add_x_forwarded_for`). Cookie Strict; CSRF; throttler 300 req/phút/user (+ upload 20/phút, sa-login 10/phút/IP) và 300 req/phút/IP chạy **trước** IdentityGuard (`THROTTLE_IP_PER_MIN`, chặn spam cookie/sa-login chưa xác thực); bộ đếm theo user chạy sau Roles; redact trong log: `cookie`, `authorization`, `req.query.code`, `state`, `login_hint`, `logout_token`; không log body webhook/BCL; `AUTH_DEV_MODE` chỉ ở development/test, nginx xóa header `x-dev-*`; webhook HMAC v2 + timestamp (§4); BCL verify JWT; SA lockout theo (IP, username) + toàn cục; security headers (X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy). Ảnh: magic bytes, không thực thi, luật đọc theo tham chiếu (§8), member chỉ gắn được tệp mình tải. Audit chỉ cho mutate và tạo bản chốt, không cho GET.

## 14. Kiểm thử

| Tầng | Nội dung |
|---|---|
| Unit (jest) | `period.ts`: 23:59:59 ngày 10 vs 00:00:00 ngày 11, múi giờ (mốc UTC lệch ngày), `daysLeft` (ngày 6 → 5, ngày 10 → 1), `deadlineOf` với lastDay 28 tháng 2; validate qty/max; copy-previous (bỏ ngừng/`admin_only`/`added_by_admin`/`rejected`, hạ qty); `need` theo BR-15 (4 ca: chưa giao, giao một phần, có nợ kỳ trước, tồn dư); hash SA; HMAC v2 với test vector từ PMH_IDE. |
| DB-spec | migrations sạch trên `vpp_test`; UNIQUE phiếu; CHECK delivered/cancelled ≤ qty; CHECK cặp (`item_id`, `review_status`); `ref_line_id` RESTRICT; partial unique cho phép 2 dòng cùng món khi một là `converted`; kho không âm dưới 2 giao song song; audit append-only + chặn TRUNCATE; `in_app_notifications` UNIQUE event. |
| E2E api (theo BR) | BR-1/2: `CLOCK_OFFSET_MS` đặt 23:59:59 và 00:00:00, `periods/current`; đổi config không đổi `deadline` kỳ đã có · BR-3: hai `PUT` song song lần đầu → một phiếu, không 500 · BR-4: `PUT` với `?ym` khóa / tương lai · BR-5: member gửi `admin_only`/ngừng/trùng/qty 0; member lưu lại không mất dòng `added_by_admin` · BR-6: audit cho thêm/bớt dòng và đổi department; `self=true` · BR-7: `POST admin/requests` đúng mốc · BR-8: hai admin giao cùng dòng với cùng `expected_delivered_qty` → một `STALE_UPDATE`; giao dòng `rejected` → `LINE_REJECTED`; undo rồi giao lại; `QTY_BELOW_DELIVERED` · BR-9: convert không ảnh → `IMAGE_REQUIRED`, không unit → `UNIT_REQUIRED`; dòng rejected không vào backlog · BR-11: sync đổi department → admin sửa không đổi, member lưu lại thì đổi · BR-12: mở trang không tạo phiếu; body rỗng xóa phiếu · BR-14: 4 ca quyền đọc ảnh · webhook v1 → 401, `ts` lệch 301 s → 401, cùng `event_id` 2 lần → 1 · gỡ group qua webhook → request kế 403 · `req.ip` qua 2 hop · SA lockout (IP A, X) không khóa (IP B, X). |
| Web (vitest) | stepper (không vượt max, về 0 = bỏ dòng), giỏ (nhãn chưa lưu / đã lưu), hộp xác nhận, hiển thị khóa, dòng `added_by_admin` chỉ đọc, nén ảnh + EXIF (ảnh mẫu orientation 6), i18n. |
| Playwright smoke | SA login → tạo nhóm + món có ảnh → member (dev-identity, 390 px và 1280 px) lưu phiếu có món ngoài DM từ ảnh 4 MB → nhãn "Đã lưu" → admin thêm vào danh mục → giao 3/5 → Còn nợ → hoàn tác 1 → giao đủ → bản chốt Excel tải được, trang in hiển thị 3 ô ký có tên; axe ở 390 px không lỗi tương phản; Lịch sử/Tôi trong ≤ 2 chạm. |

## 15. Vận hành

Backup hằng đêm (pg_dump + `/data/files`, mã hóa, giữ 30 ngày, fail-closed khi thiếu passphrase); log JSON qua pino; `/api/health` cho EDGE/giám sát (`SELECT 1` qua client riêng hạn 3 s, không dùng pool; mất/treo DB → 503 `{status:'db_unavailable'}`); runbook: mất SSO → SA login; mất secret → admin PMH ID rotate, cập nhật `.env`, recreate `api`.

## 16. Danh sách copy-and-trim từ QLTS_DE (đã đối chiếu mã thật)

**api:** `src/main.ts`, `app.setup.ts` (đổi `trust proxy` → `TRUST_PROXY_HOPS`), `net-ipv4-first.ts`, `database/*`, `common/global-exception.filter.ts`, `common/user-throttler.guard.ts`, `common/sql.ts`, `modules/auth/*` (toàn bộ; đổi tên cookie; **sửa webhook sang v2**; `toIdentity` tính role từ groups; local-sa lockout theo (IP, user)), `modules/users/*` (bỏ permissions mượn), `modules/audit/*`, `modules/config/*` (bỏ SMTP/mail-settings ở GĐ1), `scripts/sa-hash.mjs`, `test/test-app.helper.ts`, `test/jest-*.json`. **Không** copy `modules/files` (viết mới, §8).

**migrations** (đánh số lại liên tục, nội dung chỉ được sửa trước lần apply đầu vì checksum): `0001_config.sql` **viết lại** với seed VPP (§5) · `0002_users.sql` · `0003_audit_log.sql` · `0004_sessions.sql` · `0005_audit_append_only.sql` · `0006_audit_no_truncate.sql` · `0007_users_role_check.sql` · `0008` = phần `processed_webhook_events` của `0026_offboarding.sql` · `0009` = `0028_session_id_token.sql` · `0010` = `0032_sessions_local_sa.sql` · `0011` = `0050_users_department.sql` · `0012` = `0053_in_app_notifications.sql` (+ cột `event_id` nếu bản gốc thiếu) · `0013_files.sql` (mới) · `0100_vpp_catalog.sql` · `0101_items_restock_level.sql` · `0102_vpp_requests.sql` · `0103_vpp_reports.sql`. Bỏ `0000_btree_gist`, `0015_files_inventory`.

**web:** `src/lib/{api-client,session-relogin,me,i18n}.ts`, `shell/login-screen.tsx` (logic), `ui/{dialog,confirm-*,load-state,chunk-error-boundary}.tsx`, `test/*`; `web/nginx.conf`, `web/proxy-api-headers.conf`, cả hai `Dockerfile`, `docker-compose.yml` (bỏ redis/worker), `.env.example` (+ `TRUST_PROXY_HOPS`, `WEBHOOK_TS_SKEW_SEC`), `ops/backup/*`, `update-qlts.sh → update-vpp.sh`, `.gitignore`.

