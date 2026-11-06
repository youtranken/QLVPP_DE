# Plan v2-D — Góp ý Hành chính (cảnh báo lệch số, Gửi ADM bản đã gửi, Còn nợ/Chưa nhận, Tủ theo người chờ)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hành chính chạy một tháng theo "Luồng chuẩn" (khóa sổ → sửa số tổng ở Gửi ADM → In trình ký → Hàng về đối chiếu bản in → Giao từ tủ), mỗi bước có cảnh báo lệch số, chỉ thao tác trên kỳ đã khóa, với Còn nợ = nợ tháng trước và Chưa nhận = tháng đang giao.

**Architecture:** 6 migration forward-only (0113–0118) và một lớp phân loại route `/admin/*` (by-ym / by-id / sql-filter / open-progress / none) dựa trên `isLocked(ym, now) ⇔ ym < openPeriod(now).ym`. Số liệu dùng chung một hàm server + một bản web (`defaultOrder`, `diffOf`, `adm_owed`); vòng đời phiếu gửi ADM là một bảng trạng thái (R-D5.19) mà mọi trang đọc qua `GET /admin/reports/:ym/sent`. Web: một thành phần cảnh báo `DiffNote`, một panel phủ, một hộp giao; các trang đổi theo 5 đợt.

**Tech Stack:** NestJS + raw SQL (`tx.execute(sql\`…\`)`), class-validator, Jest unit/e2e/db-spec; React 19, TanStack Query, react-router 7, i18next, Radix Dialog, vitest + Testing Library, Playwright + axe.

**Spec:** `docs/specs/2026-11-06-v2d-gop-y-hanh-chinh.md` (vòng 4, đã khóa) — quy tắc `R-D<n>.<m>`, tiêu chí AC theo bảng từng mục. Thẩm quyền cao hơn: `docs/specs/2026-11-06-v2d-chot-cua-chu.md` Đ0a–Đ46 + "Luồng chuẩn". Kịch bản tham chiếu: `docs/specs/2026-11-06-v2d-kich-ban-chuan.md` (mục K của spec ghi quy tắc cho từng bước B1–B34).

**Điều kiện đầu:** nhánh `feat/giao-dien-v2d` tách từ `fa37670` (đầu Plan v2-C). Migration mới nhất trên nhánh: `0112_config_signature_boxes.sql`.

## Global Constraints

- Nhánh `feat/giao-dien-v2d`. **Không push.** Commit tiếng Việt, tiền tố `feat/fix/chore/docs/test`, `git add <đường dẫn>` từng tệp. Mỗi commit kết thúc bằng:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01PxHHN6ZhknX8DPD2HSkmgy
  ```
- **Không bao giờ stage:** `docs/review-spec.md`, `docker-compose.override.yml`, `.claude/`, `.playwright-mcp/`, `PRODUCT.md`, `design-preview/redesign/`, `live-real/`, `test-accounts.local.md`, `.env`.
- Kích thước: **file ≤ 400 dòng** (kể cả test; chạm 350 thì tách trước), hàm ≤ 50, component React ≤ 250; `npx madge --circular` = 0 (api `src`, web `src`).
- CSS: tiền tố `[data-shell='admin']` (member: `[data-shell='member']`), cỡ chữ thuộc `--t-*`, khoảng cách thuộc `--s-*` (lint `web/scripts/check-css-scale.mjs`); không chữ cứng trong TSX (`web/scripts/check-hardcoded-text.mjs`).
- i18n: mọi chuỗi qua key `<feature>.<man>.<ten>`, thêm **cả vi và en** trong cùng commit; chữ tiếng Việt đúng nguyên văn spec (bảng i18n từng mục, danh mục W1–W25 R-D17.3).
- **Comment ít, không ghi chú kiểu nhật ký:** không "R-D…", "Đ…", "task …", "review …" trong comment mã; chỉ một dòng *tại sao* khi khác thường.
- Lỗi API `{code, message, …}`; mã mới thêm vào `docs/architecture.md` §7 cùng commit. Thời gian nghiệp vụ chỉ từ `ClockService` (đọc một lần mỗi request); không `now()` Postgres cho luật kỳ.
- Mutate có audit `AuditWriterService.appendWithin` trong cùng giao dịch (before/after); idempotent hoặc `expected_*`. Thứ tự khóa requests → request_lines → items.
- Migration SQL thuần, forward-only, **không sửa tệp đã apply**; một migration một chủ đề.
- **Playwright chạy trên DB dev chung** (Đ35): mọi spec tự tạo dữ liệu tên `PW …` / sub `pw-…`, chỉ ghi lên dữ liệu đó, dọn trong `finally`; không tra món/kỳ/bản chốt có sẵn của dev (R-D9.5). Dữ liệu bẩn → `web/playwright/cleanup-dev-data.sql` (R-D9.7).
- Playwright: 1280 + 390, axe 390 không lỗi tương phản; kiểm bằng `getByRole`/`getByLabel`/chữ tiếng Việt; tên test mới tiền tố `V2D-<task>`; không giả đồng hồ trình duyệt (luật giờ kiểm ở e2e với `CLOCK_OFFSET_MS`).
- `docs/map.md` cập nhật cho module chạm tới, trong commit cuối của task.

## Cổng mỗi task (theo `CLAUDE.md`)

Áp cho mọi task: TDD RED → GREEN có output; **biên hai phía** ở tầng rẻ nhất (unit → db-spec → e2e → Playwright) với bảng biên → tầng trong báo cáo; DoD trước commit: api `npm test && npm run test:e2e && npm run test:db && npm run build`, web `npm test && npm run lint && npm run build` — xanh, output sạch. Trong một đợt các task làm liền (Đ46); review độc lập và Playwright full chạy **một lần ở cổng đợt**. Task có giao diện: kiểm live 1280 + 390 bằng Playwright MCP, ảnh để `live-real/v2d/<task>/` (không commit).

## Review Focus

1. **Mốc khóa sổ đúng tới ms trên cả ba hiệu ứng cùng lúc** (16:59:59.999Z / 17:00:00.000Z): phần Chưa nhận thành Còn nợ, tự hủy ADM hết hàng (R-D11.19), ghi `headcount_subs` — một lần chạy cron, chạy lại không đổi. Test: Task 5 `V2D-5 lock boundary settles once`.
2. **Hai Hành chính cùng lúc ở Gửi ADM**: một người bấm "Tháng này không cần đề nghị ADM" trong khi người kia In trình ký. Kỳ không được vừa có bản vừa có cờ. Test: Task 4 `Promise.all(no-order, snapshot)` → đúng một thắng, trạng thái cuối nhất quán (bản có hàng ⇒ cờ NULL).
3. **Bản chốt cũ thiếu trường mới** (`order_basis`, `replaces`, `order_qty` net kiểu cũ, bản rỗng): mọi trang đọc được, không vỡ, không thành "mới nhất". Test: Task 4 fixture JSON cũ → `GET …/sent`, print, xlsx 200.
4. **Khóa ngoài DM trong URL** (`custom:["kéo cắt","cái"]` có ngoặc, dấu, khoảng trắng) ở `PUT/DELETE …/adm-out/:line_key`, `…/adm-owed-closed/:line_key`. Test: Task 5 key mã hóa `encodeURIComponent` → 200, key hỏng → 400 `VALIDATION`.
5. **Danh sách dài trong hộp** (hộp Lưu Hàng về W15 > 8 món, hộp bản thay thế > 10 món, chuông ngày gộp nhiều dòng): cắt "và n món khác", không tràn ở 390. Test: Task 8 và Task 6 với 12 món.

---

# Đợt 1 — Dữ liệu/API

### Task 0: Ổn định Playwright E3-S5 (ảnh thẻ món ngoài danh mục)

**Rules:** — (hạ tầng test; không đổi sản phẩm trừ khi tìm ra lỗi thật).

**Vấn đề:** `web/playwright/review.spec.ts:40` (E3-S5) chập chờn ở `desktop-1280`: đứng một mình thì qua, rớt 2 lần chạy full. Chỗ chờ là `expect.poll(() => photo.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true)` (`review.spec.ts:69-70`) với hạn mặc định 5 s, trong khi ảnh dòng phải qua `/api/files/:id` (DB dev chung, chạy tuần tự sau nhiều spec).

**Files:**
- Modify: `web/playwright/review.spec.ts:66-72` (chỉ phần chờ ảnh); helper `waitForImageLoaded` trong `web/playwright/helpers.ts`
- Test: chính `review.spec.ts`

**Interfaces:**
- Produces: `waitForImageLoaded(page: Page, img: Locator, fileId: string, timeoutMs = 20_000): Promise<void>` — đăng ký `page.waitForResponse(r => r.url().includes(\`/api/files/${fileId}\`) && r.ok())` **trước** hành động mở trang/thẻ, rồi `expect.poll(() => img.evaluate(e => e.complete && e.naturalWidth > 0), {timeout: timeoutMs}).toBe(true)`.

- [ ] **Step 1: Tái hiện** `npx playwright test review.spec.ts --project=desktop-1280 --repeat-each=10` sau một lượt full (hoặc cùng `catalog.spec.ts`, `p2-flow.spec.ts` chạy trước); ghi số lần rớt và kiểu lỗi (hết hạn poll / response 4xx-5xx / `naturalWidth 0`).
- [ ] **Step 2: Phân loại.** Response ảnh không `ok` hoặc không bao giờ đến → **lỗi thật**: dừng, viết test đỏ ở tầng đúng (e2e `/api/files/:id` cho ảnh dòng xem bởi admin) rồi mới sửa sản phẩm. Response `ok` nhưng chậm hơn 5 s → chỉ sửa test.
- [ ] **Step 3: Sửa test** dùng `waitForImageLoaded` (chờ response ảnh + `naturalWidth`, hạn 20 s); không `waitForTimeout`, không bỏ assert ảnh.
- [ ] **Step 4: Kiểm** `--repeat-each=20` ở `desktop-1280` và `mobile-390`, rồi 2 lượt Playwright full liên tiếp → 0 rớt.
- [ ] **Step 5:** Commit `test: E3-S5 chờ ảnh thẻ theo response và naturalWidth (hết chập chờn ở 1280)`.

Lưu ý thứ tự: Task 2 khiến Món ngoài danh mục chỉ xem kỳ đã khóa (R-D8.5), nên trong Task 2 E3-S5 phải chuyển sang gieo dòng ở kỳ khóa bằng `web/playwright/locked-request.ts` (giữ tên test, mọi assert và `waitForImageLoaded`).

### Task 1: Migration 0113–0118, script dọn dev, chính sách dữ liệu test

**Rules:** R-D6.7 (bảng), R-D8.17 (cột), R-D11.8, R-D11.12 (bảng), R-D11.21 (bảng), R-D5.21 (cột), R-D9.1, R-D9.3, R-D9.4, R-D9.5, R-D9.7, R-X.2.

**Files:**
- Create: `api/src/migrations/0113_request_line_adjustments.sql`, `0114_period_adm_out.sql`, `0115_stock_movements_receipt_ym.sql`, `0116_periods_headcount_subs.sql`, `0117_custom_receipts.sql`, `0118_periods_no_order.sql`
- Modify: `web/playwright/cleanup-dev-data.sql`, `web/playwright/helpers.ts` (`seedPwItem`), `README.md` (đoạn dọn dev)
- Test: `api/test/migrations-v2d.db-spec.ts`, `web/src/test/playwright-data-policy.test.ts`

**Interfaces:**
- Produces bảng/cột: `request_line_adjustments(id, batch_id, line_id, request_id, user_sub, period_ym, item_id, before_qty, after_qty, reason_code, reason_note, created_by, created_at)` không FK, CHECK `after_qty < before_qty`, CHECK `reason_code IN ('over_quota','adm_out_of_stock','duplicate','other','user_left')`, CHECK `reason_code <> 'other' OR char_length(btrim(reason_note)) >= 3`, `UNIQUE(batch_id, line_id)`; `period_adm_out(period_ym FK periods CASCADE, line_key text, kind text CHECK IN ('out','owed_closed') DEFAULT 'out', marked_by, marked_at, PK(period_ym, line_key, kind))`; `stock_movements.receipt_ym date` CHECK `receipt_ym IS NULL OR reason = 'purchase'` + backfill từ note `^Hàng về kỳ \d{4}-\d{2}`; `periods.headcount_subs text[]`; `custom_receipts(id uuid PK, period_ym FK, line_key, qty int CHECK > 0, note, created_by, created_at)`; `periods.no_order_at timestamptz, no_order_by text`.
- Produces helper PW: `seedPwItem(page, opts?: {stock?: number; group?: string}) => Promise<{id: string; name: string /* 'PW …' */}>`.

- [ ] **Step 1: Test đỏ** `migrations-v2d.db-spec.ts`: `it('0113 CHECK chỉ giảm: after 5 before 5 → 23514; after 4 → ok')`, `it('0113 other ghi chú "  ab " → 23514; "abc" → ok')`, `it('0113 UNIQUE(batch_id,line_id) lặp → 23505')`, `it('0115 backfill note "Hàng về kỳ 2026-10" → receipt_ym 2026-10-01; reason issue + receipt_ym → 23514')`, `it('0114 PK (ym, key, kind): out và owed_closed cùng key cùng tồn tại')`, `it('0117 qty 0 → 23514, 1 → ok')`.
- [ ] **Step 2:** `npm run test:db -- migrations-v2d` → FAIL (bảng không tồn tại).
- [ ] **Step 3:** Viết 6 migration như Interfaces.
- [ ] **Step 4:** Test xanh; `docker compose exec api npm run migrate` trên dev chạy 6 tệp không lỗi.
- [ ] **Step 5: Script dọn (R-D9.7)** — thêm trước `DELETE FROM requests`: xóa `request_line_adjustments` của `pw_lines` hoặc `user_sub LIKE 'pw-%'`; xóa `period_adm_out`/`custom_receipts` có `line_key` thuộc `pw_items` hoặc khóa custom của `pw_lines`; `UPDATE periods SET headcount_subs = ARRAY(SELECT x FROM unnest(headcount_subs) x WHERE x NOT LIKE 'pw-%'), headcount = cardinality(…) WHERE headcount_subs IS NOT NULL`. Kiểm Ops: gieo `pw-x` (phiếu khóa, 1 dòng giảm, 1 món PW `out`, có trong `headcount_subs`) → chạy 2 lần, 0 lỗi, 0 mồ côi, đếm dòng người/món thật trước = sau. Ghi lệnh dọn tay bản ghi Hàng về 2026-10 của admin dev vào `live-real/v2c/demo-seed.md` (không stage).
- [ ] **Step 6: Chính sách test (R-D9.5)** `playwright-data-policy.test.ts`: quét `web/playwright/*.spec.ts` — không chuỗi mã món dev (`B23`, `K05`), không `demo-d10`; mọi gọi ghi (`/stock/receipts`, `/deliver`, `/lines`, `/adm-out`, `/snapshots`, `/cancel-remaining`) nằm trong test có `seedPwItem`/`seedActiveUser`.
- [ ] **Step 7: Kiểm dev (R-D9.1, R-D9.3, R-D9.4)** bằng SQL chỉ đọc: 50 món active, 50 có ảnh, 5 nhóm; `stock_qty = 0` mọi món (trước khi chạy PW); demo `sub LIKE 'demo-d10-%'` tồn tại. Ghi kết quả vào báo cáo task, không đổi dữ liệu.
- [ ] **Step 8:** Commit `feat: migration v2-D (điều chỉnh, ADM hết hàng, receipt_ym, headcount_subs, hàng về ngoài DM, không đề nghị) + script dọn dev`.

### Task 2: Định nghĩa khóa duy nhất, bảng phân loại route, đếm đăng ký một tập, gỡ "Tạo phiếu hộ"

**Rules:** R-D8.1, R-D8.2, R-D8.3, R-D8.5, R-D8.7, R-D8.8, R-D8.9, R-D8.14, R-D8.15, R-D8.16, R-D8.17, R-D10.1–R-D10.9.

**Files:**
- Create: `api/src/modules/periods/admin-route-classes.ts`, `api/src/modules/periods/period-lock.ts`
- Modify: `api/src/modules/periods/periods.service.ts` (`assertLocked`), `api/src/modules/requests/line-predicates.ts` (`lockedPeriod`), `api/src/modules/requests/summary.service.ts:65-160`, `api/src/notifications/notification-scheduler.ts:124-126`, mọi service đọc phiếu theo bảng R-D8.5, `api/src/modules/requests/admin-requests.controller.ts:23` (xóa `@Post()`), `admin-request.service.ts`, `request.dto.ts`; web `features/summary/create-request-*.tsx` (xóa), `summary-actions.tsx`, `unregistered-table.tsx`, `use-user-search`, locales
- Test: `api/test/route-classes.e2e-spec.ts`, `api/test/period-lock.e2e-spec.ts`, `api/test/headcount.e2e-spec.ts`, `api/test/headcount.db-spec.ts`, `api/test/create-on-behalf-removed.e2e-spec.ts`, `api/src/modules/periods/period-lock.spec.ts`

**Interfaces:**
- Produces: `isLocked(ym: string, now: Date): boolean`; `openPeriod(now: Date): {ym: string; deadline: Date}` (đã có trong `api/common/period.ts`, dùng lại); `PeriodsService.assertLocked(ym: string, now: Date): void` → 409 `PERIOD_NOT_LOCKED {ym, deadline}` / 400 `INVALID_PERIOD`; `PeriodsService.assertLineLocked(tx, lineId, now)`; `lockedPeriod(openYm: string): SQL` (`r.period_ym < ${openYm}::date`); `type RouteClass = 'by-ym'|'by-id'|'sql-filter'|'open-progress'|'none'`; `ADMIN_ROUTE_CLASSES: Record<\`${Method} ${string}\`, RouteClass>`.
- Produces `GET /admin/periods/:ym/summary` thêm `outside: number`, `headcount_source: 'snapshot'|'live'`; bất biến `registered + unregistered = headcount`.

- [ ] **Step 1: Test đỏ**
  - `period-lock.spec.ts`: `isLocked('2026-11', 2026-11-10T16:59:59.999Z) === false`, `…17:00:00.000Z === true`; qua năm `2027-01` với `registration_last_day = 5`.
  - `route-classes.e2e-spec.ts`: duyệt `app.getHttpAdapter().getInstance()._router.stack`, mọi route `/api/admin/*` có trong `ADMIN_ROUTE_CLASSES` (thiếu → fail, liệt kê tên); mỗi route `by-ym`/`by-id` gọi trên fixture kỳ mở → 409 `PERIOD_NOT_LOCKED`.
  - `headcount.e2e-spec.ts` `V2D-2 10/8 reproduced`: S lúc khóa 8 người (6 có phiếu) + chèn sau khóa 2 phiếu ngoài S + 1 phiếu `LOCAL_SA` → `{registered: 6, headcount: 8, unregistered: 2, outside: 2}`; vòng lặp 5 fixture kiểm bất biến.
  - `headcount.db-spec.ts`: cron khóa ghi `headcount_subs` (độ dài = `headcount`), chạy lại không ghi đè; kỳ không mảng → `headcount_source 'live'`.
  - `create-on-behalf-removed.e2e-spec.ts`: `POST /api/admin/requests` → 404 `NOT_FOUND` với 4 vai × CSRF có/không; `GET /admin/directory?exclude_admin=1` → 200 (bị lột).
- [ ] **Step 2:** Chạy → FAIL đúng lý do.
- [ ] **Step 3:** Hiện thực; gắn guard theo bảng R-D8.5 (29 bề mặt); summary đếm từ một tập S (`headcount_subs ?? live`), bỏ `LOCAL_SA_SUB`; cron ghi mảng cùng giao dịch `recordHeadcount`; `ITEM_IN_USE` chữ mới; kỳ 0 phiếu (R-D8.16). Gỡ Tạo phiếu hộ theo R-D10.1–R-D10.9 (web: nút chính Tổng hợp thành "Sang Gửi ADM →" `/admin/send-adm?ym=`; `UnregisteredTable` 2 cột; xóa `exclude_admin`; docs §7).
- [ ] **Step 4:** api + web xanh; `grep -rn "createOnBehalf\|exclude_admin\|insertOnBehalf" api/src web/src` = 0.
- [ ] **Step 5:** Commit `feat: một định nghĩa khóa sổ + phân loại route admin + đếm đăng ký một tập; gỡ Tạo phiếu hộ`.

### Task 3: Điều chỉnh phiếu có lý do từng dòng (server) + chuông ngày

**Rules:** R-D6.1–R-D6.10, R-D6.13, R-D6.15–R-D6.21, R-D8.13, R-D8.20 (API).

**Files:**
- Create: `api/src/modules/requests/line-adjustments.repo.ts`, `api/src/modules/requests/adjust-rules.ts`
- Modify: `request.dto.ts` (`AdjustLineDto`), `admin-request.service.ts`, `request-lines.writer.ts` (đọc lại clock trước ghi), `api/src/notifications/notifications.service.ts` (`upsertWithin`), `summary-lists.service.ts` (`over_max`)
- Test: `api/test/adjust.e2e-spec.ts`, `api/test/adjust.db-spec.ts`, `api/src/modules/requests/adjust-rules.spec.ts`

**Interfaces:**
- Consumes: `PeriodsService.assertLocked` (Task 2), bảng 0113 (Task 1).
- Produces: `PUT /admin/requests/:id/lines` body `{expected_updated_at, lines: [{id, qty, expected_qty, reason_code?, reason_note?}]}` (không còn `reason` cấp phiếu, không dòng mới); lỗi theo thứ tự R-D6.20: `VALIDATION → REQUEST_NOT_FOUND → PERIOD_NOT_LOCKED → STALE_UPDATE → LINE_MISSING → LINE_ADD_FORBIDDEN/QTY_INCREASE_FORBIDDEN → QTY_BELOW_DELIVERED → REASON_REQUIRED`.
- Produces: `NotificationsService.upsertWithin(tx, {eventId: string, userSub: string, kind: 'line_adjusted', params: object, now: Date})`; `eventId = \`line_adjusted:${sub}:${ym}:${vnDate(now)}\``; `params` tính lại từ mọi bản ghi của người/kỳ/ngày, **bỏ** dòng `user_left`; kèm hủy `adm_out_of_stock` (Task 5 gọi cùng hàm).
- Produces: `GET /admin/periods/:ym/requests` dòng thêm `max_qty`, `over_max: boolean`.

- [ ] **Step 1: Test đỏ** `adjust-rules.spec.ts`: ghi chú NFC + trim, 200 mã điểm ok / 201 → `VALIDATION`; `other` "ab" → `REASON_REQUIRED`, "abc" ok; `user_left` không ghi chú ok. `adjust.e2e-spec.ts`: 5→6 `QTY_INCREASE_FORBIDDEN`; dòng không id `LINE_ADD_FORBIDDEN`; vắng dòng `LINE_MISSING`; `lines: []` trên 2 dòng → `LINE_MISSING` dòng đầu; sàn `delivered+cancelled`; kỳ mở 16:59:59.999Z 409 / 17:00:00.000Z 200; 1 chuông/ngày (23:59:59.999 và 00:00:00.000 giờ VN ra hai `event_id`); người đã nghỉ 0 chuông; chỉ `user_left` → 0 chuông; `user_left` + `over_quota` → params chỉ có `over_quota`; giảm về đúng số đã giao → không chuông "giao đủ"; bỏ hết dòng → phiếu giữ 0 dòng; lưu sát giờ khóa (R-D8.13) → 409. `adjust.db-spec.ts`: `Promise.all` hai HC cùng `expected_qty` → một 200, một `STALE_UPDATE`; `batch_id` = id `audit_log`.
- [ ] **Step 2–4:** FAIL → hiện thực → xanh.
- [ ] **Step 5:** Commit `feat: điều chỉnh phiếu kỳ khóa có lý do từng dòng, chuông gộp theo ngày`.

### Task 4: Số đề nghị, bản chốt có hàng, vòng đời Gửi ADM (server)

**Rules:** R-D13.1–R-D13.3, R-D13.8–R-D13.11, R-D17.1 (api), R-D5.9, R-D5.11, R-D5.16, R-D5.19 (server), R-D5.20 (server), R-D5.21 (server), R-D5.22 (API), R-X.1 (server), R-D3.6 (API), R-D17.9 (API).

**Files:**
- Create: `api/src/modules/reports/order-default.ts`, `api/src/modules/reports/sent-snapshot.ts`, `api/src/modules/reports/no-order.controller.ts`, `api/src/modules/reports/changed-after.ts`
- Modify: `report-need.ts` (`wantOf`, `diffOf`), `order-qty.ts:24-26`, `snapshots.service.ts:44-60`, `snapshot.dto.ts`, `report.types.ts` (`@deprecated need`, `order_basis`, `replaces`), `reports.service.ts`, `review.service.ts` (`in_sent_snapshot`, `in_sent_snapshot_qty`), `backlog.service.ts` (`counted_in_snapshot_qty`), `items-admin.controller.ts` (`GET :id/pending-arrival`)
- Test: `api/src/modules/reports/order-default.spec.ts`, `api/test/snapshot-lifecycle.e2e-spec.ts`, `api/test/snapshot-lifecycle.db-spec.ts`, `api/test/changed-after.e2e-spec.ts`

**Interfaces:**
- Produces: `wantOf(r) = r.requested + r.backlog_prev`; `defaultOrder(r: ReportRow & {adm_owed: number; left_excluded: number; usable: boolean}): number` = `usable ? max(0, requested_active + debt_active − adm_owed) : 0`; `diffOf({stock, order, adm_owed, need}): number` = `stock + order + adm_owed − need`; `admOwed(tx, ym, key): number` (R-D13.9; bằng 0 khi `period_adm_out` có `out` hoặc `owed_closed`).
- Produces: `hasItemsSql` = `EXISTS (SELECT 1 FROM jsonb_each_text(data->'order_qty') e WHERE e.value::int > 0)`; `GET /admin/reports/:ym/sent` → `{id, kind, created_at, items_count, units_total, replaces: {id, created_at} | null, data}` | 404 `NO_SENT_SNAPSHOT`; `GET …/snapshots` mỗi bản thêm `has_items, items_count, units_total`.
- Produces: `POST /admin/reports/:ym/snapshots {kind, reuse_if_unchanged?, order_qty}` → 201 tạo / 200 `reused` / 409 `ORDER_EMPTY`; khi tạo: `data.order_basis[key] = {requested, debt, adm_owed, left_excluded, discontinued}`, `data.replaces` khi `order_qty` khác bản có hàng trước (mọi `kind`); tạo bản thì `no_order_at = NULL`.
- Produces: `POST /admin/periods/:ym/no-order {order_qty}` → 200 / 409 `ORDER_NOT_EMPTY` / 409 `ALREADY_SENT`; `DELETE` → 204; audit `period.no_order`, `period.no_order_cleared`. `GET /admin/periods/:ym/send-state` → `{state: 'unsent'|'no_order'|'sent', no_order_at, no_order_by_name, sent: SentSnapshot | null, changed_after: boolean, changed_at: string | null}`.
- Produces: `changedAfter(tx, ym, since: Date): boolean` theo `audit_log.action ∈ {request.updated, line.cancel_remaining, line.review, arrival.adm_out_marked, arrival.adm_owed_closed}` + `requests.updated_at`, so `>` (bằng → false).
- Produces: `GET /admin/items/:id/pending-arrival` (`by-id`) → `{remaining, unit, snapshot_at} | {remaining: 0}`.

- [ ] **Step 1: Test đỏ** `order-default.spec.ts` bảng 12 ca dùng chung với web (`web/src/lib/report-qty.cases.json` — Task 6 dùng): đăng ký 8 + nợ 2, tủ 3 → 10; tủ 15 → 10; ADM nợ 4 → 6; món ngừng → 0; người nghỉ 3 không tính; `diffOf` tủ 2 cần 3 đề nghị 1 → 0, đề nghị 0 → −1, 3 → 2. `snapshot-lifecycle.e2e-spec.ts` `V2D-4 lifecycle` — 13 hàng của bảng chuyển R-D5.19, mỗi hàng một `it` (vd `'Đang làm bản mới + số trùng bản in mới nhất khác kind → xlsx không replaces'`); bản rỗng 09:23 mới hơn bản có hàng 22:12 → `sent.id` = 22:12; JSON bản cũ (thiếu `order_basis`/`replaces`, `order_qty` net 7) → `sent` 200, xuất lại vẫn 7. `snapshot-lifecycle.db-spec.ts`: `Promise.all(no-order, snapshot)` → trạng thái cuối không vừa có bản vừa có cờ. `changed-after.e2e-spec.ts`: T−1 ms / T / T+1 ms cho từng `action` → false/false/true.
- [ ] **Step 2–4:** FAIL → hiện thực → xanh. `in_sent_snapshot`: `true` khi khóa custom có `order_qty > 0` trong bản có hàng mới nhất, `false` khi không/0, `null` khi kỳ chưa có bản có hàng.
- [ ] **Step 5:** `docs/architecture.md` §7: `ORDER_EMPTY`, `ORDER_NOT_EMPTY`, `ALREADY_SENT`, `NO_SENT_SNAPSHOT` (bỏ `REPORT_EMPTY`). Commit `feat: số đề nghị mặc định gộp (trừ ADM còn nợ, người nghỉ, món ngừng), bản chốt có hàng, vòng đời Gửi ADM`.

### Task 5: Hàng về theo bản in, ADM hết hàng, về bù kỳ trước, hàng về ngoài DM (server)

**Rules:** R-D11.6, R-D11.7, R-D11.9, R-D11.10, R-D11.11, R-D11.12, R-D11.13 (API), R-D11.14 (API), R-D11.19, R-D11.20 (API), R-D11.21 (API), R-D13.9 (dùng).

**Files:**
- Create: `api/src/modules/catalog/arrivals-plan.service.ts`, `api/src/modules/catalog/adm-out.controller.ts`, `api/src/modules/catalog/adm-out.service.ts`, `api/src/modules/catalog/custom-receipts.service.ts`, `api/src/notifications/adm-out-settlement.ts`
- Modify: `stock-receipt.service.ts` (`receipt_ym`, món ngừng có trong bản in), `delivery/cancel-remaining.service.ts` (`reason_code adm_out_of_stock`), `notification-scheduler.ts` (gọi settlement trong giao dịch khóa), `delivery-people.service.ts` (`adm_out`, trần dòng ngoài DM)
- Test: `api/test/arrivals-plan.e2e-spec.ts`, `api/test/adm-out.e2e-spec.ts`, `api/test/adm-out-settlement.e2e-spec.ts`, `api/test/makeup-receipts.e2e-spec.ts`, `api/test/custom-receipts.e2e-spec.ts`

**Interfaces:**
- Consumes: `sent-snapshot.ts`, `admOwed` (Task 4); `upsertWithin` (Task 3).
- Produces: `GET /admin/periods/:ym/arrivals-plan` → `{snapshot | null, batches: [{at, actor_name, items, units, note}], rows: [{item_id, key, code, name, name_en, unit, category_id, image_file_id, ordered, received, remaining, stock_qty, usable, inactive_reason, adm_out, adm_out_final, reduced_after_snapshot}], custom: [{key, name, unit, ordered, received, remaining, adm_out}], makeup: [{ym, rows: [{key, name, unit, ordered, received, adm_owed}]}]}`.
- Produces: `PUT|DELETE /admin/periods/:ym/adm-out/:line_key` (409 `ADM_OUT_NOTHING_OPEN`, `ADM_OUT_FINAL`); `PUT|DELETE /admin/periods/:ym/adm-owed-closed/:line_key` (audit `arrival.adm_owed_closed`); `POST /admin/periods/:ym/custom-receipts {line_key, qty, note?}` (audit `arrival.custom_received`); `POST /admin/stock/receipts {ym, lines, …}` nhận `ym` = bất kỳ kỳ khóa có kế hoạch; 409 `ITEM_ADM_OUT`.
- Produces: `POST /admin/lines/:id/cancel-remaining {reason_code: 'adm_out_of_stock', expected_delivered_qty, expected_qty}` → 409 `ITEM_NOT_ADM_OUT` nếu khóa không đánh dấu; chuông qua `upsertWithin` (không `line_cancelled`).
- Produces: `settleAdmOut(tx, lockedYm: string, now: Date): {lines: number; units: number}` gọi trong giao dịch khóa kỳ `lockedYm + 1`; audit `arrival.adm_out_settled`.

- [ ] **Step 1: Test đỏ** `arrivals-plan`: nguồn = bản có hàng mới nhất (`created_at DESC, id DESC`); `ordered = order_qty[key]`; `received` nhiều đợt cùng `receipt_ym`; chưa có bản → `snapshot null`, `ordered = wantOf`; món ngừng có trong bản in nhập 3 → 201, không trong bản in → 404 `ITEM_NOT_FOUND`. `adm-out`: đánh khi không còn dòng mở → `ADM_OUT_NOTHING_OPEN`; bỏ khi đã xử lý xong → `ADM_OUT_FINAL`; `PUT` lặp 200; nhập qty > 0 cho món đang đánh → `ITEM_ADM_OUT`; key custom mã hóa (Review Focus 4). `adm-out-settlement` `V2D-5 lock boundary settles once`: 16:59:59.999Z còn 2; 17:00:00.000Z hủy 2 `adm_out_of_stock`, không ở backlog, không vào đề nghị kỳ sau, `headcount_subs` ghi cùng lần; chạy lại → 0 thay đổi. `makeup-receipts`: kỳ 12 đặt BB 7 về 3 → kỳ 01 `makeup` BB 4; nhập 4 với `ym 2026-12` → `received` kỳ 12 = 7; `adm-owed-closed` → `admOwed` 0, đề nghị kỳ 01 cộng 4; `DELETE` → trừ lại. `custom-receipts`: "Đã về" 1 → trần giao dòng đăng ký trước 1; khóa không trong bản in → trần = còn lại.
- [ ] **Step 2–4:** FAIL → hiện thực → xanh.
- [ ] **Step 5:** Commit `feat: kế hoạch Hàng về theo bản in, ADM hết hàng (tự hủy lúc khóa kỳ sau), về bù kỳ trước, hàng về ngoài danh mục`.

### Batch gate 1

- [ ] **Review đợt** (một reviewer độc lập đọc diff Task 1–5 cùng spec): R-D5.9, 5.11, 5.16, 5.19–5.22 (server), R-D6.1–6.10, 6.13, 6.15–6.21, R-D8.1–8.3, 8.5, 8.7–8.9, 8.13–8.17, 8.20 (API), R-D9.1, 9.3–9.5, 9.7, R-D10.1–10.9, R-D11.6–11.14 (API), 11.19–11.21 (API), R-D13.1–13.3, 13.8–13.11, R-D17.1, R-D17.9 (API), R-X.1 (server). Mỗi quy tắc: có test hai phía mốc, mã lỗi trong §7, audit có before/after. Critical/Important sửa trong đợt.
- [ ] **Playwright full một lần:** `cd web && npx playwright test` (cả 2 project) — xanh; số dòng `requests`/`stock_movements` của người/món **không** `pw-`/`PW` không đổi (đếm trước/sau).
- [ ] **Commit list:** 6 commit Task 0–5 (+ commit sửa review nếu có), mỗi commit có trailer. E3-S5 phải xanh trong lượt full này.

---

# Đợt 2 — Gửi ADM + Hàng về

### Task 6: Thành phần cảnh báo + Gửi ADM hai chế độ (Lập phiếu / Đã gửi / Không cần đề nghị)

**Rules:** R-D17.2, R-D17.3, R-D17.4, R-D17.5, R-D17.1 (web), R-D5.7, R-D5.8, R-D5.13, R-D5.14, R-D5.17, R-D5.19 (web), R-D5.20 (hộp), R-D5.21 (web), R-D5.22 (web), R-D13.4, R-D13.5, R-D13.10 (nhãn), R-D13.11 (dòng xám), R-X.1 (băng).

**Files:**
- Create: `web/src/ui/feedback/diff-note.tsx` + test, `web/src/lib/report-qty.ts` (`wantOf`, `diffOf`, `defaultOrder`), `web/src/lib/report-qty.cases.json`, `web/src/locales/{vi,en}/warnings.ts`, `features/send-adm/send-adm-sent.tsx`, `send-adm-draft.tsx`, `send-adm-no-order.tsx`, `order-cell.tsx`, `use-send-state.ts`, `send-adm-dialogs.tsx`
- Modify: `features/send-adm/send-adm-page.tsx` (chỉ điều phối chế độ), `send-adm-rows.ts:43`, `send-adm-orders.tsx:51,68`, `request-form-preview.tsx` (thu vào nút), locales `send-adm.ts`, `reports.ts:43-45,127`
- Test: `features/send-adm/send-adm-modes.test.tsx`, `order-cell.test.tsx`, `web/src/lib/report-qty.test.ts`, `web/src/test/warnings-copy.test.ts`, `web/playwright/send-adm.spec.ts`

**Interfaces:**
- Consumes: `GET …/send-state`, `GET …/sent`, `POST …/snapshots`, `POST|DELETE …/no-order` (Task 4).
- Produces: `DiffNote({d, order, unit}: {d: number; order: number; unit: string})` — tông `ok|short|surplus`, chữ W1a–W1d; `useSendState(ym): {state, sent, changedAfter, changedAt, noOrder}`; `OrderCell({row, value, onEdit, onReset})` chữ đậm chỉ đọc → "Sửa số" → `input inputmode="numeric"` (`appearance: textfield`, chặn `wheel`).

- [ ] **Step 1: Test đỏ** `report-qty.test.ts` chạy `report-qty.cases.json` (cùng tệp Task 4) → bằng nhau. `warnings-copy.test.ts`: `warnings.ts` vi có đủ W1a–W25 đúng chữ bảng R-D17.3 (so chuỗi). `order-cell.test.tsx`: không `input` tới khi bấm "Sửa số"; dòng xám "= 8 đăng ký + 2 nợ − 1 ADM còn nợ giao (tháng 11) · không tính 3 của người đã nghỉ"; sửa 12 → "Đã sửa: 12 (gợi ý 10)"; "Về số gợi ý" bỏ nhãn; lăn chuột không đổi số; W1: tủ 2 cần 3 đề nghị 1 "Đủ cho người đăng ký" / 0 "Thiếu 1 — 1 cuộn sẽ không có để giao" / 3 "Dư 2 vào kho" / tủ 5 đề nghị 0 "Tủ đã đủ — vẫn dư 2 vào kho". `send-adm-modes.test.tsx`: có bản → chế độ Đã gửi, bảng chỉ đọc theo `order_qty` của bản, "In lại bản này" 0 `POST`; "Làm bản mới" → hộp chữ R-D5.13 [r4] → Lập phiếu mang số đã sửa; tổng 0 chưa có bản → nút "Tháng này không cần đề nghị ADM" + hộp → `POST no-order`; tổng 0 đã có bản → không nút; hộp in bản thay thế liệt kê "Đổi so với bản 09:02 12/12: Bút bi 7 → 5" (12 món → 10 dòng + "và 2 món khác"); W2 đếm; W6 băng; W7 "Bản gửi 7 · nay cần 5 → dư 2 vào kho"; W8 trong hộp In; cột Đăng ký 5 / Đã giao 2 / công thức 3; hộp rời trang chữ R-D5.17.
- [ ] **Step 2–4:** FAIL → hiện thực → xanh. Chữ công thức R-D13.5; cột "Tổng cần", "Tủ hiện có (tham khảo)" (R-D13.4).
- [ ] **Step 5: PW** `send-adm.spec.ts` `V2D-6 draft→print→new draft` (món PW) 1280 + 390 + axe 390; 1024: dòng giới thiệu không bị cắt.
- [ ] **Step 6:** Commit `feat: Gửi ADM — số chỉ đọc + Sửa số, cảnh báo lệch số, bản đã gửi, bản thay thế, tháng không cần đề nghị`.

### Task 7: Báo cáo chỉ đọc, trang in bản thay thế/bản rỗng, bước Tháng này

**Rules:** R-D5.15, R-D5.16 (web), R-D5.18, R-D5.20 (tờ in, Excel), R-D5.22 (Báo cáo), R-D11.17, R-D13.6, R-D17.10 (W6), R-D13.2 (web Báo cáo).

**Files:**
- Delete: `features/reports/report-order-cell.tsx`; bỏ `use-order-qty` khỏi Báo cáo (giữ cho Gửi ADM)
- Modify: `reports-page.tsx`, `report-part1.tsx:47-95`, `report-snapshots.tsx`, `print-page.tsx`, `print-request-form.tsx`, `api/src/modules/reports/xlsx-request-form.ts` (dòng "Thay thế bản in lúc …"), `features/home/month-steps.ts:25-40`, `home-page.tsx:60-75`
- Test: `reports-page.test.tsx`, `print-page.test.tsx`, `month-steps.test.ts`, `api/src/modules/reports/xlsx-replaces.spec.ts`

**Interfaces:**
- Consumes: `useSendState` (Task 6), `GET …/sent`, `GET /admin/periods/:ym/arrivals-plan` (Task 5).
- Produces: `monthSteps(input): Step[]` — bước Gửi ADM `{done, value: 'Đã gửi 22:12 05/11 · 11 món, 78 đơn vị' | 'Không cần đề nghị ADM · …', changed: boolean}`; bước Hàng về `done` ⇔ (bản có hàng ∧ mọi `remaining = 0` hoặc bỏ qua) ∨ `no_order`.

- [ ] **Step 1: Test đỏ** Báo cáo: không `input`, không nút In trình ký/Xuất Excel mẫu; cột Đề nghị theo bản (ghi "Theo bản đã gửi 22:12 05/11") hoặc gộp ("Gợi ý, chưa gửi"); kỳ đã giao hết vẫn có phần 1 + "Đã về", "Đã giao"; liên kết "Sửa số đề nghị ở Gửi ADM →". Trang in bản rỗng: "Bản này không có món nào — không cần trình ký.", nút In vô hiệu; bản có `replaces` → dòng đầu "Thay thế bản in lúc 09:02 12/12" (web + xlsx đọc lại ô A1). `month-steps`: bản có hàng → giá trị đúng, bản rỗng → chưa xong; thay đổi sau bản → "Đã gửi 09:02 12/12 · có thay đổi sau đó"; `no_order` → hai bước xong; 1 đợt về còn `remaining` 2 → chưa xong.
- [ ] **Step 2–4:** FAIL → hiện thực → xanh.
- [ ] **Step 5:** Commit `feat: Báo cáo chỉ đọc theo bản đã gửi, tờ in bản thay thế, bước Tháng này theo bản có hàng`.

### Task 8: Hàng về — lọc nhanh theo nhóm, đối chiếu bản in, Đủ hàng, về bù, ngoài DM

**Rules:** R-D11.1–R-D11.5, R-D11.9–R-D11.12 (web), R-D11.14–R-D11.18, R-D11.20 (web), R-D11.21 (web), R-D13.7, R-D17.7.

**Files:**
- Create: `web/src/lib/search.ts`, `web/src/lib/group-counts.ts`, `web/src/ui/filter/{search-box,group-chips,grouped-combobox}.tsx` (+ test), `features/arrivals/arrivals-toolbar.tsx`, `arrivals-group.tsx`, `arrivals-done.tsx`, `arrivals-makeup.tsx`, `arrivals-custom.tsx`, `arrivals-confirm.tsx`, `use-arrivals-plan.ts`
- Modify: `features/arrivals/arrivals-page.tsx`, `arrival-rows.ts:40-43`, `arrival-table.tsx`, `arrivals.api.ts`, màn nhân viên dùng lại `search.ts` (không đổi hành vi)
- Test: `arrivals-page.test.tsx`, `arrival-rows.test.ts`, `ui/filter/*.test.tsx`, `web/playwright/arrivals.spec.ts`

**Interfaces:**
- Consumes: Task 5 endpoints.
- Produces: `normalizeSearch(s: string): string` (bỏ dấu, `đ→d`, thường); `matches(item, q): boolean` (tên vi, en, mã); `groupCounts(rows, keyOf): Map<string, number>`; `SearchBox({value, onChange, label})`, `GroupChips({groups, counts, value, onChange})`, `GroupedCombobox({options, onPick})`.

- [ ] **Step 1: Test đỏ** lọc `?q=&g=&short=1` (`replace`), "Đang hiện x/y món", lọc không xóa số đã gõ, Lưu gửi cả hàng ẩn; "Về đủ cả nhóm"/bỏ; "chưa về đủ" 9/10/11 với `ordered` 10; nhãn W13 "Thiếu 1 so với bản in" / "Dư 1 so với bản in — vào kho"; W14 nhãn + đầu trang; W15 hộp khi khác (12 món → 8 dòng + "và 4 món khác"), khớp hết → 0 hộp; W16 hàng thêm; W17 hàng ADM hết hàng có tủ; nút "ADM hết hàng" `aria-pressed` → ô 0 + khóa; món ngừng có trong bản in nhập được + nhãn "Ngừng dùng — đã đặt trong bản in"; "Đủ hàng" hộp tóm tắt W18, bấm đúp → 1 request; trạng thái xong "Hàng kỳ tháng 10 đã về đủ — …" + "Sang Giao hàng →" + danh sách đợt; khối "Về bù kỳ trước" nhập `ym` cũ + "ADM không giao nữa"; khối ngoài DM ô "Đã về".
- [ ] **Step 2–4:** FAIL → hiện thực → xanh.
- [ ] **Step 5: PW** `arrivals.spec.ts` `V2D-8 partial then Đủ hàng` (món PW, bản in PW) 1280 + 390 + axe 390.
- [ ] **Step 6:** Commit `feat: Hàng về — lọc theo nhóm, đối chiếu bản in có cảnh báo, Đủ hàng, về bù kỳ trước, món ngoài danh mục`.

### Batch gate 2

- [ ] **Review đợt:** R-D5.7, 5.8, 5.13–5.22 (web), R-D11.1–11.5, 11.9–11.12 (web), 11.14–11.18, 11.20–11.21 (web), R-D13.2, 13.4–13.7, 13.10–13.11 (web Gửi ADM), R-D17.1–17.5, 17.7, 17.10 (W6), R-X.1. Kiểm thêm: chữ W khớp R-D17.3 từng ký tự; bảng R-D5.19 có test cho cả 13 hàng.
- [ ] **Playwright full một lần** — xanh; đếm dữ liệu thật trước/sau không đổi.
- [ ] **Commit list:** Task 6, 7, 8 (+ sửa review).

---

# Đợt 3 — Giao + Còn nợ

### Task 9: Chưa nhận / Còn nợ (Đ28) — statusOf, tab, badge, chữ

**Rules:** R-D14.1, R-D14.2, R-D14.3, R-D14.7, R-D14.8, R-D7.13.

**Files:**
- Modify: `api/src/modules/delivery/delivery-people.service.ts:101-107`, `backlog.service.ts:55-73` (dùng `DEBT_LINE_SQL`), `line-predicates.ts` (`DEBT_LINE_SQL(latestLockedYm)`), `web/src/features/delivery/people/people-filter.ts`, `person-card.tsx:19-24,67-80`, `web/src/shell/use-admin-badges.ts`, locales `home.ts:20`, `delivery.ts:26,29,30,65,66,108,194,232`
- Test: `api/test/delivery-status.e2e-spec.ts`, `people-filter.test.ts`, `use-admin-badges.test.ts`, `web/src/test/debt-wording.test.ts`

**Interfaces:**
- Produces: `DeliveryPerson` thêm `has_pending: boolean`, `has_debt: boolean`, `deliverable_now: boolean`; `status = has_pending ? 'pending' : has_debt ? 'debt' : 'done'`; tab lọc theo vị từ; badge Giao hàng = `people.filter(p => p.deliverable_now).length`.

- [ ] **Step 1: Test đỏ** A giao một phần tháng 10 → `pending` (trước: `debt`); B chỉ nợ tháng 9 → `debt`; C cả hai → cả hai tab + "1 người có cả hai"; mốc khóa kỳ 11 .999/.000 đổi phần còn lại tháng 10 thành nợ; backlog không có dòng K\*, tổng = tab Còn nợ; badge 0 khi tủ trống ngay sau khóa, 1 khi về 1 món của A, 2 khi dòng ngoài DM của B có "Đã về"; thẻ "4 món · 18 đơn vị", panel "Cần 2 · Tủ 20 · 4 người khác còn chờ 18", nút Giao dính đáy panel; quét chữ không "thành nợ"/"vào Còn nợ".
- [ ] **Step 2–4:** FAIL → hiện thực → xanh.
- [ ] **Step 5:** Commit `feat: Chưa nhận là tháng đang giao, Còn nợ chỉ tháng trước; badge chỉ người giao được ngay`.

### Task 10: Hộp giao (Đ3) cho mọi đường giao, gợi ý theo người đăng ký trước, ADM hết hàng

**Rules:** R-D7.1–R-D7.12, R-D11.13 (web), R-D17.8, R-D1.8.

**Files:**
- Create: `features/delivery/people/deliver-dialog.tsx`, `deliver-dialog-rows.tsx`, `deliver-plan.ts` (`allocateWithPriority`)
- Modify: `features/delivery/use-quick-deliver.ts:25-62` (chỉ tính đề xuất), `person-card.tsx` ("Giao…"), `person-panel.tsx`, `web/src/shell/app-routes.tsx` (`/admin/delivery/classic` → `Navigate replace` giữ `?ym`), admin nav; xóa trang classic
- Test: `deliver-dialog.test.tsx`, `deliver-plan.test.ts`, `web/playwright/delivery-people.spec.ts`

**Interfaces:**
- Consumes: `DeliveryPerson` + `adm_out` (Task 5, 9), `waitingIndex` (có sẵn).
- Produces: `allocateWithPriority(lines: PlanLine[], stock: Map<string, number>): Map<lineId, {suggest: number; cap: number; ahead_qty: number; ahead_people: number}>` — thứ tự `period_ym ↑ → requests.created_at ↑ → line.created_at ↑ → id`; `suggest = min(remaining, max(0, stock − ahead_qty))`; người `status ≠ active` → `suggest 0`; dòng ADM hết hàng dùng cùng luật (Đ37), phần không giao bị hủy sau Xác nhận.

- [ ] **Step 1: Test đỏ** nút chính thẻ → hộp mở, **0 request `deliver`/`deliver-all` trước Xác nhận**; quét `use-quick-deliver.ts` không import API ghi; cột "Còn lại sau lần này" (Chưa nhận n / Nợ n); trần `min(còn lại, tủ còn sau dòng trước)`; gõ vượt → kẹp + "Tối đa n"; Enter trong stepper không gửi; focus tiêu đề khi mở, về ô tìm (chọn sẵn chữ) sau thành công; lỗi một dòng → chế độ kết quả ✓/✗; gửi đúp → 1 lượt; ADM hết hàng: B (trước) đề xuất 1, A 1 + "ADM hết hàng — tủ còn 1: giao từ tủ, hủy phần thiếu 1", Xác nhận → giao rồi `cancel-remaining adm_out_of_stock`; W19 "Tủ 3 không đủ cho 2 người đang chờ 5 — thiếu 2" + đầu trang; người nghỉ nhãn R-D7.12; `/admin/delivery/classic?ym=2026-12` → `/admin/delivery?ym=2026-12`.
- [ ] **Step 2–4:** FAIL → hiện thực → xanh.
- [ ] **Step 5: PW** `delivery-people.spec.ts` `V2D-10 card opens dialog` 1280 + 390 (tấm đáy) + axe 390.
- [ ] **Step 6:** Commit `feat: mọi lần giao qua hộp xác nhận, gợi ý theo người đăng ký trước, ADM hết hàng giao từ tủ; gỡ Giao hàng bản cũ`.

### Task 11: Còn nợ và Hủy nợ có lý do sẵn

**Rules:** R-D14.4, R-D14.5, R-D14.6, R-D17.9 (W23), R-X.3.

**Files:**
- Modify: `api/src/modules/delivery/cancel-remaining.service.ts:30-60`, `delivery.dto.ts:22` (`reason_code`), `features/delivery/cancel-dialog.tsx`, `backlog-table.tsx` (menu ⋯, cột "Tủ còn"), `backlog-page.tsx` (`?left=1`), locales `delivery.ts:107-171`, `docs/prd.md` FR-35 (bảng R-X.3)
- Test: `api/test/cancel-remaining.e2e-spec.ts`, `cancel-dialog.test.tsx`, `backlog-actions.test.tsx`

**Interfaces:**
- Produces: `CancelBody {reason_code: 'adm_out_of_stock'|'not_needed'|'user_left'|'other', reason?: string, expected_delivered_qty, expected_qty}`; dòng kỳ K\* → 409 `NOT_DEBT_YET` (trừ `adm_out_of_stock` khi khóa đang đánh dấu); `cancel_reason` = nhãn vi + (": " + ghi chú); `user_left` không chuông.

- [ ] **Step 1: Test đỏ** thiếu `reason_code` → `REASON_REQUIRED`; `other` 2 ký tự → 400, 3 → 200; `not_needed` không ghi chú → 200 `cancel_reason` "Người nhận không cần nữa", 1 chuông; `user_left` → 0 chuông; dòng tháng 10 (K\*) → `NOT_DEBT_YET`; dòng tháng 9 → 200; web: không nút Hủy nợ trực tiếp, có trong ⋯; hộp 4 lựa chọn, [Quay lại][Hủy nợ] vô hiệu tới khi chọn; W23 khi dòng nằm trong `counted_in_snapshot_qty`; `?left=1` chọn sẵn "Đã nghỉ việc"; `prd.md` có bảng R-X.3 (quét tệp).
- [ ] **Step 2–4:** FAIL → hiện thực → xanh.
- [ ] **Step 5:** Commit `feat: Hủy nợ chỉ cho nợ tháng trước, lý do có sẵn, cảnh báo khi đã tính vào phiếu gửi ADM`.

### Task 12: Tổng hợp — panel giảm có lý do, cảnh báo sau khi gửi, người nghỉ, vượt tối đa

**Rules:** R-D6.3 (UI), R-D6.5, R-D6.14, R-D17.6, R-D8.20 (Tổng hợp), R-D13.11 (nhắc + lọc), R-D17.10 (W25).

**Files:**
- Modify: `features/summary/adjust-drawer.tsx`, `adjust-line-row.tsx`, `adjust-lines.tsx`, `use-adjust.ts`, `summary-person-table.tsx`, `use-summary-params.ts` (`left`, `over`), xóa `add-line-picker.tsx`; `features/home/home-page.tsx` (W25)
- Test: `adjust-drawer.test.tsx`, `adjust-drawer-save.test.tsx`, `summary-page.test.tsx`, `home-page.test.tsx`, `web/playwright/adjust.spec.ts`

**Interfaces:**
- Consumes: `PUT /admin/requests/:id/lines` (Task 3), `useSendState` (Task 6), `over_max` (Task 3).

- [ ] **Step 1: Test đỏ** không phần tử "+"/"Tăng"; gõ 7 với cũ 5 → 5 + "Không tăng được sau khóa sổ"; khối lý do chỉ khi mới < cũ, ẩn giữ nháp; `other` cần ghi chú ≥ 3; có bản: hạ 5 → 3 → W11 "…hàng về dư 2 cái vào kho." ngay dưới dòng trước Lưu; chưa có bản → không; W12a + lọc "Vượt tối đa", lý do chọn sẵn "Vượt định mức"; `?left=1` chọn sẵn "Người đã nghỉ"; Tháng này W25 "1 người đã nghỉ còn phần chưa nhận: C" + "Xử lý"; kỳ mở 0 cảnh báo.
- [ ] **Step 2–4:** FAIL → hiện thực → xanh.
- [ ] **Step 5: PW** `adjust.spec.ts` `V2D-12 reduce after sent` 1280 + 390.
- [ ] **Step 6:** Commit `feat: Tổng hợp — giảm có lý do từng dòng, cảnh báo sau khi gửi ADM, nhắc người đã nghỉ, vượt tối đa`.

### Batch gate 3

- [ ] **Review đợt:** R-D6.3, 6.5, 6.14, R-D7.1–7.13, R-D1.8, R-D8.20 (Tổng hợp), R-D11.13 (web), R-D13.11, R-D14.1–14.8, R-D17.6, 17.8, 17.9 (W23), 17.10 (W25), R-X.3.
- [ ] **Playwright full một lần** — xanh; đếm dữ liệu thật không đổi.
- [ ] **Commit list:** Task 9–12 (+ sửa review).

---

# Đợt 4 — Danh mục + Tủ

### Task 13: Toàn màn hình + panel phủ từ phải, thanh lọc chung Danh mục

**Rules:** R-D1.1–R-D1.7, R-D1.9, R-D1.10, R-D16.1, R-D15.6.

**Files:**
- Create: `web/src/ui/overlay-panel.tsx` (+ test), `web/src/lib/use-panel-param.ts`
- Modify: `web/src/shell/app-routes.tsx:51-85`, `admin-shell` CSS (bỏ chặn 960/1200, `usePushContent`, `.has-drawer`), `features/catalog/catalog-page.tsx`, `catalog-grid.tsx`, `catalog-table.tsx`, `catalog-card.tsx` ("Tủ: n"), `catalog-tabs.ts` (bỏ `low`; `?tab=low` → `active` replace), `item-drawer.tsx` → panel phủ
- Test: `overlay-panel.test.tsx`, `use-panel-param.test.ts`, `catalog-page.test.tsx`, `web/playwright/admin-shell.spec.ts`

**Interfaces:**
- Produces: `OverlayPanel({open, onClose, title, dirty, saving, children, footer})` (440 px ≥ 768, 100 % < 768 có "← Đóng"; nền mờ `rgb(14 42 51 / .32)` + `blur(2px)` phủ cả sidebar; reduced-motion); `usePanelParam(name: 'item'|'person'|'request'|'group'): {id, open(id), step(+1|-1), close()}` (mở = `push`, ↑/↓ = `replace`, id lạ → gỡ tham số `replace`).

- [ ] **Step 1: Test đỏ** F5/Back với `?item=`; id lạ/rác; 10 lần ↓ → 1 Back; bẩn + ↑/↓/Esc/nền/Back → hỏi "Bỏ thay đổi?" [Ở lại][Bỏ thay đổi]; focus trả về thẻ; lưới không co khi panel mở (đo `getBoundingClientRect` trước/sau); 767 vs 768; Danh mục lưới ↔ bảng giữ `q/group/tab`; bảng mở mọi nhóm; thẻ "Tủ: 0" xám, không `.tag--danger`/`.tag--warn` về tồn.
- [ ] **Step 2–4:** FAIL → hiện thực → xanh.
- [ ] **Step 5: PW** `admin-shell.spec.ts` `V2D-13 full width every route` 1280/390/1920 × mọi route R-D1.3; axe 390 panel mở.
- [ ] **Step 6:** Commit `feat: mọi trang Hành chính toàn màn hình, sửa bằng panel phủ từ phải; Danh mục một thanh lọc`.

### Task 14: Thứ tự món chung theo số ảnh

**Rules:** R-D2.1–R-D2.8.

**Files:**
- Create: `api/src/modules/catalog/item-order.ts` (`ITEM_ORDER`), `web/src/lib/item-order.ts` (`compareItems`), `ops/data/2026-11-06-sort-order-from-photos.sql`
- Modify: mọi truy vấn/sắp của 6 bề mặt R-D2.3 (`catalog.service`, `report-queries.ts`, `xlsx-request-form.ts`, `arrivals-plan.service.ts`, `stock-query.service.ts`, `summary-lists.service.ts`), `booking-apply.ts` (bỏ `hàng × 10`), `item-fields.tsx` (bỏ "Thứ tự hiển thị"), xóa `staff-preview.tsx`
- Test: `api/test/item-order.e2e-spec.ts`, `api/test/sort-order-script.db-spec.ts`, `web/src/lib/item-order.test.ts`

**Interfaces:**
- Produces: `ITEM_ORDER: SQL` = `c.sort_order NULLS LAST, c.name, i.sort_order, lower(i.name) COLLATE "C", i.id`; `compareItems(a, b): number` cùng khóa, `toLowerCase()` + so mã điểm (không `localeCompare`); món mới `sort_order = max(nhóm) + 10`.

- [ ] **Step 1: Test đỏ** cùng dãy id ở 6 bề mặt + comparator; nhóm NULL cuối; trùng số → tên → id; script: 50 dòng → commit + 1 audit `item.reordered` có `before`; 49 hoặc 51 → `RAISE`, rollback cả khối; client cũ gửi `sort_order` → 200.
- [ ] **Step 2–4:** FAIL → hiện thực → xanh; chạy script trên dev một lần (ghi kết quả vào báo cáo).
- [ ] **Step 5:** Commit `feat: một thứ tự món chung theo số ảnh cho mọi bề mặt; bỏ ô Thứ tự hiển thị và Nhân viên sẽ thấy`.

### Task 15: Trang "Nhóm & đơn vị" (2 tab) + panel nhóm có công tắc từng món

**Rules:** R-D12.1–R-D12.7, R-D17.9 (W24).

**Files:**
- Create: `features/catalog/setup-page.tsx` (tab), `group-panel.tsx`, `group-item-switch.tsx`
- Modify: `categories-page.tsx`, `units-page.tsx`, `web/src/shell/app-routes.tsx` (`/admin/categories/units`; `/admin/units` → `Navigate replace` giữ query), admin nav (một mục), `api/src/modules/catalog/catalog-sql.ts:8-10` (`inactive_reason`), `catalog.service.ts`
- Test: `setup-page.test.tsx`, `group-panel.test.tsx`, `api/test/inactive-reason.e2e-spec.ts`, `web/playwright/categories.spec.ts`

**Interfaces:**
- Consumes: `OverlayPanel`, `usePanelParam('group')` (Task 13); `GET /admin/items/:id/pending-arrival` (Task 4).
- Produces: `GET /admin/items` thêm `inactive_reason: 'item'|'group'|null`.

- [ ] **Step 1: Test đỏ** `/admin/units?x=1` → `/admin/categories/units?x=1`, Back không quay lại; menu đúng 1 mục, sáng ở cả hai URL; `?group=` trên tab Đơn vị bỏ qua; quét `to="/admin/units"` = 0 ngoài redirect; ngừng nhóm → mọi công tắc "Ngừng" vô hiệu + "Ngừng theo nhóm", món ngừng riêng "Ngừng riêng"; bật lại nhóm → chỉ món ngừng do nhóm dùng lại; `inactive_reason` 3 giá trị; hộp ngừng món đang chờ ADM giao 3 → W24 (không chặn).
- [ ] **Step 2–4:** FAIL → hiện thực → xanh.
- [ ] **Step 5: PW** `categories.spec.ts` `V2D-15 group panel` 1280 + 390 + axe 390.
- [ ] **Step 6:** Commit `feat: gộp Nhóm món + Đơn vị tính thành Nhóm & đơn vị; panel nhóm ngừng từng món`.

### Task 16: Tủ / Kho theo người đang chờ, Nhập ngoài kỳ, Xuất lẻ lấy phần đang giữ

**Rules:** R-D15.1, R-D15.2, R-D15.3, R-D15.4, R-D15.5, R-D15.7, R-D15.8.

**Files:**
- Modify: `api/src/modules/catalog/stock-query.service.ts:72`, `catalog-sql.ts:12-18`, `stock.controller.ts` (thêm `@Get('admin/stock')`), `stock.service.ts` (issue `took_held`), `features/stock/stock-table.tsx:16-17`, `stock-stats.tsx`, `stock-rows.ts`, `stock-inventory.tsx`, `issue-dialog.tsx`, `count-stock-dialog.tsx`, `stock-page.tsx`, `use-admin-badges.ts` (badge Tủ), locales `stock.ts`
- Test: `api/test/stock-held.e2e-spec.ts`, `stock-table.test.tsx`, `issue-dialog.test.tsx`, `count-stock-dialog.test.tsx`, `web/playwright/stock.spec.ts`

**Interfaces:**
- Consumes: kế hoạch Hàng về + `admOwed` (Task 4, 5).
- Produces: `GET /admin/stock` (`sql-filter`) → `[{item_id, …, stock_qty, held, free, short, incoming, stock_state: 'short'|'incoming'|'none'|'low'|'untracked'|'ok'}]`; `held = Σ remaining dòng kỳ khóa`, `incoming = Σ remaining kế hoạch K* + Σ adm_owed`, `short = max(0, held − stock − incoming)`.

- [ ] **Step 1: Test đỏ** 6 hàng biên R-D15.3 + ngay sau khóa tủ 0 giữ 5 đặt 5 → "Chờ hàng về 5", badge 0; về 3 → "Chờ hàng về 2"; đánh ADM hết hàng → "Thiếu 2 cho người chờ", badge 1; không chữ "Đủ dùng"; ⋯ có "Nhập ngoài kỳ (tự mua lẻ)"; liên kết "Hàng ADM về? → Hàng về"; tab Xuất lẻ có "Xuất lẻ một món"; tiêu đề "Tủ / Kho"; Xuất lẻ tủ 5 giữ 4: 1 → "Xuất", 3 → "Phần này đang giữ cho 2 người chờ nhận." + "Vẫn xuất" → 201 `took_held 2`, 6 → chặn; Kiểm kê đếm 3 → "Sau kiểm kê tủ còn 3, thiếu 1 cho người đang chờ.".
- [ ] **Step 2–4:** FAIL → hiện thực → xanh.
- [ ] **Step 5: PW** `stock.spec.ts` `V2D-16 held stock` 1280 + 390 + axe 390.
- [ ] **Step 6:** Commit `feat: Tủ / Kho theo người đang chờ và hàng đang về; Nhập ngoài kỳ; Xuất lẻ cảnh báo phần đang giữ`.

### Batch gate 4

- [ ] **Review đợt:** R-D1.1–1.7, 1.9, 1.10, R-D2.1–2.8, R-D12.1–12.7, R-D15.1–15.8, R-D16.1, R-D17.9 (W24).
- [ ] **Playwright full một lần** — xanh; đếm dữ liệu thật không đổi.
- [ ] **Commit list:** Task 13–16 (+ sửa review).

---

# Đợt 5 — Giao diện chung

### Task 17: Nút không "biến mất" khi hover/nhấn — sửa nguyên nhân gốc

**Rules:** R-D4.1–R-D4.8, R-D9.2.

**Files:**
- Modify: `web/src/css/m1/base.css:105-131` (biến `--btn-bg`, `--btn-bg-hover`, `--btn-bg-active`, `--btn-fg`), `features/home/home.m1.css:27-29` (`.hm-cta`: `#9FE3F0` / hover `#C4EEF6` / active `#8AD6E5`), mọi biến thể `.btn--*`; locales nút đóng hộp → "Quay lại"/"Back"
- Test: `web/playwright/button-matrix.spec.ts`, `web/src/test/button-css.test.ts`, `web/src/test/dialog-close-copy.test.ts`

- [ ] **Step 1: Test đỏ** ma trận biến thể × 5 trạng thái × shell × nền, ngưỡng chữ 4.5, viền 3, nền đổi ≥ 1.15; "giữ sắc": nền mặc định ≠ `--c-surface` thì hover/active ≠ `--c-surface-hover`/`--c-surface-2`; `.hm-cta` hover = `rgb(196, 238, 246)` (trước sửa `#F2F8FA` → đỏ); tổ hợp lạ → fail; quét CSS ngoài `base.css` không `.btn…:hover { background` trong admin; biến thể có `--btn-bg` có đủ hover/active; quét locales nút đóng hộp không "Hủy"; ảnh chuẩn trên fixture tự gieo `maxDiffPixelRatio 0.01` (R-D9.2).
- [ ] **Step 2–4:** FAIL → hiện thực → xanh.
- [ ] **Step 5:** Commit `fix: nút admin giữ màu khi hover/nhấn (luật gốc chỉ đọc biến), nút đóng hộp là Quay lại`.

### Task 18: Kỳ khóa trên web, một câu khóa sổ, trạng thái trống, Món ngoài danh mục

**Rules:** R-D8.4, R-D8.10, R-D8.11, R-D8.12, R-D3.1–R-D3.7.

**Files:**
- Create: `web/src/lib/period-text.ts` (`lockPhrase`), `web/src/ui/illustrations/{review-clear,review-none}.tsx`
- Modify: `features/summary/period-lock-gate.tsx` (dùng cho 7 trang chỉ-kỳ-khóa), `web/src/lib/query-client.ts` (không retry 409 `PERIOD_NOT_LOCKED`), hẹn giờ `deadline + 1 s`, `features/review/*` (empty state, 3 nút "Mua lần này"/"Mua và thêm vào danh mục"/"Không mua", W10a/W10b trong hộp)
- Test: `period-text.test.ts`, `period-lock-gate.test.tsx`, `review-page.test.tsx`, `web/playwright/review.spec.ts`

**Interfaces:**
- Produces: `lockPhrase(deadline: string, lang: 'vi'|'en'): string` → `'00:00 ngày 11/11'` / `'00:00 on 11/11'` (ngày theo giờ VN của `deadline`).

- [ ] **Step 1: Test đỏ** `lockPhrase('2026-11-10T17:00:00.000Z','vi') === '00:00 ngày 11/11'` ở TZ LA và Kiritimati; trang chỉ-kỳ-khóa: dải nhắc + trống "không có kỳ khóa"; 409 không retry, chữ trong trang; hẹn giờ gọi `invalidateQueries(['periods','current'])` đúng `deadline + 1000 ms`; Món ngoài DM rỗng: minh họa `aria-hidden`, chữ theo trạng thái kỳ, vi/en; 3 nút đúng chữ, tab vẫn "Đã chấp nhận"; W10b khi `in_sent_snapshot: false`, không khi `null`; W10a khi "Không mua" và `in_sent_snapshot_qty > 0`.
- [ ] **Step 2–4:** FAIL → hiện thực → xanh.
- [ ] **Step 5: PW** `review.spec.ts` ảnh chuẩn tab rỗng 1440 (fixture) + axe 390.
- [ ] **Step 6:** Commit `feat: trang chỉ kỳ khóa dùng một câu khóa sổ; trạng thái trống và nút rõ nghĩa ở Món ngoài danh mục`.

### Task 19: In trình ký tại chỗ (Đ5)

**Rules:** R-D5.1–R-D5.6, R-D5.10, R-D5.12.

**Files:**
- Create: `web/src/features/reports/print-portal.tsx`, `use-print-in-place.ts`
- Modify: `send-adm-draft.tsx` (Task 6), `send-adm-sent.tsx`, `print.m1.css` (`@page { size: A4 portrait; margin: … }`, `thead` lặp), `print-page.tsx` (`?from=`)
- Test: `use-print-in-place.test.ts`, `print-portal.test.tsx`, `web/playwright/print.spec.ts`

**Interfaces:**
- Produces: `usePrintInPlace(): {print(data: SnapshotData): Promise<'printed'|'blocked'>}` — portal ra `document.body`, `#root` ẩn khi in; chờ ảnh tối đa 3 s; không có `afterprint` sau 1 s từ `beforeprint` thiếu → `'blocked'` + chữ R-D5.10; dọn khi không có `afterprint`.

- [ ] **Step 1: Test đỏ** 1 lần `print`, 0 tab mới, URL không đổi; ảnh treo → in sau 3000 ms; bị chặn 1 s → thông báo; gợi ý "Trong hộp in: chọn máy in, khổ A4; tắt 'Đầu trang và chân trang'." chỉ ở Gửi ADM; trang in riêng `from` hợp lệ/thiếu/rác.
- [ ] **Step 2–4:** FAIL → hiện thực → xanh.
- [ ] **Step 5: PW** `print.spec.ts` `V2D-19 print in place` (spy `window.print`).
- [ ] **Step 6:** Commit `feat: In trình ký chốt bản và mở hộp in ngay tại trang`.

### Task 20: Menu theo luồng chuẩn, Nhân viên, Cấu hình, Nhật ký

**Rules:** R-D1.11, R-D8.18, R-D8.19, R-D16.2, R-D16.3.

**Files:**
- Modify: `web/src/shell/admin-nav.ts` (nhóm "Hằng tháng": Tháng này · Tổng hợp kỳ · Gửi ADM · Hàng về · Giao hàng · Còn nợ · Báo cáo & in), `send-adm-orders.tsx` (liên kết "Xem ai đăng ký (n người)"), `features/users/*` (ô "Chưa đăng ký kỳ {{month}}: {{n}} người", cột + lọc `?reg=`), `features/config/*` (dòng kỳ áp dụng, cảnh báo nhóm chỉ sau khi đổi), `api/src/modules/config/config.service.ts` (`effective_from_ym`), `api/src/modules/audit/*` + `features/audit/*` (gộp đợt Hàng về theo `detail.batch_id`, nhãn đối tượng cụ thể)
- Test: `admin-nav.test.tsx`, `users-page.test.tsx`, `config-page.test.tsx`, `api/test/config-effective.e2e-spec.ts`, `api/test/audit-grouping.e2e-spec.ts`, `audit-page.test.tsx`

- [ ] **Step 1: Test đỏ** menu đúng 7 mục, đúng thứ tự, "Xem lại sau" không còn 3 trang; liên kết mở Tổng hợp theo món đúng `item`; Nhân viên "Chưa đăng ký kỳ 11: 2 người", `reg=no` ra 2, không số món; Cấu hình hạn 10 → 8 với kỳ mở 01: "Kỳ tháng 01 (đang mở) vẫn khóa 00:00 ngày 11/01. Áp dụng từ kỳ tháng 02: khóa 00:00 ngày 09/02." + hộp cùng câu + audit `effective_from_ym 2027-02`; cảnh báo nhóm: mở trang không hiện, đổi ID → hiện, đổi lại → ẩn; Nhật ký: 1 lần Lưu 5 món → 1 dòng gộp mở ra 5, 2 lần → 2 dòng, không chuỗi `request_line`/`item` thô.
- [ ] **Step 2–4:** FAIL → hiện thực → xanh.
- [ ] **Step 5:** Commit `feat: menu theo luồng chuẩn; Nhân viên thấy tiến độ đăng ký; Cấu hình nói kỳ áp dụng; Nhật ký gộp đợt hàng về`.

### Task 21: Phía nhân viên — chờ nhận mọi kỳ, tối đa mới, Lịch sử điều chỉnh, chuông

**Rules:** R-D6.11, R-D6.8 (hiển thị chuông), R-D8.6, R-D8.20 (giỏ), R-D8.21, R-D11.13 (chữ chuông).

**Files:**
- Modify: `api/src/modules/requests/current-period.service.ts` (`owed[]`), `history.service.ts` (điều chỉnh), `features/request/owed-notice.tsx`, `features/request/*cart*` (nhãn tối đa mới), `features/history/*`, `features/notifications/*` + locales `notifications.ts` (`line_adjusted` gộp dòng giảm + ADM hết hàng)
- Test: `api/test/current-period-owed.e2e-spec.ts`, `owed-notice.test.tsx`, `cart-max.test.tsx`, `history-adjust.test.tsx`, `notification-copy.test.ts`, `web/playwright/history.spec.ts`

**Interfaces:**
- Produces: `GET /periods/current` thêm `owed: [{ym, items, units, lines: [{name, unit, qty}]}]` cho mọi kỳ khóa còn phần chưa giao (bỏ phần đã hủy).

- [ ] **Step 1: Test đỏ** A còn 2 Bút bi tháng 11 + 2 món tháng 12 → `owed` 2 kỳ; dải "Bạn còn chờ nhận Tháng 11: Bút bi 2 · Tháng 12: 2 món. Không cần đăng ký lại."; quét `locales/vi` phía nhân viên không có "nợ"; giỏ: tối đa 5 → 4 khi đã lưu 5 → "Tối đa mới 4 — giữ được 5, không tăng được", + vô hiệu, lưu 5 → 200; Lịch sử "Hành chính giảm 5 → 3 cái: Vượt định mức · 09:10 13/12", bỏ toàn bộ, `<script>` hiện thô; chuông ngày vi/en có dòng "Băng keo (2 cuộn) không giao được: ADM hết hàng. Tháng sau cần thì đăng ký lại."; nhân viên kỳ mở không thấy gì của HC (R-D8.6).
- [ ] **Step 2–4:** FAIL → hiện thực → xanh.
- [ ] **Step 5: PW** `history.spec.ts` `V2D-21 owed across months` 390 (≤ 2 chạm) + 1280 + axe 390.
- [ ] **Step 6:** Commit `feat: nhân viên thấy mọi phần còn chờ nhận, nhãn tối đa mới, điều chỉnh trong Lịch sử, chuông gộp`.

### Batch gate 5

- [ ] **Review đợt:** R-D1.11, R-D3.1–3.7, R-D4.1–4.8, R-D5.1–5.6, 5.10, 5.12, R-D6.8, 6.11, R-D8.4, 8.6, 8.10–8.12, 8.18–8.21, R-D9.2, R-D11.13 (chữ chuông), R-D16.2, 16.3.
- [ ] **Playwright full một lần** — xanh; đếm dữ liệu thật không đổi.
- [ ] **Commit list:** Task 17–21 (+ sửa review).

---

## Kết thúc plan (Đ46)

- [ ] **Final review** cả nhánh so với spec (mục K: đi lại B1–B34 trên dev bằng tài khoản Hành chính thật, chụp `live-real/v2d/final/`).
- [ ] **`/code-review high`** trên diff `fa37670..HEAD`.
- [ ] **Một đợt sửa** cho mọi finding Critical/Important của hai bước trên; Playwright full lại một lần.
- [ ] Vẽ lại sơ đồ kiến trúc + luồng chính bằng `archify` vào `docs/diagrams/` (theo `CLAUDE.md`); đối chiếu `architecture.md`.

## Bảng phủ quy tắc → task

| Quy tắc | Task |
|---|---|
| R-D1.1, R-D1.2, R-D1.3, R-D1.4, R-D1.5, R-D1.6, R-D1.7, R-D1.9, R-D1.10 | 13 |
| R-D1.8 | 10 |
| R-D1.11 | 20 |
| R-D2.1, R-D2.2, R-D2.3, R-D2.4, R-D2.5, R-D2.6, R-D2.7, R-D2.8 | 14 |
| R-D3.1, R-D3.2, R-D3.3, R-D3.4, R-D3.5, R-D3.7 | 18 |
| R-D3.6 | 4, 18 |
| R-D4.1, R-D4.2, R-D4.3, R-D4.4, R-D4.5, R-D4.6, R-D4.7, R-D4.8 | 17 |
| R-D5.1, R-D5.2, R-D5.3, R-D5.4, R-D5.5, R-D5.6, R-D5.10, R-D5.12 | 19 |
| R-D5.7, R-D5.8, R-D5.13, R-D5.14, R-D5.17 | 6 |
| R-D5.9, R-D5.11 | 4 |
| R-D5.15, R-D5.18 | 7 |
| R-D5.16 | 4, 7 |
| R-D5.19, R-D5.21 | 4, 6 |
| R-D5.20, R-D5.22 | 4, 6, 7 |
| R-D6.1, R-D6.2, R-D6.4, R-D6.7, R-D6.9, R-D6.10, R-D6.13, R-D6.15, R-D6.16, R-D6.17, R-D6.18, R-D6.19, R-D6.20, R-D6.21 | 3 |
| R-D6.3, R-D6.5 | 3, 12 |
| R-D6.6 | 3 |
| R-D6.8 | 3, 21 |
| R-D6.11 | 21 |
| R-D6.14 | 12 |
| R-D7.1, R-D7.2, R-D7.3, R-D7.4, R-D7.5, R-D7.6, R-D7.7, R-D7.8, R-D7.9, R-D7.10, R-D7.11, R-D7.12 | 10 |
| R-D7.13 | 9 |
| R-D8.1, R-D8.2, R-D8.3, R-D8.5, R-D8.7, R-D8.8, R-D8.9, R-D8.14, R-D8.15, R-D8.16, R-D8.17 | 2 |
| R-D8.4, R-D8.10, R-D8.11, R-D8.12 | 18 |
| R-D8.6 | 21 |
| R-D8.13 | 3 |
| R-D8.18, R-D8.19 | 20 |
| R-D8.20 | 3, 12, 21 |
| R-D8.21 | 21 |
| R-D9.1, R-D9.3, R-D9.4, R-D9.5, R-D9.7 | 1 |
| R-D9.2 | 17 |
| R-D10.1, R-D10.2, R-D10.3, R-D10.4, R-D10.5, R-D10.6, R-D10.7, R-D10.8, R-D10.9 | 2 |
| R-D11.1, R-D11.2, R-D11.3, R-D11.4, R-D11.5, R-D11.15, R-D11.16, R-D11.18 | 8 |
| R-D11.6, R-D11.7, R-D11.8, R-D11.19 | 1, 5 |
| R-D11.11 | 5, 8 |
| R-D11.9, R-D11.10, R-D11.12, R-D11.14, R-D11.20, R-D11.21 | 5, 8 |
| R-D11.13 | 5, 10, 21 |
| R-D11.17 | 7 |
| R-D12.1, R-D12.2, R-D12.3, R-D12.4, R-D12.5, R-D12.6, R-D12.7 | 15 |
| R-D13.1, R-D13.3, R-D13.8, R-D13.9 | 4 |
| R-D13.2 | 4, 7 |
| R-D13.4, R-D13.5 | 6 |
| R-D13.6 | 7 |
| R-D13.7 | 8 |
| R-D13.10 | 4, 6 |
| R-D13.11 | 4, 6, 12 |
| R-D14.1, R-D14.2, R-D14.3, R-D14.7, R-D14.8 | 9 |
| R-D14.4, R-D14.5, R-D14.6 | 11 |
| R-D15.1, R-D15.2, R-D15.3, R-D15.4, R-D15.5, R-D15.7, R-D15.8 | 16 |
| R-D15.6 | 13 |
| R-D16.1 | 13 |
| R-D16.2, R-D16.3 | 20 |
| R-D17.1 | 4, 6 |
| R-D17.2, R-D17.3, R-D17.4, R-D17.5 | 6 |
| R-D17.6 | 12 |
| R-D17.7 | 8 |
| R-D17.8 | 10 |
| R-D17.9 | 4, 11, 15, 18 |
| R-D17.10 | 7, 12 |
| R-X.1 | 4, 6 |
| R-X.2 | 1 (thứ tự đợt theo Đ46) |
| R-X.3 | 11 |

Kiểm phủ: `python3` trích mọi `R-…` hoạt động của spec (trừ R-D6.12, R-D9.6 đã bỏ) và mọi mã ở bảng trên → hiệu tập = ∅ (chạy lại sau mỗi lần sửa plan).
