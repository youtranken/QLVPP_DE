# Plan v2-A — Khung giao diện v2 (bảng màu teal, sidebar kính, panel "Vừa") + tab Xuất lẻ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đổi khung khu Hành chính (bỏ đầu sidebar, chuông + avatar ở cuối sidebar) sang thiết kế v2 (nền teal, sidebar kính, panel nội dung "Vừa", sidebar 4 nhóm) cho **mọi trang hiện có**, và thêm tab **Xuất lẻ** trong Tủ / Kho cho API `GET admin/issues` chưa có màn.

**Architecture:** Chỉ đổi **giá trị** trong khối bảng màu của `tokens-m1.css` (giữ tên biến) + thêm vài token khung; restyle `css/m1/shell.css`; sắp lại `ADMIN_NAV`. Không đổi route, không đổi API. Trang Nhân viên (member) **không** đụng — làm ở Plan C.

**Tech Stack:** React 19 + Vite, react-router, TanStack Query, i18next, vitest + Testing Library, Playwright + axe-core.

**Nguồn sự thật:** `docs/quyet-dinh-2026-11-05-luong-hanh-chinh.md` (Q9, Q10, Q17, Q18) · thiết kế `design-preview/v2-glass/Sidebar.dc.html`, `Kho.dc.html`, `Main.dc.html` (khung) · `CLAUDE.md`.

**Chuỗi plan:** A (plan này) → B luồng HC mới (Tháng này, Giao theo người gộp nợ, Hàng về, Gửi ADM, Danh mục ảnh) → C trang Nhân viên. Plan B sẽ chuyển *Tổng hợp kỳ* và *Báo cáo & in* sang nhóm "Xem lại sau" khi có trang thay thế.

## Global Constraints

- Nhánh `feat/giao-dien-v2` tách từ `feat/giao-dien-hanh-chinh` (chủ dự án chọn, Q17 — ngoại lệ có chủ ý với quy tắc "feat/* từ main"). Không push.
- Mọi CSS M1 bắt đầu bằng `[data-shell='admin']` (test `src/test/m1-scope.test.ts`); cỡ chữ/khoảng cách theo thang `--t-*`/`--s-*` (`npm run lint` → `check-css-scale`).
- Chữ trên nền tối (sidebar, topbar điện thoại) **chỉ** dùng `--c-on-dark` hoặc `--c-on-dark-2`.
- Mọi chuỗi giao diện qua i18n, thêm `vi` + `en` cùng commit (`locales/parity.test.ts`).
- File ≤ 400 dòng, component ≤ 250 dòng, hàm ≤ 50 dòng.
- Mỗi task: 1 commit tiếng Việt (`feat:`/`docs:`/`test:`), `git add <đường dẫn cụ thể>` (không `-A`, không `stash`), cập nhật `docs/map.md` trong commit cuối của task nếu đụng module.
- Mỗi task đụng giao diện: chụp 1280 + 390 các trang bị ảnh hưởng, đính vào báo cáo task.
- Không thêm thư viện.

## Bảng màu v2 (giá trị chốt, Q10)

Thay **giá trị** trong khối `/* ===== BẢNG MÀU ... */` của `web/src/css/tokens-m1.css`, đổi tiêu đề khối thành `BẢNG MÀU v2 "Teal kính"`. Nhóm `--g*`, `--ill-*`, `--k-*`, `--c-print-*` **giữ nguyên**.

| Token | Giá trị | | Token | Giá trị |
|---|---|---|---|---|
| `--c-page` | `#D7EAEF` | | `--c-acc` | `#0F6E80` |
| `--c-surface` | `#FFFFFF` | | `--c-acc-hover` | `#0A5868` |
| `--c-canvas` | `#F4FAFB` | | `--c-acc-press` | `#08434F` |
| `--c-surface-2` | `#EEF5F7` | | `--c-acc-soft` | `#DDF1F5` |
| `--c-surface-hover` | `#F2F8FA` | | `--c-acc-tint` | `#EEF8FA` |
| `--c-surface-sunk` | `#DCEAEE` | | `--c-hero-a/b/c` | `#DDF1F5` / `#EEF6F8` / `#CBE4EB` |
| `--c-ink` | `#0E2A33` | | `--c-hero-ink` | `#0E2A33` |
| `--c-ink-2` | `#2F4A52` | | `--c-ok` / `-soft` / `-fill` | `#0D5E46` / `#E3F5EE` / `#11795A` |
| `--c-muted` | `#47636C` | | `--c-warn` / `-soft` / `-fill` | `#8A3F06` / `#FFF1E3` / `#E39A52` |
| `--c-faint` | `#9FBAC2` | | `--c-danger` / `-soft` / `-line` / `-tint` | `#A32C1E` / `#FBE4E1` / `#EDB8B0` / `#FDF3F1` |
| `--c-dark` | `#0E2A33` | | `--c-info` / `-soft` | `#0A5868` / `#DDF1F5` |
| `--c-on-dark` / `-2` | `#FFFFFF` / `#C9DEE4` | | `--sh-ink` / `--sh-acc` | `8 48 59` / `15 110 128` |
| `--c-device` | `#08303B` | | `--c-scrim` | `rgb(8 48 59 / .6)` |
| `--c-line` / `-strong` / `-input` | `#D6E6EB` / `#B5CFD7` / `#7F9AA3` | | | |

Token mới (thêm cuối khối): `--c-shell-a: #08303B; --c-shell-b: #0E4757; --c-shell-c: #12596A; --c-panel-a: #E3F1F5; --c-panel-b: #CBE4EB; --c-glass: rgb(255 255 255 / .06); --c-glass-line: rgb(255 255 255 / .12); --c-cart: #FFF4E8; --c-cart-line: #F7D9B5;` (`--c-cart*` dùng ở Plan C).

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

1. **Nhãn dài + badge trong sidebar 252 px** ("Món ngoài danh mục" + số) → không tràn, cắt bằng `…`, badge vẫn thấy.
2. **Điện thoại 390 px**: topbar + menu bật ra dùng chung `ADMIN_NAV` → đủ 4 nhóm, chữ trên nền tối đạt axe.
3. **Trang in** (`/admin/reports/snapshots/:id/print`, ngoài shell) vẫn đen trắng → `print.spec.ts` phải xanh không sửa.
4. **Trang member không đổi** (dùng `tokens.css` cũ) → `request.spec.ts`, `history.spec.ts` xanh không sửa.
5. **Tab Xuất lẻ khi API lỗi / tháng không có dòng** → hiện lỗi có nút Thử lại / câu "Tháng này chưa xuất lẻ món nào", không trắng trang.

---

### Task 1: Nhánh + ghi tài liệu thiết kế

**Files:**
- Commit (đã có trên đĩa): `docs/quyet-dinh-2026-11-05-luong-hanh-chinh.md`, `design-preview/v2-glass/*`, `docs/plans/2026-11-02-mau1-nhan-vien.md`, `docs/plans/2026-11-05-v2a-khung-giao-dien.md`

- [ ] **Step 1:** `git -C /home/ims/Desktop/VPP switch -c feat/giao-dien-v2` từ `feat/giao-dien-hanh-chinh`. Kiểm: `git branch --show-current` → `feat/giao-dien-v2`.
- [ ] **Step 2:** Commit đúng 4 đường dẫn trên (KHÔNG thêm `docs/review-spec.md`, `.claude/`, `.playwright-mcp/`, `PRODUCT.md`, `design-preview/redesign/` — chưa rõ chủ):

```bash
git add docs/quyet-dinh-2026-11-05-luong-hanh-chinh.md design-preview/v2-glass docs/plans/2026-11-02-mau1-nhan-vien.md docs/plans/2026-11-05-v2a-khung-giao-dien.md docs/plans/2026-11-05-v2b-luong-hanh-chinh.md
git commit -m "docs: chốt luồng Hành chính + thiết kế v2, plan v2-A, v2-B"
```

### Task 2: Bảng màu v2 + test tương phản

**Files:**
- Modify: `web/src/css/tokens-m1.css` (khối bảng màu, dòng 1–40)
- Create: `web/src/css/tokens-contrast.test.ts`

**Interfaces:**
- Produces: các token mới `--c-shell-a|b|c`, `--c-panel-a|b`, `--c-glass`, `--c-glass-line`, `--c-cart`, `--c-cart-line` (Task 3, Plan C dùng).

- [ ] **Step 1: Viết test đỏ** `tokens-contrast.test.ts`: đọc `tokens-m1.css` bằng `fs` (`?raw` import cũng được), lấy giá trị hex theo tên biến, tính tỉ lệ tương phản WCAG; assert ≥ 4.5 cho từng cặp:

```ts
const PAIRS: [fg: string, bg: string][] = [
  ['--c-ink', '--c-surface'], ['--c-muted', '--c-surface'], ['--c-acc', '--c-surface'],
  ['--c-ink', '--c-panel-b'], ['--c-muted', '--c-panel-b'], ['--c-muted', '--c-page'],
  ['--c-ok', '--c-ok-soft'], ['--c-warn', '--c-warn-soft'], ['--c-danger', '--c-danger-soft'],
  ['--c-on-dark', '--c-shell-c'], ['--c-on-dark-2', '--c-shell-a'], ['--c-on-dark-2', '--c-shell-c'],
  ['--c-on-dark', '--c-acc'], ['--c-warn', '--c-cart'],
];
it.each(PAIRS)('%s trên %s ≥ 4.5', (fg, bg) => expect(contrast(tok(fg), tok(bg))).toBeGreaterThanOrEqual(4.5));
```

- [ ] **Step 2:** `cd web && npx vitest run src/css/tokens-contrast.test.ts` → FAIL (thiếu `--c-panel-b`, `--c-shell-*`, `--c-cart`).
- [ ] **Step 3:** Thay giá trị theo bảng "Bảng màu v2" ở trên + thêm token mới.
- [ ] **Step 4:** `npx vitest run src/css/tokens-contrast.test.ts` → PASS; `npm test` → toàn bộ xanh (nếu test snapshot nào chứa mã màu cũ đỏ: sửa kỳ vọng sang giá trị mới, ghi tên test vào báo cáo).
- [ ] **Step 5:** Chụp 1280 + 390: Tổng hợp kỳ, Giao hàng, Kho.
- [ ] **Step 6:** Commit `feat: bảng màu v2 teal + test tương phản token`.

### Task 3: Khung shell v2 (nền teal, sidebar kính, panel "Vừa")

**Files:**
- Modify: `web/src/css/m1/shell.css` (các luật `.shell`, `.shell__main`, `.side*`, `.topbar*`)
- Modify: `web/src/shell/admin-shell.tsx` (bọc `<Outlet/>` trong `<div className="shell__panel">`)
- Test: `web/src/shell/admin-shell.test.tsx`, `web/playwright/admin-shell.spec.ts`

**Interfaces:**
- Consumes: token Task 2.
- Produces: class `.shell__panel` (khung nội dung bo 28) — Plan B/C đặt trang vào trong.

Giá trị chốt (theo `Sidebar.dc.html` / `Main.dc.html`):
- `.shell`: `background: linear-gradient(160deg, var(--c-shell-a) 0%, var(--c-shell-b) 55%, var(--c-shell-c) 100%)`; bỏ gradient vạch ngăn cũ.
- `.side`: nền `var(--c-glass)`, viền phải `var(--c-glass-line)`, chữ `var(--c-on-dark-2)`; nhãn nhóm `var(--c-on-dark-2)` 12 px đậm 700, **viết thường** (không uppercase); link hover `rgb(255 255 255 / .08)`; link `aria-current=page`: nền `var(--c-surface)`, chữ `var(--c-ink)`, bỏ vạch `::before`; logo nền `#E7F6F9` chữ `var(--c-ink)`.
- Badge: mặc định nền `rgb(255 255 255 / .14)` chữ `var(--c-on-dark)`; `[data-badge='stock']` và `[data-badge='review']` nền `var(--c-warn-fill)` chữ `var(--c-ink)`.
- `.shell__main`: `padding: 16px 20px 24px`, `max-width` bỏ; `.shell__panel`: `max-width: 1280px; margin-inline: auto; min-height: calc(100dvh - 40px); padding: 24px; border-radius: var(--r-xl); background: linear-gradient(180deg, var(--c-panel-a) 0%, var(--c-panel-b) 100%); box-shadow: inset 0 1px 0 rgb(255 255 255 / .9)`.
- Điện thoại (< 768): topbar nền `var(--c-shell-a)` chữ `var(--c-on-dark)`; `.shell__panel` padding 16, bo `var(--r-lg)`.
- Focus trên nền tối: `outline: 2px solid var(--c-on-dark); outline-offset: 2px`.

- [ ] **Step 1: Test đỏ (vitest)** trong `admin-shell.test.tsx`: `it('nội dung trang nằm trong khung panel', …)` — render shell tại `/admin/summary` (dùng `test/admin-shell-stub.ts`), `expect(screen.getByRole('main').querySelector('.shell__panel')).not.toBeNull()`.
- [ ] **Step 2:** `npx vitest run src/shell/admin-shell.test.tsx` → FAIL.
- [ ] **Step 3:** Sửa `admin-shell.tsx` + `shell.css` theo giá trị trên.
- [ ] **Step 4: Playwright** thêm vào `admin-shell.spec.ts`: `test('v2: khung teal + panel, đạt axe', …)` — ở cả 2 project: mở `/admin/summary`, kiểm `getByRole('navigation', { name: 'Menu quản lý' })` thấy được (1280) hoặc nút mở menu (390); chạy axe trên `body` → 0 lỗi `color-contrast`.
- [ ] **Step 5:** `npm test && npm run lint && npm run build` xanh; `npx playwright test admin-shell admin-mobile print request history` xanh (Review Focus 3, 4).
- [ ] **Step 6:** Chụp 1280 + 390: Tổng hợp kỳ, Giao hàng, Danh mục, Kho, Cấu hình, menu điện thoại mở.
- [ ] **Step 7:** Commit `feat: khung Hành chính v2 — nền teal, sidebar kính, panel nội dung`.

### Task 4: Sidebar 4 nhóm + khung tiến độ kỳ

**Files:**
- Modify: `web/src/shell/admin-nav.ts`, `web/src/shell/admin-period-card.tsx`, `web/src/css/m1/shell.css` (`.side__period*`)
- Modify: `web/src/locales/vi/nav.ts`, `web/src/locales/en/nav.ts`
- Test: `web/src/shell/admin-sidebar.test.tsx`, `web/src/shell/admin-period-card.test.tsx`

**Interfaces:**
- Produces: `ADMIN_NAV` 4 nhóm, nhóm `nav.groups.monthly | stock | system | later` (giá trị nhãn mới, xem bảng). Plan B thêm `home`, `arrivals`, `sendAdm` vào nhóm `monthly` và dời `summary`, `reports` sang `later`.

`ADMIN_NAV` chốt (giữ path/badge/icon hiện có, chỉ đổi nhóm + thứ tự):

| Nhóm (vi / en) | Trang (path → nhãn vi) |
|---|---|
| `nav.groups.monthly` Hằng tháng / Monthly | `summary` Tổng hợp kỳ · `delivery` Giao hàng [badge delivery] · `reports` Báo cáo & in |
| `nav.groups.stock` Danh mục và tủ / Catalog & cupboard | `catalog` Danh mục món · `stock` Tủ / Kho [badge stock] · `review` Món ngoài danh mục [badge review] · `categories` Nhóm món · `units` Đơn vị tính |
| `nav.groups.system` Quản lý / Manage | `users` Nhân viên · `audit` Nhật ký · `config` Cấu hình |
| `nav.groups.later` Xem lại sau / To review | `backlog` Còn nợ |

`ADMIN_HOME` giữ `'summary'`. Khóa cũ `nav.groups.stock`, `nav.groups.system` đang làm breadcrumb ở catalog/categories/units/stock/users/audit/config-page → **đổi giá trị** chúng thành `Danh mục và tủ` / `Quản lý` (en: `Catalog & cupboard` / `Manage`) và dùng lại làm `labelKey` thay vì tạo `catalogStock`/`manage`; chỉ thêm khóa mới `nav.groups.later`. Review đổi breadcrumb nếu có (`features/review/review-page.tsx`) sang `nav.groups.stock`.

Khung kỳ cuối sidebar (theo `Sidebar.dc.html`): dòng 1 `Kỳ tháng {{m}}` đậm; dòng 2 `{{registered}}/{{headcount}} đã đăng ký`; thanh tiến độ (`ui/progress`) giá trị `registered/headcount`; dòng 3 giữ chữ hạn hiện tại. Số lấy từ `periodSummaryQuery(period.ym)` (`features/summary/summary.api.ts`); lỗi/đang tải → ẩn dòng 2 + thanh, vẫn hiện dòng 1, 3.

- [ ] **Step 1: Test đỏ** `admin-sidebar.test.tsx`: `it('sidebar có 4 nhóm theo thứ tự v2', …)` — `getAllByRole('group').map(g => g.getAttribute('aria-label'))` toEqual `['Hằng tháng','Danh mục và tủ','Quản lý','Xem lại sau']`; trong nhóm `Xem lại sau` có link `Còn nợ` href `/admin/backlog`; nhóm `Danh mục và tủ` có link `Món ngoài danh mục`.
- [ ] **Step 2: Test đỏ** `admin-period-card.test.tsx`: summary stub `{registered: 32, headcount: 40}` → thấy `32/40 đã đăng ký` và `getByRole('progressbar')` có `aria-valuenow="32"` `aria-valuemax="40"`; summary lỗi → không có progressbar, vẫn thấy `Kỳ tháng 11`; `headcount: 0` → không có progressbar (không chia 0).
- [ ] **Step 3:** Chạy 2 file test → FAIL.
- [ ] **Step 4:** Sửa `admin-nav.ts`, locales, `admin-period-card.tsx`, CSS khung kỳ (nền `var(--c-glass)`, viền `var(--c-glass-line)`, chữ on-dark, thanh nền `rgb(255 255 255 / .15)` phần đầy `#9FE3F0`).
- [ ] **Step 5:** `npm test && npm run lint` xanh; `npx playwright test admin-shell admin-mobile` xanh (sửa selector cũ theo nhãn nhóm nếu có, ghi vào báo cáo). Kiểm Review Focus 1: Playwright 1280 — `getByRole('link', { name: /Món ngoài danh mục/ })` có `boundingBox().width ≤ 252`.
- [ ] **Step 6:** Cập nhật `docs/map.md` mục shell. Commit `feat: sidebar Hành chính 4 nhóm + tiến độ đăng ký kỳ`.

### Task 4b: Bỏ đầu sidebar — chuông + avatar xuống cuối sidebar

Chủ dự án chốt (2026-11-05): **bỏ hẳn hàng thương hiệu** (`.side__brand`: logo + tên app + chuông) ở sidebar máy tính; **chuông thông báo nằm cùng hàng avatar ở cuối sidebar**, ngay dưới khung kỳ. Không làm thanh trên cùng.

**Files:**
- Modify: `web/src/shell/admin-sidebar.tsx` (xóa nhánh `variant === 'side'` dựng `<header className="side__brand">`), `web/src/shell/admin-sidebar-user.tsx` (thêm `<NotificationBell />` vào hàng `.side__who`, trước nút ngôn ngữ/đăng xuất, chỉ khi `variant === 'side'` — topbar điện thoại giữ chuông riêng như cũ)
- Modify: `web/src/css/m1/shell.css` (xóa luật `.side__brand*`, `.side__logo*`; panel thông báo khi chuông ở cuối sidebar mở **lên trên, sang phải**: sửa luật `fixed` hiện có ở `shell.css:71` thành `top: auto; bottom: 16px; left: calc(var(--side-w) + 8px)` và luật máy tính bảng ở `shell.css:115` thành `top: auto; bottom: 16px; left: 80px`)
- Test: `web/src/shell/admin-sidebar.test.tsx`, `web/playwright/admin-shell.spec.ts`

- [ ] **Step 1: Test đỏ** `admin-sidebar.test.tsx`:
  - `it('không còn hàng thương hiệu ở đầu sidebar')` — `container.querySelector('.side__brand')` là `null`.
  - `it('chuông nằm cùng khối người dùng ở cuối')` — `getByRole('button', { name: /Thông báo/ })` có `closest('.side__user')` khác `null`; trong DOM, nó đứng **sau** `navigation` (`nav.compareDocumentPosition(bell) & Node.DOCUMENT_POSITION_FOLLOWING`).
- [ ] **Step 2:** Chạy → FAIL. **Step 3:** Sửa code + CSS. Tên app vẫn còn ở `<title>` trang và màn đăng nhập (không cần trong sidebar).
- [ ] **Step 4: Playwright** 1280: bấm chuông ở cuối sidebar → panel `dialog` "Thông báo" nằm trọn trong viewport (`boundingBox` y ≥ 0 và bottom ≤ 720); 390: chuông topbar vẫn mở được như cũ.
- [ ] **Step 5:** `npm test && npm run lint` xanh; chụp 1280 sidebar (đóng + mở thông báo). Commit `feat: chuông + avatar xuống cuối sidebar, bỏ đầu sidebar`.

### Task 5: Tab Xuất lẻ trong Tủ / Kho

UX chốt: xuất lẻ là việc của tủ (nút "Xuất lẻ" đã ở trang Kho) → **không thêm mục sidebar**, thêm thanh `Segmented` đầu trang Kho: `Tồn kho` | `Xuất lẻ`. URL `?tab=issues&ym=YYYY-MM` (mặc định `tab` vắng = tồn kho, `ym` vắng = kỳ hiện tại `currentPeriodQuery`).

**Files:**
- Modify: `web/src/features/stock/stock.api.ts`, `web/src/features/stock/stock-page.tsx`, `web/src/features/stock/use-stock-params.ts`, `web/src/features/stock/use-stock-submit.ts` (invalidate sau xuất lẻ)
- Create: `web/src/features/stock/issues-panel.tsx`, `web/src/features/stock/issues-panel.test.tsx`
- Modify: `web/src/locales/vi/stock.ts`, `web/src/locales/en/stock.ts`, `web/src/features/stock/stock.m1.css`
- Test: `web/playwright/stock.spec.ts`

**Interfaces:**
- Consumes: `GET /api/admin/issues?ym=YYYY-MM` → mảng `IssueRow`.
- Produces:

```ts
export interface IssueRow {
  id: string; item_id: string; item_name: string; item_name_en: string | null; unit: string;
  qty: number; recipient_sub: string | null; recipient_name: string | null;
  note: string | null; actor_sub: string; created_at: string;
}
export const ISSUES_KEY = ['admin', 'issues'] as const;
export function issuesQuery(ym: string | undefined): UseQueryOptions<IssueRow[]>; // enabled khi có ym, key [...ISSUES_KEY, ym]
export function IssuesPanel({ ym, onYmChange }: { ym: string; onYmChange: (ym: string) => void }): JSX.Element;
```

Bảng (dùng `ui/data-table`): cột `Ngày` (dd/MM HH:mm, giờ VN) · `Món` (tên theo ngôn ngữ, fallback `item_name`) · `SL` (`qty` + `unit`) · `Người nhận` (`recipient_name`, null → `—`) · `Lý do` (`note`, null → `—`). Trên bảng: `ui/month-switcher` + dòng tổng `{{n}} lần xuất, {{units}} đơn vị`.

- [ ] **Step 0: Test đỏ e2e api** `api/test/stock-issues.e2e-spec.ts` (nếu chưa có test cho `GET admin/issues`): biên tháng giờ VN — xuất lúc `23:59:59.999` ngày cuối tháng (giờ VN) thuộc tháng đó, `00:00:00` ngày 1 tháng sau thuộc tháng sau; member → 403; ym sai → 400 `INVALID_PERIOD`. Chỉ thêm test, không đổi API (nếu fail → báo chủ dự án trước khi sửa).
- [ ] **Step 1: Test đỏ** `issues-panel.test.tsx` (stub fetch như `stock-page.test.tsx`):
  - `it('liệt kê các lần xuất lẻ của tháng')` — 2 dòng → thấy `Bút bi FO-03`, `2 cây`, `Trần Minh Khoa`, `Khách đến họp`, và `2 lần xuất, 5 đơn vị`.
  - `it('người nhận/lý do trống hiện gạch ngang')` — `recipient_name: null, note: null` → 2 ô `—`.
  - `it('tháng không có dòng')` → `Tháng này chưa xuất lẻ món nào.`
  - `it('lỗi tải có nút Thử lại')` → 500 → `getByRole('button', { name: 'Thử lại' })`; bấm → gọi lại API.
  - `it('đổi tháng gọi onYmChange')` — bấm tháng trước → `onYmChange('2026-10')`.
- [ ] **Step 2:** `npx vitest run src/features/stock/issues-panel.test.tsx` → FAIL.
- [ ] **Step 3:** Viết `issuesQuery`, `IssuesPanel`, khóa i18n `stock.issues.*` (vi + en).
- [ ] **Step 4: Test đỏ** thêm vào `stock-page.test.tsx`: `it('tab Xuất lẻ đổi URL và hiện bảng xuất lẻ')` — bấm radio `Xuất lẻ` → `?tab=issues` và thấy cột `Người nhận`; tải lại URL có `?tab=issues&ym=2026-10` → radio `Xuất lẻ` đang chọn, API gọi với `ym=2026-10`. Thêm `it('xuất lẻ xong làm mới danh sách xuất lẻ')` — sau submit `IssueDialog`, `queryClient` invalidated `ISSUES_KEY`.
- [ ] **Step 5:** Sửa `use-stock-params.ts` (thêm `tab: 'stock' | 'issues'`, `ym?: string`; giá trị lạ → `'stock'`), `stock-page.tsx` (Segmented + render panel), `use-stock-submit.ts` (invalidate `ISSUES_KEY` khi action là issue). `stock-page.tsx` đang 123 dòng — nếu vượt 250 thì tách phần tồn kho ra `stock-inventory.tsx`.
- [ ] **Step 6:** `npm test && npm run lint && npm run build` xanh.
- [ ] **Step 7: Playwright** `stock.spec.ts`: `test('Xuất lẻ: xuất 1 món rồi thấy ở tab Xuất lẻ', …)` — dùng seed hiện có, xuất lẻ 1 món qua dialog, bấm `Xuất lẻ`, thấy dòng món đó với số lượng vừa xuất. Chạy 1280 + 390, axe 390 không lỗi tương phản.
- [ ] **Step 8:** Chụp 1280 + 390 tab Xuất lẻ (có dòng, rỗng). Cập nhật `docs/map.md` (stock: tab Xuất lẻ → `GET admin/issues`). Commit `feat: tab Xuất lẻ trong Tủ / Kho`.

### Task 6: Vòng kiểm cuối plan

- [ ] **Step 1:** api: `npm test && npm run test:e2e && npm run test:db` (không đổi api nhưng chạy theo DoD). web: `npm test && npm run lint && npm run build && npm run typecheck:e2e`.
- [ ] **Step 2:** `npx playwright test` toàn bộ (desktop-1280 + mobile-390) trên stack docker dev → 0 fail.
- [ ] **Step 3:** `grep -ri qlts web/src api/src` → 0; `npx madge --circular web/src` → 0; không file nào > 400 dòng (`find web/src -name '*.ts*' | xargs wc -l | sort -n | tail -3`).
- [ ] **Step 4:** Vẽ lại sơ đồ shell bằng skill `archify` vào `docs/diagrams/`.
- [ ] **Step 5:** Review toàn nhánh + `code-review high`, sửa một vòng, báo cáo chủ dự án kèm ảnh chụp 1280/390 các trang. Không merge khi chưa được duyệt.
- [ ] **Step 6:** Commit `docs: Plan v2-A xong — sơ đồ + map`.
