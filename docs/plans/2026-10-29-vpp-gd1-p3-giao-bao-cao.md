# VPP GĐ1 — Plan 3: Giao hàng · Còn nợ · Báo cáo · Chuông (E4 · E5 · E6-S1/S2/S4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trọn vòng một tháng trên dev — Hành chính giao hàng sau khi kỳ khóa (từng dòng / giao tất cả), theo dõi Còn nợ xuyên kỳ, hủy nợ có lý do, lập báo cáo có bản chốt (Excel 2 sheet + trang in 3 ô ký), chuông thông báo hai shell + lịch nhắc mỗi giờ, song ngữ hoàn chỉnh.

**Architecture:** Module api mới `notifications` (ghi chuông trong SAVEPOINT, đọc/đánh dấu đọc), `delivery` (giao, giao tất cả, hủy nợ, còn nợ, lịch sử đợt — ghi `request_lines` qua `LineDeliveryStore` do `requests` export, ghi kho qua `StockService`), `reminders` (cron mỗi giờ, tách riêng để `requests ↔ notifications` không vòng), `reports` (báo cáo sống đọc-only + bản chốt + Excel). Một định nghĩa SQL "phần còn lại hiệu lực" (`REMAINING_QTY` cạnh `EFFECTIVE_LINE`/`UNDELIVERED_LINE`) dùng chung cho Còn nợ, báo cáo, KPI. Web thêm `features/notifications`, `features/delivery` (Giao hàng + Còn nợ), `features/reports` (Báo cáo + trang in, `css/print.css`).

**Tech Stack:** như Plan 2 — NestJS 12 (core ESM; jest `--experimental-vm-modules`), `@nestjs/schedule` 12 (đã có), Node 24, `pg` + drizzle (`sql\`\``), class-validator, Postgres 18; **exceljs** (thêm lại — ghi một dòng lý do + `npm audit --omit=dev` trong report Task 9); React 19, Vite 8, TanStack Query 5, react-router 7, react-i18next, Radix Dialog, vitest, Playwright 1.64.1 + `@axe-core/playwright`.

**Spec:** `docs/prd.md` v1.1 (§5, FR-35, FR-40…44, FR-60…62, FR-70, BR-8/9/13/15, §10), `docs/architecture.md` (§5, §6 Giao hàng/Hủy nợ, §7, §9, §10, §13), `docs/backlog/epic-4-giao-hang-con-no.md`, `epic-5-bao-cao.md`, `epic-6-thong-bao-ho-so-i18n.md` (S1, S2, S4), `design-preview/_SPEC.md` (**"Thay đổi sau review" thắng mockup**), phạm vi đã duyệt `docs/plans/2026-10-28-vpp-gd1-p3-giao-bao-cao.draft.md`, sổ Plan 2 `.superpowers/sdd/2026-10-28-vpp-gd1-p2-phieu-tong-hop/progress.md`, `CLAUDE.md`.

## Phân công model (luật chủ dự án: chỉ Opus/Sonnet, không Haiku, Fable không viết code; Opus cho phán đoán/đồng thời/số kho; Sonnet cho việc cơ học; review mặc định Opus)

| Task | Nội dung | Làm | Review |
|---|---|---|---|
| 1 | Migrations 0103–0107, đồng bộ spec (bỏ hoàn tác), map 23001 | Sonnet | Opus |
| 2 | `NotificationsService` + `GET/POST me/notifications` | Opus | Opus |
| 3 | Giao một dòng (kho, đợt giao, `PERIOD_NOT_LOCKED`, chuông "giao đủ") | Opus | Opus |
| 4 | Giao tất cả theo phiếu (SAVEPOINT, thứ tự khóa) | Opus | Opus |
| 5 | Hủy nợ + Còn nợ + lịch sử đợt + `REMAINING_QTY` dùng chung | Opus | Opus |
| 6 | Móc chuông vào Plan 2: `line_review`, `custom_line_new` | Sonnet | Opus |
| 7 | Cron mỗi giờ `runHourly(now)` | Opus | Opus |
| 8 | `ReportsService.build` + `GET admin/reports/:ym` | Opus | Opus |
| 9 | Bản chốt + Excel 2 sheet | Opus | Opus |
| 10 | Web: chuông hai shell | Sonnet | Opus |
| 11 | Web: trang Giao hàng + nút "Giao" ở Tổng hợp | Opus | Opus |
| 12 | Web: trang Còn nợ | Opus | Opus |
| 13 | Web: trang Báo cáo | Opus | Opus |
| 14 | Web: trang in từ bản chốt + `print.css` | Sonnet | Opus |
| 15 | Web member: Nhận lẻ, "đã hủy n", tiến độ dòng | Sonnet | Opus |
| 16 | Song ngữ hoàn chỉnh (E6-S4) + lint/Playwright carry | Sonnet | Opus |
| 17 | Smoke trọn vòng tháng, archify, đồng bộ tài liệu, review toàn nhánh | Opus | Opus |
| — | Review lại sau mỗi vòng sửa | — | Opus |
| — | Vòng sửa 4–5 khi kẹt | Opus (agent mới) | — |
| — | Review toàn nhánh + code-review high cuối Plan 3 | — | Opus |

Tổng: làm Opus 11 · Sonnet 6; review Opus 17/17.

Thứ tự bắt buộc: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → (10…16, mỗi task web sau task api nó gọi) → 17.

## Global Constraints

- Nhánh `feat/p3-giao-bao-cao` (từ `main` 3a47336); commit cục bộ theo task, tiếng Việt, tiền tố `feat/fix/chore/docs/test/refactor`, dòng `Co-Authored-By` của model đang làm; **không push**; stage theo đường dẫn; không commit `.env`, ảnh chụp, `playwright-report/`.
- Tên thật trong code: danh tính `RequestIdentity` (`@CurrentIdentity()`), `AuditWriterService.appendWithin(tx, {actor, action, objectType, objectId, detail})`, `ClockService.now()`, `PeriodsService.{ensurePeriod, openPeriod, findSnapshot}`, `RequestLinesWriter.save(tx, SaveArgs)`, `repo.bumpRequest`, `repo.lockLineForReview`, `EFFECTIVE_LINE`/`UNDELIVERED_LINE` (`requests/line-predicates.ts`, bí danh `l`), `LOW_STOCK_SQL` (`catalog/catalog-sql.ts`), `ItemUsageRegistry`, `pgViolation`, `uuidParam`, `parseYm`/`YmPipe`, `PageQuery`, `decodeTimestampCursor`; web `apiFetch`, `apiErrorCode/apiErrorNumber/apiErrorFields`, `useCurrentPeriod`, `SUMMARY_KEY`, `adminRequestKey`, `MonthSwitcher`, `Drawer`, `Dialog`, `useConfirm`, `shiftYm`, `useFormatTime`; Playwright `asRole`, `devHeaders`, `seedActiveUser`, `psql`, `acquireLock`, `settled`, `deleteTestUsers`, `removeTestItem`.
- Module chỉ gọi module khác qua service được `export`; ghi `request_lines` chỉ trong module `requests` (`LineDeliveryStore`); ghi `items`/`stock_movements` chỉ trong `catalog` (`StockService`); `reports`/`delivery` đọc-only được join bảng khác cho báo cáo/còn nợ. Không import vòng (`npx madge --circular --extensions ts api/src` = 0).
- Mã lỗi phải có trong `architecture.md` §7; mã mới Plan 3: `PERIOD_NOT_LOCKED` (409), `SNAPSHOT_NOT_FOUND` (404) — thêm vào §7 trong commit của task tạo ra nó. Trạng thái: xung đột trạng thái 409 (`PERIOD_NOT_LOCKED`, `LINE_NOT_REVIEWED`, `LINE_REJECTED`, `STALE_UPDATE`, `STOCK_INSUFFICIENT {available}`), sai số 400 (`DELIVER_EXCEEDS_QTY {remaining}`, `REASON_REQUIRED`, `VALIDATION`), không có 404 (`LINE_NOT_FOUND`, `REQUEST_NOT_FOUND`, `SNAPSHOT_NOT_FOUND`).
- **Chỉ giao/hủy nợ khi kỳ của phiếu đã khóa**: `now ≥ periods.deadline` (`now` từ `ClockService`, đọc một lần mỗi request); trước đó → `PERIOD_NOT_LOCKED`. Hoàn tác đợt giao **không có** trong GĐ1 (FR-44).
- Lý do (hủy nợ) trim ≥ 3 ký tự như mọi lý do khác (`REASON_REQUIRED`). Số giao nguyên 1…9999; `order_qty` nguyên 0…99999.
- Thứ tự khóa cố định `requests → request_lines (id tăng) → items (id tăng)`; trừ kho bằng `UPDATE … WHERE stock_qty >= $q`; không đọc-rồi-ghi.
- Chuông: `in_app_notifications.event_id` là chuỗi theo §9; ghi trong SAVEPOINT của tx nghiệp vụ, lỗi thì nuốt + log `{event_id, topic, code}` (không log params); "admin nhận" = user `active`, khác `local:sa`, có group ∩ `config.admin_group` (không phân biệt hoa thường); "mọi người" = tập mẫu số sống của Tổng hợp (active, khác `local:sa`, giao `authorized_groups` nếu không rỗng); `created_at = ClockService.now()`.
- Test: e2e/db `NODE_ENV=test`, `DATABASE_URL=…/vpp_test`; db-spec gọi `assertTestDatabase()` đầu tiên; e2e cần thời điểm chính xác thì override `ClockService` bằng giá trị cố định (mẫu `me-request.fixture.ts`); dữ liệu test mang hậu tố duy nhất; đồng thời = `Promise.all` hai request thật. Mốc biên viết UTC, kèm chú thích giờ VN.
- Web: mọi chuỗi qua i18n `web/src/locales/{vi,en}/<feature>.ts` (`en` gõ `Messages<typeof vi>`), câu chữ `_SPEC.md` (gọi admin là **Hành chính**); file ≤ 400 dòng (chạm 350 tách), hàm ≤ 50, component ≤ 250; `ui/` không biết nghiệp vụ; `lib/` không import `features/`; comment ít, một dòng "tại sao".
- Playwright: Vite dev → api compose dev (`NODE_ENV=development`, **không** có `CLOCK_OFFSET_MS`) → kỳ đã khóa tạo bằng seed SQL kỳ trước (mẫu `adjust.spec.ts`/`history.spec.ts`), thông báo seed bằng SQL; mỗi spec 1280 + 390, `workers: 1`, `acquireLock` khi đụng dữ liệu chung, dọn trong `finally` (cả tệp ảnh đã tải); kiểm bằng `getByRole`/`getByLabel`/chữ tiếng Việt; axe 390 trên màn chính.
- Cuối mỗi task cập nhật `docs/map.md` cho module chạm tới; report có RED/GREEN (lệnh + output), lệnh verify, danh sách file, băn khoăn.

## Giả định (ghi vào report Task 1, không tự đổi)

1. Luật kỳ/cron/chuông theo giờ được kiểm ở **e2e api với `ClockService` cố định**; Playwright chỉ kiểm hiển thị (kỳ khóa seed SQL, thông báo seed SQL). Xem "Chờ chủ dự án" mục 1.
2. "Xuất lẻ trong kỳ" của báo cáo = xuất lẻ trong **tháng dương lịch** `ym` (giờ VN), dùng lại `StockQueryService.issuesInMonth(ym)` như `GET admin/issues?ym` đã có. Xem "Chờ chủ dự án" mục 2.
3. Cron gửi đúng **ngày** theo §9 (ngày 1 / `lastDay−2` / `lastDay+1` giờ VN, `lastDay` suy từ `periods.deadline` của kỳ — BR-2); bỏ lỡ cả ngày (api tắt từ trước 00:05 tới hết ngày) thì không gửi bù thông báo, nhưng `headcount` của kỳ khóa gần nhất vẫn được ghi bù ở lần chạy sau.
4. Còn nợ chỉ gồm dòng thuộc **kỳ đã khóa** (kỳ đang mở chưa giao được).

## Chờ chủ dự án — đã chốt 2026-10-29: mục 1 chọn (a) (CLAUDE.md đã sửa), mục 2 chọn tháng dương lịch

1. **`CLOCK_OFFSET_MS` và Playwright** (đã ghi `docs/review-spec.md` mục E, 2026-10-29): CLAUDE.md nói Playwright kiểm luật kỳ bằng `CLOCK_OFFSET_MS` phía server, nhưng biến chỉ nhận khi `NODE_ENV=test` còn Playwright chạy compose dev. Plan 3 giả định (a) — cron/chuông/ranh giới kỳ kiểm ở api e2e với đồng hồ cố định; nếu chủ dự án chọn (b) thì thêm test Playwright sau, không đổi code nghiệp vụ.
2. Cửa sổ "Xuất lẻ trong kỳ" trên báo cáo: tháng dương lịch (giả định, khớp `GET admin/issues?ym`) hay khung kỳ 11/M−1 → 10/M.

## Mâu thuẫn spec đã phát hiện (Task 1 ghi `docs/review-spec.md` mục F rồi sửa tài liệu)

| # | Mâu thuẫn | Xử lý trong Plan 3 |
|---|---|---|
| F1 | Hoàn tác đợt giao đã bỏ (FR-44, PRD §11) nhưng còn ở PRD §5 ("Giao nhầm → Hoàn tác"), §10 mục 5 ("hoàn tác đợt 2"), FR-43 ("nếu hoàn tác…"), architecture §6 "Hoàn tác đợt giao", §7 `POST admin/movements/:id/undo`, §14 smoke, backlog E4-S3, `_SPEC.md` "Hoàn tác…" | Gạch/bỏ khỏi các chỗ đó; giữ `reason='return'` trong CHECK kho (không đổi migration đã áp) |
| F2 | E5-S2 `GET /admin/reports/:ym/export.xlsx` ≠ §7 `GET admin/reports/snapshots/:id/export.xlsx` | Theo §7 (Excel luôn từ bản chốt); sửa backlog |
| F3 | §10/E5-S1 nhóm Ngoài danh mục `need = requested` ≠ BR-15 (gồm phần còn lại của mọi kỳ ≤ K) | Theo PRD: nhóm ngoài DM có `backlog_prev`, `need = requested + backlog_prev`, `stock = null`; sửa §10 |
| F4 | §9 `request_delivered:<id>:<n>` "n đếm từ audit" — delivery không được đọc `audit_log` của module khác | `n` = số đợt giao (`line_deliveries`) của phiếu tại lúc đủ — tăng chặt, tất định; sửa §9 |
| F5 | §9 thiếu `event_id` cho chuông Hủy nợ (quyết định 2026-10-28) | Thêm `line_cancelled:<line_id>:<cancelled_qty sau hủy>` |
| F6 | DoD "mutate có audit" vs `POST me/notifications/read` (trạng thái cá nhân); §13 "audit chỉ cho mutate và bản chốt" | Không audit đánh dấu đã đọc; ghi rõ §13 |
| F7 | §7 `read {ids?}` "rỗng = tất cả" mơ hồ với `ids: []` | Thiếu `ids` = tất cả; `ids: []` → 400 `VALIDATION` (tránh client lỡ tay đánh dấu hết) |
| F8 | §5/§12 `0103_vpp_reports.sql` gộp nhiều chủ đề, trái CLAUDE.md "một migration = một chủ đề" | Tách 0103–0107 (Task 1); sửa §5 |
| F9 | §9 "ngày 1 → `period_open` cho mọi user `active`" ≠ mẫu số Tổng hợp (active ∩ `authorized_groups`, khác SA) | Dùng mẫu số Tổng hợp (cùng tập với KPI y và danh sách chưa đăng ký) |

## Review Focus

1. **Bấm "Giao" hai lần / hai Hành chính giao cùng dòng** với cùng `expected_delivered_qty` → đúng một lần có hiệu lực, lần sau 409 `STALE_UPDATE` kèm `delivered_qty` hiện tại; giao diện làm mới số đã giao thay vì báo lỗi chung. → Task 3 (e2e + db-spec `Promise.all`), Task 11.
2. **Tồn vừa bị xuất lẻ/giao ở phiếu khác sau khi trang Giao hàng đã mở** → `STOCK_INSUFFICIENT {available}` gắn đúng dòng ("Chỉ còn n"), ô số hạ tối đa; "Giao tất cả" báo dòng đó trong danh sách không giao được, các dòng khác vẫn giao. → Task 3, 4, 11.
3. **Hành chính tăng số lượng phiếu sau khi đã giao đủ**, rồi giao tiếp tới đủ → chuông "đã giao đủ" mới (`n` mới), không bị nuốt bởi `event_id` cũ; dòng lại hiện ở Còn nợ trong lúc thiếu. → Task 3, 5.
4. **Ranh giới ngày VN của cron** (16:59:59.999Z vs 17:00:00Z) và api khởi động lại giữa ngày / chạy 5 lần → không mất, không trùng; đổi `registration_last_day` chỉ đổi ngày nhắc của kỳ tạo sau. → Task 7.
5. **Bản chốt với `order_qty` lạ** (khóa không có trong báo cáo, âm, thập phân, chuỗi) → 400 `VALIDATION {fields: ['order_qty.<khóa>']}`; ô không sửa lấy `need` tại lúc chốt; giao thêm rồi tải lại bản chốt cũ → số cũ. → Task 9, 13.

---

### Task 1: Migrations 0103–0107, đồng bộ spec, map 23001

**Files:**
- Create: `api/src/migrations/0103_periods_ym_first_day.sql`, `0104_notifications_event_id_text.sql`, `0105_vpp_deliveries.sql`, `0106_vpp_report_snapshots.sql`, `0107_items_drop_min_stock.sql`
- Modify: `api/src/modules/requests/request-errors.ts` (+ `constraintError`), `request-lines.writer.ts` (dùng `constraintError`), `api/test/migrations.db-spec.ts` (số migration), `docs/review-spec.md` (mục **F**: F1–F9 + "Giả định" 1–4), `docs/prd.md` (§5, FR-43, §10 mục 5), `docs/architecture.md` (§5 bảng mới + đánh số migration, §6 bỏ "Hoàn tác", thêm "chỉ giao khi kỳ khóa", §7 bỏ `movements/:id/undo`, §9 F4/F5, §10 F3, §13 F6, §14 smoke), `docs/backlog/epic-4-giao-hang-con-no.md` (E4-S3 bỏ hoàn tác), `epic-5-bao-cao.md` (E5-S2 đường dẫn), `design-preview/_SPEC.md` (bỏ "Hoàn tác…")
- Test: `api/test/p3-schema.db-spec.ts`, `api/src/modules/requests/request-errors.spec.ts`

**Interfaces:**
- Produces (SQL):
  - `periods`: `CONSTRAINT periods_ym_first_day_ck CHECK (extract(day FROM ym) = 1)`.
  - `in_app_notifications.event_id` → `text NOT NULL` (`DELETE … WHERE event_id IS NULL` trước; `USING event_id::text`); UNIQUE `(event_id, user_sub)` giữ.
  - `line_deliveries(id uuid PK DEFAULT gen_random_uuid(), line_id uuid NOT NULL REFERENCES request_lines ON DELETE RESTRICT, qty int NOT NULL CHECK (qty > 0), movement_id uuid REFERENCES stock_movements, actor_sub text NOT NULL, created_at timestamptz NOT NULL)` + index `(line_id, created_at)`; `deliveries` đúng §5 (chỗ GĐ2, không code dùng).
  - `report_snapshots(id uuid PK, period_ym date NOT NULL REFERENCES periods, kind text NOT NULL CHECK (kind IN ('xlsx','print')), data jsonb NOT NULL, created_by_sub text NOT NULL, created_at timestamptz NOT NULL)` + index `(period_ym, created_at DESC)`.
  - `ALTER TABLE items DROP COLUMN min_stock` (code không còn đọc/ghi — kiểm `grep -rn min_stock api/src web/src api/scripts api/seed` chỉ còn migration cũ + test web "không gửi min_stock").
- Produces (TS): `constraintError(error: unknown): HttpException | null` trong `request-errors.ts` — gom bảng `CONSTRAINT_ERRORS` hiện có của writer, thêm `stock_movements_ref_line_id_fkey` và `line_deliveries_line_id_fkey` (SQLSTATE **23001** — RESTRICT, không phải 23503) → 400 `LINE_READONLY` "Dòng đã có đợt giao — không xóa được." (cùng trạng thái với `LINE_READONLY` hiện có; lưới an toàn — luật `isDeletable` đã chặn trước).

- [ ] **Step 1: Test db** `p3-schema.db-spec.ts`: `INSERT periods ('2026-11-15', …)` → 23514, `('2026-11-01', …)` → OK; thông báo `event_id = 'period_open:2026-11'` chèn được, cùng `(event_id, user_sub)` lần hai → 23505, `event_id NULL` → 23502; `line_deliveries.qty = 0` → 23514, `qty = 1` → OK; xóa dòng có `line_deliveries` → SQLSTATE `23001` constraint `line_deliveries_line_id_fkey`; xóa dòng có movement `ref_line_id` → `23001` `stock_movements_ref_line_id_fkey`; `report_snapshots.kind = 'pdf'` → 23514; cột `items.min_stock` không còn (`information_schema.columns`).
- [ ] **Step 2: Test unit** `request-errors.spec.ts`: lỗi giả `{cause: {code: '23001', constraint: 'stock_movements_ref_line_id_fkey'}}` → `LINE_READONLY` 400; `line_deliveries_line_id_fkey` → `LINE_READONLY`; `request_lines_item_uq` (23505) → `DUPLICATE_ITEM` (hành vi cũ giữ); constraint lạ → `null`.
- [ ] **Step 3: Run** `cd api && npm run test:db -- p3-schema && npm test -- request-errors` → FAIL (bảng/hàm chưa có).
- [ ] **Step 4: Implement** 5 migration + `constraintError`; writer gọi `constraintError(error) ?? error`.
- [ ] **Step 5: Run** `npm test && npm run test:e2e && npm run test:db` → PASS; `docker compose up -d --build api` → log áp `0103…0107`.
- [ ] **Step 6: Docs** — ghi F1–F9 + giả định vào `review-spec.md` mục F (một dòng mỗi mục, ngày 2026-10-29), rồi sửa các tài liệu trong **Files** theo cột "Xử lý"; `docs/map.md` dòng database (0103–0107).
- [ ] **Step 7: Commit** — `feat(db): 0103–0107 kỳ ngày 1, event_id chuỗi, đợt giao, bản chốt, bỏ min_stock; docs: bỏ hoàn tác khỏi spec`.

### Task 2: `NotificationsService` và API chuông

**Files:**
- Create: `api/src/modules/notifications/{notifications.module.ts, notification-events.ts, notifications.service.ts, me-notifications.controller.ts, notifications.dto.ts}`
- Modify: `api/src/modules/users/users.service.ts` (+ `activeAdminSubs`), `api/src/app.module.ts`, `docs/architecture.md` §7 (hình trả về, F7)
- Test: `api/src/modules/notifications/notification-events.spec.ts`, `api/test/notifications.e2e-spec.ts`, `api/test/notifications.db-spec.ts`

**Interfaces:**
- Produces:
  - `type NotificationTopic = 'period_open' | 'reminder' | 'period_locked' | 'request_delivered' | 'line_review' | 'custom_line_new' | 'low_stock' | 'line_cancelled'`.
  - `eventIds` (thuần): `periodOpen(ym)` → `'period_open:2026-12'`, `reminder(ym)`, `periodLocked(ym)`, `requestDelivered(requestId, n: number)`, `lineReview(lineId)`, `customLineNew(lineId)`, `lowStock(itemId, purchaseMovementId: string | null)` (null → `…:0`), `lineCancelled(lineId, cancelledQty: number)`.
  - `NotifyInput = {eventId: string; recipients: string[]; topic: NotificationTopic; params: Record<string, unknown>; link: string | null; now: Date}`.
  - `NotificationsService.notifyWithin(tx: Tx, n: NotifyInput): Promise<number>` — `tx.transaction(sp => INSERT … SELECT unnest($recipients) … ON CONFLICT (event_id, user_sub) DO NOTHING)` (drizzle lồng = SAVEPOINT); lỗi → log warn, trả 0, tx ngoài vẫn dùng được; `recipients` rỗng → 0, không truy vấn.
  - `NotificationsService.adminRecipients(ex?: Executor): Promise<string[]>` → `UsersService.activeAdminSubs(await config.getAdminGroup(), ex)`.
  - `UsersService.activeAdminSubs(adminGroup: string, ex?): Promise<string[]>`.
  - `NotificationsService.list(sub, {unread?: boolean, limit, cursor?})` → `{items: NotificationView[], next_cursor, unread_count}`; `NotificationView = {id, topic, params, link, created_at, read_at}`; keyset `(created_at, id)` mới trước qua `decodeTimestampCursor`.
  - `NotificationsService.markRead(sub, ids: string[] | undefined, now): Promise<{updated: number}>` — chỉ dòng của `sub` và `read_at IS NULL`; không audit (F6).
  - `NotificationsService.purgeBefore(cutoff: Date): Promise<number>` (Task 7 gọi với `now − 90 ngày`).
  - `GET /api/me/notifications?unread=true|false&limit&cursor` (M); `POST /api/me/notifications/read {ids?: uuid[]}` (M, CSRF, 200): `ids` 1…200 phần tử uuid; `[]` hoặc > 200 hoặc không phải uuid → 400 `VALIDATION`.

- [ ] **Step 1: Test unit** `notification-events.spec.ts`: 8 công thức ra đúng chuỗi §9 (+F5), `lowStock('i', null)` = `'low_stock:i:0'`, `requestDelivered('r', 2)` = `'request_delivered:r:2'`.
- [ ] **Step 2: Test db** `notifications.db-spec.ts`: `notifyWithin` 2 lần cùng `eventId` cho `[A, B]` → 2 bản ghi; trigger tạm `BEFORE INSERT ON in_app_notifications … RAISE` → `notifyWithin` trả 0, một `UPDATE` khác trong cùng tx vẫn commit (drop trigger trong `finally`); `activeAdminSubs('VPP-Admin')`: user active group `vpp-admin` → có; `locked` → không; `local:sa` có group → không; group `vpp-admin-x` → không.
- [ ] **Step 3: Test e2e** `notifications.e2e-spec.ts`: A thấy đúng thông báo của mình, không thấy của B; `unread=true` chỉ chưa đọc; `unread_count` đúng; `limit=1` → `next_cursor`, trang 2 không trùng; `read {ids:[idA1]}` → `{updated: 1}`, gọi lại → `{updated: 0}`; `read {ids:[idB1]}` (của B) → `{updated: 0}`, B vẫn chưa đọc; `read {}` → mọi thông báo của A đã đọc; `ids: []` → 400 `VALIDATION`; 200 id → 200, 201 id → 400; `ids: ['x']` → 400; thiếu CSRF có phiên → 403; không phiên → 401.
- [ ] **Step 4: Run** → FAIL. **Step 5: Implement.** **Step 6: Run** `npm test && npm run test:e2e -- notifications && npm run test:db -- notifications` → PASS; `npx madge --circular --extensions ts src` = 0.
- [ ] **Step 7: Commit** — `feat(api): thông báo trong app — ghi trong savepoint, đọc, đánh dấu đã đọc` (+ map dòng notifications 🟨).

### Task 3: Giao một dòng

**Files:**
- Create: `api/src/modules/requests/line-delivery.store.ts`, `api/src/modules/delivery/{delivery.module.ts, delivery.controller.ts, delivery.service.ts, delivery.dto.ts, delivery-errors.ts, delivery.repo.ts}`
- Modify: `api/src/modules/catalog/stock.service.ts` (+ `takeForDeliveryWithin`), `requests.module.ts` (export `LineDeliveryStore`), `app.module.ts`, `docs/architecture.md` §6 Giao hàng (khóa, `PERIOD_NOT_LOCKED`, F4), §7 (+ `PERIOD_NOT_LOCKED` 409)
- Test: `api/test/delivery.e2e-spec.ts`, `api/test/delivery.fixture.ts`, `api/test/delivery-concurrency.db-spec.ts`

**Interfaces:**
- Consumes: `NotificationsService.notifyWithin`, `eventIds.requestDelivered`, `PeriodsService.findSnapshot`, `repo.bumpRequest`, `CatalogService.itemFacts`, `AuditWriterService.appendWithin`. `DeliveryModule` imports `RequestsModule`, `CatalogModule`, `PeriodsModule`, `NotificationsModule` (không module nào import ngược `DeliveryModule`).
- Produces:
  - `LockedLine = {id, request_id, period_ym, user_sub, item_id, custom_name, qty, delivered_qty, cancelled_qty, review_status}`.
  - `LineDeliveryStore.lockLine(tx, lineId): Promise<LockedLine | null>` (khóa requests rồi dòng — như `lockLineForReview`); `addDelivered(tx, lineId, qty, expected, now): Promise<boolean>` (`UPDATE … SET delivered_qty = delivered_qty + $q, last_delivered_at = $now, updated_at = $now WHERE id = $1 AND delivered_qty = $expected AND review_status IN ('n/a','accepted','converted')`); `isComplete(tx, requestId): Promise<boolean>` (có ≥ 1 dòng hiệu lực, mọi dòng hiệu lực `delivered + cancelled = qty`, không dòng `pending`).
  - `StockService.takeForDeliveryWithin(tx, {itemId, qty, lineId, actor}): Promise<StockResult>` — `UPDATE items … WHERE stock_qty >= $q` + movement `reason='delivery', delta=-q, ref_line_id`; không audit riêng; thiếu → 409 `STOCK_INSUFFICIENT {available}`.
  - `delivery.repo.ts`: `insertLineDelivery(tx, {lineId, qty, movementId, actor, now})`, `countRequestDeliveries(tx, requestId): Promise<number>`.
  - `DeliverBody {qty: int 1..9999; expected_delivered_qty: int ≥ 0}`; `DeliverResult = {line: {id, qty, delivered_qty, cancelled_qty}, movement_id: string | null, stock_qty: number | null, request_complete: boolean}`.
  - `DeliveryService.deliverLine(lineId, body, actor): Promise<DeliverResult>`; nội bộ `deliverWithin(tx, line, qty, actor, now)` (Task 4 dùng lại) và `notifyIfComplete(tx, line, now)`.
  - `POST /api/admin/lines/:id/deliver` (A, CSRF, 200; `uuidParam`).
- Luật (thứ tự kiểm sau khi khóa): không có dòng → 404 `LINE_NOT_FOUND`; `now < deadline` kỳ của phiếu → 409 `PERIOD_NOT_LOCKED`; `pending` → 409 `LINE_NOT_REVIEWED`; `rejected` → 409 `LINE_REJECTED`; `delivered_qty ≠ expected` → 409 `STALE_UPDATE {delivered_qty}`; `qty > qty_dòng − delivered − cancelled` → 400 `DELIVER_EXCEEDS_QTY {remaining}`; dòng có `item_id` → trừ kho; dòng `accepted` (ngoài DM) không trừ kho, `movement_id = null`. Sau đó: `line_deliveries`, audit `line.delivered {request_id, before: {delivered_qty}, after: {delivered_qty}, qty, movement_id}`, `bumpRequest`; nếu `isComplete` → chuông chủ phiếu `request_delivered:<request_id>:<countRequestDeliveries>` topic `request_delivered` params `{ym}` link `/history/<ym>`.

- [ ] **Step 1: Test e2e** `delivery.e2e-spec.ts` (đồng hồ cố định `2026-11-12T03:00:00Z`, kỳ 2026-11 hạn `2026-11-10T17:00:00Z`, món tồn 10, dòng 5):
  - `giao 3/5 với expected 0 → delivered_qty 3, movement −3, tồn 7, 1 dòng line_deliveries`
  - `gửi lại cùng body → 409 STALE_UPDATE {delivered_qty: 3}, tồn vẫn 7`
  - `giao 3 khi còn 2 → 400 DELIVER_EXCEEDS_QTY {remaining: 2}`; `giao 2 (= phần còn lại) → 200, request_complete true`
  - `qty 0 → 400 VALIDATION`; `qty 1 → 200`; `qty 1.5 → 400 VALIDATION`
  - `tồn 2 giao 3 → 409 STOCK_INSUFFICIENT {available: 2}`; `tồn 3 giao 3 → 200, tồn 0`
  - `dòng pending → LINE_NOT_REVIEWED`; `rejected → LINE_REJECTED`; `accepted (ngoài DM) giao 2 → không movement, tồn không đổi, movement_id null`
  - `PERIOD_NOT_LOCKED khi giao lúc 2026-11-10T16:59:59.999Z`; `giao được lúc 2026-11-10T17:00:00.000Z (00:00 ngày 11 VN)`
  - `id không tồn tại → 404 LINE_NOT_FOUND`; `member → 403`; thiếu CSRF → 403
  - chuông: `giao đủ → đúng 1 thông báo request_delivered cho chủ phiếu, link /history/2026-11`; `giao thiếu → không có`; `phiếu còn dòng pending → giao đủ mọi dòng khác không có chuông`; (Review Focus 3) `giao đủ → Hành chính tăng qty 5→6 qua PUT admin lines (lý do) → giao 1 → thông báo thứ 2 với event_id khác`
  - audit `line.delivered` có before/after; `GET admin/requests/:id` sau giao có `updated_at` mới (tab Điều chỉnh cũ → `STALE_UPDATE`).
- [ ] **Step 2: Test db** `delivery-concurrency.db-spec.ts`: (Review Focus 1) hai `POST deliver {qty: 3, expected 0}` song song (`Promise.all`, app thật) → đúng một 200 + một 409 `STALE_UPDATE`, đúng 1 movement; hai dòng khác phiếu cùng món tồn 4, mỗi dòng giao 3 song song → một 200, một `STOCK_INSUFFICIENT {available: 1}`, tồn 1, không âm.
- [ ] **Step 3: Run** `npm run test:e2e -- delivery && npm run test:db -- delivery-concurrency` → FAIL (404 route).
- [ ] **Step 4: Implement** (kiểm `PERIOD_NOT_LOCKED` bằng `now` đọc một lần, so `findSnapshot(ym, tx).deadline`).
- [ ] **Step 5: Run** toàn bộ api (`npm test && npm run test:e2e && npm run test:db`) → PASS; madge = 0.
- [ ] **Step 6: Commit** — `feat(api): giao từng dòng — trừ kho, đợt giao, chỉ sau khi kỳ khóa, chuông giao đủ`.

### Task 4: Giao tất cả theo phiếu

**Files:**
- Create: `api/src/modules/delivery/deliver-all.service.ts`
- Modify: `line-delivery.store.ts` (+ `lockRequestLines`), `delivery.controller.ts`, `stock.service.ts` (+ `lockItemsWithin`), `docs/architecture.md` §6/§7
- Test: `api/test/delivery-all.e2e-spec.ts`, `api/test/delivery-concurrency.db-spec.ts` (thêm ca)

**Interfaces:**
- Consumes: `DeliveryService.deliverWithin`, `notifyIfComplete` (Task 3).
- Produces:
  - `LineDeliveryStore.lockRequestLines(tx, requestId): Promise<{request_id, period_ym, user_sub, lines: LockedLine[]} | null>` — `FOR UPDATE` phiếu rồi dòng `ORDER BY id`.
  - `StockService.lockItemsWithin(tx, itemIds: string[]): Promise<void>` — `SELECT … WHERE id = ANY($1) ORDER BY id FOR UPDATE` (tránh deadlock giữa hai phiếu có món chéo nhau).
  - `DeliverAllService.deliverAll(requestId, actor): Promise<{delivered: {line_id, qty}[], failed: {line_id, code, available?}[]}>`; `POST /api/admin/requests/:id/deliver-all` (A, CSRF, 200).
- Luật: phiếu không có → 404 `REQUEST_NOT_FOUND`; kỳ chưa khóa → 409 `PERIOD_NOT_LOCKED` (cả phiếu); mỗi dòng còn lại > 0 xử lý theo `id` tăng trong `tx.transaction` lồng (SAVEPOINT) giao đủ phần còn lại qua `deliverWithin`; dòng `pending` → `failed {code: 'LINE_NOT_REVIEWED'}`, `rejected` → `failed {code: 'LINE_REJECTED'}`, thiếu kho → `failed {code: 'STOCK_INSUFFICIENT', available}`; dòng đã đủ bỏ qua (không vào hai danh sách); chuông kiểm **một lần** sau vòng lặp. Không cần `expected_*`: chỉ giao phần còn lại sau khi khóa → bấm lại là no-op.

- [ ] **Step 1: Test e2e** `delivery-all.e2e-spec.ts`: phiếu 4 dòng (A4 qty 2 tồn 5, bút qty 3 tồn 1, dòng `accepted` qty 1, dòng `pending`) → `delivered` = [A4 2, accepted 1], `failed` = [bút `STOCK_INSUFFICIENT {available: 1}`, pending `LINE_NOT_REVIEWED`], tồn A4 3, bút 1 (không trừ dở); bấm lại → `delivered: []`, `failed` như cũ, không movement mới; dòng đã giao 1/2 → giao 1 (phần còn lại); phiếu mọi dòng đủ kho → một chuông duy nhất; `PERIOD_NOT_LOCKED` lúc `2026-11-10T16:59:59.999Z`; id lạ → 404 `REQUEST_NOT_FOUND`.
- [ ] **Step 2: Test db**: hai `deliver-all` cùng phiếu song song → tổng movement = một bộ, `delivered` của một bên rỗng; phiếu X (món P, Q) và phiếu Y (món Q, P) `deliver-all` song song 5 lần → không lỗi deadlock (40P01), tồn đúng.
- [ ] **Step 3–5:** FAIL → Implement → PASS toàn bộ api.
- [ ] **Step 6: Commit** — `feat(api): giao tất cả theo phiếu — savepoint từng dòng, khóa món theo id`.

### Task 5: Hủy nợ, Còn nợ, lịch sử đợt giao

**Files:**
- Create: `api/src/modules/delivery/{cancel-remaining.service.ts, backlog.service.ts, backlog.controller.ts}`
- Modify: `requests/line-predicates.ts` (+ `REMAINING_QTY`), `line-delivery.store.ts` (+ `cancelRemaining`), `summary-lists.service.ts` (`PersonRow.cancelled_qty`; tổng qua `REMAINING_QTY` nơi có), `request-view.ts` (`LineView.cancel_note`), `delivery.dto.ts`, `docs/architecture.md` §6 Hủy nợ, §7, §9 (F5)
- Test: `api/test/backlog.e2e-spec.ts`, `api/test/cancel-remaining.e2e-spec.ts`, `api/test/admin-summary-lists.e2e-spec.ts` (thêm `cancelled_qty`)

**Interfaces:**
- Produces:
  - `REMAINING_QTY = sql.raw('(l.qty - l.delivered_qty - l.cancelled_qty)')` — định nghĩa duy nhất "phần còn lại", Task 8 dùng lại.
  - `LineDeliveryStore.cancelRemaining(tx, lineId, reason, now): Promise<{cancelled_now: number, line}>` (`cancelled_qty = qty − delivered_qty`, `cancel_note = reason`).
  - `CancelBody {reason: string; expected_delivered_qty: int ≥ 0}`; `POST /api/admin/lines/:id/cancel-remaining` (A, CSRF, 200) → `{line, cancelled_now}`. Luật: như Task 3 (`LINE_NOT_FOUND`, `PERIOD_NOT_LOCKED`, `LINE_NOT_REVIEWED`, `LINE_REJECTED`, `STALE_UPDATE`); `reason` trim < 3 → 400 `REASON_REQUIRED`; phần còn lại 0 → 200 `cancelled_now: 0`, không audit, không chuông. Có hủy → audit `line.cancel_remaining {request_id, before: {cancelled_qty}, after: {cancelled_qty}, reason}`, `bumpRequest`, chuông chủ phiếu `line_cancelled:<line_id>:<cancelled_qty>` params `{ym, name, name_en, unit, qty: cancelled_now, reason}` link `/history/<ym>`.
  - `BacklogLine = {line_id, request_id, period_ym, user_sub, full_name, department, user_status, item_id, name, name_en, unit, qty, delivered_qty, cancelled_qty, remaining_qty, stock_qty: number | null}`.
  - `GET /api/admin/backlog?by=item|person` → `{groups: {key, label: {item_id?, name?, unit?, user_sub?, full_name?, department?}, remaining_qty, lines: BacklogLine[]}[]}`; chỉ `UNDELIVERED_LINE` của kỳ đã khóa (`p.deadline <= $now`); nhóm món: dòng ngoài DM gom theo `lower(trim(custom_name)), custom_unit`; trong nhóm sắp `period_ym, full_name`; `by` khác → 400 `VALIDATION`.
  - `GET /api/admin/lines/:id/deliveries` → `{line: {id, qty, delivered_qty, cancelled_qty, cancel_note}, items: {id, qty, movement_id, actor_sub, actor_name, created_at}[]}` (cũ trước); không có dòng → 404 `LINE_NOT_FOUND`.

- [ ] **Step 1: Test e2e** `cancel-remaining.e2e-spec.ts`: dòng 5 đã giao 3 → hủy với lý do "Người đã nghỉ" → `cancelled_qty 2`, `cancelled_now 2`, rời `GET admin/backlog`, member `GET me/request?ym=2026-11` có `cancelled_qty 2` + `cancel_note`, đúng 1 chuông `line_cancelled:<id>:2`; `reason "ab"` → `REASON_REQUIRED`, `"  abc "` → 200; gọi lại → `cancelled_now 0`, không chuông thứ hai; `expected_delivered_qty` lệch → `STALE_UPDATE`; `PERIOD_NOT_LOCKED` lúc 16:59:59.999Z; Hành chính tăng qty 5→7 rồi hủy tiếp → chuông mới `…:4`.
- [ ] **Step 2: Test e2e** `backlog.e2e-spec.ts`: nợ kỳ 2026-10 (2) + kỳ 2026-11 (3) cùng món → `by=item` một nhóm `remaining_qty 5`, 2 dòng sắp kỳ cũ trước; dòng `rejected`/`pending`/đã hủy hết/đã giao đủ không có; dòng kỳ đang mở (2026-12) không có; `by=person` nhóm theo người; giao bổ sung tới đủ → biến mất; lịch sử đợt: giao 1 rồi 2 → `items` 2 đợt đúng thứ tự, `actor_name`; dòng `accepted` giao 1 → lịch sử có đợt `movement_id null`; `by=foo` → 400.
- [ ] **Step 3: Test** `admin-summary-lists`: phiếu 1 dòng qty 5 giao 3 hủy 2 → `PersonRow {total_qty: 5, delivered_qty: 3, cancelled_qty: 2}`.
- [ ] **Step 4–6:** FAIL → Implement → PASS toàn bộ api.
- [ ] **Step 7: Commit** — `feat(api): hủy nợ có lý do + chuông, màn Còn nợ theo món/người, lịch sử đợt giao`.

### Task 6: Móc chuông vào code Plan 2

**Files:**
- Modify: `api/src/modules/requests/review.service.ts`, `request-lines.writer.ts`, `requests.module.ts` (import `NotificationsModule`)
- Test: `api/test/review-notify.e2e-spec.ts`, `api/test/custom-line-notify.e2e-spec.ts`

**Interfaces:**
- Consumes: `NotificationsService.notifyWithin`, `adminRecipients`, `eventIds.lineReview`, `eventIds.customLineNew`.
- Produces: review (accept/convert/reject) → chuông chủ phiếu `line_review:<line_id>` topic `line_review` params `{ym, action: 'accepted'|'converted'|'rejected', name: custom_name gốc, item_name?, item_name_en?, note?}` link `/history/<ym>`; writer: mỗi dòng ngoài DM **mới chèn** (`pending`) → chuông admin (trừ chính `actor.sub`) `custom_line_new:<line_id>` params `{ym, name, person: full_name chủ phiếu}` link `/admin/review?ym=<ym>`; sửa dòng ngoài DM đã có không gửi lại.

- [ ] **Step 1: Test** — reject với lý do "Không mua được" → chủ phiếu có 1 thông báo `params.action 'rejected'`, `note` đúng; review lần 2 → `LINE_ALREADY_REVIEWED`, vẫn 1 thông báo; convert → `params.item_name` = tên món mới. Member lưu phiếu có 1 dòng ngoài DM → mỗi admin active (2 người seed với group `vpp-admin`) có 1 thông báo, admin `locked` không, SA không; member lưu lại (đổi qty dòng đó) → không thêm; Hành chính tạo hộ có dòng ngoài DM → admin khác nhận, chính người tạo không; trigger lỗi INSERT thông báo → review vẫn 200 và dòng đã `rejected`.
- [ ] **Step 2–4:** FAIL → Implement → PASS toàn bộ api; madge = 0.
- [ ] **Step 5: Commit** — `feat(api): chuông khi xử lý món ngoài danh mục và khi có món ngoài danh mục mới`.

### Task 7: Cron mỗi giờ

**Files:**
- Create: `api/src/modules/reminders/{reminders.module.ts, notification-scheduler.ts}`
- Modify: `periods.service.ts` (+ `latestLocked`, `recordHeadcount`), `summary.service.ts` (+ `audienceSubs`, `liveCounts` public), `requests.module.ts` (export `SummaryService`), `catalog/stock.service.ts` (+ `claimLowStockWithin`), `app.module.ts`, `docs/architecture.md` §9
- Test: `api/test/reminders.e2e-spec.ts`, `api/test/reminders-lowstock.e2e-spec.ts`

**Interfaces:**
- Produces:
  - `PeriodsService.latestLocked(now, tx?): Promise<(Period & {headcount: number | null}) | null>` (kỳ `deadline <= now` lớn nhất); `recordHeadcount(ym, n, tx?): Promise<boolean>` (`UPDATE … WHERE ym = $1 AND headcount IS NULL`).
  - `SummaryService.audienceSubs(): Promise<string[]>` (cùng `headcountCondition`); `liveCounts(ym)` public; `unregistered(ym)` dùng cho người nhận nhắc.
  - `StockService.claimLowStockWithin(tx, now): Promise<{id, name, name_en, stock_qty, last_purchase_id: string | null}[]>` — `UPDATE items SET low_stock_notified_at = $now WHERE active AND LOW_STOCK_SQL AND low_stock_notified_at IS NULL RETURNING …` (đòi quyền một lần, chạy song song không gửi đôi).
  - `NotificationScheduler.runHourly(now: Date): Promise<{period_open, reminder, period_locked, low_stock, purged}>` (số bản ghi chèn/xóa); `@Cron('5 * * * *', {name: 'notifications-hourly', timeZone: 'Asia/Ho_Chi_Minh'})` gọi `runHourly(clock.now())`; `onApplicationBootstrap` chạy một lần khi `NODE_ENV !== 'test'`; mọi lỗi bắt + log, không làm sập.
- Luật (ngày giờ VN của `now`; `open = openPeriod(now)`; `lastDay(P) = vnDate(P.deadline − 1 ms).d`):
  - ngày 1 → `period_open:<open.ym>` cho `audienceSubs`, params `{ym, deadline}` link `/`;
  - ngày `lastDay(open) − 2` → `reminder:<open.ym>` cho `unregistered(open.ym)`, link `/`;
  - `L = latestLocked(now)`: `headcount` null → `recordHeadcount(L.ym, liveCounts(L.ym).headcount)`; ngày VN của `now` = ngày VN của `L.deadline` → `period_locked:<L.ym>` cho admin, params `{ym, registered, headcount}` link `/admin/summary?ym=<L.ym>`;
  - mỗi lần: `claimLowStockWithin` → mỗi món `low_stock:<id>:<last_purchase_id|0>` cho admin, link `/admin/stock?filter=low`; `purgeBefore(now − 90 ngày)`.

- [ ] **Step 1: Test e2e** `reminders.e2e-spec.ts` (gọi thẳng `app.get(NotificationScheduler).runHourly(new Date(…))`; kỳ 2026-12 hạn `2026-12-10T17:00:00Z`; 3 người trong mẫu số, 1 đã có phiếu, 1 người ngoài group, 1 admin):
  - `2026-11-30T16:59:59.999Z (23:59:59 30/11 VN) → không period_open`; `2026-11-30T17:00:00Z (00:00 1/12) → period_open:2026-12 cho 3 người, người ngoài group không`; chạy thêm 4 lần cùng ngày (`17:10Z`, `20:00Z`, `2026-12-01T16:59Z`…) → vẫn 1 bản ghi mỗi người; `2026-12-01T17:00Z (ngày 2)` + người mới vào mẫu số → người mới không nhận.
  - `api khởi động lại lúc 00:10 ngày 1 vẫn gửi period_open`: app mới, `runHourly(2026-11-30T17:10:00Z)` → có.
  - nhắc: `2026-12-07T16:59:59.999Z (23:59:59 ngày 7) → không reminder`; `2026-12-07T17:00:00Z (00:00 ngày 8) → reminder:2026-12 chỉ 2 người chưa có phiếu`; `2026-12-08T17:00Z (ngày 9) → không thêm`.
  - khóa: `2026-12-10T16:59:59.999Z → không period_locked, headcount null`; `2026-12-10T17:00:00Z → admin có period_locked:2026-12 params registered 1, headcount 3; periods.headcount = 3`; `2026-12-11T16:59:59Z` chạy lại → không trùng; kỳ có headcount null mà qua ngày khóa → lần chạy sau ghi headcount, không gửi chuông.
  - đổi `registration_last_day` 10 → 15 lúc 2026-12-05: kỳ 2026-12 vẫn nhắc ngày 8 (hạn đã chụp); kỳ 2027-01 (tạo sau) nhắc ngày 13 (`2027-01-12T17:00Z`), không nhắc ngày 8.
  - dọn: thông báo `created_at = now − 90 ngày − 1 ms` bị xóa, `= now − 90 ngày` còn.
- [ ] **Step 2: Test e2e** `reminders-lowstock.e2e-spec.ts`: nhập 30 → giảm tới 7 → chạy → không; 6 → `low_stock:<id>:<movement nhập>` 1 bản ghi mỗi admin, chạy lại → không thêm; xuất tới 5 → không thêm; nhập 20 (tồn 25, mốc 5) → `low_stock_notified_at` null; xuất tới 5 → event mới với id movement nhập mới; món nhập 4 (mốc 0) tồn 1 → không bao giờ (đúng FR-50, đã báo chủ dự án); tồn 0 → không (Hết hàng không phải Sắp hết); hai `runHourly` song song (`Promise.all`) → 1 bản ghi.
- [ ] **Step 3–5:** FAIL → Implement → PASS toàn bộ api; madge = 0 (`reminders` → requests/notifications/periods/catalog, không chiều ngược).
- [ ] **Step 6: Commit** — `feat(api): lịch nhắc mỗi giờ — kỳ mở, nhắc chưa đăng ký, kỳ khóa + headcount, sắp hết, dọn 90 ngày`.

### Task 8: Báo cáo sống

**Files:**
- Create: `api/src/modules/reports/{reports.module.ts, reports.controller.ts, reports.service.ts, report-queries.ts, report.types.ts}`
- Modify: `catalog.module.ts` (export `StockQueryService`), `app.module.ts`, `docs/architecture.md` §10 (F3, hình kiểu)
- Test: `api/src/modules/reports/report-need.spec.ts`, `api/test/reports.e2e-spec.ts`, `api/test/reports.fixture.ts`

**Interfaces:**
- Consumes: `REMAINING_QTY`, `EFFECTIVE_LINE` (Task 5), `StockQueryService.issuesInMonth(ym)`, `PeriodsService.openPeriod`.
- Produces:
  - `needOf(requested: number, backlogPrev: number, stock: number | null): number` thuần = `max(0, requested + backlogPrev − (stock ?? 0))`.
  - `MonthReport = {ym, generated_at, byItem: ReportItemRow[], custom: ReportCustomRow[], byDepartment: {department: string | null, people: {user_sub, full_name, lines: {name, name_en, unit, qty}[]}[]}[], issues: {item_name, unit, recipient_sub, recipient_name, qty, reason, at}[], pending_custom_count}`; `ReportItemRow = {key: item_id, item_id, name, name_en, unit, pack_note, active, requested, backlog_prev, stock, need}`; `ReportCustomRow = {key: 'custom:<lower(trim(name))>:<unit>', name, unit, requested, backlog_prev, stock: null, need, people}`.
  - `ReportsService.build(ym: string, now: Date): Promise<MonthReport>`; `GET /api/admin/reports/:ym` (A; `ym` sai dạng → `INVALID_PERIOD`, > kỳ mở → `INVALID_PERIOD`).
- Luật §10 + F3: dòng hiệu lực, `requested` = Σ `REMAINING_QTY` dòng kỳ `ym`, `backlog_prev` = Σ dòng kỳ `< ym`; chỉ hàng có `requested + backlog_prev > 0`; món ngừng vẫn hiện (`active: false`); `stock` = tồn hiện tại; `byDepartment` liệt kê `qty` dòng hiệu lực kỳ `ym` theo `requests.department` (null cuối) → người → món; `pending_custom_count` = dòng `pending` kỳ `ym`.

- [ ] **Step 1: Test unit** `report-need.spec.ts`: `needOf(3, 0, 2) = 1` (đăng ký 5, đã giao 2, tồn 2); `needOf(3, 2, 0) = 5`; `needOf(3, 0, 10) = 0`; `needOf(3, 0, 3) = 0`; `needOf(3, 0, 2) = 1` biên tồn = cần − 1; `needOf(4, 1, null) = 5` (ngoài DM).
- [ ] **Step 2: Test e2e** `reports.e2e-spec.ts` (BR-15, E5-S1): `đăng ký 5, tồn 2, đã giao 2 → need 1`; `nợ 2 kỳ 2026-10 + đăng ký 3 kỳ 2026-11, tồn 0 → requested 3, backlog_prev 2, need 5`; `tồn 10, đăng ký 3 → need 0`; dòng đã hủy nợ không tính; ngoài DM `accepted` 4 → nhóm `custom` `stock null, need 4`, cùng tên khác hoa/khoảng trắng gộp một hàng; `rejected`/`pending` không vào số, `pending_custom_count 1`; `converted` tính vào món đích; `byDepartment` theo phòng ban đã chụp trên phiếu ("Chưa có phòng ban" = null cuối), `qty` sau điều chỉnh; xuất lẻ 2 A4 cho B ngày 2026-11-15 có trong `issues`, ngày 2026-10-31T17:00Z (00:00 1/11 VN) có, `2026-10-31T16:59:59Z` không; `ym 2027-05` → `INVALID_PERIOD`; member → 403.
- [ ] **Step 3–5:** FAIL → Implement → PASS toàn bộ api.
- [ ] **Step 6: Commit** — `feat(api): báo cáo tháng sống — cần mua theo BR-15, ngoài danh mục, chi tiết phòng ban, xuất lẻ`.

### Task 9: Bản chốt và Excel 2 sheet

**Files:**
- Create: `api/src/modules/reports/{snapshots.service.ts, snapshots.controller.ts, snapshot.dto.ts, xlsx-report.ts, xlsx-labels.ts}`
- Modify: `api/package.json` (exceljs — một dòng lý do trong report, `npm audit --omit=dev` không high/critical mới), `reports.module.ts`, `docs/architecture.md` §7 (`SNAPSHOT_NOT_FOUND`, `order_qty`), §10
- Test: `api/src/modules/reports/xlsx-report.spec.ts`, `api/test/report-snapshots.e2e-spec.ts`

**Interfaces:**
- Consumes: `ReportsService.build`, `SystemConfigService.get('signers')`, `UsersService.findBySub`.
- Produces:
  - `SnapshotBody {kind: 'xlsx'|'print'; order_qty?: Record<string, number>}`; `SnapshotData = MonthReport & {order_qty: Record<key, number>, signers: {preparer, head, approver}, created_by: {sub, name}, created_at}`.
  - `SnapshotsService.create(ym, body, actor): Promise<{id, kind, created_at, created_by}>` — `order_qty` của mọi hàng `byItem` + `custom`: khóa không có trong báo cáo, giá trị không nguyên, < 0, > 99999 → 400 `VALIDATION {fields: ['order_qty.<key>']}`; ô thiếu → `need`; audit `report.snapshot_created {ym, kind, snapshot_id}`.
  - `list(ym)` → `{items: {id, kind, created_at, created_by_sub, created_by_name}[]}` mới trước; `get(id)` → `SnapshotData & {id, kind, period_ym}` (id lạ → 404 `SNAPSHOT_NOT_FOUND`).
  - `buildWorkbook(data: SnapshotData, lang: 'vi'|'en'): Promise<Buffer>` — sheet 1 (vi "Tổng theo món" / en "By item"): cột Món · ĐVT · Đăng ký kỳ này · Nợ kỳ trước · Tồn · Cần mua · Đặt mua, nhóm "Ngoài danh mục" (Tồn trống), một dòng trống rồi bảng "Xuất lẻ trong kỳ" (Món · Người nhận/"Dùng chung" · SL · Lý do); sheet 2 ("Chi tiết" / "Detail"): Phòng ban · Người · Món · SL; tên món theo `lang` (`name_en` có thì dùng); `xlsx-labels.ts` giữ chữ vi/en.
  - `POST /api/admin/reports/:ym/snapshots` (201), `GET /api/admin/reports/:ym/snapshots`, `GET /api/admin/reports/snapshots/:id`, `GET /api/admin/reports/snapshots/:id/export.xlsx?lang=vi|en` (mặc định vi; khác → 400 `VALIDATION`; `Content-Disposition: attachment; filename="vpp-bao-cao-2026-11.xlsx"`).

- [ ] **Step 1: Test unit** `xlsx-report.spec.ts`: workbook đọc lại bằng `exceljs` có đúng 2 sheet tên vi; `lang=en` → "By item", ô A1 "Item", tên món dùng `name_en`, thiếu `name_en` dùng `name`; cột Đặt mua = `order_qty`; xuất lẻ không người nhận → "Dùng chung"/"Shared".
- [ ] **Step 2: Test e2e** `report-snapshots.e2e-spec.ts`: `order_qty {<A4>: 7}` → bản chốt `order_qty` A4 7, món khác = `need`; `{<A4>: 0}` → OK; `-1`, `1.5`, `"7"`, `100000`, khóa `<uuid lạ>` → 400 `VALIDATION` với đúng `fields`; `99999` → OK; (Review Focus 5) chốt → giao thêm 2 → `GET snapshots/:id` và `export.xlsx` ra số cũ, `GET admin/reports/:ym` ra số mới; mỗi `POST` tạo một bản chốt mới, `list` mới trước có giờ + tên người lập; `signers` lấy từ cấu hình lúc chốt, đổi cấu hình sau không đổi bản chốt; `export.xlsx?lang=en` tải về 200, mở bằng exceljs đọc tiêu đề tiếng Anh; `?lang=fr` → 400; id lạ → 404 `SNAPSHOT_NOT_FOUND`; audit `report.snapshot_created` có, `GET` không audit.
- [ ] **Step 3–5:** FAIL → Implement → PASS toàn bộ api; nếu máy có `soffice`: `soffice --headless --convert-to csv` tệp e2e tải về đọc được (ghi output vào report, không có thì ghi "không có LibreOffice").
- [ ] **Step 6: Commit** — `feat(api): bản chốt báo cáo và Excel 2 sheet song ngữ` (+ map dòng reports ✅).

### Task 10: Web — chuông hai shell

**Files:**
- Create: `web/src/features/notifications/{notifications.api.ts, notification-bell.tsx, notification-text.ts, notifications.css}`, `web/src/locales/{vi,en}/notifications.ts`
- Modify: `web/src/shell/member-shell.tsx`, `admin-shell.tsx` (đặt chuông ở thanh trên), `locales/{vi,en}/index.ts`
- Test: `notification-bell.test.tsx`, `notification-text.test.ts`

**Interfaces:**
- Consumes: Task 2 endpoints.
- Produces: `useUnreadCount()` (`GET me/notifications?unread=true&limit=1` → `unread_count`; `refetchInterval: 60_000`, `refetchOnWindowFocus: true`), `useNotifications()` (infinite, 20/trang), `markRead(ids?: string[])`; `notificationText(n: NotificationView, t, lang): string` dịch `notifications.topics.<topic>` (+ `line_review.<action>`) bằng `params` (tháng dạng "tháng 11"/"November", tên món theo ngôn ngữ); `NotificationBell` — nút `aria-label` "Thông báo, n chưa đọc", huy hiệu số (≥ 10 → "9+", 0 → không huy hiệu), mở bảng (Esc/bấm ngoài đóng, focus trả về nút), danh sách mới trước (chưa đọc đậm), bấm mục → `markRead([id])` rồi `navigate(link)` (chỉ link bắt đầu `/` và không `//`), nút "Đánh dấu đã đọc tất cả" → `markRead()`; trống → "Chưa có thông báo".
- [ ] **Step 1: Test** — 9 chưa đọc → "9", 10 → "9+", 0 → không huy hiệu; bấm mục `request_delivered {ym:'2026-11'}` → POST `read {ids:[id]}` rồi điều hướng `/history/2026-11`; link `//evil` → không điều hướng; "Đánh dấu đã đọc tất cả" gửi body `{}`; `notificationText` đủ 8 topic vi + en (en không còn ký tự tiếng Việt có dấu).
- [ ] **Step 2–4:** FAIL → Implement → PASS `npm test && npm run lint && npm run build`; Playwright `notifications.spec.ts` "E6-S1 chuông" 1280/390: seed 2 thông báo SQL cho người dùng thử → huy hiệu 2 → bấm một mục → về trang đích, huy hiệu 1; admin thấy chuông trong shell quản lý; axe 390.
- [ ] **Step 5: Commit** — `feat(web): chuông thông báo ở hai shell`.

### Task 11: Web — trang Giao hàng

**Files:**
- Create: `web/src/features/delivery/{delivery.api.ts, delivery-page.tsx, delivery-request.tsx, deliver-line-row.tsx, delivery-errors.ts, delivery.css}`, `web/src/locales/{vi,en}/delivery.ts`
- Modify: `app-routes.tsx` (`delivery` vào `BUILT_ADMIN_PAGES`), `features/summary/{person-table.tsx, summary.api.ts}` (nút "Giao" khi kỳ đã khóa; thanh tiến độ `delivered/(total − cancelled)` — carry), `features/summary/adjust-lines.tsx` (dòng vừa converted bỏ nhãn "Ngoài danh mục" ngay sau review — carry), `features/stock/stock-dialogs.tsx` (chặn bấm đúp bằng `useRef` — carry P1), locales summary
- Test: `delivery-page.test.tsx`, `deliver-line-row.test.tsx`, `summary-page.test.tsx`, `adjust-drawer.test.tsx`, `stock-dialogs.test.tsx`

**Interfaces:**
- Consumes: `GET admin/periods/:ym/requests?by=person&filter=pending_delivery|all`, `GET admin/requests/:id`, `POST admin/lines/:id/deliver`, `POST admin/requests/:id/deliver-all`.
- Produces: `/admin/delivery?ym=&request=` — mặc định `ym` = `shiftYm(open.ym, -1)` (kỳ khóa gần nhất), `MonthSwitcher` max = kỳ đó; mỗi phiếu một hàng (người, phòng ban, thanh tiến độ, nút mở `aria-expanded`), mở ra `DeliveryRequest`: dòng hiệu lực còn lại > 0 có ô "Thực giao" (mặc định = còn lại, 1…còn lại) + nút "Giao" (vô hiệu khi đang gửi); dòng `pending`/`rejected` nhãn "Chờ xem — chưa giao được"/"Đã từ chối"; nút "Giao tất cả" → kết quả "Đã giao n dòng" + danh sách "Không giao được: <món> — <lý do>"; `?request=<id>` mở sẵn phiếu đó; công tắc "Hiện cả phiếu đã giao đủ". Lỗi: `STALE_UPDATE` → tải lại phiếu + "Dòng vừa được giao ở nơi khác — số đã cập nhật"; `STOCK_INSUFFICIENT {available}` → "Chỉ còn {available}" gắn ô của dòng, max ô hạ về `available`; `DELIVER_EXCEEDS_QTY` → câu tại ô; `PERIOD_NOT_LOCKED` → "Kỳ chưa khóa — giao sau 00:00 ngày 11". Sau giao làm mới `SUMMARY_KEY`, `adminRequestKey(id)`, `['backlog']`.
- [ ] **Step 1: Test** — ô mặc định = 2 khi qty 5 đã giao 3; gõ 3 → nút Giao vô hiệu + "Tối đa 2"; bấm Giao gửi `{qty: 2, expected_delivered_qty: 3}`; bấm đúp nhanh → 1 request; 409 STALE → refetch + thông báo; 409 `STOCK_INSUFFICIENT {available: 1}` → "Chỉ còn 1" gắn ô (`aria-describedby`); "Giao tất cả" với `failed` → liệt kê; Tổng hợp: dòng `{total 5, delivered 3, cancelled 2}` → thanh `aria-valuenow 3` `aria-valuemax 3` (đầy); kỳ đang mở không có nút "Giao"; ngăn điều chỉnh: sau Thêm vào danh mục không còn nhãn "Ngoài danh mục"; hộp Nhập mua bấm đúp → 1 request.
- [ ] **Step 2–4:** FAIL → Implement → PASS (vitest + lint + build); Playwright `delivery.spec.ts` "E4-S4 giao thiếu rồi kiểm Còn nợ" 1280/390 (phiếu kỳ trước seed SQL: giao 3/5 → mở Còn nợ thấy "còn 2" → Tổng hợp thanh 3/5) và "E4-S1 bấm giao hai lần" (`dblclick` → một movement, kiểm bằng `psql`; request thứ hai nếu lọt tới server nhận 409 `STALE_UPDATE`).
- [ ] **Step 5: Commit** — `feat(web): trang Giao hàng, nút Giao ở Tổng hợp; sửa thanh tiến độ tính phần hủy`.

### Task 12: Web — trang Còn nợ

**Files:**
- Create: `web/src/features/delivery/{backlog.api.ts, backlog-page.tsx, backlog-group.tsx, deliver-more-dialog.tsx, cancel-dialog.tsx, deliveries-drawer.tsx}`, locales delivery (thêm khóa)
- Modify: `app-routes.tsx` (`backlog`)
- Test: `backlog-page.test.tsx`, `cancel-dialog.test.tsx`, `deliveries-drawer.test.tsx`

**Interfaces:**
- Consumes: `GET admin/backlog?by=`, `GET admin/lines/:id/deliveries`, `POST admin/lines/:id/deliver`, `POST admin/lines/:id/cancel-remaining`.
- Produces: `/admin/backlog?by=item|person` (nút chuyển `aria-pressed`, mặc định theo món); nhóm (tên món + "còn n ĐVT" + "Tồn n" / người + phòng ban + "Người đã nghỉ"); mỗi dòng: kỳ "Tháng M/YYYY", người hoặc món, "đã giao a/b", "còn n", nút "Giao bổ sung…" (hộp số lượng mặc định `min(còn lại, tồn)` — tồn 0 thì nút vô hiệu + "Hết hàng"; dòng ngoài DM không giới hạn tồn), "Lịch sử" (ngăn: từng đợt "hh:mm dd/mm · n · người giao", phần hủy "Đã hủy n — lý do"), "Hủy nợ…" (hộp "Hủy n <ĐVT> còn lại của <người>?", ô lý do bắt buộc trim ≥ 3, nút "Hủy nợ" vô hiệu khi chưa đủ); xong → dòng biến mất khỏi nhóm; trống → "Không còn nợ".
- [ ] **Step 1: Test** — lý do "ab" → nút vô hiệu, "abc" → bật, gửi `{reason, expected_delivered_qty}`; `REASON_REQUIRED` từ server gắn ô lý do; giao bổ sung đủ → dòng biến mất; tồn 0 → nút giao bổ sung vô hiệu; ngăn lịch sử hiện 2 đợt đúng thứ tự + dòng hủy; chuyển "Theo người" đổi `?by=person`.
- [ ] **Step 2–4:** FAIL → Implement → PASS; Playwright `backlog.spec.ts` "E4-S3 còn nợ" 1280/390: nợ 2 → giao bổ sung 1 → lịch sử 2 đợt → hủy nợ 1 với lý do → biến mất; member (dev-identity) mở Lịch sử thấy "đã hủy 1"; axe 390.
- [ ] **Step 5: Commit** — `feat(web): trang Còn nợ — giao bổ sung, lịch sử đợt, hủy nợ có lý do`.

### Task 13: Web — trang Báo cáo

**Files:**
- Create: `web/src/features/reports/{reports.api.ts, reports-page.tsx, report-item-table.tsx, report-detail-table.tsx, issues-table.tsx, snapshot-list.tsx, use-order-qty.ts, reports.css}`, `web/src/locales/{vi,en}/reports.ts`
- Modify: `app-routes.tsx` (`reports`)
- Test: `use-order-qty.test.ts`, `reports-page.test.tsx`

**Interfaces:**
- Consumes: `GET admin/reports/:ym`, `POST admin/reports/:ym/snapshots`, `GET admin/reports/:ym/snapshots`, `GET admin/reports/snapshots/:id/export.xlsx?lang=`.
- Produces: `/admin/reports?ym=` (mặc định kỳ khóa gần nhất, max kỳ đang mở); đầu trang: `MonthSwitcher`, "Xuất Excel", nút xanh "In trình ký"; phần 1 `ReportItemTable` (Món · ĐVT · Đăng ký kỳ này · Nợ kỳ trước · Tồn · Cần mua · **Đặt mua** ô số nguyên ≥ 0, mặc định = Cần mua, nền vàng nhạt khi khác, nút "Về Cần mua"), nhóm "Ngoài danh mục" (Tồn "—"); bảng phụ "Xuất lẻ trong kỳ"; phần 2 Chi tiết phòng ban → người → món · SL; `useOrderQty(report)` → `{value(key), set(key, n), edited: Record<key, number>, reset(key)}` chỉ gửi ô đã sửa (ô không sửa server lấy `need` lúc chốt); bấm Xuất/In: `pending_custom_count > 0` → hộp "Còn n món chưa xem — chốt vẫn thiếu các món này" ("Quay lại" / "Vẫn chốt"); Xuất → `POST snapshots {kind:'xlsx', order_qty}` → tải `export.xlsx?lang=<ngôn ngữ đang dùng>`; In → `POST {kind:'print'}` → điều hướng `/admin/reports/snapshots/:id/print`; `SnapshotList` (giờ, người lập, loại, "Tải lại" / "In lại" không tạo bản mới); `VALIDATION {fields:['order_qty.<key>']}` → lỗi tại ô.
- [ ] **Step 1: Test** — ô Đặt mua mặc định = Cần mua; sửa 7 → nền vàng + body chỉ có khóa đó; gõ "-1"/"1.5" → lỗi tại ô, nút chốt vô hiệu; `pending_custom_count 3` → hộp, "Quay lại" không gọi POST, "Vẫn chốt" gọi; "Tải lại" ở danh sách không gọi POST; đổi tháng khi có ô đã sửa → hỏi "Bỏ số Đặt mua đã sửa?", đồng ý thì nháp kỳ cũ bị xóa (nháp theo kỳ).
- [ ] **Step 2–4:** FAIL → Implement → PASS; Playwright `reports.spec.ts` "E5-S4 trang Báo cáo" 1280/390 (cấu trúc: 2 bảng + bảng phụ + danh sách bản chốt, chụp ảnh `settled`) và "E5-S2 xuất Excel" (`waitForEvent('download')`, đọc tệp bằng exceljs trong test → 2 sheet).
- [ ] **Step 5: Commit** — `feat(web): trang Báo cáo — cột Đặt mua, xuất lẻ trong kỳ, bản chốt`.

### Task 14: Web — trang in từ bản chốt

**Files:**
- Create: `web/src/features/reports/print-page.tsx`, `web/src/css/print.css`
- Modify: `app-routes.tsx` (route `/admin/reports/snapshots/:id/print` trong `RequireRole`, **ngoài** `AdminShell`), locales reports
- Test: `print-page.test.tsx`

**Interfaces:**
- Consumes: `GET admin/reports/snapshots/:id`.
- Produces: trang A4 dọc: tiêu đề "Báo cáo văn phòng phẩm tháng M/YYYY", phần 1 + bảng phụ Xuất lẻ + phần 2 (bảng `thead` lặp mỗi trang — `display: table-header-group`, hàng không cắt ngang — `break-inside: avoid`), chân 3 ô ký "Người lập · Trưởng phòng · Duyệt" kèm tên từ `signers` (tên rỗng → ô trống để ký tay), dòng "Lập lúc hh:mm dd/mm/yyyy bởi <tên>"; thanh công cụ màn hình ("In", "Quay lại Báo cáo") ẩn khi in; 404 → `NotFound`.
- [ ] **Step 1: Test** — tên 3 người ký hiển thị; ký rỗng vẫn có ô; dòng "Lập lúc … bởi …" đúng giờ VN; số Đặt mua lấy từ bản chốt.
- [ ] **Step 2–4:** FAIL → Implement → PASS; Playwright `print.spec.ts` "E5-S3 trang in" (chỉ chromium, 1280): `emulateMedia({media:'print'})` → không thấy thanh công cụ/sidebar, thấy 3 ô ký có tên; `page.pdf({format:'A4'})` → bắt đầu `%PDF`, ≥ 1 `/Type /Page`; không phần tử nào `scrollWidth > clientWidth` (không cắt chữ).
- [ ] **Step 5: Commit** — `feat(web): trang in báo cáo từ bản chốt, print.css A4 3 ô ký`.

### Task 15: Web member — Nhận lẻ, "đã hủy n", tiến độ dòng

**Files:**
- Modify: `web/src/features/request/{history-page.tsx, history.api.ts, history-detail-page.tsx, line-progress.tsx, request.api.ts (LineView.cancel_note)}`, locales request
- Create: `web/src/features/request/issues-section.tsx`
- Test: `history-page.test.tsx`, `history-detail-page.test.tsx`, `api/test/me-issues.e2e-spec.ts`

**Interfaces:**
- Consumes: `GET me/issues?limit&cursor` (catalog, đã có), `LineView.cancel_note` (Task 5).
- Produces: mục "Nhận lẻ" trong Lịch sử (món, SL, ngày, lý do; ẩn khi trống; "Xem thêm" theo cursor); `LineProgress {delivered, qty, cancelled}` → thanh trên mẫu `qty − cancelled` (hủy hết → không thanh, chỉ "Đã hủy n"), "đã hủy n — <lý do>"; `deliveryState` giữ nguyên luật.
- [ ] **Step 1: Test** — dòng 5 giao 3 hủy 2 → `aria-valuenow 3`, `aria-valuemax 3`, chữ "đã hủy 2 — Người đã nghỉ"; hủy hết 5 → không progressbar; Nhận lẻ 2 mục → hiện; rỗng → không có mục. api `me-issues.e2e-spec.ts`: A thấy xuất lẻ của mình, không thấy của B và của "Dùng chung" (carry).
- [ ] **Step 2–4:** FAIL → Implement → PASS (api e2e + web); Playwright `history.spec.ts` thêm "E6 nhận lẻ" 390 (xuất lẻ seed qua API admin → member thấy trong Lịch sử ≤ 2 chạm).
- [ ] **Step 5: Commit** — `feat(web): lịch sử hiện nhận lẻ, phần hủy nợ và tiến độ giao đúng`.

### Task 16: Song ngữ hoàn chỉnh (E6-S4) và carry lint/Playwright

**Files:**
- Create: `web/src/features/admin/audit-actions.ts`, `web/src/test/i18n-screens.test.tsx`
- Modify: `audit-columns.tsx` (nhãn hành động), locales admin (vi/en), `web/scripts/check-hardcoded-text.mjs` (+ `side`, `align`, `orientation`, `enterKeyHint`, `form`, `i18nKey` vào `TECHNICAL_ATTRS`; đối số đầu dạng token `toast('success', …)` không báo; chuỗi chỉ gồm ký hiệu tiền tệ `'đ'`/`'₫'` không báo), `web/scripts/check-hardcoded-text.test.ts`, `web/playwright/helpers.ts` (`settled`: giữ `[aria-busy="true"]` — trạng thái ARIA người dùng trợ năng thấy, không phải class — thêm comment một dòng lý do)
- Test: như trên

**Interfaces:**
- Produces: `AUDIT_ACTIONS: readonly string[]` = mọi `action` api ghi (liệt kê bằng `grep -rhoE "action: [\`'][a-z_.\${}]+" api/src`, mở rộng `stock.${reason}` thành `stock.purchase|adjust|issue`; gồm cả Plan 3: `line.delivered`, `line.cancel_remaining`, `report.snapshot_created`) → nhãn `audit.actions.<action>` vi/en ở cột Hành động và bộ lọc Nhật ký; thiếu nhãn → hiện mã thô (không vỡ).
- [ ] **Step 1: Test** — `i18n-screens.test.tsx`: render lần lượt Giao hàng, Còn nợ, Báo cáo, trang in, chuông, Lịch sử với `lng='en'` (dữ liệu fixture, tên món có `name_en`) → `textContent` không chứa `[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]`; với `lng='vi'` thấy "Giao tất cả", "Hủy nợ", "Đặt mua", "In trình ký"; mọi phần tử `AUDIT_ACTIONS` có khóa ở cả vi và en; `check-hardcoded-text.test.ts`: `<Popover side="top">`, `<Trans i18nKey="a.b">`, `toast('success', t('x'))`, `const unit = 'đ'` → 0 vi phạm; `toast('Đã lưu')` vẫn 1 vi phạm.
- [ ] **Step 2–4:** FAIL → Implement → PASS `npm test && npm run lint && npm run build`; Playwright axe 390 trên Giao hàng, Còn nợ, Báo cáo, Lịch sử ở cả vi và en (đổi ngôn ngữ qua trang Tôi/LanguageSwitch) → 0 lỗi tương phản.
- [ ] **Step 5: Commit** — `feat(web): song ngữ hoàn chỉnh — nhãn Nhật ký, màn Plan 3; lint chuỗi cứng bớt báo nhầm`.

### Task 17: Smoke trọn vòng tháng, sơ đồ, đồng bộ tài liệu, review toàn nhánh

**Files:**
- Create: `web/playwright/p3-flow.spec.ts`, `docs/diagrams/src/*.json` + `docs/diagrams/{vpp-kien-truc,vpp-giao-hang,vpp-vong-thang}.{html,png}`
- Modify: `web/playwright/helpers.ts` (+ `deleteTestFiles(ids)`: `psql` xóa bản ghi `files` + `docker compose exec -T api rm -f /data/files/<id>.*` — carry tệp mồ côi), các spec có tải ảnh gọi nó trong `finally`, `web/playwright/cleanup-dev-data.sql` (dọn `line_deliveries`, `report_snapshots`, `in_app_notifications` của `pw-%`), `docs/map.md` (delivery, reports, notifications, reminders, web delivery/reports/notifications → ✅), `README.md` (vòng tháng trên dev: seed kỳ khóa, chuông seed, cách chạy cron tay trong e2e), `docs/architecture.md` (đối chiếu sơ đồ), `docs/plans/2026-10-28-vpp-gd1.md` (P3 ✅), `docs/review-spec.md` (lệch phát hiện khi vẽ)

- [ ] **Step 1: Smoke** `p3-flow.spec.ts` "P3 vòng tháng" (tuần tự, `acquireLock('p3-flow')`, hậu tố duy nhất, 1280 rồi 390, dọn `finally`). Seed SQL kỳ trước đã khóa: phiếu member A (A4 qty 5, bút qty 2, 1 dòng ngoài DM `accepted` qty 1 có ảnh), phiếu member B (kẹp qty 3); tồn A4 3, bút 5, kẹp 0; Cấu hình 3 người ký. Admin (SA thật nếu `PW_SA_PASSWORD`, không thì dev admin):
  1. Giao hàng → phiếu A: giao A4 3 bằng **bấm đúp** nút Giao (`dblclick`) → đúng một movement −3 (`psql`), ô hiện số mới (PRD §10 mục 5 "bấm giao hai lần liên tiếp").
  2. "Giao tất cả" phiếu A → giao bút 2 + dòng ngoài DM 1; "Không giao được: Giấy A4 — chỉ còn 0".
  3. Còn nợ (theo món): A4 "còn 2", kẹp "còn 3".
  4. Báo cáo kỳ đó: Cần mua A4 = 2, kẹp = 3; sửa Đặt mua A4 = 4 → Xuất Excel (tải về, đọc 2 sheet) → In trình ký (3 ô ký có tên, "Lập lúc … bởi …").
  5. Kho: nhập mua A4 +2 → Còn nợ "Giao bổ sung" A4 2 → nhóm A4 biến mất; member A có chuông "Phiếu tháng M đã giao đủ", bấm → `/history/<ym>`.
  6. Báo cáo → danh sách bản chốt → "In lại" bản vừa chốt → Đặt mua A4 4, Cần mua 2 (**số cũ**); báo cáo sống Cần mua A4 0.
  7. Còn nợ: "Hủy nợ…" kẹp của B với lý do "Không mua được" → biến mất; member B Lịch sử thấy "đã hủy 3 — Không mua được" và chuông hủy nợ.
  8. axe 390 trên Giao hàng, Còn nợ, Báo cáo. Report đối chiếu PRD §10 mục 5 (trừ hoàn tác — F1), 6, 9.
- [ ] **Step 2: Kiểm tra đầy đủ** (dán output): api `npm test && npm run test:e2e && npm run test:db`, `npm audit --omit=dev`, `npx madge --circular --extensions ts src` = 0; web `npm test && npm run lint && npm run build`, `npx madge --circular --extensions ts,tsx src` = 0; `npx playwright test` (hai lần, toàn bộ xanh); `docker compose up -d --build` → `/api/health` 200; `grep -ri qlts api web --exclude-dir=node_modules | wc -l` = 0; `grep -rn "TODO" api/src web/src | wc -l` = 0; không file > 400 dòng (`find api/src api/test web/src web/playwright -name '*.ts*' | xargs wc -l | sort -n | tail -3`); `git status` không có `.env`.
- [ ] **Step 3: Sơ đồ** — skill `archify` từ bằng chứng code: kiến trúc (thêm notifications/delivery/reports/reminders, cron, exceljs), tuần tự "giao một dòng" (khóa requests → lines → items, SAVEPOINT chuông), vòng đời tháng (ngày 1 / `lastDay−2` / `lastDay+1` / giao / còn nợ / bản chốt); đối chiếu `architecture.md`, lệch thì sửa tài liệu hoặc code + ghi `review-spec.md`.
- [ ] **Step 4: Commit** — `chore: smoke trọn vòng tháng Plan 3, sơ đồ, bản đồ, README`.
- [ ] **Step 5: Review toàn nhánh** — dispatch Opus whole-branch (range `3a47336..HEAD`) + skill `code-review` mức high (theo ruling Plan 2); gộp findings một đợt sửa; chạy lại Step 2; dừng và báo chủ dự án (kèm "Chờ chủ dự án" 1–2) — không gộp `main`, không push.
