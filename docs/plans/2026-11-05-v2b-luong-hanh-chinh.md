# Plan v2-B — Luồng Hành chính mới (Tháng này · Giao theo người · Hàng về · Gửi ADM · Danh mục ảnh)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hành chính làm cả tháng theo 4 bước Đăng ký → Gửi ADM → Hàng về → Giao, mỗi bước một màn theo thiết kế v2; giao theo người gộp luôn nợ kỳ trước.

**Architecture:** 2 endpoint mới (`GET admin/periods/:ym/delivery-people`, `POST admin/stock/receipts`) tái dùng lõi có sẵn (`DeliveryService.deliverWithin`-không đổi, `StockService.applyChange`/`record`, predicate `line-predicates.ts`). 4 trang web mới trong `features/` dùng lại hook có sẵn (`useMonthReport`, `useOrderQty`, `useTakeSnapshot`, `useUnregisteredCopy`, `ImageField`, `ItemThumb`). Trang cũ không xóa: chuyển sang nhóm sidebar "Xem lại sau" (Q18).

**Tech Stack:** NestJS + raw SQL (`tx.execute(sql\`…\`)`), class-validator, Jest e2e (fixtures `api/test/*.fixture.ts`); React 19, TanStack Query, i18next, vitest, Playwright.

**Nguồn sự thật:** `docs/quyet-dinh-2026-11-05-luong-hanh-chinh.md` (Q3, Q4, Q5, Q6, Q11–Q14, Q18, "Ví dụ chuẩn") · thiết kế `design-preview/v2-glass/Main|Giao|HangVe|GuiADM|DanhMuc.dc.html` · `docs/prd.md` FR-35, FR-41, BR-8, BR-15 · `docs/architecture.md` §6, §7.

**Điều kiện đầu:** Plan v2-A đã merge vào nhánh làm việc (có `.shell__panel`, token v2, `ADMIN_NAV` 4 nhóm, khóa `nav.groups.later`).

## Global Constraints

- Nhánh: tiếp tục `feat/giao-dien-v2`. Không push. Commit tiếng Việt, 1 commit/task, `git add <đường dẫn>`.
- **Kỳ làm việc của HC** = `lockedYm = shiftYm(current.ym, -1)` (`web/src/lib/ym`) — Gửi ADM, Hàng về, Giao đều thao tác trên kỳ này; Đăng ký là kỳ đang mở `current.ym`.
- Luật giữ nguyên: không âm kho (FR-41, `STOCK_INSUFFICIENT` 409 `{available}`), `0 ≤ delivered_qty ≤ qty` (BR-8), Cần mua = `max(0, requested + backlog_prev − stock)` (BR-15, `reports/report-need.ts`), Hủy nợ có lý do (FR-35, giữ ở trang Còn nợ).
- Thứ tự khóa: requests → request_lines → items (`StockService.lockItemsWithin` sắp id). Mọi thay đổi ghi audit qua `AuditWriterService.appendWithin` trong cùng giao dịch.
- Endpoint mới: thêm dòng vào bảng `docs/architecture.md` §7 (:205-219), mã lỗi mới (nếu có) vào đoạn :223, cùng commit.
- Web: chuỗi qua i18n vi + en; CSS M1 có tiền tố `[data-shell='admin']`, theo thang `--t-*`/`--s-*`; component ≤ 250 dòng; file ≤ 400.
- Ảnh món: luôn `ItemThumb` (`ui/item-thumb.tsx`) với `image_file_id`; không có ảnh → placeholder theo tông nhóm (đã có sẵn).
- **Không có "Hoàn tác" sau khi giao** — chủ dự án chốt 2026-11-05 (Q19). Giao sai thì sửa qua Kho → Điều chỉnh có lý do. Không làm nút Hoàn tác dù thiết kế có.
- Mỗi task giao diện: Playwright 1280 + 390, axe 390 không lỗi tương phản, chụp màn đính báo cáo; cập nhật `docs/map.md`.

## Cổng mỗi task: TDD · DoD · E2E · Live (bắt buộc, theo `CLAUDE.md`)

Áp cho **mọi** task, kể cả khi bước của task không nhắc lại:

1. **TDD:** RED trước → chạy, xác nhận fail **đúng lý do** (không phải lỗi import/cú pháp) → GREEN tối thiểu → refactor. Báo cáo dán lệnh + output RED và GREEN. Test `skip`, test không assert, test chỉ kiểm mock = chưa làm.
2. **Biên hai phía (phễu):** mọi giới hạn task chạm có test ở cả hai phía mốc, tầng rẻ nhất: unit → db-spec → e2e → Playwright. Báo cáo có **bảng biên → tầng test**.
3. **Tầng đúng loại:** luật thuần → unit; CHECK/đồng thời → `*.db-spec.ts` (đồng thời = `Promise.all` hai request thật); endpoint/vai/mã lỗi → `*.e2e-spec.ts` (`createTestApp` + `x-dev-user-sub`/`x-dev-role`); component → vitest; luồng xuyên api+web → Playwright (`getByRole`/`getByLabel`/chữ tiếng Việt, không CSS class; kỳ khóa seed bằng SQL, không giả đồng hồ trình duyệt).
4. **DoD trước commit:** api `npm test && npm run test:e2e && npm run test:db && npm run build` + web `npm test && npm run lint && npm run build` — xanh, output sạch (không warning lạ/`console.error`); i18n vi + en; mutate có audit before/after; mutate idempotent hoặc `expected_*`; mã lỗi đúng `architecture.md` §7; `grep -ri qlts api web` = 0; không `TODO`; không file > 400 dòng; `npx madge --circular` = 0; `docs/map.md` cập nhật.
5. **E2E Playwright:** luồng của task chạy ở `desktop-1280` + `mobile-390` trên `docker compose` dev; axe 390 không lỗi tương phản.
6. **Kiểm live (task có giao diện):** mở app dev thật bằng Playwright MCP, chụp 1280 + 390 các màn bị ảnh hưởng và **NHÌN** (so với `design-preview/v2-glass/*.dc.html`); ảnh để ở scratchpad `live-real/v2/<task>/`, không commit. Thử tay luồng chính bằng tài khoản PMH ID **Hành chính** trong `test-accounts.local.md` (không chép mật khẩu ra file/chat/log). Lỗi thấy khi live → test đỏ trước rồi mới sửa.
7. **Báo cáo task:** RED/GREEN, lệnh verify, bảng biên, danh sách file, ảnh live, điều còn băn khoăn. Reviewer độc lập; Critical/Important sửa xong mới sang task sau.

## Review Focus

1. **Người chỉ có nợ, không có phiếu kỳ này** → vẫn xuất hiện ở Giao (tab Còn nợ), giao được dòng nợ (test B1 + B3).
2. **Hai HC giao cùng lúc / tồn vừa bị người khác lấy** → dòng lỗi `STOCK_INSUFFICIENT` hạ trần stepper xuống `available`, không giao lố (đã có `onLineFailure`; test B3).
3. **Lưu Hàng về hai lần (bấm đúp, mạng chậm)** → lần 2 bị `STALE_UPDATE` vì `expected_stock_qty`, kho không cộng đôi (test B2).
4. **Kỳ chưa khóa** (trước hạn) → Giao/Hàng về/Gửi ADM hiện thông báo "Kỳ tháng N chưa khóa sổ, mở lại sau {{hạn}}", không nút thao tác (test B1 409 + B3/B4 web).
5. **Món ngoài danh mục đang chờ duyệt trong phiếu** → hiện ở thẻ người với nhãn "Chờ duyệt", không có stepper; Gửi ADM chặn mềm "Còn n món ngoài danh mục chưa duyệt" (test B3, B5).

---

### Task B1: API — danh sách giao theo người (gồm nợ)

**Files:**
- Create: `api/src/modules/delivery/delivery-people.service.ts`, `api/src/modules/delivery/delivery-people.controller.ts`
- Modify: `api/src/modules/delivery/delivery.dto.ts` (thêm interface), `api/src/modules/delivery/delivery.module.ts`
- Test: `api/test/delivery-people.e2e-spec.ts` (dùng `deliveryFixture`)
- Docs: `docs/architecture.md` §7 dòng "Giao"

**Interfaces:**
- Produces: `GET /api/admin/periods/:ym/delivery-people` (`@Roles('admin','sa')`, `@Param('ym', YmPipe)`) → `{ ym: string; people: DeliveryPerson[] }`

```ts
export type DeliveryPersonStatus = 'pending' | 'debt' | 'done';
export interface DeliveryPersonLine {
  line_id: string; request_id: string; period_ym: string; is_debt: boolean; // period_ym < ym
  item_id: string | null; name: string; name_en: string | null; unit: string;
  image_file_id: string | null; // item.image_file_id, món ngoài DM: ảnh của dòng
  qty: number; delivered_qty: number; cancelled_qty: number; remaining_qty: number;
  stock_qty: number | null; review_status: 'n/a' | 'pending' | 'accepted' | 'converted';
}
export interface DeliveryPerson {
  user_sub: string; full_name: string | null; department: string | null; user_status: string;
  request_id: string | null; // phiếu kỳ ym, null nếu chỉ có nợ
  status: DeliveryPersonStatus; owed_lines: number; open_lines: number;
  lines: DeliveryPersonLine[]; // nợ trước (period_ym tăng dần), rồi dòng kỳ ym; theo l.id
}
```

Quy tắc chọn dòng (một câu SQL, `p.deadline <= now`):
- Dòng **kỳ ym**: mọi dòng có `review_status <> 'rejected'` (kể cả đã giao đủ — để tab Đã nhận có dữ liệu).
- Dòng **nợ**: `r.period_ym < ym AND ${UNDELIVERED_LINE}`.
- `status`: còn dòng kỳ ym `remaining > 0` → `pending`; không, nhưng còn dòng nợ → `debt`; còn lại → `done`. Sắp người theo `full_name` `localeCompare(…, 'vi')`, rồi `user_sub`.
- ym chưa khóa (`now < deadline`) → 409 `PERIOD_NOT_LOCKED` (dùng `periodNotLocked()` có sẵn); ym không có kỳ → cũng 409 `PERIOD_NOT_LOCKED` (giống `assertPeriodLocked` hiện có; không thêm mã lỗi mới).

- [ ] **Step 1: Test đỏ** `delivery-people.e2e-spec.ts` theo "Ví dụ chuẩn" trong file quyết định:
  - `it('A cần 3, B cần 10, tồn 10: cả hai pending, stock_qty 10')` — `lines[0].remaining_qty` A=3, B=10.
  - `it('A nhận đủ → done, xuất hiện kèm dòng đã giao')`.
  - `it('B giao 7 → vẫn pending kỳ 11; sang kỳ 12 B có dòng is_debt remaining 3, request_id kỳ 12 null nếu B không đăng ký → status debt')`.
  - `it('dòng bị từ chối không xuất hiện; dòng ngoài DM chờ duyệt có review_status pending')`.
  - Biên khóa sổ (đồng hồ `freeze`): `it('deadline − 1 ms → 409 PERIOD_NOT_LOCKED')` và `it('đúng deadline → 200')`.
  - `it('kỳ chưa khóa → 409 PERIOD_NOT_LOCKED')`, `it('member gọi → 403')`, `it('ym sai định dạng → 400 INVALID_PERIOD')`.
- [ ] **Step 2:** `cd api && npm run test:e2e -- delivery-people` → FAIL (404 route).
- [ ] **Step 3:** Viết service + controller; `DeliveryPeopleService.list(ym: string): Promise<{ym; people: DeliveryPerson[]}>`.
- [ ] **Step 4:** `npm run test:e2e -- delivery-people` PASS; `npm test && npm run test:e2e && npm run build` xanh; `npx madge --circular src` = 0.
- [ ] **Step 5:** §7 thêm `GET admin/periods/:ym/delivery-people` → 200 `{ym, people}` (409 `PERIOD_NOT_LOCKED`). Commit `feat: API danh sách giao theo người gồm nợ kỳ trước`.

### Task B2: API — nhập hàng về nhiều món một lần

**Files:**
- Create: `api/src/modules/catalog/stock-receipt.service.ts`
- Modify: `api/src/modules/catalog/stock.controller.ts`, `api/src/modules/catalog/stock.dto.ts`, `api/src/modules/catalog/stock.service.ts` (chỉ export `applyChange` dạng `applyChangeWithin(tx, itemId, dto, actor)` nếu đang private — không đổi hành vi)
- Test: `api/test/stock-receipt.e2e-spec.ts` (vai, validate, mã lỗi) + `api/test/stock-receipt.db-spec.ts` (rollback, đồng thời)
- Docs: `docs/architecture.md` §7 dòng "Kho"

**Interfaces:**
- Produces: `POST /api/admin/stock/receipts` `@HttpCode(200)` body `ReceiptBody` → `ReceiptResult`

```ts
export class ReceiptLine { @IsUUID() item_id!: string; @IsInt() @Min(1) @Max(99_999) qty!: number; @IsInt() @Min(0) expected_stock_qty!: number; }
export class ReceiptBody {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => ReceiptLine) lines!: ReceiptLine[];
  @IsString() @Matches(/^\d{4}-\d{2}$/) ym!: string;          // kỳ hàng về cho, chỉ ghi vào note/audit
  @TrimToNull() @IsOptional() @IsString() @MaxLength(500) note?: string | null;
}
export interface ReceiptResult { items: { item_id: string; stock_qty: number; movement_id: string }[] }
```

Hành vi: **tất cả hoặc không** (một transaction, không savepoint từng dòng). `item_id` trùng → 400 `VALIDATION` (`fields.lines`). `lockItemsWithin(tx, ids)` rồi với từng dòng: `stock_qty ≠ expected_stock_qty` → 409 `STALE_UPDATE {item_id, stock_qty}`; món không tồn tại/ngừng dùng → 404 `ITEM_NOT_FOUND {item_id}`; ngược lại áp như `purchase` hiện có (reset `restock_level`, xóa `low_stock_notified_at`, movement reason `purchase`, note = `Hàng về kỳ {ym}` + ` · {note}` nếu có, audit `stock.purchase`). Thêm 1 audit tổng `stock.receipt` (objectType `period`, objectId `ym`, detail `{lines: [{item_id, qty}], note}`).

- [ ] **Step 1: Test đỏ e2e** `stock-receipt.e2e-spec.ts`:
  - `it('nhập 2 món → 200, cộng tồn cả hai, 2 movement purchase, audit stock.purchase ×2 + stock.receipt có before/after')`.
  - Biên: `qty 1 → 200` / `qty 0 → 400`; `qty 99999 → 200` / `qty 100000 → 400`; `200 dòng → 200` / `201 dòng → 400`; `0 dòng → 400`; `note 500 ký tự → 200` / `501 → 400`.
  - `it('item_id trùng → 400 VALIDATION fields.lines')`, `it('món không tồn tại → 404 ITEM_NOT_FOUND')`, `it('member → 403')`, `it('ym sai định dạng → 400')`.
- [ ] **Step 2: Test đỏ db** `stock-receipt.db-spec.ts`:
  - `it('gửi lại cùng body (expected cũ) → 409 STALE_UPDATE, tồn không đổi')` (Review Focus 3).
  - `it('một dòng sai expected → không món nào được cộng, không movement, không audit')`.
  - `it('hai request đồng thời cùng expected (Promise.all) → đúng một 200, một 409, tồn cộng một lần')`.
  - `it('nhập song song với giao (Promise.all receipt + deliver cùng món) → không deadlock, tồn cuối đúng')`.
- [ ] **Step 2b:** `npm run test:e2e -- stock-receipt && npm run test:db -- stock-receipt` → FAIL đúng lý do (404 route).
- [ ] **Step 3:** Viết DTO, `StockReceiptService.receive(body: ReceiptBody, actor: string): Promise<ReceiptResult>`, route.
- [ ] **Step 4:** test PASS; `npm test && npm run test:e2e && npm run test:db && npm run build` xanh.
- [ ] **Step 5:** §7 thêm dòng. Commit `feat: API nhập hàng về nhiều món (tất cả hoặc không)`.

### Task B3: Trang Giao hàng theo người

**Files:**
- Create (`web/src/features/delivery/people/`): `delivery-people.api.ts`, `delivery-people-page.tsx`, `person-card.tsx`, `person-panel.tsx`, `person-line-row.tsx`, `people-filter.ts`, `delivery-people.m1.css` + test `*.test.tsx`/`.test.ts` cùng tên
- Modify: `web/src/shell/app-routes.tsx` (`delivery` → `DeliveryPeoplePage`; trang cũ chuyển `delivery/classic`), `web/src/shell/admin-nav.ts` (nhóm `later` thêm `delivery/classic` "Giao hàng (bản cũ)"), locales `delivery.ts` vi/en
- Test Playwright: `web/playwright/delivery-people.spec.ts` (seed theo `p3-seed.ts`)

**Interfaces:**
- Consumes: B1; `deliverLine(lineId, {qty, expected_delivered_qty}, csrf)` & `deliverAll(requestId, csrf)` (`delivery.api.ts`); `deliverMax(remaining, stock, cap)`; `lineErrorText`, `LINE_CODES`/`STALE_CODES` (`delivery-errors.ts`); `ItemThumb`.
- Produces:

```ts
export const deliveryPeopleQuery = (ym: string | undefined) => ({ queryKey: ['admin', 'delivery-people', ym], … });
export type PeopleTab = 'pending' | 'debt' | 'done' | 'all';
export function filterPeople(people: DeliveryPerson[], tab: PeopleTab, q: string): DeliveryPerson[]; // q khớp full_name/department, bỏ dấu, không phân biệt hoa thường
export function waitingFor(people: DeliveryPerson[], itemId: string, exceptSub: string): { people: number; qty: number };
```

Màn (theo `Giao.dc.html`): URL `?tab=&q=&person=<user_sub>`. Đầu: tiêu đề `Giao hàng kỳ tháng {{m}}`, tab có số (Chưa nhận/Còn nợ/Đã nhận/Tất cả), ô tìm. Lưới thẻ người: avatar chữ đầu (`lib/initials`), tên, phòng, nhãn trạng thái, dải tối đa 4 `ItemThumb size=34` + `+N`, dòng cam `Nợ tháng {{m}}: {{n}} món` nếu có `is_debt`; nút `Xem` và `Giao đủ` (gọi `deliverAll` cho `request_id` và với từng dòng nợ gọi `deliverLine` với `remaining`; nếu có dòng `stock_qty < remaining` thì nút đổi thành `Giao {{x}}/{{y}}` và mở panel thay vì giao). Panel phải (drawer `ui/drawer` trên 390): nhóm "Nợ kỳ trước" ở đầu rồi "Tháng {{m}}"; mỗi dòng `ItemThumb 48`, tên, `Cần {{remaining}} · Tủ còn {{stock}}`, `Stepper` mặc định `deliverMax(...)`; khi số < remaining: cảnh báo cam `Giao {{x}}, còn nợ {{y}}` + (nếu `waitingFor().people > 0`) `Còn {{n}} người chờ món này, cần thêm {{qty}}`. Dòng `review_status='pending'`: nhãn `Chờ duyệt` + link `/admin/review`, không stepper. Nút chính `Giao` (giao tuần tự các dòng qty > 0, theo mẫu `use-deliver-selected.ts`), sau thành công: toast `Đã giao cho {{name}}` + nút `Người tiếp theo` (người kế trong danh sách đang lọc). Kỳ chưa khóa (409): `EmptyState` "Kỳ tháng {{m}} chưa khóa sổ. Giao được từ {{deadline}}."

- [ ] **Step 1: Test đỏ** `people-filter.test.ts`: lọc tab/từ khóa có dấu ("binh" khớp "Lê Thị Bình"); `waitingFor` trả `{people: 1, qty: 3}` cho kịch bản bút B.
- [ ] **Step 2: Test đỏ** `person-panel.test.tsx`: dòng nợ đứng trước; stepper mặc định `min(remaining, stock)` (B cần 10, tủ 7 → 7) và cảnh báo `Giao 7, còn nợ 3`; lỗi `STOCK_INSUFFICIENT available 2` → stepper max 2 + chữ `Chỉ còn 2 cây.`; dòng chờ duyệt không có `spinbutton`.
- [ ] **Step 3: Test đỏ** `delivery-people-page.test.tsx`: số trên tab đúng; `Giao đủ` trên thẻ đủ hàng gọi `deliverAll` 1 lần; thẻ thiếu hàng hiện `Giao 7/10` và mở panel; 409 hiện thông báo chưa khóa sổ; người chỉ có nợ có ở tab Còn nợ (Review Focus 1).
- [ ] **Step 3b: Biên stepper** trong `person-panel.test.tsx`: giá trị = `min(remaining, stock)` cho bấm `+` bị vô hiệu; `1` thì `−` bị vô hiệu; tồn 0 → không stepper, chữ `Tủ hết món này`.
- [ ] **Step 4:** Chạy 3 file → FAIL. **Step 5:** Viết code; route + nav. **Step 6:** `npm test && npm run lint && npm run build` xanh.
- [ ] **Step 7: Playwright** `delivery-people.spec.ts`: `test('Ví dụ chuẩn: A đủ 3, B giao 7 nợ 3')` — nhập tồn 10 (API seed), tìm A → Giao đủ → tủ 7; mở B → thấy `Giao 7, còn nợ 3` → Giao → B ở tab Chưa nhận với `7/10`. 1280 + 390, axe 390. `npx playwright test delivery backlog p3-flow` vẫn xanh (trang cũ ở `delivery/classic`: sửa URL trong spec cũ nếu cần, ghi vào báo cáo).
- [ ] **Step 8:** Commit `feat: Giao hàng theo người, gộp nợ kỳ trước`.

### Task B4: Trang Hàng về

**Files:**
- Create (`web/src/features/arrivals/`): `arrivals.api.ts`, `arrivals-page.tsx`, `arrival-rows.ts`, `arrival-table.tsx`, `arrivals.m1.css` + tests
- Modify: `app-routes.tsx` (route `arrivals`), `admin-nav.ts` (nhóm `monthly` sau `delivery`: `{ path: 'arrivals', titleKey: 'nav.arrivals', icon: 'pkg' }`), locales `arrivals.ts` vi/en + đăng ký trong `locales/{vi,en}/index.ts`

**Interfaces:**
- Consumes: `useMonthReport(lockedYm)` (`features/reports`) → `byItem[] {key,item_id,code,name,unit,requested,backlog_prev,stock,need}`; `useAdminItems()` (ảnh, `stock_qty` hiện tại cho `expected_stock_qty`); B2.
- Produces:

```ts
export function postReceipt(body: ReceiptBody, csrf: string): Promise<ReceiptResult>;
export interface ArrivalRow { item_id: string; name: string; unit: string; image_file_id: string | null; waiting: number; stock: number; qty: number; edited: boolean }
export function toArrivalRows(report: MonthReport, items: AdminItem[]): ArrivalRow[]; // chỉ món có item_id && need > 0; waiting = requested + backlog_prev; qty mặc định = need
export function arrivalTag(r: ArrivalRow): 'short' | 'over' | 'exact'; // qty < need → short (Thiếu), > → over (Dư), = → exact (Đủ)
```

Màn (theo `HangVe.dc.html`): tiêu đề `Hàng về kỳ tháng {{m}}`; 3 ô số (món cần nhập, tổng đơn vị, món đã đủ); bảng Món (ảnh 36) · Còn chờ · Tủ hiện có · **Về lần này** (ô số, điền sẵn `need`, 0 = bỏ qua) · nhãn Thiếu/Dư/Đủ · Tủ sau khi lưu; nút `Thêm món khác` (chọn món trong danh mục chưa có trong bảng, qty mặc định 1); ô ghi chú đợt; nút `Lưu hàng về` (disabled khi mọi qty = 0) → `postReceipt` chỉ các dòng qty > 0. Thành công: dải xanh `Đã nhập {{n}} món vào tủ. Tiếp theo: Giao hàng` + link `/admin/delivery`, invalidate report/items/delivery-people. `STALE_UPDATE` → tải lại items và báo `Tủ vừa thay đổi, kiểm lại số rồi lưu lại`. Món ngoài danh mục (không có `item_id`) không nhập kho: dòng ghi chú dưới bảng `{{n}} món ngoài danh mục giao thẳng, không qua tủ`.

- [ ] **Step 1: Test đỏ** `arrival-rows.test.ts`: Ví dụ chuẩn (A 3 + B 10, tủ 0) → 1 dòng need 13, qty 13, tag `exact`; sửa qty 10 → `short`; tháng sau B nợ 3 → `waiting` gồm `backlog_prev` 3.
- [ ] **Step 2: Test đỏ** `arrivals-page.test.tsx`: lưu gửi đúng body (`expected_stock_qty` = `stock_qty` hiện tại, bỏ dòng qty 0); 409 STALE → thông báo và refetch; tất cả 0 → nút disabled; kỳ chưa khóa → thông báo (Review Focus 4).
- [ ] **Step 2b: Biên ô Về lần này:** `0` được (bỏ dòng), `-1` báo lỗi gắn ô (`aria-describedby`); `99999` được, `100000` báo lỗi `Tối đa 99.999`; nút Lưu vô hiệu khi có ô lỗi.
- [ ] **Step 3:** FAIL → viết code → `npm test && npm run lint && npm run build` xanh.
- [ ] **Step 4: Playwright** `arrivals.spec.ts` `test('Hàng về điền sẵn Cần mua, sửa 10 rồi lưu → tủ 10')`, 1280 + 390, axe.
- [ ] **Step 5:** Commit `feat: trang Hàng về nhập theo món, điền sẵn Cần mua`.

### Task B5: Trang Gửi ADM

**Files:**
- Create (`web/src/features/send-adm/`): `send-adm-page.tsx`, `send-adm-checklist.tsx`, `request-form-preview.tsx`, `send-adm.m1.css` + tests
- Modify: `app-routes.tsx` (`send-adm`), `admin-nav.ts` (monthly: `{ path: 'send-adm', titleKey: 'nav.sendAdm', icon: 'printer' }` sau `home`), locales
- Check: `api/src/modules/reports/xlsx-request-form.ts` so với sheet `ACC` của `VPPham (2).xlsx` (repo root)

**Interfaces:**
- Consumes: `useMonthReport`, `useOrderQty(report)`, `useTakeSnapshot(report, qty, files, onInvalidPeriod)`, `useSnapshotDownload(ym)` (`features/reports`); `periodSummaryQuery(lockedYm)` (`unregistered`, `custom_pending`); `useAdminConfig()` (`features/admin/admin.api.ts:75`) `signature_boxes`.
- Produces: `RequestFormPreview({ rows, signatureBoxes, ym })` — tờ A4 thu nhỏ đúng thứ tự cột sheet 1 Excel: `STT · Mã · Tên vật dụng · Item name · ĐVT · SL` + ô ký.

Màn (theo `GuiADM.dc.html`): cột trái **Kiểm trước khi gửi** — 3 mục có dấu: `{{n}} người chưa đăng ký` (cảnh báo, link Tổng hợp kỳ), `{{n}} món ngoài danh mục chưa duyệt` (cảnh báo, link Món ngoài danh mục — Review Focus 5), `Đã trừ hàng trong tủ` (luôn xanh). Bảng **Số đề nghị**: Món (ảnh 36, mã) · Cần · Tủ · **Đề nghị** (ô sửa = `useOrderQty`, mặc định `need`). Cột phải: `RequestFormPreview`; hai nút `In trình ký` (`take('print')`) và `Xuất Excel mẫu phòng` (`take('xlsx')`); danh sách bản đã xuất (`ReportSnapshots`, tái dùng).

- [ ] **Step 1:** Đọc sheet `ACC` (`python3 -I` + openpyxl hoặc unzip XML) — ghi tên cột, thứ tự, ô ký vào báo cáo. Nếu khác `xlsx-request-form.ts` (cột/tiêu đề/ô ký): thêm test đỏ vào `xlsx-request-form` spec (`api/src/modules/reports/xlsx-report.spec.ts`) khẳng định đúng tiêu đề ACC, sửa, chạy `npm test` (api). Nếu giống: ghi "khớp" và bỏ qua.
- [ ] **Step 2: Test đỏ** `send-adm-page.test.tsx`: checklist hiện `3 người chưa đăng ký` / `1 món ngoài danh mục chưa duyệt`; sửa Đề nghị 13 → 10 thì preview hiện 10; `Xuất Excel mẫu phòng` gọi `createSnapshot` với `order_qty` chứa 10; món đề nghị 0 không có trong preview.
- [ ] **Step 2b: Biên Đề nghị** (`ORDER_QTY_MAX = 99999`): `99999` được / `100000` lỗi gắn ô; `0` được (món biến khỏi preview); ô trống → lỗi, nút xuất vô hiệu.
- [ ] **Step 3: Test đỏ** `request-form-preview.test.tsx`: header đúng 6 cột theo thứ tự; STT liên tục; 2 ô ký từ `signature_boxes`.
- [ ] **Step 4:** FAIL → viết → `npm test && npm run lint && npm run build` xanh.
- [ ] **Step 5: Playwright** `send-adm.spec.ts`: sửa số → Xuất Excel → file tải về tên `vpp-bao-cao-<ym>.xlsx`; In trình ký mở trang in. 1280 + 390.
- [ ] **Step 6:** Commit `feat: trang Gửi ADM — kiểm trước, số đề nghị, xem trước mẫu phòng`.

### Task B6: Trang Tháng này (trang chủ HC)

**Files:**
- Create (`web/src/features/home/`): `home-page.tsx`, `month-steps.ts`, `month-steps.tsx`, `home-cards.tsx`, `home.m1.css` + tests
- Modify: `app-routes.tsx` (`home`), `admin-nav.ts` (`ADMIN_HOME = 'home'`; monthly = `home` Tháng này · `delivery` · `arrivals` · `send-adm`; chuyển `summary` "Tổng hợp kỳ", `reports` "Báo cáo & in" sang `later`), locales `home.ts`

**Interfaces:**
- Consumes: `currentPeriodQuery`, `periodSummaryQuery(ym)` cho `current.ym` và `lockedYm`, `useSnapshots(lockedYm)` (`reports.api.ts:116`, `GET …/:ym/snapshots`), `useMonthReport(lockedYm)`, `reviewLinesQuery('pending','')`, `lowStockQuery()`, `useUnregisteredCopy(ym, deadline)`.
- Produces:

```ts
export type StepKey = 'register' | 'send' | 'arrive' | 'deliver';
export interface StepState { key: StepKey; done: boolean; current: boolean; value: string; progress?: number; to: string }
export function monthSteps(input: { registered: number; headcount: number | null; isOpen: boolean; snapshots: number; needTotal: number; pendingDelivery: number }): StepState[];
// register.done = !isOpen; send.done = snapshots > 0; arrive.done = needTotal === 0; deliver.done = pendingDelivery === 0; current = bước đầu tiên chưa done
```

Màn (theo `Main.dc.html`): chào `Chào {{tên}}`; dải tối 4 bước (Đăng ký → Gửi ADM → Hàng về → Giao), bước `current` có số lớn + thanh + nút đi thẳng (`to`: `/admin/summary`, `/admin/send-adm`, `/admin/arrivals`, `/admin/delivery`); chuyển kỳ `Segmented`: `Kỳ đang giao (tháng {{locked}})` / `Kỳ đang đăng ký (tháng {{current}})` — kỳ đăng ký chỉ có bước 1 hoạt động, 3 bước sau mờ "sau khi khóa sổ". Thẻ chính `{{n}} người chưa đăng ký kỳ tháng {{m}}` (chip tên tối đa 8 + `+N`, nút `Chép tin nhắc` dùng `useUnregisteredCopy`) — ẩn khi 0. Thẻ phụ chỉ hiện khi có: `{{n}} món ngoài danh mục chờ xem` (link `/admin/review`), `{{n}} món trong tủ sắp hết` (link `/admin/stock`).

- [ ] **Step 1: Test đỏ** `month-steps.test.ts`: đang mở → current `register`; đã khóa, chưa snapshot → `send`; có snapshot, need 13 → `arrive`; need 0, pending 4 → `deliver`; tất cả xong → không bước nào current, mọi `done`.
- [ ] **Step 2: Test đỏ** `home-page.test.tsx`: thẻ chưa đăng ký ẩn khi 0; thẻ món ngoài DM ẩn khi 0, hiện khi 1; nút bước hiện tại dẫn đúng `to`; vào `/admin` → chuyển về `/admin/home`.
- [ ] **Step 3:** FAIL → viết → `npm test && npm run lint && npm run build` xanh; sửa test sidebar Plan A (thứ tự nhóm monthly/later mới).
- [ ] **Step 4: Playwright** `home.spec.ts` + cập nhật `admin-shell.spec.ts`/`smoke.spec.ts` (trang chủ mới). 1280 + 390, axe.
- [ ] **Step 5:** Commit `feat: trang Tháng này — 4 bước của kỳ, việc cần làm`.

### Task B7: Danh mục dạng lưới ảnh

**Files:**
- Create: `web/src/features/catalog/catalog-grid.tsx`, `catalog-card.tsx`, `catalog-tabs.ts`, `staff-preview.tsx` + tests
- Modify: `catalog-page.tsx` (chế độ `?view=grid|table`, mặc định `grid`; tab), `item-drawer.tsx` (thêm `StaffPreview` dưới các trường), `catalog.m1.css`, locales `catalog.ts`

**Interfaces:**
- Consumes: `CatalogRow` (`catalog-rows.ts`), `ImageField`, `uploadItemImage` + `PATCH admin/items/:id {image_file_id}` (hook cập nhật món có sẵn trong `use-item-form.ts`/catalog.api), `ItemThumb size='card'`.
- Produces: `export type CatalogTab = 'active' | 'low' | 'noImage' | 'inactive'; export function inTab(row: CatalogRow, tab: CatalogTab): boolean;` (`low` = hết hoặc dưới `restock_level`, theo cách `stock-rows.ts` đang tính sắp hết).

Màn (theo `DanhMuc.dc.html`): tab có số Đang dùng · Sắp hết/hết · Chưa có ảnh · Đã ngừng; chip nhóm + tìm (giữ toolbar cũ); lưới `repeat(auto-fill, minmax(200px, 1fr))` thẻ: ảnh lớn, nhãn nhóm, nhãn tồn (`Hết` đỏ / `Còn {{n}}`), tên, mã · ĐVT · `tối đa {{max}}/tháng`; thẻ chưa ảnh có nút `Tải ảnh lên` (chọn file → nén → upload → PATCH, không mở drawer); nút `Sửa` mở `ItemDrawer` có sẵn. `StaffPreview`: thẻ thu nhỏ giống thẻ món phía nhân viên (ảnh, tên, ĐVT, tối đa) cập nhật theo form. Nút đổi `Lưới / Bảng` giữ bảng cũ (thao tác hàng loạt vẫn ở chế độ Bảng).

- [ ] **Step 1: Test đỏ** `catalog-tabs.test.ts` (4 tab, món ngừng chỉ ở `inactive`); `catalog-card.test.tsx` (`Tải ảnh lên` gọi upload rồi PATCH `image_file_id`; lỗi `FILE_TOO_LARGE` hiện `Ảnh quá 5 MB`; biên đã có ở api `files-formats.e2e-spec` — Playwright dùng ảnh hợp lệ); `catalog-page.test.tsx` thêm `?view=table` vẫn ra bảng cũ.
- [ ] **Step 2:** FAIL → viết → `npm test && npm run lint && npm run build` xanh.
- [ ] **Step 3: Playwright** `catalog.spec.ts` thêm `test('Lưới: tải ảnh lên cho món chưa có ảnh')` (dùng fixture ảnh của `camera-photo.spec.ts`). 1280 + 390.
- [ ] **Step 4:** Commit `feat: Danh mục dạng lưới ảnh, tải ảnh tại thẻ, xem trước phía nhân viên`.

### Task B8: Vòng kiểm cuối plan

- [ ] **Step 1:** api `npm test && npm run test:e2e && npm run test:db && npm run build`, `npx madge --circular src`; web `npm test && npm run lint && npm run build && npm run typecheck:e2e`.
- [ ] **Step 2:** `npx playwright test` toàn bộ 1280 + 390 → 0 fail. Chạy tay "Ví dụ chuẩn" 4 bước qua UI (Tháng này → Gửi ADM → Hàng về 10 → Giao A 3, B 7 → kỳ sau B nợ 3), chụp từng bước.
- [ ] **Step 3:** `docs/map.md` (features home, arrivals, send-adm, delivery/people; API delivery-people, stock/receipts), `docs/architecture.md` §7 đủ.
- [ ] **Step 4:** `archify` vẽ lại luồng HC 4 bước vào `docs/diagrams/`. Review toàn nhánh + `code-review high`, sửa một vòng, báo cáo chủ dự án. Không merge khi chưa duyệt.
- [ ] **Step 5:** Commit `docs: Plan v2-B xong — map, kiến trúc, sơ đồ`.
