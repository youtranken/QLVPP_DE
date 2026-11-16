# Port giao diện A + sửa lỗi rà soát — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (Opus làm liền trong phiên), review độc lập theo giai đoạn như `CLAUDE.md` mục Review. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa mockup đã chốt (bo góc A 6/8/12 + một bộ nút/ô nhập/dropdown/popup) vào code, sửa mọi lỗi Hỏng/Lệch của báo cáo rà soát 15/11, và làm các ý mục G đã chốt (G2 Điều chỉnh giảm/từ chối, G6 bỏ Kiểm kê + trang Xuất lẻ, G7 bỏ món chỉ Adm D&E, G8 duyệt trong Xem phiếu).

**Architecture:** Sửa ở gốc trước (token, `ui/*`, `css/m1/*`), mỗi gốc kèm một máy chặn tái phát (test quét CSS hoặc Playwright đo nhiều route). Sau đó vá các lỗi riêng màn theo feature. Không đổi API trừ H9 (chữ "Thay thế bản…") và kiểm biên server cho các ô số đã có.

**Tech Stack:** React 19 + Vite 8 + TS 6, CSS token riêng (`web/src/css/tokens-m1.css`), vitest + Testing Library, Playwright trên compose dev; NestJS 12 + jest e2e cho phần api.

**Spec:** `docs/superpowers/specs/2026-11-15-ra-soat-giao-dien.md` (báo cáo rà soát; mã H1–H13, L1–L13, mục 7) + canvas mockup https://claude.ai/artifact/Jow9EJotq5TXajAxVfqizq (bảng "Thang bo góc", "Bộ nút · ô nhập · dropdown · popup đề xuất (A)").

## Global Constraints

- Thang bo góc A: `--r-xs: 4px; --r-sm: 6px; --r-md: 8px; --r-lg: 8px; --r-xl: 12px; --r-pill: 999px`. Nút, ô nhập, ô chọn, ô tìm, chip lọc = `--r-sm`; thẻ, khung bảng, menu thả, popover = `--r-md`; hộp thoại, ngăn kéo, sheet = `--r-xl`. `--r-pill`/`50%` CHỈ cho nhãn trạng thái (`.tag`), số đếm (`em` trong nút lọc, badge), avatar, công tắc, thanh tiến độ, chấm.
- Không `border-radius` viết px tay ngoài `0`, `1px`, `2px`, `50%`, `inherit` (quét bằng script, Task 1).
- Một màu nút chính `--c-acc` (#0E6A7B) cho cả shell member và admin.
- Điều khiển thanh công cụ cao 40px (`--ctl-h`), `pointer: coarse` 44px (`--hit`). Mọi nút ngoài đoạn văn ở 390 ≥ 44×44.
- Nút đóng biểu tượng: `aria-label` "Đóng" / "Close". Nút hủy thao tác: "Hủy" / "Cancel". Hộp xác nhận lưu phiếu: "Quay lại sửa" / "Back to edit" + "Lưu phiếu" (CLAUDE.md). Không còn "Quay lại" / "← Đóng" làm nút đóng popup.
- Nút bị khóa luôn có lý do nhìn thấy, nối bằng `aria-describedby`.
- CLAUDE.md giữ nguyên: TDD (RED rồi GREEN, ghi lệnh + output vào commit), biên hai phía theo phễu, i18n vi+en cùng commit, file ≤ 400 dòng (350 thì tách), component ≤ 250 dòng, `docs/map.md` cập nhật trong commit cuối mỗi task, câu chữ "Adm D&E" / "Nhà cung cấp" / "Tài khoản D&E", Playwright 1280 + 390, không push khi chưa được bảo.
- Nhánh `feat/giao-dien-a` từ `main` (e66c6f0). Commit tiếng Việt, mỗi task một commit trở lên, cuối thân commit `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Dữ liệu mẫu dev: `seed.sql` / `cleanup.sql` của đợt rà (sao vào `web/playwright/fixtures/mau-seed.sql` ở Task 0) — Playwright mới của plan chạy trên dữ liệu đó.

## Quyết định của chủ dự án (15/11/2026)

- **Q1 — mục G:** chốt 15/11 G1–G8 → Phase 2b (Task 22–30), chạy sau Phase 2, trước Task 21. Thứ tự trong 2b: 22 → 23 → 24 → 25 → 26 → 27 → 28 → 29 (cần 25) → 30. Task 13 giữ (hộp Xuất lẻ dùng lại ở Task 24); Task 17 bỏ. G9 → Task 31. Mọi ý mục G đã chốt.
- **Q2 — tên app:** "QLVPP" ở mọi chỗ (thanh trên, menu, sidebar admin, đăng nhập, tab). Task 19.
- **Q3 — H9:** bản in đầu tiên sau bản Excel vẫn là "thay thế", chữ ghi rõ loại: "Thay thế bản Excel gửi NCC lúc {{time}}" / "Thay thế bản in gửi NCC lúc {{time}}". Task 14.
- **Cách chạy (chủ dự án đổi 16/11):** Opus làm liền từng task (TDD, commit từng task); review độc lập 4 lần — sau Phase 0+1 (nền chung, BẮT BUỘC trước Phase 2), sau Phase 2, sau Phase 2b, và review toàn nhánh trong Task 21 — rồi code review mức high, rồi đo lại bằng `ra-soat-ui` + `design-taste-frontend` trên dev. Chỉ bắt đầu khi chủ dự án bảo.

## Review Focus

- Bảng có dòng dài ở 1024–1280 khi mở sidebar (tên 40 ký tự, mã 20 ký tự): không tràn khung, cột thao tác luôn trong tầm nhìn → Task 9 Playwright dùng người mẫu "Huỳnh Ngọc Thiên Kim Nguyên Khánh".
- Tiếng Anh: nhãn nút dài hơn tiếng Việt làm vỡ thanh công cụ ở 1024 → Task 3 chạy spec đo chiều cao ở cả `vi` và `en`.
- Điện thoại 320×568 với bàn phím ảo mở trong popup: chân popup (nút chính) vẫn bấm được → Task 4 test sheet ở 320×568 nút chính trong viewport.
- Phiên đổi giữa chừng (popup đang mở thì hết phiên) không để lại lớp phủ chặn trang → Task 4 vitest: `handleSessionExpired` đóng mọi overlay.
- Bấm đúp nút xác nhận mới thêm (Nhận đủ hàng) không gửi hai lần → Task 15 vitest: hai click liên tiếp chỉ một POST (dùng `useSingleFlight`).

---

## Phase 0 — Chuẩn bị

### Task 0: Ghi quyết định vào spec + dữ liệu mẫu cho Playwright

**Files:**
- Modify: `docs/review-spec.md` (thêm mục "H. Giao diện A — 15/11/2026"), `design-preview/_SPEC.md` mục "Thay đổi sau review" (bo góc, một màu nút, khung popup, chữ nút đóng). Cả hai file đang có sửa dở của chủ dự án chưa commit: chỉ stage đoạn mình thêm (`git apply --cached` một patch chỉ chứa đoạn đó), không đụng phần còn lại.
- Create: `web/playwright/fixtures/mau-seed.sql`, `web/playwright/fixtures/mau-cleanup.sql` (từ seed đợt rà, giữ chặn `current_database() = 'vpp'`), thêm mục "Dữ liệu mẫu giao diện" vào `README.md` (lệnh nạp/gỡ).

- [ ] **Step 1:** Viết mục H trong review-spec: thang A, `--r-pill` chỉ cho nhãn/đếm/avatar/công tắc/tiến độ; một màu nút chính; khung popup chung; chữ nút đóng/hủy; nút khóa có lý do; kèm link canvas. Ghi kết quả Q1–Q3 khi có.
- [ ] **Step 2:** Sao seed/cleanup; chạy `docker compose exec -T postgres psql … < web/playwright/fixtures/mau-cleanup.sql` rồi `mau-seed.sql` trên DB dev, kỳ vọng in `users 8 / requests 17 / stocked items ≥ 20`.
- [ ] **Step 3:** Commit `docs: ghi quyết định giao diện A, dữ liệu mẫu cho kiểm giao diện`.

## Phase 1 — Sửa ở gốc (hệ thống)

### Task 1: Thang bo góc A + máy quét bo góc

**Files:**
- Modify: `web/src/css/tokens-m1.css:77`, `web/src/css/tokens.css` (nếu còn định nghĩa `--r-*` cho shell member), mọi `.css` có `border-radius` px tay hoặc `var(--r-pill)` cho control (danh sách: `grep -rn "border-radius" web/src --include=*.css`; ~15 chỗ px tay, ~60 chỗ pill cho control trong `css/m1/base.css`, `css/fields.css`, `css/m1/member-shell.css`, `features/**/*.m1.css`).
- Create: `web/scripts/check-css-radius.mjs` + `web/scripts/check-css-radius.test.ts`; nối vào `npm run lint` (sau `check-css-scale.mjs`).

**Interfaces:**
- Produces: `findRadiusIssues(file: string, source: string): {file, line, selector, value, reason: 'px' | 'pill-on-control'}[]` ; hằng `PILL_OK = /\.tag\b|badge|avatar|switch|progress|meter|dot|count|\bem\b|::?(before|after)/` khớp trên selector của rule.

- [ ] **Step 1: test RED** `check-css-radius.test.ts`:
  - `'border-radius: 14px' trong .card → lỗi px`; `'0', '1px', '2px', '50%', 'inherit', 'var(--r-md)' → không lỗi`.
  - `'.btn { border-radius: var(--r-pill) }' → pill-on-control`; `'.tag { … var(--r-pill) }' → ok`; `'.seg-m1 em { … pill }' → ok`.
  - `quét toàn bộ web/src hiện tại → 0 lỗi` (fail lúc đầu, liệt kê đủ chỗ cần sửa).
- [ ] **Step 2:** `cd web && npx vitest run scripts/check-css-radius.test.ts` → FAIL ở test quét toàn bộ (in danh sách file:line).
- [ ] **Step 3:** Đổi token theo Global Constraints; thay px tay bằng token gần nhất (≥ 10 → `--r-md`, khung hộp/ngăn/sheet → `--r-xl`, ≤ 6 → `--r-xs`/`--r-sm`); control đang pill → `--r-sm`. Không đổi màu/kích thước khác.
- [ ] **Step 4:** Test xanh; `npm test`, `npm run lint`, `npm run build` sạch; chụp lại 4 màn (Kỳ tháng, Sản phẩm, Đăng ký 390, hộp Giao) so với ảnh "A" trên canvas — cùng dáng.
- [ ] **Step 5:** Commit `feat(web): thang bo góc A (6/8/12), quét chặn bo px tay và pill cho control`.

### Task 2: Một màu nút chính + lý do cho nút bị khóa

**Files:**
- Modify: CSS nút chính phía member (`css/m1/member-shell.css`, `features/request/*.m1.css` — lớp đang dùng `--c-dark`/`--c-ink` làm nền nút chính) → `--c-acc`; `web/src/ui/` thêm `disabled-reason.tsx`.
- Test: `web/src/ui/disabled-reason.test.tsx`, `web/src/css/primary-color.test.ts` (quét CSS: nút chính member không dùng `--c-dark` làm nền).

**Interfaces:**
- Produces: `<DisabledReason id: string, reason: string | null>` hiển thị `<small id class="disabled-reason">` khi `reason`; hook `useDisabledReason(reason: string | null) → { describedBy?: string, node: ReactNode }` để gắn `aria-describedby` vào nút.

- [ ] **Step 1: test RED** `disabled-reason.test.tsx`: `nút khóa có lý do → toHaveAccessibleDescription('Chưa có thay đổi')`; `reason null → không có small`. `primary-color.test.ts`: `selector nút chính member (".req-bar__save", ".cart__save" — lấy đúng tên lớp khi làm) có background var(--c-acc)`.
- [ ] **Step 2:** chạy, FAIL đúng lý do.
- [ ] **Step 3:** Làm `DisabledReason`; đổi nền nút chính member sang `--c-acc` (kiểm `tokens-contrast.test.ts` vẫn xanh: chữ trắng trên #0E6A7B ≥ 4.5:1).
- [ ] **Step 4:** Gắn lý do (key i18n mới `common.disabledReason.*` vi+en): ngăn Điều chỉnh "Chưa có thay đổi" (spec mục 7), "Giao…" "Tủ chưa có hàng", "Xác nhận giao" "Chưa chọn số lượng giao", Báo cáo kỳ chưa khóa "Kỳ chưa khóa — xuất được từ 00:00 ngày {{d}}", ngăn Lịch sử Tủ "Xuất lẻ" "Tủ hết món này", thanh dưới member "Lưu phiếu" khi chưa đổi "Chưa có thay đổi". Mỗi chỗ một test Testing Library `toHaveAccessibleDescription`.
- [ ] **Step 5:** test xanh; commit `feat(web): một màu nút chính, nút khóa luôn nói lý do`.

### Task 3: Một họ điều khiển thanh công cụ (ô tìm, ô chọn, lọc)

**Files:**
- Modify: `web/src/css/m1/base.css:74-92` (toolbar, `.seg-m1`, `.toolbar__search`), `web/src/css/fields.css`, `web/src/ui/select.tsx`, `web/src/ui/segmented.tsx`, `web/src/ui/filter/group-chips.tsx`; thay chip riêng: `features/month/month-chips-bar*`, `features/delivery/people/*tabs*` (pp-tabs), `features/review/*tabs*` (rv-tabs), `features/admin/audit-filters.tsx` (chip Nhanh) bằng `ui/segmented`.
- Create: `web/playwright/ui-system.spec.ts`.

**Interfaces:**
- Consumes: Task 1 token.
- Produces: `Segmented` nhận thêm `compactBelow?: number` (mặc định 480): dưới bề rộng đó tự hiện `ui/select` cùng lựa chọn (thay thanh cuộn ẩn tab).

- [ ] **Step 1: test RED** `ui-system.spec.ts` (`test.describe('Hệ điều khiển')`), lướt 13 route admin + `/` member, ở 1280 và 390, `vi` và `en`:
  - `ô tìm, ô chọn, nhóm lọc trong thanh công cụ cùng chiều cao: 40 (1280) / 44 (390)` — đo `getBoundingClientRect().height` của `[role=searchbox]`, `[role=combobox]`, `[role=radiogroup]`, lệch ≤ 1px.
  - `cùng nền và viền: ô tìm và ô chọn có background trắng, border 1px, border-radius 6px`.
  - `390: thanh lọc không có tab bị khuất` — mọi `[role=radio]` của nhóm lọc nằm trong viewport, hoặc nhóm đã thành combobox.
- [ ] **Step 2:** `npx playwright test ui-system.spec.ts` → FAIL (36/40/44 hiện tại).
- [ ] **Step 3:** Một biến thể duy nhất cho ô tìm/ô chọn (nền `--c-surface`, viền `--c-line` 1px, cao `--ctl-h`); nhóm lọc = `Segmented` (khung 40, nút trong 32, bo `--r-xs`); chuyển 4 chỗ chip riêng sang `Segmented`; `compactBelow`.
- [ ] **Step 4:** vitest `segmented.test.tsx`: `dưới 480 hiện combobox cùng lựa chọn, chọn → onChange cùng giá trị`; Playwright xanh; `state-diff` (skill ra-soat-ui) trên Kỳ tháng/Giao/Tủ ở 1280: thanh công cụ không đổi cao khi lọc.
- [ ] **Step 5:** Commit `feat(web): một họ ô tìm/ô chọn/nhóm lọc cao 40, thu thành ô chọn dưới 480`.

### Task 4: Khung popup chung + chữ nút đóng

**Files:**
- Modify: `web/src/ui/overlay-panel.tsx`, `web/src/ui/dialog.tsx`, `web/src/ui/confirm-dialog.tsx`, `web/src/css/m1/overlay.css` (≤ 640px nền đặc `--c-surface`, không `rgb(255 255 255/.86)`), `web/src/features/summary/registration-dialog.tsx` (Xem phiếu ở Kỳ tháng → dùng `OverlayPanel` như ngăn Xem người ở Giao), `features/request/*confirm*` (nút "Quay lại sửa").
- Test: `web/src/ui/overlay-panel.test.tsx`, `web/src/ui/dialog.test.tsx`, `web/src/test/wording.test.ts`.

**Interfaces:**
- Produces: `OverlayPanel` props giữ nguyên + `footer?: ReactNode` (chân đứng yên), `eyebrow?: string` (dòng phụ trên tiêu đề). Nút đóng × luôn `aria-label={t('common.close')}`.

- [ ] **Step 1: test RED**:
  - `wording.test.ts`: `nút đóng/hủy: không khóa nào trong vi có giá trị "← Đóng" hoặc "Quay lại" dùng làm nút đóng popup` (danh sách khóa nút đóng lấy từ `ui/*` + `features/**` dùng `onClose`); `request.confirm.back = "Quay lại sửa"`, en `"Back to edit"`.
  - `overlay-panel.test.tsx`: `390: nền không trong suốt (alpha 1)` (đọc computed style trong jsdom qua class `is-sheet`), `chân popup render một lần, nút chính bên phải`.
  - Playwright `ui-system.spec.ts`: `320×568: mở Xem phiếu, Điều chỉnh, Giao, Xuất lẻ, Lưu phiếu → nút chính của chân popup trong viewport`; `mọi button trong [role=dialog] ở 390 ≥ 44×44`.
  - vitest: `hết phiên khi popup đang mở → không còn [role=dialog] trong document` (Review Focus).
- [ ] **Step 2:** chạy, FAIL.
- [ ] **Step 3:** Sửa khung; chuyển Xem phiếu Kỳ tháng sang `OverlayPanel` (˄/˅ đổi người như Giao, nút 44 trên coarse); đổi chữ; nền đặc ≤ 640.
- [ ] **Step 4:** xanh; commit `feat(web): một khung popup, nút đóng một tên, nền đặc trên điện thoại`.

### Task 5: Trạng thái rỗng, dòng đếm, tiêu đề trang thống nhất

**Files:**
- Modify: `web/src/ui/empty-frame.tsx`, `web/src/ui/list-meta.tsx`, `web/src/ui/page-header.tsx`, `features/delivery/people/people-table.tsx` (rỗng/không khớp), `features/request/history-detail-page.tsx` (H5), admin NotFound + member NotFound trong `web/src/shell/*`, `features/profile` (bề rộng member), các trang admin chưa có crumbs (Kỳ tháng, Báo cáo).
- Test: `empty-frame.test.tsx`, `features/delivery/people/people-table.test.tsx`, `features/request/history-detail-page.test.tsx`, Playwright `ui-system.spec.ts`.

**Interfaces:**
- Produces: `EmptyFrame` thêm `variant: 'empty' | 'no-match'` — `no-match` luôn có nút "Xóa lọc" (gọi `onClear`); `ListMeta` luôn render (kể cả 0) ở vị trí cố định dưới thanh công cụ, chừa chỗ hàng "Đang lọc" (`min-height` đủ một dòng).

- [ ] **Step 1: test RED**:
  - `people-table`: `tìm "zzzz" → "Không có ai khớp" + nút "Xóa lọc"; số trên tab giữ theo bộ lọc tab`.
  - `history-detail-page`: `kỳ không có phiếu → đúng một trạng thái rỗng, có h1 "Phiếu tháng 12/2026" ở 1280 và 390` (giả lập `matchMedia`).
  - Playwright: `h1 của 13 route admin cùng top ±2px; 404 admin có h1 cỡ PageHeader`; `h1 member cùng left ở /, /history, /me, /khong-co (1280)`; `ListMeta có mặt và cùng x trên mọi route danh sách`; `Danh bạ 390: bảng cùng top giữa ?status=active và ?status=locked`; `Giao hàng: chọn một dòng → ô tìm không co, bảng không tụt (≤ 2px) ở 1280/1024/390`.
- [ ] **Step 2–4:** RED → sửa → GREEN.
- [ ] **Step 5:** Commit `feat(web): rỗng/không khớp, dòng đếm, tiêu đề trang một kiểu cho mọi màn`.

### Task 6: Một nhãn trạng thái phiếu, một cách đếm

**Files:**
- Create: `web/src/lib/request-status.ts` + `request-status.test.ts`.
- Modify: nơi hiện trạng thái: `features/request/history-*.tsx`, `features/request` thẻ "Phiếu tháng 12 đã chốt" ở hero, `features/month/month-people-table.tsx`, `features/delivery/people/people-table.tsx`, `features/summary/registration-dialog.tsx`.

**Interfaces:**
- Produces: `requestStatus(t: { qty: number; delivered: number; cancelled: number; owedPrevMonths?: number; shortInCabinet?: number }): { key: 'notDelivered' | 'partial' | 'done' | 'owed'; delivered: number; total: number }` và `RequestStatusTag` (một `.tag`), chữ: "Chưa giao", "Đã giao {{delivered}}/{{total}}", "Đã nhận đủ", "Còn nợ {{n}}"; đếm theo đơn vị.

- [ ] **Step 1: test RED** `request-status.test.ts`: `qty 9 delivered 0 → notDelivered`; `delivered 4 → partial "4/9"`; `delivered 9 → done`; `delivered 8 cancelled 1 → done` (biên: hủy phần còn lại = xong); `delivered 0 qty 0` không xảy ra (bỏ). Playwright: `phiếu tháng 12 của NV mẫu hiện cùng chữ "Đã giao 4/9" ở /history/2026-12, Kỳ tháng, Giao hàng`.
- [ ] **Step 2–4:** RED → làm → GREEN; bỏ các key cũ ("Đang giao · đã nhận x/y món", "Chưa nhận" khi đã giao một phần).
- [ ] **Step 5:** Commit `feat(web): một nhãn trạng thái phiếu, đếm theo đơn vị ở mọi màn`.

### Task 7: Bảng vừa khung ở 768–1280, cột không nhảy

**Files:**
- Modify: `web/src/css/m1/table.css` (`.table-stack`: dạng thẻ theo `@container` dưới 820px; trên đó cột thao tác `position: sticky; right: 0`), `features/month/month-people-table.tsx` (thêm `table--fixed` + `colgroup`), `features/delivery/people/people-table.tsx` (ô Người `min-width:0; overflow-wrap:anywhere`, bỏ cột Tháng khi lọc một kỳ), `features/directory/users-table.tsx` (Mã NV ≥ 13ch), `features/admin/audit-table.tsx` (ô Người nowrap, icon riêng cho Hệ thống), `features/reports/report-snapshots*` (bảng bản đã in ở 390 thành thẻ).
- Create: `web/playwright/table-fit.spec.ts`.

- [ ] **Step 1: test RED** `table-fit.spec.ts` trên `/admin/month?ym=2026-11`, `?ym=2026-12`, `/admin/delivery`, `/admin/reports`, `/admin/users`, `/admin/audit`, `/admin/catalog?view=table`, `/admin/stock` ở 1280, 1024, 768 (sidebar mở):
  - `bảng không rộng hơn khung hoặc cột thao tác nằm trong viewport`;
  - `chữ trong mọi td không vượt td.right` (người mẫu tên dài);
  - `Kỳ tháng: thead th (x, width) lệch ≤ 2px giữa ?ym=2026-12, &q=Hoàng, chip "Có ghi chú", ?ym=2026-11`;
  - `390: bảng bản đã in / xuất vừa màn, nút In lại trong viewport`.
- [ ] **Step 2–4:** RED → sửa CSS/colgroup → GREEN; chạy lại `table-layout.spec.ts`, `fixed-columns.spec.ts` có sẵn.
- [ ] **Step 5:** Commit `fix(web): bảng vừa khung 768–1280, cột thao tác luôn thấy, cột không nhảy khi lọc`.

### Task 8: Vùng chạm 44 trên điện thoại

**Files:**
- Modify: `web/src/ui/month-picker.tsx` (nút năm/tháng, `max-width: calc(100vw - 16px)`, phím mũi tên roving tabindex), `.rg-step` (nút người trước/sau), `ui/language-switch.tsx` trong sheet, `features/admin/audit-filters.tsx` (chip Nhanh), `features/directory` tên người, `features/stock/stock-table.tsx` tên món, chuông "Đánh dấu đã đọc tất cả", `shell/admin-menu-sheet*` (cả sheet cuộn chung, bóng mép dưới).
- Test: `web/src/css/hit-targets.test.ts` (đã có — mở rộng danh sách), `month-picker.test.tsx`, Playwright `ui-system.spec.ts`.

- [ ] **Step 1: test RED**: Playwright `390: mọi button/a/[role=radio] ngoài đoạn văn trong main, dialog, menu trượt ≥ 44×44 (hoặc vùng ::after ≥ 44)`; `320: hộp chọn năm-tháng right ≤ 312`; `menu trượt 390×667: "Cấu hình" không bị chân menu che (elementFromPoint)`; vitest `month-picker: ArrowRight chuyển focus sang tháng kế, Enter chọn`.
- [ ] **Step 2–4:** RED → sửa → GREEN.
- [ ] **Step 5:** Commit `fix(web): vùng chạm 44 trên điện thoại, chọn tháng không tràn mép, đi bằng phím mũi tên`.

### Task 9: Không chớp nền khi tải

**Files:** `web/index.html` (nền `html` = nền màn chờ), `web/src/css/base.css:96` `.entry-page`, `web/src/css/fonts.css` (preload woff2 vietnamese 400/700 qua `<link rel=preload>` do Vite chèn), `features/reports` (chừa chỗ thanh trạng thái để hết CLS 0.063).
- [ ] **Step 1: test RED** Playwright `fouc.spec.ts`: CPU ×4, mạng chậm, ghi màu nền `document.documentElement` mỗi khung tới khi có `[data-shell]` → `chỉ một màu nền trước khi shell hiện`, `font-family của h1 không bao giờ là Times`; `/admin/reports CLS < 0.01` (PerformanceObserver layout-shift).
- [ ] **Step 2–5:** RED → sửa → GREEN → commit `fix(web): một màu nền khi tải, nạp sẵn font, Báo cáo không nhảy bố cục`.

## Phase 2 — Lỗi Hỏng

### Task 10: Báo cáo — cột Đề nghị (H1, H2) và kỳ chưa gửi (mục 7)

**Files:** `web/src/features/reports/report-item-table.tsx:109` (bề rộng cột tính từ `.bc-order__box` 136px + padding ô), `features/reports/reports.m1.css:21`, `features/reports/order-input*` (thông báo lỗi), `lib/report-qty.ts` nếu luật nằm đó; câu "có n món đổi sau bản này" thành nút lọc.
- [ ] **Step 1: test RED** vitest biên: `Đề nghị 1000 → hợp lệ`, `1001 → "Tối đa 1.000"`, `2.5 → "Nhập số nguyên"`, `-1 → "Nhập số từ 0"`, `0 → hợp lệ`; `có lỗi → chiều cao dòng không đổi` (lỗi nằm trong chỗ đã chừa). Playwright 1280/1024: `nút "+" nằm trong ô Đề nghị, không giao link "N người"`. vitest: `"có 5 món đổi sau bản này" là nút, bấm → bảng chỉ còn 5 dòng có nhãn "Đổi sau bản in"`.
- [ ] **Step 2–4:** RED → sửa → GREEN (kèm e2e api có sẵn của `order_qty` biên 1000/1001 vẫn xanh).
- [ ] **Step 5:** Commit `fix(web): ô Đề nghị vừa cột, báo đúng lý do lỗi, lọc nhanh món đổi sau bản in`.

### Task 11: Thẻ món nhân viên ở 320 (H3, H4) + trạng thái đã lưu (mục 7)

**Files:** `web/src/features/request/item-card.tsx`, `item-card.m1.css`, `ui/qty-input.tsx` (min-width theo 3 chữ số), thanh dưới/giỏ (một nhãn "Lưu phiếu"), hero (ghi năm khi kỳ khác năm hiện tại: "tháng 1/2027"), lọc "Đã chọn 0" (câu "Bạn chưa chọn món nào", không "Thử từ khóa khác").
- [ ] **Step 1: test RED** Playwright 320/335/340: `ô số hiện đủ "10" (scrollWidth ≤ clientWidth)`, `"Thêm vào phiếu" không tràn`; vitest: `phiếu đã lưu, chưa bấm Sửa phiếu → stepper trên thẻ bị khóa kèm lý do "Bấm Sửa phiếu để thêm, bớt"` (hoặc cho sửa thẳng và bỏ câu — chọn: khóa, theo câu đang có); `giỏ, sheet, thanh dưới cùng nhãn "Lưu phiếu"`; `đang sửa → hero không còn "Đã lưu 18:32", hiện "Có thay đổi chưa lưu"`; `"Đã chọn" với 0 món → "Bạn chưa chọn món nào"`; `kỳ 2027-01 khi hôm nay 2026-11 → tiêu đề "tháng 1/2027"`.
- [ ] **Step 2–5:** RED → sửa → GREEN → commit `fix(web): thẻ món vừa 320, một nhãn Lưu phiếu, trạng thái đã lưu/đang sửa rõ ràng`.

### Task 12: (H5 Lịch sử chi tiết rỗng nằm trong Task 5 — không có task riêng, giữ số để khớp tham chiếu)

### Task 13: Tủ/Kho — hộp Xuất lẻ, Nhập ngoài kỳ (H7, H12, H13, mục 7)

**Files:** `web/src/features/stock/issue-dialog.tsx`, `issue-one-button.tsx`, `purchase-dialog.tsx`, `stock-input.ts`, `ui/listbox.tsx` (ô tìm + dòng phụ "Tủ: n" + câu rỗng); api: chỉ kiểm e2e có sẵn cho `IssueDto.qty` 1..QTY_MAX và `ReceiptLine.qty` 1..99 999 (thêm nếu thiếu).
- [ ] **Step 1: test RED** vitest `stock-input`: `xuất: tồn 20 → 20 được, 21 "Tủ chỉ còn 20 — nhập từ 1 đến 20", 0 lỗi, 2.5 "Nhập số nguyên"`; `nhập: 99 999 được, 100 000 "Tối đa 99.999", 0 lỗi`; `issue-dialog`: `có lỗi → nút Xuất khóa + lý do`, `tổng tồn 0 → nút "Xuất lẻ một món" khóa, lý do "Tủ đang trống"`, `listbox: gõ "Băng" → chỉ món có "Băng"; mỗi mục hiện "Tủ: n"`. e2e api `issue qty 21 khi tồn 20 → 409 mã đúng §7`, `receipt qty 100000 → 400`.
- [ ] **Step 2–5:** RED → sửa → GREEN → commit `fix(stock): hộp Xuất lẻ và Nhập chặn số sai tại ô, chọn món có tìm và tồn`.

### Task 14: Bản in/Excel ghi đúng bản bị thay (H9)

**Files:** `api/src/modules/reports/snapshots.service.ts:157-172` (`withReplaces` lưu thêm `kind` của bản trước: `replaces: { id, created_at, kind }`), `report.types.ts`, `api/src/modules/reports/xlsx-*` ô A1, `web/src/features/reports/print*` + `locales/{vi,en}/reports.ts` (chữ "Thay thế bản gửi NCC lúc {{time}} ({{kind}})").
- [ ] **Step 1: test RED** e2e `snapshots-replaces.e2e-spec.ts`: `tạo xlsx 18:30 rồi print 18:31 cùng đề nghị khác → print.replaces.kind = 'xlsx'`; `print rồi print → kind 'print'`; `cùng đề nghị → không replaces` (giữ); vitest trang in: `replaces.kind 'xlsx' → "Thay thế bản Excel gửi NCC lúc 18:30 15/11"`. Kiểm `xlsx-replaces.spec.ts` có sẵn cho ô A1 theo chữ mới.
- [ ] **Step 2–5:** RED → sửa → GREEN (`npm test`, `npm run test:e2e` api) → commit `fix(reports): bản in/Excel ghi đúng loại bản bị thay`.

### Task 15: Nhận hàng — xác nhận trước khi ghi kho (H10, mục 7)

**Files:** `web/src/features/arrivals/arrivals-group.tsx`, `arrivals-toolbar.tsx`, `use-arrivals-save.ts`, `arrival-table.tsx` (cột "Còn thiếu" lấy cùng số với Tình trạng).
- [ ] **Step 1: test RED** `arrivals-flows.test.tsx`: `"Nhận đủ hàng (2 nhóm)" → mở ConfirmDialog liệt kê số nhận; Hủy → không POST receipts`; `"NCC hết hàng" → xác nhận rồi mới PUT adm-out`; `đã gõ thiếu ở một dòng → nút đổi thành "Nhận theo số đã nhập"`; `bấm đúp Xác nhận → đúng một POST` (Review Focus); `dòng thiếu 6 → cột Còn thiếu "6"`.
- [ ] **Step 2–5:** RED → sửa → GREEN → commit `fix(arrivals): nhận hàng và NCC hết hàng phải xác nhận, cột Còn thiếu đúng số`.

### Task 16: Xem phiếu hiện đúng trạng thái món ngoài danh mục (H11)

**Files:** `web/src/features/summary/registration-dialog.tsx:37`, `locales/{vi,en}/summary.ts` (`open.customLine` → `open.custom.{pending,accepted,rejected,converted}`).
- [ ] **Step 1: test RED** `registration-dialog.test.tsx`: `review_status accepted → "Ngoài danh mục · đã chấp nhận"`, `pending → "… chờ duyệt"`, `rejected → "… đã từ chối"`, `converted → không nhãn ngoài danh mục`.
- [ ] **Step 2–5:** RED → sửa → GREEN → commit `fix(summary): Xem phiếu hiện đúng trạng thái món ngoài danh mục`.

### Task 17: (BỎ — trang Duyệt bị xóa ở Task 26, không làm)

**Files:** `web/src/features/review/*`, `locales/{vi,en}/review.ts`, `wording.test.ts`.
- [ ] **Step 1: test RED** wording: `nút duyệt = tên tab: "Chấp nhận" / "Thêm vào danh mục" / "Từ chối"` (nếu Q1 giữ G8: chỉ "Chấp nhận" / "Từ chối" trong popup Xem phiếu).
- [ ] **Step 2–5:** RED → sửa → GREEN → commit `fix(review): chữ nút duyệt trùng tên tab và spec`.

### Task 18: Dọn dữ liệu Playwright để lại trên dev (H8)

**Files:** `web/playwright/p3-seed.ts` (`cleanup` gọi trong `finally` cả khi test lỗi giữa chừng), `web/playwright/cleanup-dev-data.sql` (khôi phục `signature_boxes` có tên "PW %" về bản mặc định), `web/playwright/smoke.spec.ts` thêm `config dev không có tiền tố "PW " trong signature_boxes` (chạy cuối, `test.afterAll`).
- [ ] **Step 1–5:** RED (smoke fail khi còn "PW …") → sửa → GREEN → commit `test(e2e): dọn tên người ký PW sót lại, kiểm sạch sau mỗi lượt`.

### Task 19: Ô số Cấu hình, Sản phẩm + câu chữ còn lệch (L8, L10, L11, L12, mục 7)

**Files:** `features/admin/use-config-block.ts` (kiểm khi đổi: hạn 3..28), `features/catalog` sửa nhanh Tối đa/tháng (1..999), `lib/format-time.ts` (một hàm `savedAt` cho mọi chỗ giờ lưu), locales: "Tổng"/"Đơn vị" một tên, "Người đã nghỉ" trong thông báo `user_left_with_work.deleted`, tồn kho một chữ "Tủ" ("Tủ: 20", "Trong tủ"), `auth.loginFailed` nói "bấm Tiếp tục", `en/reports.ts:111` thêm `who_one: '{{count}} person'`, `en/nav.ts` rút "Reports & send to suppl…", tên app theo Q2 (`app.shortName`, thanh trên, menu, sidebar admin thêm logo + tên).
- [ ] **Step 1: test RED**: vitest config `hạn 2 → lỗi gắn ô + Lưu khóa; 3 → ok; 28 → ok; 29 → lỗi; rỗng → lỗi`; catalog `Tối đa 0 → lỗi; 1 → ok; 999 → ok; 1000 → lỗi` (khớp DTO api — đọc giới hạn thật trong `catalog.dto.ts` khi làm); `format-time`: `một định dạng "14/11 · 19:18" cho Kỳ tháng, hộp Xem phiếu, ngăn Điều chỉnh`; wording: `không còn "bị xóa" trong notifications.*`, `en-plurals: mọi khóa _other có _one`, `app.shortName === tên Q2 và thanh trên dùng cùng khóa`.
- [ ] **Step 2–5:** RED → sửa → GREEN → commit `fix(web): kiểm biên ô số Cấu hình/Sản phẩm, một cách viết giờ, chữ còn lệch`.

### Task 20: Mức đặt lại và các lệch riêng màn còn lại (mục 3, mục 7)

**Files:** `features/catalog` + `features/stock` (hiện "dưới mức đặt lại" khi `stock_qty ≤ restock_level`: `.tag` "Sắp hết · mức 6"), `features/delivery` chuông admin có số, sidebar nhãn đang chọn không cắt (`text-overflow` + `title`), Đơn vị tính nút "Sửa" cố định cột, Sản phẩm mã không bẻ giữa (`white-space: nowrap; text-overflow: ellipsis` + `title`), tiêu đề "Tối đa/tháng" một dòng, chế độ Sắp xếp khóa Sửa/Tạm ngưng kèm lý do, nút ⓘ "Cách tính Tổng cần" hiện ở 390, bản xem tổng kết 390 có nút "Mở cỡ thật".
- [ ] **Step 1: test RED** mỗi mục một test Testing Library hoặc Playwright (tên test = mô tả mục, ví dụ `Sản phẩm: tồn 4 mức 6 → nhãn "Sắp hết"`, `tồn 6 mức 6 → "Sắp hết"`, `tồn 7 mức 6 → không nhãn` — biên hai phía).
- [ ] **Step 2–5:** RED → sửa → GREEN → commit `fix(web): hiện mức đặt lại, các lệch riêng màn còn lại`.

## Phase 2b — Mục G đã chốt 15/11 (G1–G9)

Mockup: canvas, nhóm "Mục G — chức năng chốt 15/11" (`G2DieuChinh`, `G6XuatLe`, `G6XuatLeHop`, `G8Duyet`). Quyết định ghi ở cuối `docs/review-spec.md`. Mỗi task sửa PRD + backlog + `architecture.md` §7 (nếu thêm mã lỗi) trong cùng commit — spec đi trước code (CLAUDE.md).

### Task 22: G7 — cắt "món chỉ Adm D&E"

**Files:**
- Create: `api/src/migrations/0129_items_drop_admin_only.sql` (một chủ đề: `ALTER TABLE items DROP COLUMN admin_only`; trước đó `UPDATE … SET` không cần — dev/prod đếm 0 món `admin_only`, ghi câu kiểm vào đầu file: dừng nếu còn món `admin_only = true`).
- Modify: mọi chỗ đọc/ghi `admin_only` (`api/src/modules/catalog/{catalog.dto,catalog.service,categories.service,catalog-sql}.ts`, `requests/{request-view,review.dto,review.service,request-lines.diff,copy-previous.service}.ts`; web `features/catalog/{item-fields,item-draft,catalog-cells,catalog.api}.ts(x)`, `features/review/convert-*`, `features/summary/adjust-*`, fixtures), `docs/prd.md` (FR định mức giữ, bỏ admin_only), backlog liên quan.
- [ ] **Step 1: test RED**: db-spec `0129: cột admin_only không còn; migration dừng khi còn món admin_only`; e2e `POST admin/items có admin_only → 400 (whitelist)`; e2e `nhân viên thấy mọi món active` (giữ); vitest `ngăn Sửa món không còn ô "Chỉ Adm D&E"`.
- [ ] **Step 2–4:** RED → xóa code → GREEN (`npm test`, `test:e2e`, `test:db` api; web `npm test`).
- [ ] **Step 5:** Commit `feat!: bỏ món chỉ Adm D&E (G7), giữ định mức tối đa/người`.

### Task 23: G6 — bỏ Kiểm kê

**Files:** xóa `POST admin/items/:id/stock/count` (`api/src/modules/catalog/stock.controller.ts:46`), `StockCountDto` (`stock.dto.ts:41`), `stock-count.ts` + spec, route class trong `periods/admin-route-classes.ts`, chữ trong `web/src/features/admin/contact-block.tsx` + `locales/{vi,en}/config.ts`. Giữ nhãn nhật ký `stock.count` (dòng cũ vẫn đọc được).
- [ ] **Step 1: test RED**: e2e `POST admin/items/:id/stock/count → 404`; vitest `Nhật ký: dòng stock.count cũ vẫn hiện nhãn "Kiểm kê"`.
- [ ] **Step 2–5:** RED → xóa → GREEN → commit `feat!: bỏ Kiểm kê (G6)`.

### Task 24: G6 — trang Xuất lẻ riêng dưới Tủ / Kho

**Files:**
- Create: `web/src/features/issues/issues-page.tsx`, `issues-table.tsx`, `issues.m1.css`, `issues-page.test.tsx`; route `/admin/issues` trong `web/src/shell/app-routes.tsx`; mục `issues` trong `web/src/shell/admin-nav.ts` (nhóm "Danh mục và tủ", ngay sau `stock`, icon có sẵn gần nhất), `PAGE_TITLE` trong `wording.test.ts`, `locales/{vi,en}/{nav,stock}.ts` (`nav.issues` "Xuất lẻ" / "Issues").
- Move: hộp Xuất lẻ (`features/stock/issue-dialog.tsx`, `issue-one-button.tsx` — đã sửa ở Task 13) sang `features/issues/`; Tủ / Kho bỏ tab Xuất lẻ (`stock-filter-tabs.tsx`, `issues-panel.tsx` thay bằng bảng trang mới); ngăn Lịch sử món giữ dòng xuất lẻ.
- API: dùng `GET /api/admin/issues?ym=` và `POST admin/items/:id/issue` có sẵn; người nhận bắt buộc (`IssueDto` thêm `recipient_sub` bắt buộc nếu chưa — kiểm DTO khi làm; thêm thì e2e `thiếu recipient_sub → 400`).

**Interfaces:**
- Produces: `IssuesPage` (route `/admin/issues?ym=YYYY-MM&q=`), cột: Ngày · Món · Số lượng (căn phải) · Người nhận · Lý do · Người xuất; nút đầu trang "+ Xuất lẻ" mở `IssueDialog`.

- [ ] **Step 1: test RED**: vitest `IssuesPage: kỳ 2026-11 có 4 lần → ListMeta "Đang hiện 4 lần xuất · 9 đơn vị"`, `tìm "Khoa" → 1 dòng`, `kỳ rỗng → EmptyFrame "Tháng này chưa xuất lẻ món nào."`; `admin-nav.test.tsx`: `mục "Xuất lẻ" ngay sau "Tủ / Kho"`; Playwright `G6 Xuất lẻ` 1280 + 390: mở trang, mở hộp, chọn món có tìm, gõ 21 khi tồn 19 → lỗi dưới ô + nút khóa có lý do, Hủy → không có POST.
- [ ] **Step 2–5:** RED → làm → GREEN → commit `feat(web): trang Xuất lẻ riêng dưới Tủ / Kho (G6)`.

### Task 25: G2 — hộp Điều chỉnh phiếu mới (giảm / từ chối, lý do chip)

**Files:**
- Create: `api/src/migrations/0130_adjust_reason_cannot_buy.sql` (thay CHECK `request_line_adjustments_reason_code_check` thêm `'cannot_buy'`); `web/src/features/summary/adjust-dialog.tsx` (+ test) thay `adjust-lines.tsx` và ngăn hiện tại.
- Modify: `api/src/modules/requests/adjust-rules.ts:5` (`ADJUST_REASONS` thêm `'cannot_buy'`), `admin-request.service.ts` (nhận dòng ngoài danh mục nếu hiện chặn), thông báo `line_adjusted` gộp mọi thay đổi trong một lần lưu (đã có `many_*`), locales chip: `adm_out_of_stock` "Hết hàng", `over_quota` "Số lượng quá nhiều", `cannot_buy` "Không mua được", `other` "Khác"; `docs/prd.md` FR-31.

**Interfaces:**
- Consumes: `PUT /api/admin/requests/:id/lines` có sẵn (`admin-requests.controller.ts:14`), Task 4 `OverlayPanel` (`footer`, `eyebrow`).
- Produces: `AdjustDialog({ request, onClose })`; mỗi dòng tick → `{ mode: 'reduce', qty: n } | { mode: 'reject' }`; một lý do chung cho lần lưu; nút "Lưu {{count}} thay đổi".

- [ ] **Step 1: test RED** (biên hai phía, luật ở tầng rẻ nhất):
  - unit `adjust-rules.spec.ts`: `giảm 10 → 9 hợp lệ; 10 → 10 lỗi (không đổi); 10 → 0 qua "reduce" lỗi (dùng Từ chối)`; `đã giao 4: giảm còn 4 hợp lệ, còn 3 lỗi LINE_BELOW_DELIVERED (mã có sẵn hoặc thêm vào §7)`; `đã giao 4 + Từ chối → cancelled = 6, delivered giữ 4, dòng thành xong`; `reason other + note 2 ký tự → lỗi, 3 ký tự → ok`; `note 200 → ok, 201 → lỗi`; `cannot_buy → ok`.
  - db-spec: `CHECK nhận 'cannot_buy', từ chối 'abc'`.
  - e2e: `điều chỉnh dòng ngoài danh mục (review_status accepted) → 200`; `nhân viên nhận một chuông gộp 2 thay đổi`.
  - vitest `adjust-dialog`: `chưa tick dòng → nút "Lưu" khóa, lý do "Chọn ít nhất một dòng"`; `chưa chọn lý do → khóa, "Chọn lý do"`; `chọn Khác chưa gõ → lỗi gắn ô Ghi thêm`; `câu xem trước = "Adm D&E giảm Băng keo si 3,5cm 10 → 5 cuộn, từ chối Kệ mica 3 tầng (tháng 12): Số lượng quá nhiều."`.
  - Playwright `G2 Điều chỉnh phiếu` 1280 + 390.
- [ ] **Step 2–5:** RED → làm → GREEN → commit `feat: hộp Điều chỉnh phiếu giảm/từ chối có lý do chip, áp cả món ngoài danh mục (G2)`.

### Task 26: G8 — duyệt món ngoài danh mục trong Xem phiếu, bỏ trang riêng

**Files:**
- Modify: Xem phiếu (`features/summary/registration-dialog.tsx`, đã thành `OverlayPanel` ở Task 4) thêm khối duyệt cho dòng `review_status = 'pending'`; dùng lại `features/review/{review.api.ts, convert-new-fields.tsx, reject-dialog.tsx}` (chuyển sang `features/summary/review-block.tsx`); xóa `features/review/review-page*`, route `/admin/review` → chuyển hướng `/admin/month?ym=<kỳ cũ nhất còn món chờ>&pending=1`; `admin-nav.ts` bỏ mục, đếm "chờ duyệt" gắn vào mục Kỳ tháng (`use-admin-badges.ts`); bảng Kỳ tháng thêm chip lọc "Có món chờ duyệt"; `docs/prd.md` FR-33.
- API giữ `POST admin/lines/:id/review` (`accept` / `convert` / `reject`).

**Interfaces:**
- Produces: `ReviewBlock({ line, onDone })`: ô tick "Thêm luôn vào danh mục" → bấm Chấp nhận gửi `convert` (hiện các ô bắt buộc của `convert-new-fields` ngay dưới, điền sẵn tên/đơn vị), không tick → `accept`; Từ chối bắt buộc ghi chú (≥ 1 ký tự sau trim, ≤ giới hạn DTO hiện có).

- [ ] **Step 1: test RED**: vitest `ReviewBlock: không tick → POST action accept; tick → hiện ô nhóm, POST convert; Từ chối chưa ghi chú → lỗi gắn ô, không POST`; `admin-nav.test.tsx`: `không còn mục "Món ngoài danh mục"; badge chờ duyệt nằm ở "Kỳ tháng"`; Playwright `G8 Duyệt món ngoài danh mục` 1280 + 390: `/admin/review` chuyển về Kỳ tháng có lọc, mở phiếu Nguyễn Thị Phương Thảo, Chấp nhận → nhãn "Ngoài danh mục · đã chấp nhận" (dùng Task 16).
- [ ] **Step 2–5:** RED → làm → GREEN → commit `feat: duyệt món ngoài danh mục ngay trong Xem phiếu, bỏ trang riêng (G8)`.

Task 17 (chữ nút trang Duyệt) **bỏ** — trang bị xóa ở Task 26.

### Task 27: G1 — Kỳ tháng theo người / theo món

**Files:** `web/src/features/month/{month-page,month-people-table,month-locked-view,month-open-view}.tsx` + `features/month/month-items-table.tsx` (mới), `use-month-params.ts` (`view=people|items`, `area=<phòng>` lặp được, `pending=1`), `features/summary` (nguồn số), `docs/prd.md` FR Tổng hợp. API: thêm vào `GET admin/periods/:ym/summary` (hoặc endpoint đang cấp bảng) trường mỗi người `short_items: string[]` (món còn phải giao mà tủ không đủ cho tổng còn phải giao của món) — kiểm có sẵn trường "Tủ thiếu" ở Giao hàng và dùng lại câu SQL đó; chế độ Theo món dùng lại `report-need` của Báo cáo (không công thức thứ hai).
- [ ] **Step 1: test RED**: vitest `chỉ người đã đặt có dòng; thẻ "Đã đặt 12/16", nút "Chép DS 4 người chưa đặt" chép đúng 4 tên (clipboard mock)`; `dòng phụ có "lưu 06/11"`; `lọc 2 khu → chỉ người thuộc 2 phòng, ListMeta "Đang hiện 5/12 người · 2 khu"`; `Theo món: Cần mua = max(0, đặt + nợ − tồn)` biên `tồn = đặt + nợ → 0`, `tồn = đặt + nợ − 1 → 1`; e2e api `short_items` cho người có món tủ thiếu; Playwright `G1 Kỳ tháng` 1280 + 390 (table-fit của Task 7 vẫn xanh).
- [ ] **Step 2–5:** RED → làm → GREEN → commit `feat: Kỳ tháng chỉ người đã đặt, lọc khu, chế độ theo món (G1)`.

### Task 28: G3 — popup Lịch sử đặt hàng của một nhân viên

**Files:** api `GET /api/admin/users/:sub/requests?year=YYYY` (module `requests`, chỉ đọc, `@Roles('admin','sa')`, trả mỗi tháng `{ym, status, lines[], adjustments[]}` — dùng lại truy vấn của `me/requests` có tham số sub); web `features/summary/order-history-dialog.tsx` (+ test), lối vào: menu ⋯ ở Kỳ tháng và Giao hàng, nút trong `features/directory/user-drawer.tsx`.
- [ ] **Step 1: test RED**: e2e `member gọi → 403 FORBIDDEN_ROLE`; `admin, user không có phiếu năm đó → [] 200`; `sub không tồn tại → 404`; api-leak: chỉ dữ liệu của `:sub`; vitest dialog: `tab T12 chọn sẵn kỳ mới nhất có phiếu; chấm theo trạng thái (requestStatus của Task 6); tháng không đặt → chấm rỗng, bấm hiện "Không đặt tháng này"`; `‹ lùi năm`.
- [ ] **Step 2–5:** RED → làm → GREEN → commit `feat: Adm D&E xem lịch sử đặt hàng của một nhân viên (G3)`.

### Task 29: G4 — Giao hàng cùng kiểu bảng, từ chối/giảm dòng từ hộp Giao

**Files:** `features/delivery/people/people-table.tsx` (cột Người · Tiến độ giao (`ui/progress` + "x/y") · Tồn kho · Còn nợ "n món · Tkk" · Giao…), hộp Giao (`features/delivery/deliver-dialog.tsx`) thêm nút "Từ chối / giảm dòng…" mở `AdjustDialog` (Task 25) cho cùng phiếu, xong thì nạp lại hộp Giao.
- [ ] **Step 1: test RED**: vitest `cột Tiến độ "18/35" + thanh 51%`; `Còn nợ "2 món · T11"`; `bấm "Từ chối / giảm dòng…" → mở AdjustDialog đúng phiếu; lưu xong → dòng Còn chờ của hộp Giao giảm theo`; Playwright `G4 Giao hàng` 1280 + 390.
- [ ] **Step 2–5:** RED → làm → GREEN → commit `feat: Giao hàng cùng kiểu bảng Kỳ tháng, từ chối/giảm dòng ngay từ hộp Giao (G4)`.

### Task 30: G5 — Tủ / Kho: Sắp hết vs Thiếu kỳ này, sổ cái toàn kho

**Files:** api `GET /api/admin/stock/movements?ym=&kind=` (đọc `stock_movements` + tên món + người nhận, phân trang theo `created_at,id`); web `features/stock/stock-table.tsx` (cột Mức đặt lại, Tình trạng hai nhãn, Cần thêm), `stock-filter-tabs.tsx` (Tất cả · Thiếu kỳ này · Sắp hết · Hết), tab mới `features/stock/stock-ledger-page.tsx` (+ test); `docs/prd.md` FR-50 ghi rõ hai nghĩa.
- [ ] **Step 1: test RED** (biên hai phía): unit/vitest `Sắp hết: tồn 6 mức 6 → có; 7 → không; mức null → không bao giờ`; `Thiếu kỳ này: cần 5 tồn 4 → 1; tồn 5 → không`; e2e `movements?ym=2026-11 → đúng số dòng seed, sắp mới nhất trước; kind=issue chỉ xuất lẻ; member → 403`; vitest ledger `lọc Nhập → chỉ dòng purchase; tổng "Nhập +62 · Ra −40"`; Playwright `G5 Tủ / Kho` 1280 + 390.
- [ ] **Step 2–5:** RED → làm → GREEN → commit `feat: Tủ / Kho tách Sắp hết và Thiếu kỳ này, thêm sổ cái nhập xuất (G5)`.


### Task 31: G9 — ảnh tạm theo nhóm cho món chưa có ảnh

**Files:** `web/src/ui/item-thumb.tsx` (thêm `categoryIcon?: IconName`, `custom?: boolean`), bảng biểu tượng nhóm `web/src/lib/category-icon.ts` (khớp theo tên nhóm đã chuẩn hóa `foldVi`: "bút" → `pen`, "giấy"/"sổ" → `paper`, "kẹp"/"dán" → `clip`, "lưu trữ"/"bìa" → `folder`, còn lại → `box`; icon lấy từ `ui/icon-paths.ts`, thêm path nếu thiếu), nền theo `groupTone` có sẵn; mọi nơi gọi `ItemThumb` truyền nhóm.
- [ ] **Step 1: test RED** `item-thumb.test.tsx`: `không ảnh, nhóm "Bút & viết" → svg biểu tượng pen, aria-hidden, nền tone nhóm`; `nhóm lạ → box`; `custom không ảnh → ô "?" class viền đứt`; `có ảnh → img như cũ`; `category-icon.test.ts`: `"Giấy & sổ" → paper`, `"GIẤY" → paper` (không phân biệt hoa thường/dấu).
- [ ] **Step 2–5:** RED → làm → GREEN → commit `feat(web): ảnh tạm theo nhóm cho món chưa có ảnh (G9)`.

## Phase 3 — Kết thúc plan (CLAUDE.md)

### Task 21: Kiểm toàn bộ, đo lại, bản đồ

- [ ] **Step 1:** api `npm test`, `npm run test:e2e`, `npm run test:db`; web `npm test`, `npm run lint`, `npm run build`, `madge --circular src` = 0 (cả api), mọi file ≤ 400 dòng (`find … | xargs wc -l | awk '$1>400'` rỗng).
- [ ] **Step 2:** Playwright cả bộ 1280 + 390 trên compose dev (đã nạp `mau-seed.sql`), kèm `@axe-core/playwright` ở 390 không lỗi tương phản.
- [ ] **Step 3:** Chạy lại 5 phép đo của skill `ra-soat-ui` (probe, state-diff, fouc, thao tác tay, api-leak) trên đúng các route của báo cáo; ghi bảng "lỗi cũ → đã hết / còn" vào `docs/superpowers/specs/2026-11-15-ra-soat-giao-dien.md` mục "Sau khi sửa".
- [ ] **Step 4:** `docs/map.md` cập nhật mọi module đã chạm (ui, css, shell, request, month, delivery, reports, stock, arrivals, summary, review, catalog, admin, profile); vẽ lại sơ đồ bằng skill `archify` → `docs/diagrams/`.
- [ ] **Step 5:** Review toàn nhánh + code review mức high → một đợt sửa + re-review → đo lại bằng `ra-soat-ui` + tiêu chí áp được của `design-taste-frontend` (Step 3 chạy lại sau đợt sửa) → báo chủ dự án; gộp `main` và push chỉ khi được bảo.
