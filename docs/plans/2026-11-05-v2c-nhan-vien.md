# Plan v2-C — Trang Nhân viên đặt VPP theo thiết kế v2 (máy tính + điện thoại)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nhân viên đăng ký VPP trên một màn full width kiểu v2: lưới ảnh 4–5 món/hàng, thanh lọc phía trên, phiếu nền cam nhạt bên phải (máy tính); lưới 2 cột + thanh phiếu nổi (điện thoại); Lịch sử / Tôi cùng hệ.

**Architecture:** Chỉ đổi web, **không đổi API/DTO/mã lỗi/luật**. Logic giỏ/lưu giữ nguyên (`use-cart.ts`, `use-save-flow.ts`, `use-copy-previous.ts`, `use-leave-guard`, `request.api.ts`, `history.api.ts`); chỉ thay component trình bày và CSS. CSS nhân viên chuyển sang phạm vi `[data-shell='member']`, tệp `web/src/css/m1/member-*.css` + `features/request/*.m1.css`, dùng token v2 của `tokens-m1.css` (Plan A). Xóa `request.css`, `history.css`, phần member của `member.css` khi port xong.

**Tech Stack:** React 19, TanStack Query, react-router, i18next, Radix Dialog (sheet), vitest + Testing Library, Playwright + axe.

**Nguồn sự thật:** `docs/quyet-dinh-2026-11-05-luong-hanh-chinh.md` Q10, **Q15**, **Q16** · thiết kế `design-preview/v2-glass/NhanVienPC.dc.html` (máy tính), `NhanVien.dc.html` (điện thoại) · `docs/prd.md` FR-20…FR-28, BR-2, BR-12 · `CLAUDE.md`. Plan này **thay thế** `docs/plans/2026-11-02-mau1-nhan-vien.md` (đang hoãn) — mục "Giữ hành vi hiện có" (Global Constraints 1–10) của plan đó vẫn là luật cho plan này.

**Điều kiện đầu:** Plan v2-A + v2-B xong; nhánh `feat/giao-dien-v2c` tách từ đầu `feat/giao-dien-v2b`.

## Global Constraints

- Không push. Commit tiếng Việt, 1 commit/task, `git add <đường dẫn>`; không stage `docs/review-spec.md`, `docker-compose.override.yml`, `.claude/`, `.playwright-mcp/`, `PRODUCT.md`, `design-preview/redesign/`, `live-real/`.
- **Giữ nguyên hành vi** = Global Constraints 1–10 của `docs/plans/2026-11-02-mau1-nhan-vien.md` (kỳ 1–10 & khóa 00:00 ngày 11; hộp "Lưu phiếu tháng N?" + "x loại món · y đơn vị" + "Quay lại sửa"/"Lưu phiếu"; `max_qty`; lỗi dòng từ server gắn dòng giỏ + focus; "Thêm món khác" không có ô ảnh; "Chép lại danh sách tháng X"; kỳ khóa chỉ đọc + 2 biến thể khóa giữa chừng; thứ tự nhóm/`sort_order`; **nhân viên không bao giờ thấy tồn kho**; i18n vi+en). Implementer đọc mục đó.
- **Điểm gãy 900/901** (PRD FR-28, `NARROW_QUERY` trong `lib/use-media-query.ts`): ≤ 900 = bố cục điện thoại (thanh dưới 3 mục + thanh phiếu nổi), ≥ 901 = máy tính.
- **Giữ nguyên tên mọi test Playwright** hiện có ở `request.spec.ts`, `request-extra.spec.ts`, `history.spec.ts`, `camera-photo.spec.ts`, `smoke.spec.ts`, `notifications.spec.ts`, `i18n.spec.ts`, `p1/p2/p3-flow.spec.ts`; được sửa bước bên trong khi bố cục đổi, **không được bỏ assert**. Test mới tiền tố `V2C-Tn`.
- Màu (Q10/Q15): nền trang `linear-gradient(160deg, var(--c-shell-a), var(--c-shell-b) 55%, var(--c-shell-c))`; panel lưới `linear-gradient(180deg, var(--c-panel-a), var(--c-panel-b))` bo `var(--r-xl)`; **phiếu `var(--c-cart)` viền `var(--c-cart-line)`**; món đã chọn viền `--c-warn-fill`, badge số nền `#B4540A` → token mới `--c-pick: #B4540A` (chữ trắng ≥ 4.5:1, thêm cặp vào `tokens-contrast.test.ts`); nút chính `var(--c-dark)`; chữ trên nền tối chỉ `--c-on-dark`/`--c-on-dark-2`.
- `src/test/m1-scope.test.ts` hiện chỉ chấp nhận `[data-shell='admin']`: mở rộng cho tệp `css/m1/member-*.css` và `features/request/*.m1.css` phải bắt đầu bằng `[data-shell='member']` (Task C1).
- Câu chữ cố định (Q15/_SPEC): "Đăng ký văn phòng phẩm tháng {{m}}", "Chọn món, bấm Lưu phiếu. Bạn sửa được tới 23:59 ngày {{d}}, còn {{n}} ngày.", "Thêm vào phiếu", "Phiếu tháng {{m}}", "Chưa lưu"/"Đã lưu", "Lưu phiếu", "Chép lại tháng {{m}}", "Đã chọn", "Xóa bộ lọc", "Không có món phù hợp", "Món không có trong danh sách? Gửi đề nghị" (mở hộp "Thêm món khác" hiện có), "Phiếu chỉ được tính khi bạn bấm Lưu phiếu.".
- File ≤ 400 dòng, component ≤ 250, hàm ≤ 50; `madge --circular` = 0.

## Cổng mỗi task: TDD · DoD · E2E · Live (bắt buộc, theo `CLAUDE.md`)

Giống hệt mục cùng tên trong `docs/plans/2026-11-05-v2a-khung-giao-dien.md` (RED/GREEN có output; biên hai phía; tầng đúng; DoD đủ cả api + web trước commit; Playwright 1280 + 390 + axe 390; kiểm live chụp + NHÌN so với `NhanVienPC.dc.html`/`NhanVien.dc.html`, thử tay bằng tài khoản nhân viên IdP local `an.nguyen@pmh.com.vn` qua `https://dev-vpp.pmh.com.vn:8443` sau khi rebuild `vpp-web`; báo cáo đủ mục).

## Review Focus

1. **169 món Booking ở 390 px** → trang không dài vô tận: lọc theo nhóm mặc định "Hay dùng" nếu có, hoặc nhóm đầu; tìm kiếm luôn ở trên; test đếm thẻ hiển thị ≤ số món của nhóm.
2. **Phiếu dài (≥ 15 dòng)** ở máy tính → khung phiếu cuộn trong, nút Lưu phiếu luôn thấy (sticky); ở 390 sheet phiếu cuộn, nút Lưu ở đáy sheet.
3. **Kỳ khóa / chỉ đọc** → thanh lọc vẫn dùng được, mọi stepper/“Thêm vào phiếu” bị vô hiệu kèm lý do, phiếu hiện tiến độ giao.
4. **Bộ lọc “Đã chọn” + tìm kiếm cùng lúc** → kết quả là giao của hai điều kiện; "Xóa bộ lọc" trả về mặc định.
5. **Món có trong phiếu nhưng đã ngừng (`ITEM_INACTIVE`)** → vẫn hiện trong phiếu với lỗi dòng, không biến mất khỏi phiếu khi lọc.

---

### Task C1: Khung member v2 (thanh trên tối, nền teal, thanh dưới điện thoại) + phạm vi CSS

**Files:** Modify `web/src/shell/member-shell.tsx`, `web/src/shell/bottom-nav.tsx`, `web/src/test/m1-scope.test.ts`, `web/src/css/tokens-m1.css` (`--c-pick`), `web/src/css/tokens-contrast.test.ts`; Create `web/src/css/m1/member-shell.css`; Modify `web/src/main.tsx` (import); Test `web/src/shell/member-shell.test.tsx`, `web/playwright/smoke.spec.ts`.

**Interfaces:** Produces class `.m-page` (khung nội dung max-width 1440, padding 0 20 24), `.m-panel` (panel "Vừa") để C2–C6 dùng.

Thiết kế (theo `NhanVienPC.dc.html` header): trái logo ô 38 `--c-logo-bg` + "VPP D&E"; giữa nhóm tab pill (Đăng ký · Lịch sử · Tôi) nền `rgb(255 255 255 / .06)`, tab hiện tại nền trắng chữ ink; phải chuông + khối avatar (chữ đầu, tên, phòng). ≤ 900: thanh trên chỉ logo + chuông + avatar, thanh dưới 3 mục nền `--c-shell-a`, mục hiện tại chữ `--c-on-dark` nền `rgb(255 255 255 / .12)`.

- [ ] **Step 1: Test đỏ** `m1-scope.test.ts`: `it('CSS member M1 bắt đầu bằng [data-shell=member]')` (tệp `css/m1/member-*.css`, `features/request/*.m1.css`); `tokens-contrast.test.ts` thêm `['--c-on-dark', '--c-pick']`; `member-shell.test.tsx`: tab "Đăng ký" có `aria-current="page"` ở `/`, avatar hiện tên + phòng.
- [ ] **Step 2–4:** FAIL → viết → `npm test && npm run lint && npm run build`.
- [ ] **Step 5: Playwright** `smoke.spec.ts` + `history.spec.ts` (thanh dưới ≤ 2 chạm) xanh 1280 + 390, axe 390.
- [ ] **Step 6:** Commit `feat: khung Nhân viên v2 — thanh trên tối, nền teal, thanh dưới`.

### Task C2: Bố cục trang Đăng ký — tiêu đề kỳ, nhắc nợ, panel lưới + phiếu cam

**Files:** Modify `features/request/request-page.tsx` (≤ 250 dòng; tách `request-layout.tsx` nếu cần), `period-hero.tsx`, `previous-period-card.tsx`; Create `features/request/request.m1.css`, `features/request/owed-notice.tsx` + test; Test `request-page.test.tsx`.

**Interfaces:** Consumes `useMyRequest(previous.ym)` (đã có trong `previous-period-card.tsx`). Produces `OwedNotice({ previous })` — hiện khi kỳ trước `delivering` và có dòng `qty − delivered_qty − cancelled_qty > 0`: "Bạn còn chờ nhận **{{tên}} ({{n}} {{đvt}})** từ tháng {{m}}. Không cần đăng ký lại." (≥ 2 món: "**{{k}} món** từ tháng {{m}}") + link "Xem" → `/history/{{ym}}`.

Bố cục ≥ 901: hàng tiêu đề (h1 30/800 chữ trắng + câu phụ `--c-on-dark-2`) | ô cam nhắc nợ (nền `rgb(247 178 103 / .14)`, viền `.4`); dưới là flex: `main.m-panel` (flex 999 1 640) + `aside` phiếu (flex 1 1 340, max 380, sticky top 16). Kỳ khóa: câu phụ thành "Kỳ tháng {{m}} đã khóa sổ — phiếu chỉ xem."

- [ ] **Step 1: Test đỏ** `owed-notice.test.tsx`: 1 dòng còn 1 ream → câu đúng; 0 dòng → không render; 2 món → "2 món"; kỳ trước không delivering → không gọi API.
- [ ] **Step 2: Test đỏ** `request-page.test.tsx`: h1 "Đăng ký văn phòng phẩm tháng 11"; câu "còn 6 ngày" với `days_left 6`; ngày 10 → câu "Hôm nay là ngày cuối" giữ như hiện có.
- [ ] **Step 3–5:** FAIL → viết → DoD; Playwright `request.spec.ts` xanh (giữ tên test).
- [ ] **Step 6:** Commit `feat: trang Đăng ký v2 — tiêu đề kỳ, nhắc nợ, khung lưới + phiếu`.

### Task C3: Thanh lọc — tìm, sắp xếp, Đã chọn, chép lại, chip nhóm có số, rỗng

**Files:** Create `features/request/item-filters.ts` + test, `features/request/filter-bar.tsx` + test; Modify `item-grid.tsx`, `request-page.tsx`.

**Interfaces:**

```ts
export type SortKey = 'fav' | 'az' | 'group';
export interface FilterState { q: string; group: string | 'all'; sort: SortKey; onlyPicked: boolean }
export const DEFAULT_FILTER: FilterState; // { q: '', group: 'all', sort: 'group', onlyPicked: false }
export function applyFilters(items: MemberItem[], cart: Cart, f: FilterState, lang: string): MemberItem[];
// q: bỏ dấu + không phân biệt hoa thường, khớp name/name_en/code; group; onlyPicked = có trong cart.lines; sort 'group' = thứ tự API (nhóm rồi sort_order), 'az' = localeCompare('vi'), 'fav' = món có trong phiếu tháng trước trước (dữ liệu copy-previous nếu đã tải, không có thì như 'group')
export function groupCounts(items: MemberItem[]): { id: string; label: string; n: number }[];
```

Lưu `FilterState` vào URL `?q=&g=&sort=&picked=1` (giá trị lạ → mặc định). "Chép lại tháng {{m}}" gọi luồng `useCopyPrevious` hiện có. Rỗng: "Không có món phù hợp" + "Thử từ khóa khác, hoặc gửi đề nghị món mới cho Hành chính." + nút "Xóa bộ lọc". Dòng đếm: "{{n}} món trong danh mục" / "{{n}} món khớp bộ lọc".

- [ ] **Step 1: Test đỏ** `item-filters.test.ts`: "but bi" khớp "Bút bi Thiên Long"; `onlyPicked` + q là giao (Review Focus 4); 'az' theo tiếng Việt ("Bìa" trước "Bút"); `groupCounts` đúng; URL `sort=xyz` → 'group'.
- [ ] **Step 2: Test đỏ** `filter-bar.test.tsx`: "Đã chọn 3" có `aria-pressed`; bấm chip nhóm → `aria-pressed=true`; "Xóa bộ lọc" về mặc định.
- [ ] **Step 3–5:** FAIL → viết → DoD; Playwright thêm `V2C-T3 lọc: tìm + Đã chọn + Xóa bộ lọc` 1280 + 390.
- [ ] **Step 6:** Commit `feat: thanh lọc trang Đăng ký — tìm, sắp xếp, đã chọn, nhóm`.

### Task C4: Thẻ món v2 — lưới 4–5/hàng, ảnh, nhãn nhóm, badge số, stepper

**Files:** Modify `features/request/item-card.tsx` (bỏ `ItemThumb` riêng, dùng `ui/item-thumb` `size='card'`), `item-grid.tsx`, `request.m1.css`; Test `item-card.test.tsx` (tạo), `request-page.test.tsx`.

Thẻ (theo `NhanVienPC.dc.html`): nền trắng bo 20 pad 8; ô ảnh cao 120 bo 14 nền tông nhóm, nhãn nhóm góc trái trên (nền trắng .92), badge số góc phải khi đã chọn (nền `--c-pick`, chữ trắng); tên 14/700 (2 dòng, min-height 38); "{{đvt}}, tối đa {{max}}/tháng"; chưa chọn: nút "Thêm vào phiếu"; đã chọn: stepper − số + (`+` vô hiệu ở `max`), viền `inset 0 0 0 2px var(--c-warn-fill)`. Lưới `repeat(auto-fill, minmax(min(100%, 176px), 1fr))`, gap 14 → 1280: 5 cột với phiếu 340. Không hiện tồn kho dưới mọi hình thức.

- [ ] **Step 1: Test đỏ** `item-card.test.tsx`: chưa chọn → nút "Thêm vào phiếu" → `onChange(1)`; đã chọn qty = max → `+` disabled, `−` ở 1 → về 0 (bỏ khỏi phiếu); không có chữ "Hết"/"tồn"; badge số = qty.
- [ ] **Step 2: Playwright** `V2C-T4 lưới 1280 có ≥ 4 thẻ một hàng` (so `boundingBox().y` của 4 thẻ đầu bằng nhau) + 390 2 cột.
- [ ] **Step 3–5:** FAIL → viết → DoD; `request.spec.ts`, `request-extra.spec.ts` xanh.
- [ ] **Step 6:** Commit `feat: thẻ món v2 — ảnh, nhãn nhóm, badge số, stepper`.

### Task C5: Phiếu cam bên phải + hộp lưu

**Files:** Modify `features/request/cart-panel.tsx` (≤ 250), `save-dialog.tsx`, `request.m1.css`; Test `request-page-flows.test.tsx`, `cart-panel.test.tsx` (tạo).

Phiếu (≥ 901): nền `--c-cart`, viền `--c-cart-line`, bo 26, pad 20, sticky top 16; đầu "Phiếu tháng {{m}}" + "{{x}} món, {{y}} đơn vị" + chip trạng thái ("Chưa lưu" nền trắng chữ `--c-warn` / "Đã lưu" nền `--c-ok-soft` chữ `--c-ok`); rỗng: khung viền đứt "Chưa có món nào. Bấm “Thêm vào phiếu” ở món cần dùng, hoặc chép lại tháng {{m}}."; mỗi dòng nền trắng bo 16: ảnh 42, tên, "{{qty}} {{đvt}}", − +; dòng ngoài danh mục giữ nhãn trạng thái + sửa/xóa như hiện có; danh sách cuộn trong `max-height: 520px` (Review Focus 2); nút "Lưu phiếu" tối cao 52 (vô hiệu khi không có thay đổi, như hiện có); chú thích "Phiếu chỉ được tính khi bạn bấm Lưu phiếu." / "Đã lưu lúc HH:MM. Bạn vẫn sửa được tới hết dd/mm.". Hộp lưu giữ nguyên nội dung, đổi kiểu v2 (bo 24, nút "Quay lại sửa" trắng / "Lưu phiếu" tối).

- [ ] **Step 1: Test đỏ** `cart-panel.test.tsx`: chip "Chưa lưu" khi dirty, "Đã lưu" sau lưu; 16 dòng → vùng danh sách có `overflow-y: auto` và nút "Lưu phiếu" vẫn trong khung (kiểm bằng Playwright ở Step 3); lỗi dòng `QTY_EXCEEDS_MAX` gắn đúng dòng + focus (giữ test cũ).
- [ ] **Step 2–3:** FAIL → viết → DoD; Playwright `V2C-T5 phiếu dài vẫn thấy nút Lưu` 1280.
- [ ] **Step 4:** Commit `feat: phiếu cam bên phải, hộp Lưu phiếu kiểu v2`.

### Task C6: Điện thoại ≤ 900 — lưới 2 cột, chip cuộn ngang, thanh phiếu nổi

**Files:** Modify `mobile-save-bar.tsx`, `cart-panel.tsx` (biến thể sheet), `request.m1.css`; Test `request-page-flows.test.tsx`, Playwright `request.spec.ts` (390).

Theo `NhanVien.dc.html`: đầu tối "Đăng ký tháng {{m}}" + "Còn {{n}} ngày" + nhắc nợ; panel "Vừa" bo trên 28; chip nhóm cuộn ngang (`overflow-x: auto`, không xuống dòng); lưới 2 cột; thanh phiếu nổi pill tối trên thanh dưới: "{{x}} món · {{y}} đơn vị" + nút "Lưu phiếu" (mở sheet phiếu có danh sách + nút Lưu ở đáy). Ô nhập 16 px (iOS).

- [ ] **Step 1: Test đỏ** vitest (`viewport.ts` helper có sẵn): ở 390 có nút "Xem phiếu" mở sheet `dialog` "Phiếu tháng 11"; ở 901 không có thanh nổi.
- [ ] **Step 2: Playwright** `V2C-T6 390: chip cuộn ngang, 2 cột, mở phiếu, lưu` + axe 390; mốc `E0-S9 … 900/901` giữ xanh.
- [ ] **Step 3–4:** FAIL → viết → DoD → Commit `feat: Đăng ký trên điện thoại v2 — 2 cột, chip ngang, phiếu nổi`.

### Task C7: Lịch sử · Chi tiết phiếu · Tôi theo v2

**Files:** Modify `history-page.tsx`, `history-detail-page.tsx`, `issues-section.tsx`, `features/profile/*page*.tsx`; Create `features/request/history.m1.css`; Test các `*.test.tsx` cùng tên, Playwright `history.spec.ts`.

Lịch sử: tiêu đề "Lịch sử" + câu "Phiếu các tháng trước và tình trạng nhận hàng."; panel "Vừa"; mỗi tháng 1 thẻ trắng bo 22: "Tháng {{m}}" + chip ("Đã nhận đủ" xanh / "Còn chờ {{n}} món" cam / "Không có phiếu" xám / "Đang mở" teal); tháng gần nhất có dòng món (ảnh 40, tên + số, chip từng dòng "Đã nhận dd/mm" / "Nhận {{a}}, chờ {{b}}" / "Đã hủy {{n}} — {{lý do}}"). Giữ mục "Nhận lẻ" (`issues-section`). Tôi: thẻ trắng thông tin + đổi ngôn ngữ + đăng xuất.

- [ ] **Step 1: Test đỏ**: chip đúng cho 4 trạng thái; dòng hủy hiện lý do; "Nhận lẻ" vẫn ≤ 2 chạm.
- [ ] **Step 2–4:** FAIL → viết → DoD; `history.spec.ts`, `i18n.spec.ts` xanh → Commit `feat: Lịch sử, chi tiết phiếu, Tôi theo v2`.

### Task C8: Dọn CSS cũ + vòng kiểm cuối plan

- [ ] **Step 1:** Xóa `features/request/request.css`, `history.css`, phần member trong `css/member.css` (grep không còn class dùng); `npm test && npm run lint && npm run build` xanh.
- [ ] **Step 2:** api + web full suites; `npx playwright test` toàn bộ 1280 + 390 → 0 fail (không chạy song song).
- [ ] **Step 3:** Rebuild `vpp-web` (`docker compose up -d --build web`), đăng nhập thật `an.nguyen@pmh.com.vn` qua `https://dev-vpp.pmh.com.vn:8443`: chọn 3 món, lọc, lưu, xem Lịch sử — chụp 1280 + 390.
- [ ] **Step 4:** Đánh dấu `docs/plans/2026-11-02-mau1-nhan-vien.md` "THAY THẾ bởi v2-C"; `docs/map.md`; sơ đồ `archify` luồng nhân viên; commit `docs: Plan v2-C xong`.
- [ ] **Step 5:** Review toàn nhánh + `code-review high`, sửa một vòng, báo cáo chủ dự án. Không merge.
