# Giao diện VPP theo họ QLHS/QLTS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Opus làm liền trong phiên) hoặc superpowers:subagent-driven-development; review độc lập theo giai đoạn như `CLAUDE.md` mục Review. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa VPP về cùng bộ màu, khung và luật "đang chọn" với QLHS/QLTS, và áp toàn bộ 121 mục đã duyệt trên trang rà soát Trước/Sau (TC-00..18, AD-01..56, NV-01..33, TN-02..15).

**Architecture:** Đổi ở gốc trước: khối token màu, component dùng chung `web/src/ui/*`, khung `web/src/shell/*`. Phase 1 là nền dùng chung, bắt buộc review trước khi sang màn. Sau đó sửa theo từng màn admin (Phase 2), từng màn nhân viên (Phase 3), rồi phần chạm server và màn mới (Phase 4). Mỗi gốc kèm một test chặn tái phát.

**Tech Stack:** React 19 + Vite 8 + TS 6, CSS token (`web/src/css/tokens-m1.css`, `web/src/css/m1/*`), vitest + Testing Library, Playwright trên compose dev; NestJS 12 + jest e2e/db-spec cho 3 chỗ chạm server.

**Spec:** `docs/superpowers/specs/2026-11-18-giao-dien-ho-qlhs-design.md` (quyết định + bảng 121 mục) và trang Trước/Sau https://claude.ai/artifact/9tSeCyKhUDVYcfgUP9sJGA (bản 5; mỗi mục có nút "Sau" là hình đích).

## Global Constraints

- Màu (TC-00), đặt trong khối bảng màu của `tokens-m1.css`, giữ tên biến cũ:
  - Màu chính: `--c-acc #1d4ed8`, `--c-acc-hover #1e40af`, `--c-acc-press #1e3a8a`, `--c-acc-soft #eff4ff`.
  - Mới: `--c-acc-ink #1e3a8a`, `--c-acc-line #c7d7fe`.
  - Sidebar: `--c-rail #0f1f3d`, `--c-rail-ink rgba(255,255,255,.76)`, `--c-rail-on rgba(255,255,255,.1)`, `--c-rail-bar #60a5fa`.
  - Nền: `--c-page #f3f6fb`, `--c-surface #fff`, `--c-surface-2 #f7f9fc`.
  - Chữ: `--c-ink #111a2c`, `--c-ink-2 #364258`, `--c-muted #5a6680`.
  - Viền: `--c-line #dde3ee`, `--c-line-strong #c6cfdf`.
  - Trạng thái: ok `#067647/#ecfdf3/#abefc6`, warn `#b54708/#fffaeb/#fedf89`, danger `#b42318/#fef3f2/#fecdca`, info `#0e7490/#ecfeff`.
  - Số đếm việc chờ: `#fdb022` (chữ `#3b2500`).
- Thang bo góc A (15/11) giữ nguyên: nút, ô nhập, chip `--r-sm` 6; thẻ, bảng, menu `--r-md` 8; hộp thoại, ngăn kéo `--r-xl` 12. Pill chỉ cho nhãn trạng thái, số đếm, avatar. Chip **không** bo tròn.
- Luật "đang chọn", đúng 3 kiểu, đặt tên lớp/biến một lần và dùng lại:
  - A. Điều hướng trên nền tối: nền `--c-rail-on`, chữ trắng, vạch 3px `--c-rail-bar`. Sidebar để vạch ở trái, tab thanh trên nhân viên ở dưới, thanh dưới 390 ở trên.
  - B. Xem/lọc trên nền sáng: nền `--c-acc-soft`, viền `--c-acc-line`, chữ `--c-acc-ink`, đậm 600. Danh sách dọc thêm vạch trái 3px `--c-acc`.
  - C. Chọn một giá trị: nền `--c-acc`, chữ trắng.
  - Ngoại lệ: thẻ món đã chọn ở Đăng ký có nền cam nhạt, viền cam, không có số tròn trên ảnh.
- Vạch 3px vẽ bằng `::before` hoặc `box-shadow: inset 3px 0 0`, không dùng `border-left`, để không xô bố cục; bo `0 3px 3px 0`, cách trên dưới 8px.
- Điều khiển cao 36 (`--ctl-h` giữ 40 cho thanh công cụ có ô nhập); `pointer: coarse` 44. Mỗi màn đúng một nút `--c-acc` đặc ở góc phải đầu trang.
- Icon chỉ dùng `web/src/ui/icon-paths.ts`. Logo mới: `web/public/vpp-logo.png` (cắt từ `logo vpp.webp`, góc trong suốt), dùng ở sidebar, thanh trên nhân viên, đăng nhập, favicon, apple-touch-icon.
- CLAUDE.md giữ nguyên:
  - TDD: RED rồi GREEN, lệnh và output ghi vào commit; biên hai phía theo phễu.
  - i18n vi + en trong cùng commit; không chuỗi cứng; `wording.test.ts` xanh.
  - File ≤ 400 dòng (chạm 350 thì tách), component ≤ 250 dòng; `madge` = 0.
  - Cập nhật `docs/map.md` trong commit cuối mỗi task.
  - Playwright chạy 1280 + 390; axe 390 không lỗi tương phản.
  - Không push khi chưa được bảo; không commit `design-preview/_SPEC.md`, `docker-compose.override.yml` hay file người dùng chưa track.
- Nhánh `feat/giao-dien-ho-qlhs` cắt từ HEAD `feat/giao-dien-a` (a5d9bb0). Commit tiếng Việt, cuối thân có `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Mỗi task: viết test → chạy thấy đỏ đúng lý do → sửa tối thiểu → chạy lại xanh → chạy cả gói (`npm test`, `npm run lint`; task có CSS chạy thêm `npm run build`) → commit. Bên dưới mỗi task chỉ ghi phần riêng của task: test nào, giá trị nào, file nào.

## Review Focus

- **Tiếng Anh dài hơn tiếng Việt** làm vỡ hàng chip bo 6 hoặc thẻ số ở 1024: phải xuống dòng gọn, không tràn. Task 4 chạy `layout-wrap.spec.ts` ở cả `vi` và `en`.
- **Dữ liệu rỗng ở trang "Việc hôm nay"** (chưa có kỳ, API lỗi một phần): mỗi ô tự báo lỗi riêng, không làm trắng cả trang. Task 21 có vitest với một query lỗi và một query rỗng.
- **Gộp Xuất lẻ vào Tủ/Kho** (AD-38): link cũ `/admin/issues` trong chuông hay sổ tay vẫn tới đúng chỗ. Task 15 test chuyển hướng sang `/admin/stock?tab=history&kind=issue`.
- **Chuông nhắc tự đọc khi lưu phiếu** (NV-03): chỉ chuông của đúng người và đúng kỳ, không đụng chuông người khác. Task 25 có db-spec với hai người, hai kỳ.
- **Tương phản sau đổi màu:** chữ `--c-muted` trên `--c-surface-2` và chữ trên nền cam của thẻ đã chọn phải ≥ 4.5:1. Task 1 mở rộng `tokens-contrast.test.ts`; Task 23 kiểm thẻ cam.

---

## Phase 0 — Ghi quyết định

### Task 0: review-spec cho các mục trái spec + nhánh mới

**Files:** Modify `docs/review-spec.md`, `docs/prd.md` (nếu có câu chữ trái), tạo nhánh.

- [ ] `git switch -c feat/giao-dien-ho-qlhs` từ a5d9bb0. Commit kèm spec `docs/superpowers/specs/2026-11-18-giao-dien-ho-qlhs-design.md` và plan này.
- [ ] Thêm vào `docs/review-spec.md` một mục "18/11/2026 — giao diện họ QLHS/QLTS". Mỗi dòng ghi: mục spec cũ → quyết định mới → mã mục. Các mục cần ghi:
  - TC-00 màu;
  - TC-01 khung trang (thanh trên trắng, bỏ tấm nổi);
  - TC-03 luật đang chọn (thay luật `--c-sel` nền tối);
  - TC-14 trang Đăng ký: thẻ đã chọn giữ cam, bỏ số;
  - AD-08 "Lọc phòng";
  - AD-09 và TN-13: "Đang hiện x/y" chỉ hiện khi đang lọc;
  - NV-04 hạn nói một lần;
  - NV-11 bỏ nút "+ Thêm món khác" ở thanh lọc;
  - NV-33 đăng nhập một nút, email tùy chọn;
  - TN-04 nút nguy hiểm;
  - AD-33 nút "Quay lại".
- [ ] Commit `docs: ghi quyết định giao diện họ QLHS/QLTS 18/11`.

## Phase 1 — Nền dùng chung (review độc lập trước Phase 2)

### Task 1: Bảng màu họ QLHS/QLTS (TC-00, TN-15)

**Files:** Modify `web/src/css/tokens-m1.css` (khối bảng màu), `web/src/css/tokens.css` nếu còn màu cũ; test `web/src/css/tokens-contrast.test.ts`, `web/src/css/primary-color.test.ts`, tạo `web/src/css/legacy-colors.test.ts`.

- [ ] **Test** `primary-color.test.ts`: `--c-acc` = `#1d4ed8` trong cả shell member và admin.
- [ ] **Test** `tokens-contrast.test.ts` thêm các cặp, mỗi cặp ≥ 4.5:
  - `--c-muted`/`--c-surface-2`
  - `--c-acc-ink`/`--c-acc-soft`
  - `--c-warn`/`--c-warn-soft`
  - `--c-rail-ink`/`--c-rail`
  - trắng/`--c-acc`
- [ ] **Test mới** `legacy-colors.test.ts`: quét `web/src/**/*.{css,tsx,ts}` trừ file test, không còn `#0E6A7B`, `#0E2A33`, `#14231C`, `#51645B`, `#C9D5CE`, `#08303B` (không phân biệt hoa thường).
- [ ] **Code:** thay khối bảng màu theo Global Constraints. Thêm `--c-acc-ink`, `--c-acc-line`, `--c-rail*`, `--c-count`, `--c-count-ink`. Bỏ các biến của khung kính teal (`--c-shell-*`, `--c-glass*`, `--c-hero-*`, `--c-bar-fill`) và đổi mọi chỗ dùng chúng sang `--c-page`/`--c-surface`.
- [ ] **Code:** `--c-cart*` thành tông cam warn mới (`#fffaeb`/`#fedf89`/`#7a2e0e`); `--c-pick` cam đậm đủ 4.5 với chữ trắng.
- [ ] Commit `feat(web): bảng màu họ QLHS/QLTS`.

### Task 2: Luật "đang chọn" A/B/C (TC-03, mục 2 cả 8 kiểu, TN-10)

**Files:** Modify `web/src/ui/segmented.tsx`, `web/src/ui/filter/*`, `web/src/ui/stat-card.tsx`, `web/src/ui/language-switch.tsx`, `web/src/ui/month-picker.tsx`, `web/src/ui/month-switcher.tsx`, `web/src/css/m1/filter.css`, `web/src/css/m1/base.css`; tạo `web/src/css/selection-rule.test.ts`; Playwright `web/playwright/button-matrix.spec.ts` (cập nhật snapshot).

- [ ] **Test** `selection-rule.test.ts`: quét CSS, mọi selector chứa `[aria-pressed="true"]`, `[aria-selected="true"]`, `[aria-current]` hoặc `.is-on` chỉ được dùng nền `var(--c-acc-soft)` (B), `var(--c-acc)` (C) hoặc `var(--c-rail-on)` (A). Cấm `var(--c-sel)`, `var(--c-dark)`, `#fff` làm nền đang chọn.
- [ ] **Test** vitest `segmented.test.tsx`: mục đang chọn có `aria-pressed="true"`. Theo nghĩa, segmented, chip và stat-card đều thuộc B. Không kiểm style inline.
- [ ] **Code:** chip/segmented/stat-card dùng kiểu B, bo `--r-sm`; bỏ rãnh xám và nền trắng nổi. Language switch (trang Tôi, đăng nhập, sheet Tôi) và ô tháng trong month-picker dùng C. Month switcher (TN-10) cao `--ctl-h`, bo `--r-sm`, không còn pill.
- [ ] **Code:** xóa `--c-sel`, `--c-on-sel`, `--c-sel-count` khỏi token sau khi không còn ai dùng.
- [ ] **Playwright:** `button-matrix.spec.ts` chụp lại snapshot (`--update-snapshots`), mở ảnh xem bằng mắt rồi commit snapshot mới. Trước đó, `.gitignore` phải chặn ảnh ngoài thư mục `-snapshots`.
- [ ] Commit `feat(web): một luật đang chọn A/B/C`.

### Task 3: Một bộ nút, nhãn, nút icon, bộ −/+ (TC-13, TC-09, TN-02…TN-08)

**Files:** Modify `web/src/css/m1/base.css` (lớp `.btn*`, `.tag*`), `web/src/ui/stepper.tsx`, `web/src/ui/confirm-dialog.tsx`, `web/src/ui/row-menu.tsx`; test `web/src/ui/stepper.test.tsx`, `web/src/ui/confirm-dialog.test.tsx`, tạo `web/src/css/button-family.test.ts`.

- [ ] **Test** `button-family.test.ts` (quét CSS):
  - chỉ `.btn--primary` có nền `var(--c-acc)`;
  - `.btn--danger-line` chữ `var(--c-danger)`, viền `var(--c-danger-line)`;
  - `.btn--danger` (đặc) chỉ xuất hiện trong `confirm-dialog`.
- [ ] **Test** `.tag`: dạng pill, cao 22, có `::before` chấm 6px `currentColor`, 5 tông `ok/warn/danger/info/muted`.
- [ ] **Test** `button-family.test.ts` (TN-05): không selector nào vừa có khung nút (`.btn`) vừa `text-decoration: underline`. Chuyển trang dùng liên kết gạch chân không khung; mở hộp hay đổi trạng thái dùng nút.
- [ ] **Test** `stepper.test.tsx`: nút −/+ là `button` có nhãn "Bớt"/"Thêm"; tắt thì `disabled` kèm `aria-describedby` trỏ tới lý do. Biên cao 40 ở desktop và 44 khi `pointer: coarse` kiểm ở Playwright `card-320.spec.ts`.
- [ ] **Code:**
  - nút chính cao 36, đậm 600, không bóng;
  - nút phụ có viền `--c-line-strong`;
  - nút nguy hiểm trong hàng là `.btn--danger-line`;
  - nút icon 36/44 bo `--r-sm`, viền mảnh (TN-07);
  - TN-08: "Người đã nghỉ" là `.tag--muted` ở mọi màn.
- [ ] Commit `feat(web): một bộ nút, nhãn có chấm, nút icon, bộ −/+`.

### Task 4: Khuôn bảng, thanh lọc, đang tải/rỗng/lỗi, "Đang hiện" (TC-07, TC-10, TC-12, TN-11, TN-12, TN-13)

**Files:** Modify `web/src/ui/data-table*.tsx`, `web/src/css/m1/table.css`, `web/src/ui/toolbar.tsx`, `web/src/ui/filter-notice.tsx`, `web/src/ui/list-meta.tsx`, `web/src/ui/load-state.tsx`, `web/src/ui/empty-frame.tsx`; test `web/src/ui/list-meta.test.tsx`, `web/src/ui/load-state.test.tsx`; Playwright `web/playwright/layout-wrap.spec.ts`, `fixed-columns.spec.ts`.

- [ ] **Test** `list-meta.test.tsx` "Đang hiện x/y" chỉ render khi `filtered && x < y`. Biên hai phía:
  - x = y, có lọc → không hiện;
  - x = y − 1 → hiện;
  - không lọc → không hiện.
- [ ] **Test** `load-state.test.tsx`: rỗng có tiêu đề, gợi ý và nút hành động (nếu truyền vào); lỗi có `role=alert` và nút "Thử lại" gọi `refetch`.
- [ ] **Code:**
  - thead nền `--c-surface-2`, chữ 12.5/600 `--c-muted`;
  - dòng cao 52, cột ⋯ ghim phải kèm bóng;
  - dòng nhóm nền trung tính, không có nút thu/mở (TN-11);
  - lớp `.row--attn-warn` / `.row--attn-danger` = vạch trái inset 3px + nền nhạt;
  - bỏ ô tròn chữ cái ở mọi bảng admin (TN-12, xóa `delivery-avatar.tsx` nếu còn mình nó dùng);
  - thanh lọc là khung trắng bo `--r-md`, lọc ngay khi đổi; có hàng "Đang lọc" gồm các chip gỡ được và nút "Xóa lọc" (TC-10).
- [ ] **Playwright:** `layout-wrap.spec.ts` chạy thêm `en` ở 1024 và 1280; `fixed-columns.spec.ts` kiểm cột ⋯ luôn trong tầm nhìn.
- [ ] Commit `feat(web): khuôn bảng, thanh lọc và trạng thái dùng chung`.

### Task 5: Khung admin — sidebar navy vạch trái, thanh trên trắng, logo (TC-01, TC-02, TN-09, AD-03)

**Files:** Modify `web/src/shell/admin-shell.tsx`, `admin-sidebar.tsx`, `admin-sidebar-user.tsx`, `admin-topbar.tsx`, `admin-period-card.tsx`, `web/src/css/m1/shell.css`; tạo `web/public/vpp-logo.png`, cập nhật `web/index.html` (favicon, apple-touch-icon); test `admin-sidebar.test.tsx`, `admin-topbar.test.tsx`; Playwright `admin-shell.spec.ts`, `fouc.spec.ts`.

- [ ] **Test** `admin-topbar.test.tsx` (1280):
  - có đường dẫn "QLVPP › {tên màn}";
  - có chuông và nút tài khoản (tên viết tắt) ở bên phải;
  - sidebar không còn khối người dùng ở chân.
- [ ] **Test** `admin-topbar.test.tsx` (390): dòng phụ giống nhau ở mọi màn, "Kỳ hiện tại: tháng {n} · {đang mở|đã khóa}" (AD-03).
- [ ] **Test** `admin-sidebar.test.tsx`: mục khớp route có `aria-current="page"`; số đếm có nhãn đọc màn hình. Số đếm chỉ có một màu (TN-09); nội dung số do Task 20 sửa.
- [ ] **Code:**
  - bỏ nền vỏ tối và tấm nội dung nổi; trang nằm thẳng trên `--c-page`;
  - sidebar rộng 236, nền `--c-rail`;
  - mục active theo kiểu A, vạch `::before` trái, chữ không đổi độ đậm;
  - logo `vpp-logo.png` 30px thay chữ "V";
  - thẻ "Kỳ tháng 1" ở chân sidebar giữ, nền `rgba(255,255,255,.06)`.
- [ ] **Playwright:**
  - `admin-shell.spec.ts` 1280: mục "Kỳ tháng" đang chọn, `getComputedStyle(::before).width === '3px'`;
  - 390: ngăn kéo menu mở ra thấy logo;
  - `fouc.spec.ts` vẫn xanh.
- [ ] Commit `feat(web): khung admin theo họ QLHS/QLTS`.

### Task 6: Khung nhân viên — thanh trên navy, thanh dưới đặc (TC-14 phần khung, TC-15, NV-01, NV-02, NV-31)

**Files:** Modify `web/src/shell/member-shell.tsx`, `bottom-nav.tsx`, `account-menu.tsx`, `web/src/css/m1/member-shell.css`, `member-page.css`; test `member-shell.test.tsx`, `account-menu.test.tsx`; Playwright `admin-mobile.spec.ts` (phần member), `i18n.spec.ts`.

- [ ] **Test** `member-shell.test.tsx`:
  - 1280: không có bộ VI/EN trên thanh trên; VI/EN nằm trong hộp tài khoản (NV-01);
  - dưới tên không còn "Phòng D&E" (NV-02);
  - hộp tài khoản ghi "Phòng D&E", không có "· Nhân viên" (NV-31).
- [ ] **Test** `bottom-nav.test.tsx` (tạo mới): 3 mục; mục active có `aria-current="page"`.
- [ ] **Code:**
  - thanh trên cao 60 nền `--c-rail`, logo, tab "Đăng ký / Lịch sử" kiểu A vạch dưới;
  - nội dung nằm trên `--c-page`;
  - thanh dưới 390 nền `--c-rail` đặc (bỏ kính mờ), mục active kiểu A vạch trên;
  - thanh "Lưu phiếu" dính ngay trên thanh dưới.
- [ ] **Playwright:** `i18n.spec.ts` đổi ngôn ngữ qua hộp tài khoản ở 1280 và 390.
- [ ] Commit `feat(web): khung nhân viên theo họ QLHS/QLTS`.

**Hết Phase 1:** review độc lập diff Task 0–6 (đúng spec, chất lượng, biên, map). Sửa xong finding Critical/Important rồi mới sang Phase 2.

## Phase 2 — Màn Adm D&E

### Task 7: Kỳ tháng (TC-05, TC-08, AD-04…AD-14)

**Files:** `web/src/features/month/*` (`month-page.tsx`, `month-strip.tsx`, `month-steps.ts`, `month-left-reminder.tsx`, `month-chips-bar.tsx`, `month-area-filter.tsx`, `month-people-table.tsx`, `month-open-table.tsx`, `month-open-view.tsx`, `month.m1.css`), `web/src/features/summary/adjust-dialog.tsx`, locale `month.ts`; Playwright `month.spec.ts`.

- [ ] **Test** `month-g1.test.tsx` / `month-page.test.tsx`:
  - 4 bước là danh sách có thứ tự (`role=list`), bước hiện tại có `aria-current="step"`, không phải `button` (TC-05);
  - bộ chọn kỳ nằm trong `role=toolbar` (AD-04);
  - băng người nghỉ chỉ ghi "8 người đã nghỉ còn phần chưa nhận", không kể tên, không có nút "Xem nợ tháng trước" (AD-05, AD-07);
  - nút "Lọc 8 người này" bật chip "Người đã nghỉ 8" (`aria-pressed=true`) và bảng còn 8 dòng (AD-06);
  - "Lọc phòng" là ô chọn nhiều trong hàng lọc (AD-08);
  - không có ô chữ cái (AD-10);
  - cột Trạng thái là `.tag` (AD-11);
  - kỳ đang đăng ký dùng cùng bảng, bấm dòng mở phiếu, không còn cột chữ "Xem" (AD-12);
  - ngăn "Phiếu của …" không có nút "Đóng" ở chân (AD-13).
- [ ] **Test** `adjust-dialog.test.tsx`: chữ "Chọn ít nhất một dòng" đứng trước nút chính theo thứ tự DOM (AD-14).
- [ ] **Code** theo bản "Sau" của từng mục. Dòng người đã nghỉ dùng `.row--attn-warn` (TC-08).
- [ ] **Playwright** `month.spec.ts`: 1280 và 390 lọc người đã nghỉ; ở 390 thấy dòng người đầu khi mở.
- [ ] Commit `feat(web): Kỳ tháng theo bản Sau (TC-05, TC-08, AD-04…14)`.

### Task 8: Báo cáo & gửi NCC (AD-15…AD-22)

**Files:** `web/src/features/reports/*` (`report-send-page.tsx`, `print-toolbar.tsx`, `report-item-table.tsx`, `report-part1-rows.ts`), locale `reports.ts`; Playwright `print.spec.ts`.

- [ ] **Test:**
  - không còn nút "Tháng 1 đang đăng ký — báo cáo sau…"; nút › tắt có lý do qua `aria-describedby` (AD-15);
  - bộ chọn tháng nằm trong toolbar (AD-16);
  - toolbar không có "In lại" (AD-17);
  - chip "Đã đổi sau bản in (17)" có `aria-pressed`, khi bật thì lọc bảng (AD-18);
  - nút chính "In trình ký" (AD-19);
  - cột "Tủ" (AD-20);
  - dòng nhóm không có class tô màu nhóm và không có nút thu/mở (AD-21, AD-22).
- [ ] Commit `feat(web): Báo cáo theo bản Sau (AD-15…22)`.

### Task 9: Nhận hàng (AD-23…AD-26)

**Files:** `web/src/features/arrivals/*` (`arrivals-group.tsx`, `arrival-table.tsx`, `arrival-status.ts`, `arrivals-toolbar.tsx`), locale; Playwright `arrivals.spec.ts`.

- [ ] **Test:**
  - đầu nhóm chỉ có ô tick, không có nút "Nhận đủ hàng" (AD-23);
  - nhãn trạng thái "Đủ" (AD-24);
  - không có cột "Còn thiếu" (AD-25);
  - "Đang hiện" theo Task 4 (AD-26).
- [ ] Playwright 1280 + 390: tick nhóm thì thanh dưới hiện, bấm Nhận đủ hàng.
- [ ] Commit `feat(web): Nhận hàng theo bản Sau (AD-23…26)`.

### Task 10: Giao hàng + Danh bạ: thẻ số làm bộ lọc (TC-04, AD-27…AD-31, AD-48…AD-50)

**Files:** `web/src/features/delivery/people/*`, `web/src/features/directory/*` (`users-stats.tsx`, `users-table.tsx`, `user-drawer.tsx`), `web/src/ui/stat-card.tsx`, `stat-row.tsx`, locale; Playwright `delivery-people.spec.ts`, `admin.spec.ts`.

- [ ] **Test** `stat-row` khi dùng làm bộ lọc:
  - là `role=tablist`, mỗi thẻ là `role=tab` có `aria-selected`;
  - bấm thẻ thì gọi `onSelect(key)`;
  - thẻ `tone="danger"` có nền danger-soft (kiểm bằng class, không kiểm style).
- [ ] **Test Giao hàng:**
  - có 5 thẻ "Chưa nhận / Giao được ngay / Giao một phần / Đã nhận đủ / Người đã nghỉ", số khớp số dòng khi lọc;
  - không có dòng "1 người có cả hai" (AD-27);
  - nút giao vẫn ghi "Giao…" khi tắt, lý do qua `aria-describedby` (AD-28);
  - mục ⋯ ghi "Xem phiếu" (AD-29);
  - ô tick tắt ở người đã nghỉ có lý do (AD-30);
  - hộp "Giao cho …?" có nút "Hủy" (AD-31).
- [ ] **Test Danh bạ:**
  - ô số dùng cùng `stat-row` lọc;
  - không có "Đang hiện 14/52" (AD-48);
  - cột "Phiếu tháng 1" với nhãn "Chưa đặt"/"Đã đặt" (AD-49);
  - ngăn người dùng không có nút "Đóng" ở chân (AD-50).
- [ ] Commit `feat(web): thẻ số làm bộ lọc ở Giao hàng, Danh bạ (TC-04, AD-27…31, 48…50)`.

### Task 11: Còn nợ (AD-32…AD-34)

**Files:** `web/src/features/delivery/backlog-*.tsx`, `cancel-dialog.tsx`, `deliver-more-dialog.tsx`, locale `delivery.ts`; Playwright `backlog.spec.ts`.

- [ ] **Test:**
  - cột "Tủ" (AD-32);
  - hộp Hủy nợ có nút thoát "Quay lại" + nút đỏ đặc "Hủy nợ" (AD-33, quyết định trong spec);
  - hộp Giao bổ sung ghi "Giao được tối đa {n} {đvt} — bằng số còn nợ hoặc số trong tủ, lấy số nhỏ hơn".
- [ ] **Test biên** cho câu chữ của AD-34: n = min(nợ, tủ) ở cả hai phía, khi nợ < tủ và khi tủ < nợ.
- [ ] Commit `feat(web): Còn nợ theo bản Sau (AD-32…34)`.

### Task 12: Tủ / Kho (AD-35…AD-37)

**Files:** `web/src/features/stock/*` (`stock-inventory.tsx`, `stock-filter-tabs.tsx`, `stock-rows.ts`), locale; Playwright `admin-panels.spec.ts`.

- [ ] **Test:**
  - đầu trang không có nút "Sản phẩm" (AD-35);
  - cột Tình trạng ghi "—" khi bình thường, chỉ gắn nhãn khi Sắp hết / Hết / Thiếu kỳ này (AD-36);
  - không có "Đang hiện 50/56" cạnh "Xem thêm" (AD-37).
- [ ] **Test biên** cho AD-36 tại ngưỡng "Sắp hết": đúng ngưỡng có nhãn, ngưỡng + 1 không có (ngưỡng lấy từ `stock-rows.ts`).
- [ ] Commit `feat(web): Tủ/Kho theo bản Sau (AD-35…37)`.

### Task 13: Sản phẩm + Danh mục, ngăn kéo sửa (TC-11, AD-41…AD-47)

**Files:** `web/src/features/catalog/*` (`catalog-page.tsx`, `catalog-card.tsx`, `catalog-filter-bar.tsx`, ngăn Sửa), `web/src/ui/overlay-panel.tsx` (ngăn phải 560), `web/src/features/units/*`, `web/src/features/catalog` (danh mục nhóm), locale; Playwright `catalog.spec.ts`, `categories.spec.ts`.

- [ ] **Test:**
  - Sửa món mở `role=dialog` dạng ngăn phải (`data-placement="end"`), bảng vẫn còn trong DOM (TC-11);
  - không có nút "Danh mục" (AD-41);
  - không có nhãn nhóm trên ảnh thẻ (AD-42);
  - nút "Tạm ngưng" chỉ có trong ngăn Sửa (AD-43);
  - ở 390 không có "Lưới / Bảng" (AD-44, Playwright);
  - mô tả trang một câu (AD-45);
  - khi ảnh bắt buộc, ngăn Sửa chỉ có "Đổi ảnh" (AD-46);
  - không có "Đang hiện 5/5 nhóm" (AD-47).
- [ ] **Code:** danh sách nhóm dạng dọc dùng kiểu B có vạch trái.
- [ ] Commit `feat(web): Sản phẩm, Danh mục theo bản Sau (TC-11, AD-41…47)`.

### Task 14: Nhật ký + Cấu hình (AD-51…AD-56)

**Files:** `web/src/features/admin/audit-*.tsx`, `audit-quick-ranges.ts`, `config-*.tsx`, locale `admin.ts`; Playwright `audit.spec.ts`, `config.spec.ts`.

- [ ] **Test Nhật ký:**
  - không có nút "Lọc"; đổi ô chọn thì gọi API ngay, có debounce cho ô chữ (AD-51);
  - "Hôm nay / 7 ngày qua / Tháng {n}" là lựa chọn trong ô Khoảng ngày; "Đăng nhập bị từ chối" là một mục của ô Hành động (AD-52);
  - nút "Chỉ việc tự động" (AD-53);
  - không có "50+ dòng nhật ký", không có nút thu/mở ngày (AD-54).
- [ ] **Test Cấu hình:**
  - "Chỉ lưu khối này · ghi vào Nhật ký" chỉ còn một lần ở mô tả trang (AD-55);
  - ô ký thứ 3 có nhãn "Không in"; câu "Tối đa 3 ô; phiếu in 2 ô đầu" (AD-56).
- [ ] **Test biên** của AD-56: 2 ô thì không có nhãn "Không in", 3 ô thì ô thứ 3 có.
- [ ] Commit `feat(web): Nhật ký, Cấu hình theo bản Sau (AD-51…56)`.

**Hết Phase 2:** review độc lập diff Task 7–14.

## Phase 3 — Gộp Xuất lẻ + màn nhân viên

### Task 15: Gộp Xuất lẻ vào Tủ/Kho (AD-38, AD-39)

**Files:** `web/src/shell/admin-nav.ts`, `app-routes.tsx`, `web/src/features/issues/*` (bỏ trang, giữ bảng làm tab), `web/src/features/stock/*` (tab Lịch sử + lọc `kind=issue`, nút "Xuất lẻ một món" ở đầu trang); Playwright `issues.spec.ts`.

- [ ] **Test** `app-routes.test.tsx`: `/admin/issues` chuyển tới `/admin/stock?tab=history&kind=issue`.
- [ ] **Test** `admin-nav.test.tsx`: không còn mục "Xuất lẻ".
- [ ] **Test** stock: tab Lịch sử lọc "Xuất lẻ" có cột "Người xuất"; nút chính "Xuất lẻ một món" mở hộp xuất lẻ có sẵn.
- [ ] Commit `feat(web): gộp Xuất lẻ vào Tủ/Kho (AD-38, AD-39)`.


### Task 16: Đăng ký — đầu trang và dải nhận hàng (NV-04…NV-08)

**Files:** `web/src/features/request/*` (hero, `flow-notice.tsx`, dải nhận, hộp phiếu tháng trước, `cart-panel.tsx`), locale `request.ts`; Playwright `p1-flow.spec.ts`.

- [ ] **Test:**
  - đã lưu thì dòng trạng thái chỉ "Đã lưu 18:32", dưới nút giỏ không có ghi chú (NV-04, NV-18);
  - đang sửa thì không có nhãn "Chưa lưu" trên giỏ và không có "· Chưa lưu" ở thanh nổi; chấm đầu trang vẫn còn (NV-05);
  - dải ghi "Phiếu tháng 12 · còn chờ 3 món" (NV-06);
  - "Xem" là link tới `/history/2026-12`; hộp phiếu tháng trước bị xóa (NV-07, NV-08).
- [ ] **Test biên** NV-06: còn chờ 0 thì dải ghi "đã nhận đủ" hoặc ẩn theo bản Sau; còn chờ 1 thì ghi "còn chờ 1 món".
- [ ] Commit `feat(web): Đăng ký đầu trang theo bản Sau (NV-04…08)`.

### Task 17: Đăng ký — thanh lọc và lưới món (NV-09…NV-15, thẻ cam)

**Files:** `web/src/features/request/filter-bar.tsx`, `filter-bar.m1.css`, thẻ món, `custom-line-dialog.tsx`, locale; Playwright `card-320.spec.ts`, `p1-flow.spec.ts`.

- [ ] **Test:**
  - không có ô sắp xếp, lưới cố định theo nhóm (NV-09);
  - không có nút "Đã chọn" (NV-10);
  - thanh lọc không có "+ Thêm món khác"; thẻ cuối lưới và nút trong giỏ vẫn còn (NV-11);
  - "n món khớp" chỉ hiện khi ô tìm có chữ (NV-12);
  - không có chip "Chưa có nhóm"; món chưa có nhóm nằm trong chip "Khác", số đếm cộng dồn (NV-13);
  - nhãn nhóm trên thẻ chỉ hiện khi đang tìm (NV-14);
  - thẻ đã chọn không có số tròn trên ảnh (NV-15) và có class `is-picked` cho nền cam nhạt, viền cam.
- [ ] **Test** `custom-line-dialog.test.tsx` (TN-14): ô nhập trong hộp "Thêm món khác" dùng lớp ô nhập chung (cao 40/44, viền `--c-line-input`); ô Ghi chú không còn viền mặc định trình duyệt.
- [ ] **Test** axe 390 trên trang Đăng ký có thẻ đã chọn: không có lỗi tương phản.
- [ ] Commit `feat(web): lưới món theo bản Sau, thẻ đã chọn nền cam (NV-09…15)`.

### Task 18: Giỏ 1280 và thanh nổi 390 (NV-16…NV-22; NV-19 phương án 1)

**Files:** `cart-panel.tsx`, `cart-sheet.tsx`, thanh lưu 390, locale; Playwright `p1-flow.spec.ts`, `locked-request.ts`.

- [ ] **Test:**
  - đang sửa thì dòng giỏ có −/+ và ĐVT cạnh bộ đếm, không có dòng "3 cuộn" (NV-16);
  - giỏ trống chỉ có câu "Chưa có món nào…" (NV-17);
  - giỏ không còn chế độ xem: luôn có −/+ và nút "Lưu phiếu", không còn "Sửa phiếu" (NV-19, phương án 1);
  - 390, phiếu đã lưu, không đổi gì: thanh nổi không có nút "Lưu phiếu" (NV-20);
  - 390 có thay đổi: nút ghi đúng "Lưu phiếu", một dòng (NV-21);
  - "Hủy" là nút phụ (NV-22).
- [ ] **Code:** cập nhật `docs/prd.md` câu về "Sửa phiếu" theo NV-19, ghi kèm review-spec ở Task 0. Câu chữ CLAUDE.md "Lưu phiếu", "Quay lại sửa" giữ nguyên.
- [ ] **Playwright:** kỳ khóa thì giỏ chỉ xem, không có −/+ (luật server giữ nguyên).
- [ ] Commit `feat(web): giỏ một chế độ, thanh lưu 390 (NV-16…22)`.

### Task 19: Popup kỳ mới, Lịch sử, Tôi, đăng nhập (NV-23…NV-30, NV-32, NV-33)

**Files:** `web/src/features/request/*` (popup kỳ mới), `history-*.tsx`, `history.m1.css`, `web/src/shell/login-screen.tsx`, `sa-login-form.tsx`, locale; Playwright `history.spec.ts`, `admin-shell.spec.ts` (phần login).

- [ ] **Test popup kỳ mới:** một câu "Đã mở đăng ký tháng 1 — hạn 23:59 ngày 10/01.", không có khối phiếu tháng trước (NV-23, NV-24).
- [ ] **Test Lịch sử:**
  - 1280 không có mũi tên ở dòng tháng, 390 vẫn có (NV-25);
  - chi tiết không có "· Phòng D&E" (NV-26);
  - nhãn "Còn chờ 3 món" (NV-27);
  - cột "Đăng ký · Đã nhận · Còn chờ"; "Được giao" chỉ hiện khi khác số đăng ký (NV-28);
  - cột "Nhận lần cuối" (NV-29);
  - 390 mỗi món một dòng "{tên} · {sl} {đvt} — đã nhận a, còn chờ b" (NV-30).
- [ ] **Test biên** NV-28: được giao = đăng ký thì ẩn cột, khác 1 thì hiện.
- [ ] **Test đăng nhập:**
  - vi có "Phát triển bởi Phòng IT" (NV-32);
  - nút chính "Đăng nhập bằng Tài khoản D&E" bấm được khi ô email trống; ô email ghi "không bắt buộc" và nếu có thì gửi `login_hint` (NV-33). Không log `login_hint`.
- [ ] Commit `feat(web): popup kỳ mới, Lịch sử, đăng nhập theo bản Sau (NV-23…33)`.

**Hết Phase 3:** review độc lập diff Task 15–19.

## Phase 4 — Màn mới và chạm server

### Task 20: Số đếm sidebar khớp trang đích (AD-01, AD-02, TN-09)

**Files:** `web/src/shell/use-admin-badges.ts`, `admin-nav.ts`, `admin-sidebar.tsx`; test `use-admin-badges.test.ts`.

- [ ] **Test:**
  - số "Kỳ tháng" link tới `/admin/month?ym={kỳ có món chờ duyệt cũ nhất}&chip=review`, lấy kỳ từ `period_ym` của review lines (AD-01);
  - số "Giao hàng" bằng số "Chưa nhận" trên trang (AD-02);
  - lỗi tải thì không có số.
- [ ] **Test biên:** 0 món chờ thì không có số và link thường; 1 món thì có số 1.
- [ ] Commit `feat(web): số sidebar khớp trang đích (AD-01, AD-02)`.

### Task 21: Trang "Việc hôm nay" cho Adm D&E (TC-06)

**Files:**
- Tạo `web/src/features/today/today-page.tsx`, `today-tiles.ts`, `today.m1.css`.
- Sửa `web/src/shell/admin-nav.ts`, `app-routes.tsx`, `admin-pages.ts`, locale `today.ts` (vi/en).
- Test `today-page.test.tsx`; Playwright `admin.spec.ts`.

**Interfaces:**
- Consumes: các query có sẵn `reviewLinesQuery`, `deliveryPeopleQuery`, `stockListQuery`, `currentPeriodQuery`, backlog query, notifications.
- Produces: route `/admin` (mặc định) → `TodayPage`; `todayTiles(data): Tile[]` với `Tile = {key, label, value, hint, tone, to}`.

- [ ] **Test `todayTiles`:** 8 ô theo bản Sau:
  - ô "Món ngoài danh mục chờ duyệt" có `tone='danger'` khi > 0;
  - ô có số 0 thì hint "Không có việc";
  - mỗi ô có `to` mở đúng danh sách.
- [ ] **Test `TodayPage`:**
  - một query lỗi thì chỉ ô đó báo lỗi và có "Thử lại";
  - danh sách "Cần chú ý" có nút làm luôn ("Duyệt", "Mở phiếu").
- [ ] **Code:** Adm D&E mở app thì vào `/admin` (trang này); mục sidebar đầu tiên là "Việc hôm nay" (icon `clipboard`).
- [ ] **Playwright:** 1280 và 390 bấm ô "Giao được ngay" thì tới Giao hàng, thẻ "Giao được ngay" đang chọn.
- [ ] Commit `feat(web): trang Việc hôm nay (TC-06)`.

### Task 22: Tìm nhanh Ctrl K (TC-17) + bảng thành thẻ 390 (TC-16)

**Files:**
- Tạo `web/src/shell/quick-search.tsx`, `quick-search-index.ts`; sửa `admin-topbar.tsx`.
- Sửa `web/src/css/m1/table.css` (`.table--cards` ≤ 680px, đọc `data-label`).
- Sửa các bảng Danh bạ, Nhật ký, Tủ/Kho.
- Test `quick-search.test.tsx`; Playwright `admin-mobile.spec.ts`.

- [ ] **Test** `quickSearchIndex(q)`:
  - tìm không dấu ("but bi" khớp "Bút bi");
  - nhóm kết quả MÓN / NGƯỜI / ĐI TỚI, tối đa 5 mục mỗi nhóm;
  - biên q 1 ký tự thì không tìm, 2 ký tự thì có tìm.
- [ ] **Test** phím: Ctrl K mở; Esc đóng; ↑↓ đổi mục đang trỏ (`aria-activedescendant`); Enter thì điều hướng.
- [ ] **Playwright 390:** Danh bạ, Nhật ký, Tủ/Kho không cuộn ngang; mỗi dòng là thẻ có nhãn.
- [ ] Commit `feat(web): tìm nhanh Ctrl K, bảng thành thẻ ở 390 (TC-16, TC-17)`.

### Task 23: Server — người xuất (AD-40)

**Files:** `api/src/modules/catalog/stock-query.service.ts:72,114`; test `api/test/stock-history.e2e-spec.ts` (hoặc file e2e sổ kho có sẵn).

- [ ] **Test e2e:** xuất lẻ bằng SA local (`sa:*`, không có trong `users`), gọi GET lịch sử thì `actor_name` khác null (= sub hiển thị). Người có trong `users` thì vẫn ra `full_name`.
- [ ] **Code:** `coalesce(a.full_name, m.actor_sub) AS actor_name` ở cả 2 câu, như `arrivals-plan.queries.ts:107`.
- [ ] Commit `fix(api): sổ kho luôn có tên người thực hiện (AD-40)`.

### Task 24: Server — chuông nhắc tự đọc khi lưu phiếu (NV-03)

**Files:** service lưu phiếu trong `api/src/modules/requests/*`, `notifications` service export hàm `markReadByEvent(sub, eventId, tx)`; test `api/test/notifications-read-on-save.db-spec.ts`.

- [ ] **Test db-spec:**
  - người A có chuông nhắc chưa đăng ký kỳ T và lưu phiếu kỳ T: chuông đó `read_at` không null, trong cùng transaction;
  - chuông kỳ T+1 của A và chuông kỳ T của B không đổi;
  - lưu lỗi `PERIOD_LOCKED` thì chuông giữ nguyên chưa đọc.
- [ ] **Code:** gọi hàm export của notifications service, không viết SQL thẳng vào bảng của module khác. Không audit (không phải dữ liệu nghiệp vụ). Cập nhật `docs/architecture.md` nếu đoạn chuông có mô tả luồng.
- [ ] Commit `feat(api): lưu phiếu thì chuông nhắc của kỳ đó tự đọc (NV-03)`.

### Task 25: Hoàn tác 5 giây (TC-18)

Mục này đổi luồng và cần server. Làm sau cùng; nếu tốn quá 0,5 ngày thì dừng và hỏi chủ dự án tách sang plan riêng.

**Files:** `web/src/ui/toast*.tsx` (nút hành động + đếm ngược), delivery/backlog/catalog mutation; api endpoint hoàn tác cho giao hàng, hủy nợ, xóa món (đặt tên và mã lỗi trong `architecture.md` §7 trước khi code).

- [ ] **Test api e2e** (hoàn tác giao hàng, `ClockService` cố định):
  - hoàn tác tại 4 999 ms thì được;
  - tại 5 000 ms thì `UNDO_EXPIRED`;
  - hoàn tác 2 lần thì lần sau `UNDO_ALREADY_DONE`;
  - có audit before/after.
- [ ] **Test web:** toast tối có "Hoàn tác (5)" đếm ngược, bấm thì gọi API, hết giờ thì nút biến mất.
- [ ] Commit theo từng thao tác.

## Phase 5 — Kết plan (theo CLAUDE.md)

### Task 26: Chạy đủ, review toàn nhánh, đo lại

- [ ] api: `npm test`, `npm run test:e2e`, `npm run test:db`.
- [ ] web: `npm test`, `npm run lint`, `npm run build`, `madge --circular`, `grep -ri qlts api web` = 0.
- [ ] Playwright cả bộ 1280 + 390 (`timeout 590 npx playwright test --reporter=line`).
- [ ] Review toàn nhánh + code review mức high → một đợt sửa.
- [ ] Đo lại trên dev bằng `ra-soat-ui` + tiêu chí áp được của `design-taste-frontend`. So từng mục với nút "Sau" trên trang rà soát; mục nào lệch thì ghi vào báo cáo.
- [ ] Vẽ lại sơ đồ bằng `archify` nếu luồng đổi (Việc hôm nay, gộp Xuất lẻ).
- [ ] Báo chủ dự án. Chỉ gộp `main` khi được đồng ý; không push khi chưa được bảo.

## Ước lượng thời gian

Ước theo plan trước (port giao diện A, 31 task, làm 15–17/11 khoảng 2,5 ngày). Tính bằng ngày làm liền trong phiên, đã gồm TDD, Playwright và review giai đoạn:

| Phase | Task | Ước |
|---|---|---|
| 0 Ghi quyết định | 0 | 0,5 giờ |
| 1 Nền dùng chung + review | 1–6 | 1 ngày |
| 2 Màn Adm D&E + review | 7–14 | 1–1,5 ngày |
| 3 Màn nhân viên + review | 15–19 | 1 ngày |
| 4 Màn mới, chạm server | 20–24 | 1 ngày |
| 4 Hoàn tác (TC-18) | 25 | 0,5 ngày (có thể tách) |
| 5 Kết plan | 26 | 0,5 ngày |
| **Tổng** | | **khoảng 4,5–5,5 ngày**; bỏ TC-18 thì khoảng 4–5 ngày |

Sau Phase 1 (khoảng ngày thứ 1) đã thấy được màu mới, khung mới và luật đang chọn trên mọi màn. Phần còn lại là sửa từng màn.

## Cách chạy (chủ dự án chốt 18/11/2026)

- **Đợt 1** (Claude làm liền): Task 0–6. Cuối đợt chạy Playwright cả bộ 1280 + 390 và sửa test cũ hỏng vì khung mới, rồi review độc lập. Gửi ảnh màu/khung mới cho chủ dự án xem trước khi sang đợt 2.
- **Đợt 2** (4 agent Opus song song, mỗi agent một git worktree cắt từ cuối đợt 1, TDD đủ, chỉ chạy vitest/lint/build/jest unit, không Playwright, không e2e/db-spec):
  - Agent 1: Task 7, 8, 9.
  - Agent 2: Task 10, 11, 20.
  - Agent 3: Task 12, 13, 14, 15, 23. Task 23 viết test e2e nhưng Claude chạy sau khi gộp.
  - Agent 4: Task 16, 17, 18, 19, 24. Task 24 viết db-spec nhưng Claude chạy sau khi gộp.
  - Claude gộp lần lượt từng nhánh, tự sửa xung đột ở `docs/map.md` và locale. Sau đó chạy test api e2e/db, rồi Playwright các màn vừa đổi, rồi review độc lập.
- **Đợt 3** (Claude làm): Task 21, 22, 25. Cuối đợt chạy Playwright phần mới và e2e phần Hoàn tác.
- **Đợt 4:** Task 26.
- Playwright, e2e và db-spec chỉ chạy một nơi, vì bản dev và `vpp_test` dùng chung một cơ sở dữ liệu.
