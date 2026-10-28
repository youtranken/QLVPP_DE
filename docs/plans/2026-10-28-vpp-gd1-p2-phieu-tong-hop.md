# VPP GĐ1 — Plan 2: Phiếu đăng ký & Tổng hợp (E2 · E3 · việc mở đầu)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nhân viên đăng ký văn phòng phẩm hằng tháng trên điện thoại (kỳ liên tục tới 23:59 ngày 10, giỏ, món ngoài danh mục có ảnh, chép lại tháng trước, lịch sử), và Hành chính tổng hợp kỳ, điều chỉnh phiếu, tạo phiếu hộ, xử lý món ngoài danh mục — trên nền Plan 1 đã ở `main`.

**Architecture:** Module api mới `periods` (kỳ + `ClockService`) và `requests` (phiếu, dòng, ghi theo diff, chép lại, tổng hợp, review) dùng chung một `RequestLinesWriter` cho cả member và admin; luật ép ở server + CHECK/UNIQUE trong CSDL (migration 0102). Web thêm feature `request` (member: Đăng ký, Lịch sử) và `summary`/`review` (admin), theo khuôn đã có ở `features/catalog|stock|admin`.

**Tech Stack:** như Plan 1 — NestJS 12 (core ESM; jest `--experimental-vm-modules`), Node 24, `pg` + drizzle (schemaless, SQL qua `sql\`\``), class-validator, Postgres 18; React 19, Vite 8, TanStack Query 5, react-router 7, react-i18next, Radix Dialog, vitest, Playwright 1.64.1 + `@axe-core/playwright`.

**Spec:** `docs/prd.md` v1.1 (§5, FR-20…35, FR-50, FR-81, BR-1…15), `docs/architecture.md` (§5 periods/requests/request_lines, §6, §7, §8), `docs/backlog/epic-2-phieu-dang-ky.md`, `epic-3-tong-hop-dieu-chinh.md`, `design-preview/_SPEC.md` (mục "Giao diện nhân viên", "Giao diện Hành chính", **"Thay đổi sau review" thắng mockup**), sổ `docs/plans/2026-10-28-vpp-gd1-p1-so-tien-do.md`, quy ước `CLAUDE.md`.

## Phân công model (đã chốt cách làm với chủ dự án: không Haiku, Fable không viết code)

| Task | Nội dung | Làm | Review |
|---|---|---|---|
| 1 | Quy tắc "sắp hết" 80 % (migration `restock_level`, api, web) | Opus | Opus |
| 2 | Dọn carry: tách `auth.controller`, cursor dùng chung, lọc nhật ký so khớp chính xác | Sonnet | Sonnet |
| 3 | `ClockService` + `period.ts` (luật kỳ, múi giờ) | Opus | Opus |
| 4 | Migration `0102_vpp_requests` + db-spec ràng buộc | Sonnet | Sonnet |
| 5 | Module `periods`: tạo kỳ, `GET periods/current` | Opus | Opus |
| 6 | `RequestLinesWriter` + `GET/PUT me/request` + ảnh dòng + chặn xóa món đã dùng | Opus | Opus |
| 7 | Chép lại tháng trước + lịch sử `GET me/requests` | Opus | Opus |
| 8 | Tổng hợp kỳ: summary, danh sách theo người/món, chưa đăng ký, xem phiếu | Opus | Opus |
| 9 | Admin sửa phiếu, tạo hộ, bộ lọc `self` ở Nhật ký | Opus | Opus |
| 10 | Món ngoài danh mục: hàng chờ + chấp nhận / thêm vào DM / từ chối | Opus | Opus |
| 11 | Web member: trang Đăng ký (lưới, giỏ, lưu, trạng thái lưu) | Opus | Opus |
| 12 | Web member: món ngoài DM, chép lại, hết hạn giữa chừng, thẻ kỳ trước | Opus | Opus |
| 13 | Web member: Lịch sử + chi tiết kỳ (chỉ đọc) | Sonnet | Opus |
| 14 | Web admin: Tổng hợp kỳ | Opus | Opus |
| 15 | Web admin: ngăn điều chỉnh + tạo hộ | Opus | Opus |
| 16 | Web admin: trang Món ngoài danh mục + hộp review | Opus | Opus |
| 17 | Smoke toàn luồng Plan 2, map, README | Opus | Opus |
| — | Review lại sau mỗi vòng sửa (diff nhỏ) | — | Sonnet |
| — | Vòng sửa 4–5 khi kẹt | Opus (agent mới) | — |
| — | Review toàn nhánh cuối Plan 2 | — | Opus |

## Global Constraints

- Nhánh `feat/p2-phieu-tong-hop` từ `main`; commit cục bộ theo task (tiếng Việt, tiền tố `feat/fix/chore/docs/test/refactor`, kết thúc dòng `Co-Authored-By` của model đang làm); **không push** cho tới khi chủ dự án bảo; không commit `.env`; stage theo đường dẫn.
- Tên giao diện thật trong code (không dùng tên cũ của plan 1): danh tính ở `req.user` (`RequestIdentity` trong `api/src/modules/auth/identity.types.ts`, `role: 'member'|'admin'|'sa'`); nhật ký `AuditWriterService.appendWithin(tx, {actor, action, objectType, objectId, detail})` với `before/after/reason/self` nằm trong `detail`; tham chiếu ảnh `FileAccessPolicy.registerReference({name, purpose, readCondition, referencedCondition})` (chuỗi SQL hằng, alias `f`, `$2` = sub người xem); `FilesService.assertOwnedBy(fileId, sub, purpose)` ném `FILE_FORBIDDEN`; lỗi `{statusCode, code, message, …extras}` qua `GlobalExceptionFilter`; web đọc lỗi qua `web/src/lib/api-error.ts` (`apiErrorCode`, `apiErrorFields`, `apiErrorNumber`).
- Mọi mã lỗi phải có trong `docs/architecture.md` §7; thêm mã mới thì sửa §7 cùng commit. Mã mới Plan 2: `LINE_NOT_FOUND`, `DUPLICATE_ITEM`.
- Kỳ: giờ `Asia/Ho_Chi_Minh`; hạn mặc định 23:59:59 ngày 10 (`registration_last_day`, 3–28); **hạn chụp vào `periods.deadline` lúc tạo kỳ**; mô hình liên tục — luôn có đúng một kỳ đang mở; thời gian nghiệp vụ lấy từ `ClockService`, không `new Date()`/`now()` DB cho luật kỳ.
- Phiếu: 1 người 1 phiếu/kỳ; **phiếu chỉ tồn tại khi có ≥ 1 dòng** (mở trang không tạo phiếu); qty nguyên 1…`max_qty` (dòng ngoài DM: `default_max_qty`); dòng ngoài DM bắt buộc tên ≤ 120, ĐVT ∈ `{cai,hop,cay,ram,cuon,loc,bich,chai,bo}`, ảnh `purpose='line_image'` do chính người lưu tải lên; ghi chú ≤ 500.
- Member chỉ thấy phiếu của mình; dòng Hành chính thêm (`added_by_admin`) hiện chỉ đọc và không mất khi member lưu.
- Thông báo (chuông) **không** thuộc Plan 2 — Plan 3 thêm; Plan 2 không tạo bản ghi `in_app_notifications`.
- Test: e2e/db cần `NODE_ENV=test` (đã ép bằng `test/e2e-env.setup.ts`) và `DATABASE_URL=…/vpp_test` (không source `.env` vào shell test); mọi db-spec gọi `assertTestDatabase()` trước tiên; e2e chạy tuần tự (`maxWorkers: 1`); dữ liệu test mang hậu tố duy nhất. `CLOCK_OFFSET_MS` chỉ hợp lệ khi `NODE_ENV=test`. Playwright chạy Vite dev → api `127.0.0.1:3000`, danh tính dev qua `web/playwright/helpers.ts` (`asRole`, `devHeaders`, `seedActiveUser`, `acquireLock`), 2 project `desktop-1280` và `mobile-390`, axe ở 390 cho trang member.
- Web: mọi chuỗi qua i18n (`web/src/locales/{vi,en}/<feature>.ts`, `en` kiểu theo `vi`); câu chữ theo `_SPEC.md` ("Lưu phiếu", "Quay lại sửa", "Chép lại danh sách tháng X", "Thêm món khác", "tối đa n/tháng", gọi admin là **Hành chính**); file ≤ 400 dòng (350 tách), component ≤ 250; `ui/` không biết nghiệp vụ; `lib/` không import `features/`; comment ít, một dòng "tại sao".
- Cuối mỗi task cập nhật `docs/map.md` cho module chạm tới.

## Review Focus

1. **Hai tab cùng sửa phiếu** — tab B (dữ liệu cũ) bấm Lưu sau tab A → 409 `STALE_UPDATE` và giao diện báo "Phiếu vừa được cập nhật ở nơi khác, tải lại", không ghi đè âm thầm. → Task 6 (api, member gửi `expected_updated_at` khi phiếu đã có), Task 11 (web).
2. **Trang mở từ trước hạn, bấm Lưu sau 00:00 ngày 11** — server trả `PERIOD_LOCKED {next_ym}`; giao diện giữ nguyên giỏ, chuyển sang kỳ mới và báo rõ, không mất món đã chọn. → Task 6, Task 12.
3. **Món bị ngừng / hạ `max_qty` / chuyển `admin_only` sau khi đã nằm trong giỏ** — lưu trả `ITEM_INACTIVE` / `QTY_EXCEEDS_MAX` / `ADMIN_ONLY_ITEM` kèm `line_index`; giao diện đánh dấu đúng dòng đó, phần còn lại của giỏ giữ nguyên. → Task 6, Task 11.
4. **Cùng một món gửi hai lần trong body** (bấm nhanh, lỗi client) → 400 `DUPLICATE_ITEM {line_index}`, không phải 500 từ unique index. → Task 6.
5. **Hành chính mở ngăn điều chỉnh, nhân viên sửa cùng phiếu trước hạn** — admin lưu → `STALE_UPDATE`, ngăn tải lại dữ liệu mới và giữ lại lý do đã gõ. → Task 9, Task 15.

---

### Task 1: Quy tắc "sắp hết" 80 % theo lần nhập gần nhất

**Files:**
- Create: `api/src/migrations/0101_items_restock_level.sql`
- Modify: `api/src/modules/catalog/stock.service.ts` (purchase), `stock-query.service.ts` (low list), `catalog-sql.ts`, `catalog.dto.ts` (bỏ `min_stock` khỏi DTO ghi), `docs/architecture.md` §5 (cột, đánh số migration: `0101_items_restock_level`, `0102_vpp_requests`, `0103_vpp_reports`), `docs/prd.md` (không đổi — FR-50 đã đúng)
- Modify web: `web/src/features/catalog/{item-form.tsx,item-draft.ts,catalog.api.ts}`, `web/src/features/stock/{stock.api.ts,stock-columns.tsx,stock-page.tsx}`, locales catalog/stock
- Test: `api/test/stock.db-spec.ts`, `api/test/catalog.e2e-spec.ts`, `web/src/features/stock/stock-page.test.tsx`, `item-form.test.tsx`

**Interfaces:**
- Produces: cột `items.restock_level int NULL`; hàm SQL thuần trong `stock-query.service.ts`: điều kiện `LOW_STOCK_SQL = "restock_level > 0 AND stock_qty > 0 AND stock_qty <= floor(restock_level * 0.2)"` (hằng chuỗi, Plan 3 dùng lại cho cron); `GET /api/admin/stock/low` trả món thỏa điều kiện; mọi dòng món admin có thêm `restock_level: number|null`, `stock_state: 'ok'|'low'|'out'|'untracked'` (`untracked` = chưa nhập mua lần nào; `out` = đã nhập và tồn 0).
- Web: `stockState(item)` thay `isLowStock`; nhãn "Sắp hết" (đỏ), "Hết hàng" (đỏ đậm), không nhãn khi `ok`/`untracked`.

- [ ] **Step 1: Test db** — `stock.db-spec.ts`: món mới → `restock_level` NULL, không có trong `/admin/stock/low`; purchase +30 từ 0 → `restock_level=30`; issue tới tồn 7 → không low; issue tới 6 → low; purchase +20 khi còn 6 → tồn 26, `restock_level=26`, không low; issue tới 5 → low; tồn 0 → `stock_state='out'`, không nằm trong `/low`; adjust (±) **không** đổi `restock_level`.
- [ ] **Step 2: Test web** — `stock-page.test.tsx`: món `{stock_qty:6, restock_level:30}` hiện "Sắp hết"; `{0,30}` hiện "Hết hàng"; `{0,null}` không nhãn; bộ lọc "Sắp hết" đếm đúng. `item-form.test.tsx`: không còn ô "Mức tồn tối thiểu".
- [ ] **Step 3: Run** → FAIL.
- [ ] **Step 4: Implement** — migration `ALTER TABLE items ADD COLUMN restock_level int CHECK (restock_level IS NULL OR restock_level > 0)`; purchase: `restock_level = stock_qty + $delta` trong cùng UPDATE (đặt lại `low_stock_notified_at = NULL` như cũ); giữ cột `min_stock` trong DB (không đọc/ghi nữa; ghi chú §5 "bỏ ở migration sau"); bỏ `min_stock` khỏi DTO, select, form, bảng Kho.
- [ ] **Step 5: Run** — `cd api && npm test && npm run test:e2e && npm run test:db`; `cd web && npm test && npm run lint && npm run build` → PASS.
- [ ] **Step 6: Commit** — `feat(kho): sắp hết = đã dùng 80 % tồn sau lần nhập gần nhất`.

### Task 2: Dọn carry kỹ thuật từ Plan 1

**Files:**
- Modify: `api/src/modules/auth/auth.controller.ts` → tách `auth-me.controller.ts` (`GET me`, `POST logout`) giữ nguyên route; `api/src/common/cursor.ts` (thêm `assertRealTimestamp`), `api/src/modules/catalog/stock-query.service.ts` (dùng hàm chung, xóa bản riêng), `api/src/modules/audit/audit-query.service.ts` + `users.service.ts` (cursor dùng hàm chung), `audit-query.service.ts` lọc `actor` so khớp chính xác (`a.actor = $actor`)
- Test: `api/src/common/cursor.spec.ts`, `api/test/audit.e2e-spec.ts`, `api/test/auth.e2e-spec.ts` (không đổi hành vi)

**Interfaces:**
- Produces: `assertRealTimestamp(value: string): void` (ném `invalidCursor()` khi ngày/giờ không tồn tại, nhận dạng `YYYY-MM-DD HH:MM:SS(.ffffff)?(+|-)HH(:MM)?`, kiểm năm nhuận, phút offset < 60, năm ≥ 1000) trong `common/cursor.ts`; `decodeCursor` không đổi chữ ký.

- [ ] **Step 1: Test** — `cursor.spec.ts`: `2028-02-29 00:00:00+07` hợp lệ; `2027-02-29…`, `2026-99-99…`, `2026-10-28 10:00:00+07:99` → `invalidCursor`. `audit.e2e-spec.ts`: cursor nhật ký/danh bạ đúng hình sai giá trị → 400 `VALIDATION` (trước là 500); `GET admin/audit?actor=u-1` không trả dòng của `u-10`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** toàn bộ api → PASS; `wc -l api/src/modules/auth/*.controller.ts` mỗi file < 300.
- [ ] **Step 5: Commit** — `refactor(api): tách auth controller, kiểm cursor dùng chung, lọc nhật ký theo người chính xác`.

### Task 3: `ClockService` và luật kỳ thuần

**Files:**
- Create: `api/src/common/period.ts`, `api/src/common/clock.service.ts`, `api/src/common/clock.module.ts` (global)
- Modify: `api/src/main.ts` (assert env), `api/src/app.module.ts`
- Test: `api/src/common/period.spec.ts`, `api/src/common/clock.service.spec.ts`

**Interfaces:**
- Produces (thuần, mọi tham số `Date` là thời điểm tuyệt đối; tháng biểu diễn chuỗi `YYYY-MM`):
  - `periodFor(now: Date, lastDay: number): string` — ngày (giờ VN) ≤ `lastDay` → tháng này, ngược lại tháng sau.
  - `deadlineOf(ym: string, lastDay: number): Date` — 00:00 giờ VN của ngày `lastDay + 1` trong tháng `ym`.
  - `daysLeft(now: Date, deadline: Date): number` — số ngày lịch VN từ hôm nay đến ngày hạn (ngày trước `deadline`), tính cả hôm nay; ngày hạn → 1; đã qua → 0.
  - `addMonths(ym: string, n: number): string`, `vnDate(d: Date): {y, m, d}`.
  - `ClockService.now(): Date` = `new Date(Date.now() + offset)`; `offset = Number(CLOCK_OFFSET_MS)` chỉ khi `NODE_ENV === 'test'`, ngược lại 0.
  - `assertClockEnv(env)`: `CLOCK_OFFSET_MS` có giá trị mà `NODE_ENV !== 'test'` → throw (gọi trong `main.ts` cạnh các assert khác).

- [ ] **Step 1: Test `period.spec.ts`** — các ca (thời điểm viết bằng UTC):
  - `periodFor(2026-11-10T16:59:59Z, 10)` = `'2026-11'`; `periodFor(2026-11-10T17:00:00Z, 10)` = `'2026-12'` (00:00 ngày 11 VN).
  - `periodFor(2026-12-10T17:00:00Z, 10)` = `'2027-01'` (qua năm).
  - `deadlineOf('2026-11', 10)` = `2026-11-10T17:00:00Z`; `deadlineOf('2027-02', 28)` = `2027-02-28T17:00:00Z` (00:00 ngày 1/3 VN).
  - `daysLeft(2026-11-05T03:00:00Z /*06/11 VN 10:00*/, deadlineOf('2026-11',10))` = 5; tại `2026-11-10T03:00Z` = 1; tại `2026-11-14T03:00Z` với `deadlineOf('2026-12',10)` = 27; sau hạn = 0.
  - `addMonths('2026-12', 1)` = `'2027-01'`, `addMonths('2026-01', -1)` = `'2025-12'`.
- [ ] **Step 2: Test `clock.service.spec.ts`** — `NODE_ENV=test`, `CLOCK_OFFSET_MS=86400000` → `now()` lệch +1 ngày ±1 s; `NODE_ENV=production` có biến → `assertClockEnv` throw; không có biến → offset 0.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement** (dùng `Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Ho_Chi_Minh'})` để lấy ngày VN; VN không có giờ mùa hè nên offset cố định +07 được phép cho `deadlineOf`). **Step 5: Run** → PASS.
- [ ] **Step 6: Commit** — `feat(api): ClockService và luật kỳ (periodFor, deadlineOf, daysLeft)`.

### Task 4: Migration `0102_vpp_requests`

**Files:**
- Create: `api/src/migrations/0102_vpp_requests.sql`
- Modify: `api/test/migrations.db-spec.ts` (số migration)
- Test: `api/test/requests-schema.db-spec.ts`

**Interfaces:**
- Produces bảng **đúng DDL `docs/architecture.md` §5**: `periods(ym date PK, deadline timestamptz NOT NULL, headcount int, created_at)`, `requests(id, period_ym → periods, user_sub → users, department, note, created_by_sub NOT NULL, created_at, updated_at, UNIQUE(period_ym,user_sub))`, `request_lines(…)` với CHECK cặp (`item_id`,`review_status`) gồm điều kiện `image_file_id IS NOT NULL` cho dòng ngoài DM, CHECK `delivered_qty + cancelled_qty <= qty`, partial unique `request_lines_item_uq (request_id, item_id) WHERE item_id IS NOT NULL AND review_status = 'n/a'`, index `request_lines(request_id)`, `request_lines(item_id)`, partial còn nợ theo §5, `requests(period_ym)`; `ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_ref_line_id_fkey FOREIGN KEY (ref_line_id) REFERENCES request_lines ON DELETE RESTRICT`. `ym` lưu `date` ngày 1 của tháng.
- Thêm `requests.updated_at`/`request_lines.updated_at` mặc định `now()`; không trigger.

- [ ] **Step 1: Test** — (gọi `assertTestDatabase()` đầu tiên; seed user, item, file `line_image`):
  - phiếu thứ 2 cùng (period, user) → 23505; `qty=0` → 23514; `delivered_qty > qty` → 23514; `delivered+cancelled > qty` → 23514.
  - dòng `item_id NULL` + `review_status='n/a'` → 23514; `item_id NOT NULL` + `'pending'` → 23514; dòng ngoài DM thiếu ảnh hoặc thiếu `custom_unit` → 23514.
  - hai dòng cùng món `n/a` cùng phiếu → 23505; một `n/a` + một `converted` cùng món → OK.
  - movement có `ref_line_id` → xóa dòng đó → 23503; xóa phiếu → CASCADE dòng (khi dòng chưa có movement).
- [ ] **Step 2: Run** → FAIL. **Step 3:** viết SQL. **Step 4: Run** `npm run test:db` → PASS; `docker compose up -d --build api` → log `0102_vpp_requests.sql` applied.
- [ ] **Step 5: Commit** — `feat(db): 0102 kỳ, phiếu, dòng phiếu`.

### Task 5: Module `periods` và `GET periods/current`

**Files:**
- Create: `api/src/modules/periods/{periods.module.ts,periods.service.ts,periods.controller.ts}`
- Modify: `api/src/app.module.ts`, `docs/architecture.md` §6 (luật chọn kỳ đang mở)
- Test: `api/test/periods.e2e-spec.ts`

**Interfaces:**
- Consumes: `ClockService.now()`, `periodFor`, `deadlineOf`, `daysLeft`, `addMonths`; `SystemConfigService.getInt('registration_last_day')`.
- Produces (`PeriodsService`, export):
  - `ensurePeriod(ym: string, tx?): Promise<{ym: string, deadline: Date}>` — `INSERT … ON CONFLICT DO NOTHING` với `deadlineOf(ym, lastDay hiện tại)`, rồi đọc.
  - `openPeriod(tx?): Promise<{ym, deadline}>` — **kỳ đang mở** = kỳ có `deadline > now` nhỏ nhất trong bảng; nếu không có → `ensurePeriod(periodFor(now, lastDay))`. (Đổi config giữa kỳ không làm kỳ đang có mất hiệu lực.)
  - `isOpen(ym, tx?): Promise<boolean>` = `now < periods.deadline` (kỳ chưa có → false).
  - `GET /api/periods/current` (M) → `{ym: 'YYYY-MM', deadline: ISO, is_open: true, days_left: number, previous: {ym, delivering: boolean} | null}`; `previous` = `addMonths(ym,-1)` nếu người gọi có phiếu kỳ đó, `delivering` = có dòng hiệu lực còn nợ (`review_status IN ('n/a','accepted','converted') AND delivered_qty + cancelled_qty < qty`).

- [ ] **Step 1: Test e2e** (dùng biến môi trường `CLOCK_OFFSET_MS` đặt trước `createTestApp`, tính sao cho `now` = mốc mong muốn; mỗi ca app riêng):
  - `now = 2026-11-10T16:59:59Z` → `{ym:'2026-11', days_left:1}`; `now = 2026-11-10T17:00:00Z` → `ym:'2026-12'`, `days_left:30`.
  - 15/11 10:00 VN, có phiếu kỳ 11 (seed) → `{ym:'2026-12', days_left:26, previous:{ym:'2026-11', delivering:true}}`.
  - đổi config `registration_last_day` 10→5 khi kỳ 12 đã tạo → `GET` vẫn trả hạn cũ của kỳ 12; kỳ 2027-01 tạo sau dùng hạn 5.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(api): kỳ đăng ký liên tục, GET periods/current`.

### Task 6: Ghi phiếu theo diff — `RequestLinesWriter`, `GET/PUT me/request`

**Files:**
- Create: `api/src/modules/requests/{requests.module.ts,request-lines.writer.ts,request-lines.rules.ts,requests.repo.ts,me-request.controller.ts,request.dto.ts,request-view.ts,line-image.reference.ts,request-item-usage.hook.ts}`
- Modify: `api/src/modules/catalog/catalog.module.ts` (thay provider `ITEM_USAGE_HOOK`), `api/src/modules/catalog/catalog.service.ts` (`CONSTRAINT_ERRORS` thêm `request_lines_item_id_fkey` → `ITEM_IN_USE`; gọi `isUsed` **trong** transaction xóa), `docs/architecture.md` §7 (`LINE_NOT_FOUND`, `DUPLICATE_ITEM`)
- Test: `api/src/modules/requests/request-lines.rules.spec.ts`, `api/test/me-request.e2e-spec.ts`, `api/test/me-request-concurrency.db-spec.ts`

**Interfaces:**
- Consumes: `PeriodsService.openPeriod/isOpen/ensurePeriod`, `ClockService`, `FilesService.assertOwnedBy`, `FileAccessPolicy.registerReference`, `AuditWriterService.appendWithin`, `SystemConfigService.getInt('default_max_qty')`, `UsersService.findBySub`.
- Produces:
  - DTO vào: `LineInput {id?: uuid; item_id?: uuid; custom_name?: string; custom_unit?: Unit; custom_note?: string; image_file_id?: uuid; qty: number}`; `SaveLinesBody {lines: LineInput[]; ym?: string; expected_updated_at?: string; reason?: string}` (`ym` = kỳ client đang xem, member bắt buộc gửi).
  - `RequestView` (trả về mọi endpoint phiếu): `{id, period_ym: 'YYYY-MM', user_sub, full_name, department, updated_at: ISO (ms), is_open: boolean, lines: LineView[]}`; `LineView {id, item_id, item: {name, name_en, unit, pack_note, image_file_id, active, admin_only} | null, custom_name, custom_unit, custom_note, image_file_id, qty, delivered_qty, cancelled_qty, review_status, review_note, added_by_admin, readonly_for_member: boolean}`.
  - `RequestLinesWriter.save(tx, args: {request: {id, user_sub, period_ym} | null, owner_sub: string, period_ym: string, actor: RequestIdentity, mode: 'member'|'admin', body: SaveLinesBody}): Promise<{request_id: string | null, diff: LinesDiff}>` — thuật toán architecture §6 bước 1–5. `LinesDiff {added: LineSnap[], removed: LineSnap[], changed: {id, before: LineSnap, after: LineSnap}[]}`.
  - Luật thuần trong `request-lines.rules.ts`: `isMemberReadonly(line) = added_by_admin || review_status IN ('accepted','converted','rejected') || delivered_qty > 0`; `isDeletable(line, mode) = delivered_qty = 0 && review_status IN ('n/a','pending') && (mode === 'admin' || !added_by_admin)`.
  - `GET /api/me/request?ym=YYYY-MM` (mặc định kỳ đang mở) → `RequestView` | 404 `REQUEST_NOT_FOUND`; `ym` qua `YmPipe` (sai → `INVALID_PERIOD`; lớn hơn kỳ đang mở → `INVALID_PERIOD`).
  - `PUT /api/me/request/lines` (M, CSRF) → 200 `{request: RequestView | null}` — chỉ ghi vào **kỳ đang mở**: body `ym` khác kỳ đang mở → 409 `PERIOD_LOCKED {next_ym: <kỳ đang mở>}`; phiếu đã có thì `expected_updated_at` **bắt buộc** (thiếu/lệch → 409 `STALE_UPDATE`).
  - `LINE_IMAGE_REFERENCE: FileReference = {name:'request_lines.image_file_id', purpose:'line_image', readCondition: "EXISTS (SELECT 1 FROM request_lines l JOIN requests r ON r.id = l.request_id WHERE l.image_file_id = f.id AND r.user_sub = $2)", referencedCondition: "EXISTS (SELECT 1 FROM request_lines l WHERE l.image_file_id = f.id)"}` đăng ký trong `RequestsModule.onModuleInit`.
  - `RequestItemUsageHook.isUsed(itemId, tx)` = có `request_lines.item_id = itemId`.
  - Audit: `action:'request.created'|'request.updated'|'request.deleted'`, `objectType:'request'`, `objectId: request_id`, `detail:{ym, owner_sub, added, removed, changed, reason?, self: actor.sub === owner_sub && mode === 'admin'}`.
- Luật quyết định (spec im lặng, chốt tại đây):
  - Phiếu chưa có + body rỗng → 400 `LINES_EMPTY`; phiếu đã có + body chỉ còn dòng không xóa được → giữ các dòng đó; sau diff không còn dòng nào → xóa phiếu, trả `{request: null}`.
  - Member gửi dòng readonly: không đổi nội dung → bỏ qua; đổi → 400 `LINE_READONLY {line_id}`; không gửi → giữ nguyên.
  - Cùng `item_id` xuất hiện 2 lần trong body (dòng `n/a`) → 400 `DUPLICATE_ITEM {line_index}`; `id` không thuộc phiếu → 400 `LINE_NOT_FOUND {line_index}`.
  - Dòng ngoài DM đã có (`pending`) member sửa được tên/ĐVT/ghi chú/ảnh/qty; dòng `accepted/rejected/converted` là readonly.
  - `department` phiếu = `users.department` của **chủ phiếu** tại lần lưu (member hoặc admin).
  - Lỗi theo dòng trả `{code, line_index}` (dòng mới) hoặc `{code, line_id}` (dòng cũ).

- [ ] **Step 1: Test luật thuần** `request-lines.rules.spec.ts` — bảng chân trị cho `isMemberReadonly`, `isDeletable` (member/admin).
- [ ] **Step 2: Test e2e** `me-request.e2e-spec.ts` (seed user active `e2e-req-<suffix>` qua SQL, đăng nhập bằng dev identity cùng sub; giờ cố định bằng `CLOCK_OFFSET_MS` trước hạn):
  - mở `GET me/request` khi chưa lưu → 404 `REQUEST_NOT_FOUND`, bảng `requests` không có dòng.
  - lưu 2 món + 1 dòng ngoài DM có ảnh `line_image` của mình → 200, `period_ym` = kỳ đang mở, dòng ngoài DM `review_status:'pending'`; audit `request.created`.
  - lưu lại với `expected_updated_at` cũ → 409 `STALE_UPDATE`; với giá trị mới nhất → 200, diff đúng (`changed` có before/after qty).
  - `qty:0` → `QTY_INVALID {line_index}`; `qty` > `max_qty` → `QTY_EXCEEDS_MAX`; dòng ngoài DM qty > `default_max_qty` → `QTY_EXCEEDS_MAX`; món `active=false` → `ITEM_INACTIVE`; món `admin_only` → `ADMIN_ONLY_ITEM`; dòng ngoài DM thiếu ảnh → `IMAGE_REQUIRED`, thiếu ĐVT → `UNIT_REQUIRED`; ảnh của người khác hoặc `purpose='item_image'` → `FILE_FORBIDDEN`; cùng món 2 lần → `DUPLICATE_ITEM`.
  - (Review Focus 3) sau khi lưu món X, admin ngừng X qua API → member lưu lại không đụng X → 200 (dòng X giữ, trả `item.active=false`); member đổi qty X → `ITEM_INACTIVE {line_id}`.
  - dòng `added_by_admin` (chèn bằng SQL) → member lưu lại không gửi nó → vẫn còn; gửi với qty khác → `LINE_READONLY`.
  - body rỗng khi chưa có phiếu → `LINES_EMPTY`; body rỗng khi có phiếu (không dòng readonly) → `{request:null}`, phiếu bị xóa, audit `request.deleted`.
  - (Review Focus 2) `CLOCK_OFFSET_MS` đặt sau hạn kỳ 11: `PUT` với `ym:'2026-11'` → 409 `PERIOD_LOCKED {next_ym:'2026-12'}`, phiếu kỳ 11 không đổi; `PUT` với `ym:'2026-12'` → 200 ghi vào kỳ 12; thiếu `ym` → 400 `VALIDATION`.
  - member B `GET files/:id` ảnh dòng của A → 404; A → 200; admin → 200.
  - xóa món đã nằm trong một dòng phiếu qua `DELETE admin/items/:id` → 409 `ITEM_IN_USE`.
- [ ] **Step 3: Test db** `me-request-concurrency.db-spec.ts` — hai `save()` song song lần đầu cùng người (`Promise.all`) → đúng 1 phiếu, không 23505 lọt ra (một thành công, một thành công hoặc `STALE_UPDATE`).
- [ ] **Step 4: Run** → FAIL. **Step 5: Implement** (thứ tự khóa: `requests` FOR UPDATE → `request_lines` theo `id`; so `expected_updated_at` bằng `date_trunc('milliseconds', updated_at) = $1::timestamptz`; trả `updated_at` ISO ms).
- [ ] **Step 6: Run** toàn bộ api → PASS. **Step 7: Commit** — `feat(api): phiếu của tôi — lưu theo diff, ảnh dòng, chặn xóa món đã dùng`.

### Task 7: Chép lại tháng trước và lịch sử

**Files:**
- Create: `api/src/modules/requests/{copy-previous.service.ts,history.service.ts}`
- Modify: `me-request.controller.ts`
- Test: `api/src/modules/requests/copy-previous.spec.ts` (thuần trên dữ liệu đầu vào), `api/test/me-history.e2e-spec.ts`

**Interfaces:**
- Produces:
  - `POST /api/me/request/copy-previous` (M, CSRF, **không ghi DB**) → `{from_ym, lines: LineInput[] (không id), skipped: {name, reason: 'INACTIVE'|'ADMIN_ONLY'|'ADDED_BY_ADMIN'|'REJECTED'}[], capped: {name, from, to}[], previously_accepted: string[] /* custom_name */}` hoặc 404 `REQUEST_NOT_FOUND` khi không có kỳ nào trước kỳ đang mở có phiếu. Nguồn = phiếu gần nhất có `period_ym < kỳ đang mở`.
  - Hàm thuần `buildCopy(lines: SourceLine[], items: Map<id, {active, admin_only, max_qty}>, defaultMax: number)` → kết quả trên (dòng `converted` → dòng món `item_id`; `accepted`/`pending` → dòng ngoài DM giữ `image_file_id`, `custom_*`; `qty = min(qty, max)`).
  - `GET /api/me/requests?limit&cursor` (M) → `{items: {period_ym, line_count, total_qty, delivered_qty, remaining_qty, cancelled_qty, custom: {pending, accepted, converted, rejected}}[], next_cursor}` mới nhất trước; chi tiết dùng `GET me/request?ym=`.
- [ ] **Step 1: Test thuần** — món ngừng, `admin_only`, `added_by_admin`, `rejected` → `skipped` đúng lý do; qty 15 với `max_qty` mới 10 → `capped`; `converted` → `item_id`; `accepted` → custom + `previously_accepted`.
- [ ] **Step 2: Test e2e** — chưa có kỳ trước → 404; có phiếu kỳ 10 nhưng không kỳ 11 → `from_ym:'2026-10'`; gọi không tạo phiếu; lịch sử hai kỳ đúng thứ tự và tổng; người khác không thấy lịch sử của mình.
- [ ] **Step 3–5:** Run FAIL → Implement → Run PASS. **Step 6: Commit** — `feat(api): chép lại tháng trước, lịch sử phiếu`.

### Task 8: Tổng hợp kỳ cho Hành chính

**Files:**
- Create: `api/src/modules/requests/{admin-summary.controller.ts,summary.service.ts,summary.dto.ts}`
- Test: `api/test/admin-summary.e2e-spec.ts`

**Interfaces:**
- Consumes: `PeriodsService`, `SystemConfigService.getAuthorizedGroups()`, `LOW_STOCK_SQL` (Task 1).
- Produces (A, `@Roles('admin','sa')`, `:ym` qua `YmPipe`, lớn hơn kỳ đang mở → `INVALID_PERIOD`):
  - `GET /api/admin/periods/:ym/summary` → `{ym, deadline, is_open, registered, headcount, headcount_source: 'snapshot'|'live', lines_pending_delivery, custom_pending, low_stock}`. `headcount` = `periods.headcount` nếu có, ngược lại đếm live: user `status='active'`, `sub <> 'local:sa'`, và (nếu `authorized_groups` không rỗng) `groups` giao `authorized_groups` không phân biệt hoa thường.
  - `GET /api/admin/periods/:ym/requests?by=person&q=&filter=all|pending_delivery|custom_pending&limit&cursor` → `{items: {request_id, user_sub, full_name, email, department, user_status, line_count, total_qty, delivered_qty, custom_pending, updated_at}[], next_cursor}` sắp theo `department NULLS LAST, full_name`; `q` tìm tên/email (escapeLike).
  - `GET /api/admin/periods/:ym/requests?by=item` → `{items: {key, item_id|null, name, unit, requested_qty, people}[]}` (dòng hiệu lực; dòng ngoài DM gộp theo `lower(trim(custom_name))+custom_unit`), không phân trang.
  - `GET /api/admin/periods/:ym/unregistered` → `{items: {sub, full_name, email, department}[]}` — tập headcount trừ người có phiếu.
  - `GET /api/admin/requests/:id` → `RequestView` + `{user_status}`; không có → 404 `REQUEST_NOT_FOUND`.
- [ ] **Step 1: Test e2e** — seed 3 user active (2 có phiếu, 1 không) + 1 locked: `registered=2`, `headcount=3`, `unregistered` = đúng 1 người; `filter=custom_pending` chỉ phiếu có dòng pending; `by=item` gộp hai dòng ngoài DM cùng tên khác hoa thường; member gọi → 403; `ym=2026-13` → `INVALID_PERIOD`; kỳ tương lai → `INVALID_PERIOD`.
- [ ] **Step 2–4:** FAIL → Implement → PASS. **Step 5: Commit** — `feat(api): tổng hợp kỳ cho Hành chính`.

### Task 9: Hành chính sửa phiếu, tạo hộ, lọc `self`

**Files:**
- Create: `api/src/modules/requests/admin-requests.controller.ts`
- Modify: `api/src/modules/audit/audit-query.service.ts` + DTO (`self=true|false` lọc `detail->>'self'`), `docs/architecture.md` §7 nếu body khác
- Test: `api/test/admin-requests.e2e-spec.ts`, `api/test/audit.e2e-spec.ts`

**Interfaces:**
- Consumes: `RequestLinesWriter.save(… mode:'admin')`.
- Produces:
  - `PUT /api/admin/requests/:id/lines` (A, CSRF) body `SaveLinesBody` với `expected_updated_at` **bắt buộc**; kỳ đã khóa (`!isOpen(period_ym)`) → `reason` bắt buộc (trim ≥ 3 ký tự) else 400 `REASON_REQUIRED`; dòng mới admin thêm → `added_by_admin = true`; admin được thêm món `admin_only`; `qty < delivered_qty + cancelled_qty` → `QTY_BELOW_DELIVERED {line_id, delivered}`; trả `{request: RequestView | null}`.
  - `POST /api/admin/requests` (A, CSRF) body `{user_sub, lines: LineInput[] (≥ 1)}` → chỉ cho kỳ đang mở; người không tồn tại → 404 `USER_NOT_FOUND`; không `active` → 400 `USER_INACTIVE`; đã có phiếu → 409 `REQUEST_EXISTS`; `created_by_sub` = admin; dòng tạo hộ `added_by_admin = false` (là đăng ký của chính người đó). Body rỗng → `LINES_EMPTY`.
  - `GET /api/admin/audit?self=true` → chỉ dòng `detail.self = true`.
- [ ] **Step 1: Test** — sau hạn không lý do → `REASON_REQUIRED`; có lý do → 200, audit có `reason`; (Review Focus 5) admin giữ `expected_updated_at` cũ trong khi member vừa lưu → `STALE_UPDATE`; giảm qty dưới số đã giao (seed `delivered_qty`) → `QTY_BELOW_DELIVERED`; xóa dòng đã giao một phần → dòng còn nguyên (không xóa) ; thêm Giấy A4 `admin_only` → OK, `added_by_admin:true`, member GET thấy `readonly_for_member:true`; admin sửa phiếu của chính mình → audit `self:true`, `GET audit?self=true` thấy; tạo hộ cho người đã mở app chưa lưu → 201; tạo hộ người locked → `USER_INACTIVE`; sub lạ → `USER_NOT_FOUND`; trùng → `REQUEST_EXISTS`; tạo hộ sau hạn kỳ 11 → ghi vào kỳ 12 (luôn kỳ đang mở).
- [ ] **Step 2–4:** FAIL → Implement → PASS. **Step 5: Commit** — `feat(api): Hành chính sửa phiếu, tạo phiếu hộ, lọc self ở nhật ký`.

### Task 10: Món ngoài danh mục — hàng chờ và xử lý

**Files:**
- Create: `api/src/modules/requests/{review.controller.ts,review.service.ts,review.dto.ts}`
- Modify: `api/src/modules/catalog/catalog.service.ts` (export `createItemWithin(tx, input, actor)` dùng lại validate tạo món, không đi qua HTTP), `docs/architecture.md` §7 nếu cần
- Test: `api/test/review.e2e-spec.ts`

**Interfaces:**
- Consumes: `CatalogService.createItemWithin`, `FilesService.assertOwnedBy`, `AuditWriterService.appendWithin`.
- Produces:
  - `GET /api/admin/review?status=pending|accepted|converted|rejected&ym=` → `{items: {line_id, request_id, period_ym, user_sub, full_name, department, custom_name, custom_unit, custom_note, image_file_id, qty, review_status, review_note, previously_accepted: boolean, created_at}[]}`; `previously_accepted` = cùng người có dòng `accepted` cùng `lower(trim(custom_name))` ở kỳ trước.
  - `POST /api/admin/lines/:id/review` (A, CSRF) body `{action:'accept'|'convert'|'reject', note?: string, item?: {existing_id: uuid} | {name, name_en?, unit, pack_note?, category_id, image_file_id?, max_qty?, admin_only?}}`:
    - `UPDATE … WHERE id=$1 AND review_status='pending'` (0 dòng: không có → 404 `LINE_NOT_FOUND`, khác pending → 409 `LINE_ALREADY_REVIEWED`).
    - `reject` cần `note` (trim ≥ 3) → else `REASON_REQUIRED`; lưu `review_note`.
    - `accept` → `accepted`.
    - `convert` với `existing_id` → món phải active; dòng thành `item_id = existing_id, review_status='converted'`, xóa `custom_*`? **Không** — CHECK yêu cầu `custom_name IS NULL` khi có `item_id`: đặt `custom_name/custom_unit/custom_note = NULL`, giữ `image_file_id`, lưu tên gốc vào `review_note` nếu `note` trống (`"Từ: <custom_name>"`).
    - `convert` với món mới → `unit` bắt buộc (`UNIT_REQUIRED`); ảnh = `item.image_file_id` (phải `assertOwnedBy(admin, 'item_image')`) hoặc mặc định ảnh của dòng (dùng thẳng, không kiểm chủ); tạo món tồn 0, không biến động kho; trả `{line, item, unit_mismatch: boolean}` (`unit_mismatch` = ĐVT món khác `custom_unit` gốc).
    - Audit `line.review` `{action, before, after, item_id?}`; không tạo thông báo (Plan 3).
- [ ] **Step 1: Test** — accept/convert(existing)/convert(new, dùng ảnh dòng)/reject; reject không note → `REASON_REQUIRED`; xử lý lần 2 → `LINE_ALREADY_REVIEWED`; hai request convert song song (`Promise.all`) → một 200, một `LINE_ALREADY_REVIEWED`; convert món mới thiếu unit → `UNIT_REQUIRED`; sau convert, món mới có trong `GET items` của member và ảnh đọc được bởi member khác (qua tham chiếu `items`); dòng converted cùng món với dòng `n/a` có sẵn trong phiếu → không lỗi unique; member GET thấy `review_status`, `review_note`; `previously_accepted` đúng.
- [ ] **Step 2–4:** FAIL → Implement → PASS. **Step 5: Commit** — `feat(api): xử lý món ngoài danh mục`.

### Task 11: Web member — trang Đăng ký (lưới, giỏ, lưu)

**Files:**
- Create: `web/src/features/request/{request.api.ts,request-errors.ts,use-cart.ts,request-page.tsx,period-hero.tsx,item-grid.tsx,item-card.tsx,cart-panel.tsx,save-dialog.tsx,mobile-save-bar.tsx,request.css}`, `web/src/ui/stepper.tsx`, `web/src/locales/{vi,en}/request.ts`
- Modify: `web/src/shell/app-routes.tsx` (`/` → `RequestPage`)
- Test: `use-cart.test.ts`, `request-page.test.tsx`, `ui/stepper.test.tsx`

**Interfaces:**
- Consumes: `GET periods/current`, `GET me/request`, `PUT me/request/lines`, `GET items`, `GET item-categories`, `GET files/:id`.
- Produces:
  - `useCart(server: RequestView | null)` → `{lines: CartLine[], dirtyCount: number, setQty(key, n), remove(key), addCustom(line), replaceAll(lines), toBody(): SaveLinesBody, markSaved(view)}`; `CartLine` khóa theo `item_id` hoặc `tmp-id` dòng ngoài DM; dòng `readonly_for_member` không đổi được (setQty/remove bỏ qua).
  - `Stepper` (`ui/`): props `{value, min=0, max, onChange, label}`; về 0 = bỏ dòng; nút có `aria-label`; không vượt `max`.
- UI theo `_SPEC.md` (member, Nunito, emerald): hero tiêu đề "Phiếu tháng N", ô số ngày còn lại (`days_left`; ngày cuối: "Hôm nay là ngày cuối"), dòng trạng thái "Đã lưu hh:mm · sửa tiếp đến hết dd/mm" / "Chưa lưu phiếu tháng này" / chấm vàng khi có thay đổi; hàng chip (tìm + nhóm, cuộn ngang 390); lưới thẻ `minmax(200px,1fr)` (2 cột ≤ 900): ảnh (hoặc ô màu nhóm khi thiếu ảnh), tên + quy cách, "ĐVT · tối đa n/tháng", stepper; thẻ cuối lưới "Không thấy món cần? Thêm tại đây" (mở hộp ở Task 12); giỏ 360 px dính: tên/phòng ban, dòng (dòng "Hành chính thêm" nhãn xám, không −/+/×), "4 loại món · 17 đơn vị", nút "Lưu phiếu" → hộp "Lưu phiếu tháng N?" (bảng món, "Quay lại sửa" / "Lưu phiếu"); ≤ 900 px: giỏ xuống dưới, thanh dính trên bottom nav "N món · Lưu phiếu" / "2 thay đổi chưa lưu · Lưu"; sau lưu toast "Đã lưu phiếu tháng N"; rời trang khi `dirtyCount > 0` → `beforeunload`.
  - Lỗi: `STALE_UPDATE` → hộp "Phiếu vừa được cập nhật ở nơi khác" + nút "Tải lại" (giữ giỏ hiện tại để người dùng so); lỗi theo dòng (`line_index`/`line_id`) → viền đỏ + câu lỗi tại dòng trong giỏ; lỗi khác → câu chung.
- [ ] **Step 1: Test** — `use-cart.test.ts`: setQty vượt max bị chặn; về 0 xóa dòng; dòng readonly bất biến; `toBody()` gửi `id` cho dòng cũ, `expected_updated_at` khi phiếu đã có; `dirtyCount` đếm đúng thêm/sửa/bỏ. `request-page.test.tsx` (mock fetch): chưa có phiếu → "Chưa lưu phiếu tháng này"; chọn 3 món → thanh "3 thay đổi chưa lưu"; Lưu → hộp xác nhận → PUT body đúng → toast + "Đã lưu 14:20"; (Review Focus 1) server 409 `STALE_UPDATE` → hộp tải lại; (Review Focus 3) 400 `ITEM_INACTIVE {line_id}` → đúng dòng có lỗi, các dòng khác giữ; dòng `readonly_for_member` hiện nhãn "Hành chính thêm" và không có nút −/+.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `npm test && npm run lint && npm run build` → PASS; Playwright `request.spec.ts` "E2-S5 lưu phiếu" ở 1280/390: chọn 3 món, lưu, tải lại thấy đúng; axe 390 sạch; chụp ảnh vào thư mục ảnh của task.
- [ ] **Step 5: Commit** — `feat(web): trang Đăng ký — lưới thẻ, giỏ, lưu phiếu`.

### Task 12: Web member — món ngoài danh mục, chép lại, hết hạn giữa chừng

**Files:**
- Create: `web/src/features/request/{custom-line-dialog.tsx,copy-previous-dialog.tsx,previous-period-card.tsx}`
- Modify: `request-page.tsx`, `cart-panel.tsx`, `use-cart.ts`, `request.api.ts`, locales request
- Test: `custom-line-dialog.test.tsx`, `copy-previous-dialog.test.tsx`, `request-page.test.tsx`

**Interfaces:**
- Consumes: `POST files {purpose:'line_image'}` + `compressImage` (`lib/image-compress.ts`), `POST me/request/copy-previous`, `GET periods/current.previous`.
- Produces:
  - Hộp "Thêm món khác" (nút viền đứt cạnh ô tìm và thẻ cuối lưới): tên (≤ 120), ĐVT (`UnitSelect` dùng lại từ `features/catalog/unit-select.tsx` — chuyển sang chỗ dùng chung nếu cần, không vào `ui/`), số lượng (stepper, ≤ `config.default_max_qty`), ghi chú, ảnh **bắt buộc** (nén trước khi tải; HEIC → "Chọn ảnh JPG, PNG hoặc WebP"); dòng ngoài DM trong giỏ có −/+, ×, bấm tên để sửa; chưa lưu thì chỉ ở client.
  - Nút "Chép lại danh sách tháng X" (X = `from_ym`, ẩn khi API trả 404): giỏ đang có dòng → hỏi "Thay giỏ hiện tại?"; kết quả vào giỏ (chưa lưu) + hộp tóm tắt `skipped`/`capped`/`previously_accepted` bằng lời ("Đã bỏ: Giấy A4 — chỉ Hành chính đặt").
  - Body lưu luôn gửi `ym` của kỳ đang hiển thị. (Review Focus 2) Lưu nhận `PERIOD_LOCKED {next_ym}` → tải lại `periods/current`, giữ nguyên giỏ (bỏ `id` các dòng, coi là dòng mới của kỳ mới), báo "Phiếu tháng N đã khóa lúc 00:00. Món bạn chọn đã được chuyển sang phiếu tháng N+1 — bấm Lưu phiếu để giữ.".
  - Thẻ "Tháng M đang giao · a/b món" dưới hero khi `previous.delivering` → link `/history/M`.
- [ ] **Step 1: Test** — hộp ngoài DM: không ảnh → nút Thêm vô hiệu + "Cần có ảnh"; HEIC → thông báo; đủ → dòng xuất hiện trong giỏ với nhãn info. Chép lại: giỏ rỗng → điền thẳng; giỏ có dòng → hỏi; lý do bỏ hiển thị bằng lời. `PERIOD_LOCKED` → giỏ giữ, tiêu đề đổi sang tháng mới, câu báo đúng.
- [ ] **Step 2–4:** FAIL → Implement → PASS (vitest + lint + build); Playwright "E2-S5 món ngoài danh mục" (390: chụp/chọn ảnh fixture → lưu → tải lại thấy dòng "Chờ Hành chính xem") và "E2-S4 chép lại" (seed phiếu kỳ trước bằng API admin/SQL trong setup).
- [ ] **Step 5: Commit** — `feat(web): món ngoài danh mục, chép lại tháng trước, xử lý hết hạn`.

### Task 13: Web member — Lịch sử và chi tiết kỳ

**Files:**
- Create: `web/src/features/request/{history-page.tsx,history-detail-page.tsx,line-progress.tsx}`
- Modify: `web/src/shell/app-routes.tsx` (`/history`, `/history/:ym`), locales request
- Test: `history-page.test.tsx`, `history-detail-page.test.tsx`

**Interfaces:**
- Consumes: `GET me/requests`, `GET me/request?ym=`.
- Produces: danh sách kỳ (mới trước, "Xem thêm" theo cursor): tháng, "n loại món · m đơn vị", trạng thái giao "Đã giao đủ" / "Còn nợ k" / "Chưa giao", số món ngoài DM theo trạng thái; chi tiết kỳ chỉ đọc (FR-25): mỗi dòng thanh tiến độ `delivered/qty` (`line-progress`), dòng ngoài DM nhãn "Chờ Hành chính xem" / "Đã chấp nhận" / "Đã thêm vào danh mục" / "Từ chối: <lý do>", dòng có hủy nợ "đã hủy n"; kỳ đang mở trong lịch sử dẫn về `/`.
- [ ] **Step 1: Test** — trạng thái giao tính đúng từ số liệu; lý do từ chối hiển thị; trống → "Chưa có phiếu nào" + nút về trang Đăng ký.
- [ ] **Step 2–4:** FAIL → Implement → PASS; Playwright "E2-S6 lịch sử" 390 (vào bằng bottom nav "Lịch sử" ≤ 2 chạm).
- [ ] **Step 5: Commit** — `feat(web): lịch sử phiếu và chi tiết kỳ`.

### Task 14: Web admin — Tổng hợp kỳ

**Files:**
- Create: `web/src/features/summary/{summary.api.ts,summary-page.tsx,kpi-strip.tsx,person-table.tsx,item-table.tsx,unregistered-copy.tsx,summary.css}`, `web/src/ui/month-switcher.tsx`, `web/src/locales/{vi,en}/summary.ts`
- Modify: `web/src/shell/admin-nav.ts` (`ADMIN_HOME = 'summary'`, mục summary hết "Sắp có"), `app-routes.tsx`
- Test: `summary-page.test.tsx`, `unregistered-copy.test.tsx`

**Interfaces:**
- Consumes: Task 8 endpoints.
- Produces: đầu trang "Tổng hợp kỳ" + `MonthSwitcher` (‹ tháng ›, không vượt kỳ đang mở) + nhãn "Đang mở · hạn dd/mm" / "Đã khóa"; KPI 4 ô bấm-để-lọc: "Phiếu đã đăng ký x/y" (y kèm chú thích "tính tại lúc khóa"/"tính hiện tại" theo `headcount_source`), "Dòng chờ giao", "Món ngoài danh mục chờ xem" (→ `/admin/review`), "Món sắp hết" (→ `/admin/stock?filter=low`); bảng theo người nhóm theo phòng ban (hàng nhóm xám, "Chưa có phòng ban" cuối), tìm tên/email, cột: người, số món, tổng, thanh tiến độ giao 72 px, nhãn (Người đã nghỉ khi `user_status` ≠ active, "n món ngoài DM chờ xem"), nút "Điều chỉnh" (mở ngăn Task 15); chuyển "Theo món" → bảng món; nút phụ "Sao chép danh sách chưa đăng ký" → clipboard dạng `"Chưa đăng ký VPP tháng 11 (hạn 23:59 ngày 10/11):\n- Tên — Phòng ban\n…"` + thông báo "Đã sao chép n người".
- [ ] **Step 1: Test** — KPI hiển thị `32/40`; bấm KPI "Dòng chờ giao" → gọi API `filter=pending_delivery`, ô viền xanh; sao chép tạo đúng văn bản (mock `navigator.clipboard`); tháng tương lai bị khóa nút ›.
- [ ] **Step 2–4:** FAIL → Implement → PASS; Playwright "E3-S2 tổng hợp" 1280/390 (seed 2 phiếu + 1 người chưa đăng ký).
- [ ] **Step 5: Commit** — `feat(web): trang Tổng hợp kỳ`.

### Task 15: Web admin — ngăn điều chỉnh và tạo phiếu hộ

**Files:**
- Create: `web/src/features/summary/{adjust-drawer.tsx,adjust-lines.tsx,add-line-picker.tsx,create-request-dialog.tsx,use-adjust.ts}`, `web/src/ui/drawer.tsx`
- Modify: `summary-page.tsx`, locales summary
- Test: `adjust-drawer.test.tsx`, `create-request-dialog.test.tsx`, `ui/drawer.test.tsx`

**Interfaces:**
- Consumes: `GET admin/requests/:id`, `PUT admin/requests/:id/lines`, `POST admin/requests`, `GET items` (admin thấy cả `admin_only`), `UserPicker` (`features/directory/`), hộp review Task 16 (`ReviewActions` component).
- Produces: ngăn 520 px (Radix Dialog dạng drawer, 100 % ở 390): tiêu đề người + kỳ + nhãn trạng thái kỳ; danh sách dòng với stepper (cận dưới = `delivered_qty + cancelled_qty`, chú thích "đã giao n"), dòng đã sửa nền xanh nhạt + giá trị cũ gạch ngang, nút × (ẩn khi không xóa được); "Thêm món" (tìm trong danh mục, gồm món chỉ Hành chính); khối dòng ngoài DM viền đứt chứa `ReviewActions` (áp dụng ngay, tách khỏi Lưu); ô "Lý do điều chỉnh" (bắt buộc khi kỳ đã khóa; ≥ 3 ký tự); chân "Hủy" / "Lưu điều chỉnh" (vô hiệu khi không có thay đổi); (Review Focus 5) `STALE_UPDATE` → tải lại dữ liệu ngăn, **giữ lý do đã gõ**, báo "Nhân viên vừa sửa phiếu này — dữ liệu đã được tải lại"; `QTY_BELOW_DELIVERED` → lỗi tại dòng. Tạo hộ (nút trên trang tổng hợp khi kỳ đang mở): chọn người (`UserPicker`, chỉ active), chọn món + số lượng, Lưu → `POST admin/requests`; `REQUEST_EXISTS` → "Người này đã có phiếu — mở Điều chỉnh".
- [ ] **Step 1: Test** — kỳ khóa: Lưu vô hiệu khi lý do trống; stepper không xuống dưới số đã giao; Hủy sau khi sửa → hỏi bỏ thay đổi; 409 STALE → dữ liệu mới + lý do còn; thêm món admin_only gửi body đúng; tạo hộ `REQUEST_EXISTS` → thông báo + nút mở ngăn.
- [ ] **Step 2–4:** FAIL → Implement → PASS; Playwright "E3-S3 điều chỉnh sau hạn" (đồng hồ: api dev không có `CLOCK_OFFSET_MS` — dùng phiếu kỳ trước đã khóa seed bằng SQL) và "E3-S4 tạo hộ".
- [ ] **Step 5: Commit** — `feat(web): ngăn điều chỉnh phiếu, tạo phiếu hộ`.

### Task 16: Web admin — Món ngoài danh mục

**Files:**
- Create: `web/src/features/review/{review.api.ts,review-page.tsx,review-actions.tsx,convert-dialog.tsx,reject-dialog.tsx,review.css}`, `web/src/locales/{vi,en}/review.ts`
- Modify: `admin-nav.ts` (mục review hết "Sắp có"), `app-routes.tsx`
- Test: `review-actions.test.tsx`, `convert-dialog.test.tsx`, `review-page.test.tsx`

**Interfaces:**
- Consumes: `GET admin/review`, `POST admin/lines/:id/review`, `ItemForm` phần trường (`features/catalog/item-form.tsx` — tách phần trường dùng chung nếu cần), `ImageField`, `UnitSelect`.
- Produces: `ReviewActions` props `{line, onDone(updatedLine)}` — 3 nút mở hộp riêng, áp dụng ngay: "Chấp nhận" (xác nhận ngắn), "Thêm vào danh mục…" (form món điền sẵn tên/ĐVT/ảnh của dòng, chọn "món có sẵn" hoặc "món mới"; cảnh báo vàng khi ĐVT khác dòng gốc), "Từ chối…" (ô lý do riêng, bắt buộc); sau xử lý khối đổi thành nhãn trạng thái; `LINE_ALREADY_REVIEWED` → "Dòng này vừa được xử lý" + làm mới. Trang `/admin/review`: lọc theo trạng thái (mặc định Chờ xem) và kỳ, thẻ dòng (ảnh lớn, tên, ĐVT, SL, ghi chú, người, phòng ban, nhãn "Đã chấp nhận kỳ trước → nên Thêm vào danh mục" khi `previously_accepted`).
- [ ] **Step 1: Test** — Từ chối trống lý do → nút vô hiệu; convert món mới gửi body đúng (dùng ảnh dòng khi không đổi ảnh); ĐVT khác → cảnh báo; 409 → thông báo + refetch; nhãn `previously_accepted`.
- [ ] **Step 2–4:** FAIL → Implement → PASS; Playwright "E3-S5 món ngoài danh mục" (member tạo dòng ngoài DM → admin Thêm vào danh mục → member thấy "Đã thêm vào danh mục" và món mới trong lưới).
- [ ] **Step 5: Commit** — `feat(web): xử lý món ngoài danh mục`.

### Task 17: Smoke Plan 2, bản đồ, README

**Files:**
- Create: `web/playwright/p2-flow.spec.ts`
- Modify: `docs/map.md` (requests, periods, request, summary, review → ✅), `README.md` (luồng tháng trên dev, cách giả lập kỳ: api e2e dùng `CLOCK_OFFSET_MS`; dev UI dùng phiếu kỳ trước seed SQL), `docs/plans/2026-10-28-vpp-gd1.md` (P2 ✅)
- [ ] **Step 1: Smoke tuần tự** (1280 và 390, dữ liệu hậu tố duy nhất, dọn trong `finally`): member A đăng ký 2 món + 1 món ngoài DM có ảnh → lưu → member B lưu 1 món → admin (SA thật qua `PW_SA_PASSWORD`, hoặc dev admin nếu biến trống) mở Tổng hợp: `2/…`, sao chép danh sách chưa đăng ký có tên member C → mở ngăn A, thêm Giấy A4, Lưu → Thêm vào danh mục dòng ngoài DM của A → member A tải lại: dòng "Hành chính thêm" chỉ đọc, dòng ngoài DM "Đã thêm vào danh mục" → member A Lịch sử thấy kỳ hiện tại.
- [ ] **Step 2: Kiểm tra đầy đủ** (dán output vào report): api `npm test && npm run test:e2e && npm run test:db`, `npm audit --omit=dev`; web `npm test && npm run lint && npm run build`; `npx playwright test`; `docker compose up -d --build` → `/api/health` 200; `grep -ri qlts api web --exclude-dir=node_modules | wc -l` → 0; chuỗi cứng: `grep -rlP "[ăâđêôơưàảãáạ]" web/src --include=*.tsx --exclude-dir=locales --exclude='*.test.tsx' | xargs -r grep -nP "^(?!\s*//).*[ăâđêôơưàảãáạ]" | wc -l` → 0; không file nào > 400 dòng (`find api/src web/src -name '*.ts*' | xargs wc -l | sort -n | tail -3`).
- [ ] **Step 3: Commit** — `chore: smoke Plan 2, bản đồ, README` → dừng, báo chủ dự án review toàn nhánh.
