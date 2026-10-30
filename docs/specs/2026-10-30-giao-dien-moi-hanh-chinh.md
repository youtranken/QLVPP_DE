# Spec — Đưa giao diện mới (M1 · P3 "Navy & cát") vào phần Hành chính

> 2026-10-30 · Trạng thái: chờ chủ dự án duyệt · Thay thế phần Hành chính của `design-preview/_SPEC.md` (xem §2.2). Sau khi duyệt: lập plan ở `docs/plans/`, thêm epic `docs/backlog/epic-9-giao-dien-hanh-chinh.md` với story E9-S0…E9-S7 trùng tên các lát cắt dưới đây.

## 1. Mục tiêu và phạm vi

### 1.1 Mục tiêu

Thay toàn bộ giao diện Hành chính (`/admin/*` và trang in `/admin/reports/snapshots/:id/print`) bằng bản mẫu đã duyệt (bố cục M1, bảng màu P3, font Be Vietnam Pro), port **theo từng tính năng**, mỗi lát cắt tự đứng được (merge được, test xanh, không làm hỏng trang khác). Nghiệp vụ, API và luật **giữ nguyên**, trừ lát S0 (quyết định mới của chủ dự án, §1.4).

### 1.2 Trong phạm vi

- S0: lát API nhỏ "Hành chính không có phiếu" (§1.4, §5.0).
- S1: token, font, sprite icon, shell Hành chính, các thành phần dùng chung.
- S2–S6: 13 màn B1–B12 của `SCREENS.md` cùng hộp thoại/ngăn kéo của chúng.
- S7: Hành chính ở 390 px (B13) cho mọi màn đã port.

### 1.3 Ngoài phạm vi

- Màn Nhân viên (A1–A8) và màn dùng chung C1–C4 (đăng nhập, chưa được cấp quyền, 404 toàn cục, lỗi hệ thống): giữ nguyên giao diện hiện tại cho tới spec riêng. Ràng buộc: sau mỗi lát, `npm test` web và mọi Playwright member hiện có vẫn xanh **không sửa test member**.
- Không đổi API, DTO, mã lỗi, luật nghiệp vụ, migration — trừ S0. Phần tử bản mẫu cần dữ liệu API không có: xử lý theo bảng §6 (bỏ khỏi UI / dẫn xuất phía client từ endpoint có sẵn / đề xuất API đọc-only nhỏ chờ chủ dự án quyết). Không tự thêm.
- Không thêm thư viện UI/CSS/icon. Không thêm dependency npm (font tải từ Google Fonts như hiện tại).
- Không có chế độ tối (§3.7). Không có "Hoàn tác" (FR-44 đã bỏ).

### 1.4 Quyết định chủ dự án 2026-10-30 — Hành chính chỉ quản lý VPP

Hành chính (vai `admin`) và SA cục bộ (`sa`) **không đăng ký VPP cho bản thân**; họ chỉ có "Quản lý VPP". Đảo ngược PRD §2 dòng "Admin: Mọi quyền member + …" và PRD §7 "*Phiếu của tôi* (mở giao diện member)". Hệ quả:

- UI: sau đăng nhập, admin/sa vào thẳng `/admin` (Tổng hợp kỳ). Shell Hành chính không có Đăng ký / Lịch sử / "Phiếu của tôi ↗". Mọi route nhân viên (`/`, `/history`, `/history/:ym`, `/me`) chuyển admin/sa về `/admin` (`replace`).
- Luật ép ở server (S0): admin/sa gọi endpoint ghi/đọc phiếu cá nhân → 403 `FORBIDDEN_ROLE`; mẫu số Tổng hợp, danh sách "chưa đăng ký" và chuông `period_open`/`reminder` loại người thuộc `config.admin_group`; tạo phiếu hộ cho một Hành chính → 400 `USER_IS_ADMIN` (mã mới).
- Món `admin_only` vẫn do Hành chính thêm vào phiếu nhân viên qua Điều chỉnh (`PUT admin/requests/:id/lines`) — không đổi.
- Dữ liệu cũ: phiếu của người nay là Hành chính vẫn nằm trong DB, vẫn hiện ở Tổng hợp/Giao hàng/Còn nợ/Báo cáo như phiếu thường (§5.0.4).

## 2. Nguồn và thứ tự ưu tiên

### 2.1 Nguồn

| Nguồn | Dùng cho |
|---|---|
| Bản mẫu `canvas/project/A-*.dc.html` (B1–B13), `C-loi.dc.html` (biến thể "Trang này dành cho Hành chính") | Bố cục, câu chữ, tương tác, trạng thái từng màn — **nguồn đúng về hình** |
| `design-preview/redesign/m1/SYSTEM.md` | Token, quy cách thành phần, trợ năng, điều cấm — nguồn đúng về giá trị số |
| `design-preview/redesign/m1/{components,illustrations}.html`, `palettes/P3-navy-cat.html` | Hình vẽ trạng thái, sprite `u-*`, minh họa `es-*` |
| `docs/prd.md`, `docs/architecture.md` §6–§7, `docs/backlog/*` | Luật, endpoint, mã lỗi — thắng bản mẫu khi bản mẫu mâu thuẫn |

### 2.2 Lệch giữa các nguồn và cách chốt

| # | Chỗ lệch | Chốt | Lý do |
|---|---|---|---|
| L1 | `_SPEC.md` (xanh ngọc, Nunito/IBM Plex, sidebar tối 224) | Bị thay cho phần Hành chính; vẫn đúng cho Nhân viên tới spec riêng | Chủ dự án duyệt M1+P3 |
| L2 | `_SPEC.md` "Thay đổi sau review": Tổng hợp nhóm theo phòng ban; bản mẫu B1 là danh sách phẳng | Giữ nhóm theo phòng ban (tiêu đề nhóm dính kiểu M1, "Chưa có phòng ban" cuối) | Quyết định chủ dự án đã ghi trong memory/PRD |
| L3 | PRD FR-33: ngăn Điều chỉnh có 3 nút review; bản mẫu B1a chỉ có liên kết "Xem ở Món ngoài danh mục" | Giữ 3 nút (dùng lại `ReviewActions`) + thêm liên kết | PRD thắng bản mẫu |
| L4 | Bản mẫu B5 vô hiệu "Xuất Excel/In trình ký" khi kỳ đang mở; API cho chốt mọi `ym ≤ kỳ mở` | Theo API (cho chốt), hiện cảnh báo "tạm tính" (Q2 đã chốt) | Không có luật chỉ ở FE |
| L5 | Bản mẫu: "Tên món ít nhất 2 ký tự", "Tên nhóm ít nhất 2 ký tự"; API: khác rỗng sau trim, ≤ 120 | Theo API | Không có luật chỉ ở FE |
| L6 | Bản mẫu: ĐVT gõ tự do ("viên", "vỉ 2"); API: 9 mã `UNITS` | `UnitSelect` 9 mã | FR-10, FR-22 |
| L7 | Bản mẫu desktop không có chuông | Giữ chuông (E6-S1) ở hàng thương hiệu sidebar (1280) và thanh trên (390) | Tính năng đã có test |
| L8 | Master–detail: SYSTEM 356 px, bản mẫu 320 px | 320 px | Bản mẫu là nguồn hình |
| L9 | Toast: bản mẫu khi đáy giữa, khi đỉnh giữa | Đáy giữa vùng nội dung, cách đáy 28 px (390: trên mép dưới 16 px) | SYSTEM §3 |
| L10 | SYSTEM: ảnh dự phòng là minh họa theo loại món (bảng từ khóa); chủ dự án: "SVG chỉ để mockup, khi code upload ảnh thật vào ô ảnh cố định" | Ô ảnh cố định: ảnh thật nếu có, không thì một placeholder SVG trung tính + nhãn "Thiếu ảnh" (§3.6); không port bảng từ khóa | Quyết định chủ dự án |
| L11 | `admin-nav.ts` ẩn "Nhóm món" (theo `_SPEC`); bản mẫu có mục "Nhóm món" trong sidebar | Hiện "Nhóm món" trong nhóm Kho & danh mục | Bản mẫu |
| L12 | PRD/arch: admin có "Phiếu của tôi"; bản mẫu sidebar có "Phiếu của tôi ↗" | Bỏ (quyết định §1.4) | Quyết định mới nhất |

## 3. Nền thị giác

### 3.1 Token màu (P3, giá trị chính xác)

Chép **nguyên khối** `SYSTEM.md` §2.1 (dòng 19–62) vào tệp mới `web/src/css/tokens-m1.css`, khai báo ở `:root`. Các giá trị chính:

| Vai | Token = giá trị |
|---|---|
| Nền trang / mặt / canvas / mặt phụ / hover / lõm | `--c-page #EFEBE4` · `--c-surface #FFFFFF` · `--c-canvas #FBF9F6` · `--c-surface-2 #F6F3EE` · `--c-surface-hover #FBF9F7` · `--c-surface-sunk #EDE8E0` |
| Mực | `--c-ink #1A2233` · `--c-ink-2 #353C4B` · `--c-muted #5F6372` · `--c-faint #ABA79F` (chỉ icon trang trí) |
| Mảng đậm | `--c-dark #16213A` · `--c-on-dark #FFFFFF` · `--c-on-dark-2 #C2C9D8` |
| Viền | `--c-line #E7E1D7` · `--c-line-strong #CEC5B6` · `--c-line-input #9A9183` |
| Nhấn | `--c-acc #1F3A6B` · `--c-acc-hover #172D55` · `--c-acc-press #11223F` · `--c-acc-soft #E4E9F2` · `--c-acc-tint #F0F3F8` · `--c-on-acc #FFFFFF` |
| Ngữ nghĩa | ok `#2B6A3F`/soft `#DFEBDD`/fill `#3F8A55` · warn `#86520E`/`#F3E7CC`/`#D3A04C` · danger `#A7312B`/`#F4E0DC`/line `#E1B4B0`/tint `#FBF3F1` · info `#1F3A6B`/`#E4E9F2` · `--c-dot #CF4340` |
| Tông nhóm (nền/strong/ink) | g1 `#DCE3EF/#C4CDDE/#2E4675` · g2 `#E7EDE1/#CFD8C8/#3D5A2E` · g3 `#F9F3E7/#E7DCC9/#76520F` · g4 `#CCDDDD/#B4CACB/#21585A` · g5 `#E4CDC8/#D7B8B2/#86392E` · g6 `#E6E0EA/#D1C7D9/#56406E` · g7 `#E8E6D3/#D3D0B5/#4F4B1F` · g0 `#ECE9E4/#DAD5CC/#4A4740` |
| Bóng | `--sh-ink: 22 33 58` · `--sh-acc: 31 58 107` · `--c-scrim: rgb(22 33 58 / .45)` |

Các biến `--ill-*`, `--k-*` chỉ chép phần dùng cho minh họa trạng thái trống `es-*` (§3.6); không chép biến của minh họa món.

**Cách thay `tokens.css` mà không làm hỏng trang Nhân viên:** tên biến M1 (`--c-*`, `--g*`, `--t-*`, `--s-*`, `--r-*`, `--e-*`, `--d-*`) không trùng tên biến cũ (`--brand`, `--bg`, `--ink`, `--ok`, `--t1`…, `--ring`), nên `tokens-m1.css` được khai báo toàn cục và import sau `tokens.css` trong `main.tsx`. `tokens.css` cũ **giữ nguyên** cho Nhân viên; xóa khi spec Nhân viên port xong. Mọi luật CSS thành phần M1 phải mở đầu bằng `[data-shell='admin']` (thuộc tính có sẵn trên `<body>`, do `useShellFont` đặt; Radix portal ra `body` nên hộp thoại cũng nhận). Trang in đặt `useShellFont('admin')` để nhận cùng phạm vi. Kiểm tự động: test `web/src/test/m1-scope.test.ts` đọc mọi tệp `web/src/css/m1/*.css` và khẳng định mỗi selector cấp cao nhất bắt đầu bằng `[data-shell='admin']`.

Hằng số luật: `tông nhóm = TONES[hạng % 7]`, `TONES = [g1…g7]`, `hạng` = vị trí nhóm trong **mọi** nhóm (kể cả đã ngừng) sắp `sort_order` rồi `id`; món không nhóm và dòng ngoài danh mục dùng `g0` (SYSTEM §2.1). Tính ở `web/src/lib/group-tone.ts`: `groupTone(categories: {id, sort_order}[], categoryId: string | null): 'g0'…'g7'` (nhận danh sách làm tham số, không import `features/`). Nguồn danh sách: `GET item-categories?all=1` (`useAllCategories`).

### 3.2 Chữ

- Font: `Be Vietnam Pro` 500/600/700/800, thêm vào URL Google Fonts đang có ở đầu `tokens.css` (một `@import`, `display=swap`; giữ Nunito/IBM Plex cho Nhân viên). `--font: 'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', sans-serif`.
- Thang (SYSTEM §2.3): `--t-display 800 40/1.1` · `--t-h1 800 28/1.2` · `--t-h2 800 22/1.25` · `--t-h3 700 18/1.3` · `--t-stat 800 26/1.1` · `--t-body-l 500 16/1.5` · `--t-body 500 14/1.5` · `--t-label 700 14/1.3` · `--t-sm 500 13/1.45` · `--t-cap 600 12/1.35` · `--t-micro 700 11/1.3`; giãn chữ h1 −0.02em, h2 −0.015em, h3 −0.01em.
- Luật: chữ thường kiểu câu (không VIẾT HOA nhãn cột/nhóm sidebar); mọi số lượng, tồn, ngày giờ `tabular-nums` (lớp `.num` sẵn có); chữ câu nhỏ nhất 12 px; trên 390 px thân chữ ≥ 14 px, ô nhập 16 px.

### 3.3 Khoảng cách, bo góc, độ nổi, chuyển động

- Khoảng cách `--s-1…--s-9` = 4·8·12·16·20·24·32·40·56 px.
- Bo góc: `--r-pill 999` (nút, chip, badge, ô tìm) · `--r-xl 28` (hộp thoại, sheet) · `--r-lg 20` (thẻ số liệu, vỏ bảng, thẻ dòng review) · `--r-md 14` (ô nhập, cảnh báo, thanh hàng loạt, toast) · `--r-sm 10` (điều khiển trong hàng, mục sidebar) · `--r-xs 6` (checkbox).
- Độ nổi `--e-1…--e-5`, `--e-acc` đúng SYSTEM §2.4; ngăn kéo `--e-4`, hộp thoại `--e-5`.
- Chuyển động: `--d-1 120ms`, `--d-2 200ms`, `--d-3 280ms`, `--d-4 420ms`; `--ease-out cubic-bezier(.2,.8,.2,1)`, `--ease-in cubic-bezier(.4,0,1,1)`. Ngăn kéo vào 280 ms/ra 200 ms, hộp thoại 280 ms, thanh hàng loạt 200 ms, toast 280 ms. `prefers-reduced-motion: reduce` → 1 ms (khối sẵn ở SYSTEM §2.4).
- Focus `--focus: 0 0 0 3px var(--c-surface), 0 0 0 5px var(--c-acc)`; vùng chạm `--hit: 44px`.

### 3.4 Điểm gãy Hành chính

`< 768` điện thoại (thanh trên + menu sheet, §5.7) · `768–1279` máy tính bảng (sidebar thu thành cột icon 72 px, nhãn qua `aria-label` + tooltip) · `≥ 1280` đầy đủ (sidebar 232). Thêm `ADMIN_PHONE_QUERY = '(max-width: 767px)'` và `ADMIN_TABLET_QUERY = '(min-width: 768px) and (max-width: 1279px)'` vào `web/src/lib/use-media-query.ts`; **không** đổi `NARROW_QUERY` (900 px) mà shell Nhân viên đang dùng.

### 3.5 Icon

Một sprite SVG nội tuyến, nét kiểu Lucide (`viewBox 0 0 24 24`, `fill:none`, `stroke:currentColor`, `stroke-width:2`, đầu/khớp tròn), cỡ 20 mặc định, 16 trong chip/badge. Tệp `web/src/ui/icon-sprite.tsx` render một `<svg hidden>` chứa các `<symbol id="u-*">` chép từ `components.html` (danh sách dùng: `alert back calendar check chev chevup clipboard clock copy dash download ext filter history image info layers loader lock menu minus move next pencil pkg pkgplus plus printer receipt refresh scroll search sheet sliders trend truck truckin user users warehouse x bell logout sort more`), gắn một lần trong `AdminShell` và `PrintPage`. `web/src/ui/icon.tsx`: `<Icon name="truck" size={20} />` → `<svg aria-hidden><use href="#u-truck"/></svg>`; `name` là union literal (sai tên = lỗi TS). `ui/icons.tsx` cũ giữ cho Nhân viên. Không emoji, không ký tự "↗"/"✓" làm icon.

### 3.6 Minh họa và ô ảnh món

- Trạng thái trống: port 6 minh họa `es-no-request`, `es-nothing-deliver`, `es-no-backlog`, `es-no-match`, `es-no-notifications`, `es-period-locked` từ `illustrations.html` vào `web/src/ui/empty-art.tsx` (`<EmptyArt kind="nothing-deliver" />`, 160×120, `aria-hidden`), chỉ dùng biến `--ill-*`/`--c-*`.
- **Ô ảnh món** `web/src/ui/item-thumb.tsx`: props `{fileId: string | null, alt: string, tone: 'g0'…'g7', size: 34 | 36 | 48 | 96 | 'card'}`. Có `fileId` → `<img src="/api/files/:id" alt={alt} loading="lazy">`, `object-fit: contain`, chiếm 78% khung, nền `var(--g*)`, `drop-shadow(0 8px 12px rgb(var(--sh-ink) / .18))`, bo `--r-sm` (≤ 48) hoặc `--r-lg`. Không `fileId` hoặc ảnh lỗi (`onError`) → placeholder SVG trung tính (biểu tượng `u-image` 40% trên nền `g0`, `aria-hidden`) và nơi gọi hiện badge "Thiếu ảnh". Khung kích thước cố định để sau này thay ảnh thật không xô bố cục. Không dùng chữ cái đầu tên làm ảnh.
- Avatar người (bảng Tổng hợp, Giao hàng, Danh bạ): ô tròn 32 chữ cái đầu họ+tên trên nền tông theo chỉ số dòng — là avatar người, không phải ảnh món (bản mẫu dùng như vậy).

### 3.7 Chế độ tối

Bản mẫu và SYSTEM chỉ có giao diện sáng ("app nội bộ, giờ hành chính, có in A4"). Đặt `color-scheme: light` trong phạm vi `[data-shell='admin']`; không viết `prefers-color-scheme: dark`.

## 4. Shell và thành phần dùng chung (lát S1)

### 4.1 Shell Hành chính

`web/src/shell/admin-shell.tsx` (viết lại, ≤ 150 dòng) + `admin-sidebar.tsx` + `admin-nav.ts` + mới `admin-period-card.tsx`, `admin-topbar.tsx` (390), `use-admin-badges.ts`; CSS `web/src/css/m1/shell.css` (thay `css/admin.css` — xóa tệp cũ cuối S1 sau khi mọi lớp `a-*` không còn được dùng).

Bố cục 1280: lưới `232px minmax(0,1fr)`, nền `--c-page`. Sidebar: nền surface, viền phải `--c-line`, đệm 16/14, dính `top:0; height:100vh`, cuộn riêng.

Sidebar từ trên xuống:
1. Hàng thương hiệu: ô 32 `--c-acc` chứa icon `u-pkg` trắng + "VPP Công trình" (`--t-label`) / "Hành chính" (`--t-cap` muted) + chuông (`NotificationBell` restyle thành icon button 44 tròn, chấm `--c-dot` 9 px) bên phải.
2. Ba nhóm mục, nhãn nhóm `--t-cap` muted chữ thường; mục cao 40, `--r-sm`, icon 20 + nhãn + đếm (badge min-width 20) phải; đang chọn: nền `--c-acc-soft`, chữ `--c-acc` 800, vạch trái 4 px `--c-acc` (`aria-current="page"` của `NavLink`).

| Nhóm (i18n) | Mục | Route | Icon | Đếm (nguồn) |
|---|---|---|---|---|
| Hằng tháng `nav.groups.monthly` | Tổng hợp kỳ | `/admin/summary` | `u-dash` | — |
| | Món ngoài danh mục | `/admin/review` | `u-pkgplus` | số dòng chờ xem mọi kỳ = `items.length` của `GET admin/review?status=pending` (đếm 0 → ẩn) |
| | Giao hàng | `/admin/delivery` | `u-truck` | `lines_pending_delivery` của `GET admin/periods/{kỳ khóa gần nhất}/summary` (đếm dòng; `aria-label` "n dòng chờ giao") |
| | Còn nợ | `/admin/backlog` | `u-receipt` | — |
| | Báo cáo & in | `/admin/reports` | `u-printer` | — |
| Kho & danh mục `nav.groups.stock` | Kho | `/admin/stock` | `u-warehouse` | `items.length` của `GET admin/stock/low` |
| | Danh mục | `/admin/catalog` | `u-layers` | — |
| | Nhóm món | `/admin/categories` | `u-filter` | — |
| Hệ thống `nav.groups.system` | Danh bạ | `/admin/users` | `u-users` | — |
| | Nhật ký | `/admin/audit` | `u-scroll` | — |
| | Cấu hình | `/admin/config` | `u-sliders` | — |

Không có nhóm "Cá nhân", không "Phiếu của tôi" (§1.4). `ADMIN_HIDDEN_PAGES` thành rỗng (xóa hằng). "Kỳ khóa gần nhất" = `shiftYm(periods/current.ym, −1)` (cùng cách Giao hàng đang dùng). Đếm lấy bằng TanStack Query, `staleTime` 60 s, refetch khi focus; lỗi tải đếm → ẩn đếm (không chặn sidebar).

3. Đáy sidebar: **thẻ kỳ** (`admin-period-card.tsx`, nền `--g1`, chữ `--g1-ink`, `--r-md`): "Kỳ tháng {M} đang mở" + "còn {days_left} ngày · khóa 00:00 ngày {d}/{M}" từ `GET periods/current` (`days_left`, `deadline`; ngày cuối: "Hôm nay là ngày cuối · khóa 00:00 ngày …"); bấm → `/admin/summary`. Dưới: avatar chữ cái + họ tên (`me.fullName ?? me.sub`) + vai (`common.roles.<role>`) + `LanguageSwitch` (restyle thành segmented M1) + nút ghost "Đăng xuất" (`auth-actions.logout`, lỗi → câu `auth.logoutFailed` dưới nút).

Vùng nội dung: đệm 20/24/40, không giới hạn bề rộng. **Không còn thanh đầu trang 52 px**; mỗi trang tự dựng `PageHeader` (§4.2). Có "Tới nội dung" (`common.skipToContent`) trỏ `#main`.

Máy tính bảng (768–1279): sidebar 72 px chỉ icon (mục có `aria-label` = nhãn, `title` = nhãn), thẻ kỳ thành chấm trạng thái, đáy chỉ avatar mở menu ngôn ngữ/đăng xuất. Điện thoại: §5.7.

Định tuyến (`web/src/shell/app-routes.tsx`, `require-role.tsx`):
- Thêm `RequireMember`: `me.role ∈ {admin, sa}` → `<Navigate to="/admin" replace />` cho `/`, `/history`, `/history/:ym`, `/me`.
- `RequireRole` (admin) giữ hành vi member → `/`.
- `use-auth-boot`: `returnTo` sau SSO là route nhân viên mà người là admin → về `/admin`.
- Notification link `/history/...` (không còn tới admin sau S0) nếu admin bấm tin cũ → qua `RequireMember` về `/admin`.

### 4.2 Thành phần dùng chung

Mọi chuỗi qua i18n; component ≤ 250 dòng; tệp ≤ 400 dòng. "Restyle" = giữ API props + test hiện có, thêm CSS M1 trong `css/m1/*` và (nếu cần) prop mới tùy chọn.

| Thành phần | Tệp | Mới/Restyle | Quy cách | Trạng thái phải có test |
|---|---|---|---|---|
| Đầu trang | `ui/page-header.tsx` | Mới | breadcrumb nhỏ (`nav` `aria-label="Vị trí"`, nhóm mục › trang) → `h1` (`--t-h1`) + mô tả 1 câu (`--t-body` muted) · khe `actions` phải | có/không có actions |
| Nút | `css/m1/base.css` (`.btn*` dưới phạm vi admin) | Restyle | cao 44 (sm 36 trong bảng, vùng chạm 44), pill, `--t-label`, icon 18 trái; biến thể primary (`--c-acc`, `--e-acc`, **một nút đặc mỗi khung nhìn**), secondary, ghost, danger (chữ danger nền danger-soft; đặc danger chỉ trong xác nhận nguy hiểm), dark | hover/focus/nhấn/đang chạy ("Đang lưu…", giữ bề rộng)/vô hiệu kèm lý do gần đó |
| Thẻ số liệu (lọc) | `ui/stat-card.tsx` | Mới | `<button aria-pressed>` hoặc `<div>` khi `onClick` vắng; `--r-lg`, nhãn `--t-cap` + icon, số `--t-stat` `.num`, đơn vị `--t-sm`, dòng phụ; tông `neutral·warn·danger·dark`; chữ "Lọc" góc phải khi hover; đang lọc: viền acc 2 + vòng acc-soft | bấm bật/tắt `aria-pressed`; không bấm được thì không có role button |
| Hàng thẻ số liệu | `ui/stat-row.tsx` | Mới | lưới `repeat(4,1fr)` khoảng 10 (3 cột khi 3 thẻ); 390: cuộn ngang | — |
| Nhãn đang lọc | `ui/filter-notice.tsx` | Mới | "Đang lọc: {label} · {count}" + nút ghost "Bỏ lọc" | bấm Bỏ lọc gọi `onClear` |
| Bảng dữ liệu | `ui/data-table.tsx` | Restyle + prop | vỏ `--r-lg` + `--e-1`; hàng cột 36 dính, `--t-cap` muted chữ thường, mũi tên sắp xếp; hàng 52 (prop `density="compact"` = 44); số căn phải (`meta.className="num r"`); prop mới `groupBy?: {key(row), header(groupKey, rows) → ReactNode}` dựng **tiêu đề nhóm dính** (dải 52, `top: 36px`, nền tông/`--c-surface-2`, chevron thu/mở `aria-expanded`); prop mới `activeRowId?` (hàng đang mở ngăn kéo: nền `--c-acc-tint`, vạch trái 3 px acc); `selection` sẵn có thêm trạng thái lửng ở checkbox đầu nhóm | sắp xếp; chọn/chọn nhóm/lửng; thu nhóm; hàng active; rỗng |
| Ô sửa tại chỗ | `ui/inline-number.tsx` | Mới | bấm ô số → input viền acc 2 + vòng acc-soft, nhãn nhỏ "Enter lưu · Esc bỏ"; Enter gọi `onCommit(n)` (Promise), Esc bỏ; lỗi → viền danger + câu lỗi trong hàng (`aria-describedby`) | Enter/Esc/lỗi server gắn đúng ô |
| Thanh hàng loạt | `ui/bulk-bar.tsx` | Mới | thay chỗ thanh công cụ khi ≥ 1 hàng chọn: `--c-dark`, `--r-md`, "{n} … đã chọn" + khe hành động + "Bỏ chọn"; `role="toolbar"` `aria-label` | xuất hiện/ẩn theo số chọn |
| Thanh công cụ | `ui/toolbar.tsx` | Mới | ô tìm pill co giãn (icon `u-search`, phím "/" focus, `aria-label`), khe lọc/segmented/công tắc | "/" đưa focus vào ô tìm (không khi đang gõ ô khác) |
| Segmented | `ui/segmented.tsx` | Mới (thay lớp `.seg`) | `role="radiogroup"`, mục `role="radio" aria-checked`, ←/→ đổi; nền surface-2, đệm 4, mục 36 | phím mũi tên |
| Ngăn kéo | `ui/drawer.tsx` | Restyle + đổi mặc định | rộng mặc định **384** (prop `width` giữ); ≥ 1440 đẩy nội dung (lớp `has-drawer` trên vùng nội dung: `padding-right: 384px`), 1280–1439 phủ lên với overlay **trong suốt** (không mờ nền); đầu: eyebrow + `DrawerTitle` `--t-h2` + nút đóng `u-x`; thân cuộn; chân dính: chú thích trái ("{n} thay đổi chưa lưu" / "Lưu lần cuối …"), Hủy (ghost), nút chính; `dirty` → hỏi "Bỏ thay đổi chưa lưu?" (Tiếp tục sửa / Bỏ thay đổi) — sẵn có; prop mới `onPrev/onNext` → ↑/↓ (và J/K) khi focus không ở ô nhập, đổi nội dung tại chỗ; đóng trả focus về hàng nguồn; < 768: sheet toàn màn | mở/đóng, dirty hỏi, ↑/↓ gọi đúng callback, trả focus |
| Hộp thoại | `ui/dialog.tsx`, `ui/confirm-dialog.tsx` | Restyle | rộng 440 (form 520 qua `maxWidth`), `--r-xl`, `--e-5`, scrim `--c-scrim`; tiêu đề là câu hỏi/việc; nút phụ trái, chính phải; < 768: sheet đáy | xác nhận nguy hiểm dùng nút danger đặc |
| Ô nhập + lỗi | `ui/form-field.tsx` | Restyle | nhãn trên `--t-cap` 700 ink-2, "*" cho bắt buộc; ô 44 (390: 48, chữ 16), `--r-md`, viền `--c-line-input`; gợi ý dưới muted; lỗi: viền danger 2 + icon `u-alert` + chữ danger dưới ô, `aria-invalid`, `aria-describedby`; gửi form lỗi → focus ô lỗi đầu tiên; đếm ký tự tùy chọn "{n}/500" | sẵn có + đếm ký tự |
| Toast | `ui/toast.tsx`, `ui/toast-context.ts`, `ui/toast-provider.tsx` | Mới | `useToast().show({text, tone: 'ok'|'info'|'warn', action?: {label, onClick}})`; `--c-dark` (warn: nền warn-soft chữ warn), `--r-md`, icon trạng thái, 1 câu kết quả cùng động từ nút, tự tắt 4 s, `role="status"`; tối đa 1 toast (cái mới thay cái cũ); **không** dùng cho lỗi | hiện/tự tắt (fake timers)/thay thế |
| Trạng thái trống | `ui/load-state.tsx` `EmptyState` | Restyle + prop | prop mới `art?: EmptyArtKind`, tiêu đề `--t-h3`, 1 câu, 1 nút | — |
| Lỗi tải | `ui/load-state.tsx` `LoadError` | Restyle | khối viền danger-soft, icon, "Không tải được dữ liệu — thử lại.", nút secondary "Thử lại"; giữ kích thước khối | bấm Thử lại |
| Khung xương | `ui/skeleton.tsx` | Mới | khối `--c-surface-sunk` đúng hình (hàng bảng, thẻ số liệu, thẻ review), quét sáng 1.4 s (tắt khi giảm chuyển động), hiện sau 300 ms tải | không hiện trước 300 ms |
| Badge | `.tag*` trong `css/m1/base.css` | Restyle | cao 22, pill, `--t-micro`; biến thể neutral, ok, warn, danger, info, dark ("Chỉ Hành chính"), outline ("Ngừng"), group (`tag--g1…g7`) | — |
| Tiến độ | `ui/progress.tsx` | Mới (thay `DeliveryBar` phần hình) | thanh 6 px pill, rãnh `rgb(var(--sh-ink)/.08)`, fill ok-fill (đủ)/warn-fill (thiếu kho)/danger (hết); luôn kèm chữ "đã giao a/b" | chữ đúng a/b |
| Stepper | `ui/stepper.tsx` | Restyle + prop | dạng inline (cao 32, nút 28, vùng chạm 44 qua pseudo), số giữa gõ trực tiếp; props sẵn có + `min`, `max`; tại `max` nút + vô hiệu, tại `min` nút − vô hiệu; nhãn `aria-label` "Thêm {tên}"/"Bớt {tên}" | biên min/max (§7) |
| Chọn tháng | `ui/month-switcher.tsx` | Restyle | ‹ "Tháng 11/2026" › + badge trạng thái kỳ ("Đang mở · hạn 10" ok-soft / "Đã khóa" dark) | khóa › ở trần |
| Ô ảnh món | `ui/item-thumb.tsx` | Mới | §3.6 | ảnh thật có `alt`; lỗi ảnh → placeholder |
| Chọn người | `features/directory/user-picker.tsx` | Restyle | ô tìm + danh sách 8 kết quả (avatar, tên, phòng ban), giữ props | sẵn có |

CSS: `web/src/css/m1/{base,shell,table,overlay,states}.css`, mỗi tệp ≤ 400 dòng, import trong `main.tsx` sau `tokens-m1.css`. CSS riêng màn đặt ở `features/<ten>/<ten>.m1.css` (cũng phạm vi admin); tệp `features/<ten>/<ten>.css` cũ xóa khi lát của màn đó xong.

### 4.3 Lỗi API → vị trí hiển thị (chung)

`lib/api-error.ts` giữ cách đọc `{code, message, line_id?, line_index?, fields?, …}`. Mỗi feature có `*-errors.ts` (đã có) ánh xạ `code` → key i18n + vị trí: **ô** (`VALIDATION.fields`, `REASON_REQUIRED`, `QTY_*`, `CONFIG_INVALID {field}`, `CATEGORY_EXISTS`, `IMAGE_REQUIRED`, `UNIT_REQUIRED`), **dòng** (`line_id`/`line_index`: nền danger-tint, câu dưới tên), **khối** (cảnh báo đầu thân ngăn kéo/hộp thoại: `STALE_UPDATE`, `PERIOD_LOCKED`, `PERIOD_NOT_LOCKED`, `LINE_ALREADY_REVIEWED`), **trang** (`LoadError`). `FORBIDDEN_ROLE` khi đang ở trang admin (vai vừa bị gỡ) → `NoPermission` "Trang này dành cho Hành chính." (biến thể C-loi). Không dùng toast cho lỗi.

## 5. Các lát cắt

Mỗi lát: một nhánh `feat/ui-h-sN` từ `main`, TDD theo CLAUDE.md, cập nhật `docs/map.md` (dòng shell/ui/feature chạm tới), Playwright 1280 + 390 cho mọi test của lát, axe `color-contrast` ở 390 trên màn chính của lát. i18n: thêm key `vi` + `en` cùng commit; namespace ghi ở từng màn.

### 5.0 S0 — Hành chính không có phiếu (API + điều hướng)

#### 5.0.1 Luật

| Luật | Ép ở đâu |
|---|---|
| R1. admin/sa không đọc/ghi phiếu cá nhân | `@Roles('member')` trên `MeRequestController` (`api/src/modules/requests/me-request.controller.ts`: `GET me/request`, `PUT me/request/lines`, `POST me/request/copy-previous`, `GET me/requests`) và `GET me/issues` (`api/src/modules/catalog/stock.controller.ts` dòng 57). `RolesGuard` (`api/src/modules/auth/roles.guard.ts`) đã trả 403 `FORBIDDEN_ROLE` khi vai không nằm trong danh sách — vai `admin`/`sa` khác `member` nên bị chặn; không cần mã mới. |
| R2. `GET periods/current` vẫn mở cho mọi vai (thẻ kỳ ở sidebar dùng) | `api/src/modules/requests/current-period.service.ts`: với vai admin/sa trả `previous: null` (không tra phiếu của người gọi) |
| R3. Mẫu số Tổng hợp loại Hành chính | `headcountCondition()` trong `api/src/modules/requests/summary.service.ts` thêm `AND NOT (jsonb_typeof(u.groups)='array' AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(u.groups) g WHERE lower(g) = lower($admin_group)))` (`config.getAdminGroup()`), cùng điều kiện "là admin" với `UsersService.activeAdminSubs` (`api/src/modules/users/users.service.ts` dòng 178). Áp vào: `liveCounts` (KPI `headcount`, `unregistered`), `unregisteredRows` (`GET admin/periods/:ym/unregistered`), `audienceSubs` (chuông `period_open`), `unregisteredSubs` (chuông `reminder`), và số ghi vào `periods.headcount` lúc khóa (`NotificationScheduler`, `api/src/modules/reminders/notification-scheduler.ts` dòng 121–124 gọi `liveCounts`). |
| R4. Tạo hộ không nhắm Hành chính | `POST admin/requests` (`api/src/modules/requests/admin-request.service.ts`): người được chọn có group ∩ `admin_group` → 400 `USER_IS_ADMIN` (mã **mới**), kiểm sau `USER_NOT_FOUND`/`USER_INACTIVE`, trước khi mở phiếu. |
| R5. `registered` (tử số) giữ FR-34: đếm mọi phiếu của kỳ | không đổi `requestCounts`; phiếu cũ của người nay là Hành chính vẫn được đếm — vì vậy `registered` có thể > `headcount` ở kỳ cũ; UI hiện đúng số server trả, không kẹp. |
| R6. Điều chỉnh/giao/hủy nợ/review phiếu cũ của người nay là Hành chính vẫn làm được | không đổi `PUT admin/requests/:id/lines`, `deliver*`, `cancel-remaining`, `review` (cờ audit `self` giữ nguyên ý nghĩa cho phiếu cũ). |
| R7. Dòng ngoài danh mục **không cần ảnh** (chốt 2026-10-30, đảo FR-22) | Migration mới bỏ CHECK bắt buộc `image_file_id` cho dòng ngoài DM (giữ cột, ảnh thành tùy chọn); `request-lines.diff.ts`/`line-image.reference.ts` bỏ `IMAGE_REQUIRED` ở `me/request` và `admin/requests/:id/lines` (ảnh gửi kèm vẫn kiểm `FILE_FORBIDDEN` như cũ). Review `convert` sang món **mới**: không có ảnh dòng thì `item.image_file_id` (admin tải, purpose `item_image`) bắt buộc → thiếu = 400 `IMAGE_REQUIRED` (BR-9 giữ nguyên ý); convert sang món có sẵn không cần ảnh. Test biên: lưu dòng ngoài DM không ảnh → 200 (trước là 400); có ảnh hợp lệ → 200; ảnh của người khác → `FILE_FORBIDDEN`; convert món mới không ảnh dòng + không ảnh món → `IMAGE_REQUIRED`, có ảnh món → 200. B2 hiện ảnh nếu có, không thì ô minh họa "Không có ảnh"; giao diện nhân viên bỏ ô tải ảnh ở spec phần nhân viên. Tài liệu: PRD FR-22, architecture §6 bước 4 + review convert + §BR-9, backlog E2/E3. |

Vai tính mỗi request (`toIdentity` → `resolveRole`) nên người đổi nhóm có hiệu lực từ request kế tiếp, không cần đăng nhập lại.

#### 5.0.2 Mã lỗi

- `FORBIDDEN_ROLE` (403) đã có trong code (`roles.guard.ts`) nhưng chưa có ở architecture §7 → thêm vào danh sách mã cùng commit.
- `USER_IS_ADMIN` (400, kèm `message`) mới → thêm vào §7 và `web/src/features/summary/` ánh xạ lỗi tạo hộ (ô "Người đăng ký": "Người này là Hành chính — Hành chính không đăng ký VPP.").

#### 5.0.3 Web trong S0 (giao diện cũ, chỉ điều hướng)

- `RequireMember` (§4.1) cho route nhân viên; xóa mục "Phiếu của tôi" và nhóm "Cá nhân" khỏi `admin-sidebar.tsx`; xóa `nav.groups.personal`, `nav.myRequest` khỏi `locales/{vi,en}/nav.ts` nếu không còn chỗ dùng.
- `ProfilePage` không còn lối "Mở trang quản lý" cho admin (admin không vào được `/me`); key `profile.openAdmin` xóa nếu không còn dùng.

#### 5.0.4 Dữ liệu cũ

Không migration, không xóa. Phiếu đã có của người nay là Hành chính: hiện ở Tổng hợp (theo người/món), Giao hàng, Còn nợ, Báo cáo, bản chốt như mọi phiếu; giao/hủy nợ bình thường. Người đó không xem được phiếu qua Lịch sử (R1). Câu hỏi Q4 hỏi có cần dọn phiếu kỳ đang mở của Hành chính không.

#### 5.0.5 Test (RED trước)

| Test | Tầng | Tệp |
|---|---|---|
| `PUT me/request/lines` với `x-dev-role: admin` → 403 `FORBIDDEN_ROLE`; với `sa` → 403; với `member` → 200 (cùng body) | e2e | `api/test/me-request-lines.e2e-spec.ts` |
| `GET me/request`, `POST me/request/copy-previous`, `GET me/requests`, `GET me/issues` với admin → 403; member → 200/404 như cũ | e2e | `api/test/me-request.e2e-spec.ts`, `me-history.e2e-spec.ts`, `me-issues.e2e-spec.ts` |
| `GET periods/current` admin → 200, `previous: null` dù admin có phiếu kỳ trước (dữ liệu cũ seed bằng SQL) | e2e | `api/test/periods.e2e-spec.ts` |
| **Biên đổi nhóm:** user U thuộc nhóm thường lưu phiếu → 200; cập nhật `users.groups` thêm `admin_group` (khác hoa thường, vd `VPP_ADMIN`) → `PUT me/request/lines` kế tiếp → 403; gỡ nhóm → 200. Chạy với danh tính thật (phiên SA/OIDC giả lập qua fixture có `users.groups`), không qua `x-dev-role`, để chứng minh vai tính mỗi request | e2e | `api/test/admin-group.e2e-spec.ts` |
| `liveCounts`: 3 user active (A thường, B admin_group, C nhóm ngoài `authorized_groups`) → `headcount` = 1, `unregistered` chỉ A; đổi B sang nhóm thường → `headcount` 2 | db-spec | `api/test/summary-headcount.db-spec.ts` (mới) |
| `GET admin/periods/:ym/unregistered` không chứa Hành chính; `GET …/summary` `headcount` không đếm Hành chính; phiếu cũ của Hành chính vẫn vào `registered` | e2e | `api/test/admin-summary-lists.e2e-spec.ts` |
| `runHourly` ngày 1 → `period_open` không gửi Hành chính; ngày `lastDay−2` → `reminder` không gửi Hành chính; ghi `headcount` lúc khóa không đếm Hành chính | e2e (ClockService cố định) | `api/test/reminders.e2e-spec.ts` |
| `POST admin/requests` chọn user thuộc `admin_group` → 400 `USER_IS_ADMIN`; user thường → 201 | e2e | `api/test/admin-requests-create.e2e-spec.ts` |
| Test hiện có dùng admin tự lưu `me/request` (`admin-requests.e2e-spec.ts` ca "Hành chính sửa phiếu của chính mình → audit self:true", `me-request.fixture.ts`, `review.fixture.ts`, `custom-line-notify.e2e-spec.ts`, `cancel-remaining.e2e-spec.ts`, `me-request-concurrency.db-spec.ts`) | sửa fixture | phiếu của admin seed bằng SQL (dữ liệu cũ) thay vì gọi `me/request` |
| Web: admin vào `/`, `/history`, `/me` → URL `/admin/summary`; member vào `/` ở lại | vitest | `web/src/app.test.tsx` |
| Playwright `E9-S0 Hành chính không có phiếu: đăng nhập vào thẳng Tổng hợp, mở / bị đưa về /admin, sidebar không có Phiếu của tôi` (1280 + 390); thay test cũ `E0-S9 admin: "Phiếu của tôi" về khung nhân viên` | Playwright | `web/playwright/admin.spec.ts` |

#### 5.0.6 Tài liệu cập nhật trong S0

`docs/prd.md` §2 dòng 22 (Admin: "Quản lý VPP; không đăng ký VPP cho bản thân"), FR-30 (mẫu số loại Hành chính), §7 dòng 152 (bỏ *Phiếu của tôi*), nhật ký quyết định (dòng 2026-10-30); `docs/architecture.md` §4 (vai), §6 đoạn "Kỳ đang mở … headcount" và `GET periods/current` (`previous` null cho admin/sa), §7 bảng (nhóm "Phiếu của tôi" vai **member**, `me/issues` member, Tổng hợp: mẫu số loại admin, tạo hộ `USER_IS_ADMIN`) và danh sách mã (`FORBIDDEN_ROLE`, `USER_IS_ADMIN`), §9 người nhận `period_open`/`reminder`, §11 bỏ câu "admin có mục Phiếu của tôi"; `docs/backlog/epic-0-nen-tang.md` E0-S9 AC, `epic-2-phieu-dang-ky.md` E2-S3 (member only), `epic-3-tong-hop-dieu-chinh.md` E3-S1/E3-S4 (mẫu số, `USER_IS_ADMIN`); `docs/map.md` dòng requests/summary/reminders/shell; `docs/review-spec.md` mục E ghi quyết định.

### 5.1 S1 — Token, shell, thành phần dùng chung

Phạm vi: §3, §4. Sau S1, mọi trang admin chưa port vẫn chạy trong shell mới; lớp tương thích trong `css/m1/base.css` đổi `.btn`, `.tag`, `.alert`, `.field`, `.table`, `.seg`, `.drawer`, `.dialog-viewport` sang M1 dưới phạm vi admin để trang chưa port không vỡ.

i18n: `nav.*` (thêm `nav.categories`, `nav.badge.review` "{{n}} món chờ xem", `nav.badge.delivery` "{{n}} dòng chờ giao", `nav.badge.stock` "{{n}} món sắp hết", `nav.periodCard.*`), `common.toast.*`, `common.filter.*` ("Đang lọc: {{label}} · {{count}}", "Bỏ lọc"), `common.empty.*`, `common.table.*`.

AC (E9-S1):
1. Ở `/admin/*`, `body[data-shell="admin"]`, font tính được của `h1` là Be Vietnam Pro, nền trang `rgb(239, 235, 228)`; ở `/` (member) nền vẫn `rgb(244, 247, 245)` và font Nunito (Playwright đọc `getComputedStyle`).
2. Sidebar có đúng 11 mục theo bảng §4.1 trong 3 nhóm, mục đang chọn có `aria-current="page"`; không có "Phiếu của tôi".
3. Đếm: `GET admin/review?status=pending` trả 3 dòng → mục Món ngoài danh mục hiện "3"; trả 0 → không hiện đếm (biên 0/1).
4. Thẻ kỳ: `days_left = 1` → "Hôm nay là ngày cuối"; `days_left = 2` → "còn 2 ngày" (biên, vitest với dữ liệu giả).
5. Bộ thành phần §4.2 có test vitest cho mọi trạng thái ghi trong bảng.
6. 768 px sidebar 72 px chỉ icon, 767 px thành thanh trên + nút "Mở menu" (biên điểm gãy, Playwright `setViewportSize`); 1279/1280 tương tự cho 232 px.
7. `m1-scope.test.ts` xanh; `grep -rn "#[0-9A-Fa-f]\{3,6\}" web/src/css/m1 web/src/features/*/**.m1.css` chỉ khớp trong `tokens-m1.css`.
8. Playwright: mọi test admin hiện có (`admin`, `catalog`, `stock`, `summary`, `adjust`, `review`, `delivery`, `backlog`, `reports`, `print`, `notifications`, `i18n`) vẫn xanh (chỉ sửa selector nếu nhãn đổi theo spec này, không sửa assertion nghiệp vụ); mọi test member xanh không sửa.

Playwright: `E9-S1 shell Hành chính: sidebar 3 nhóm 11 mục, thẻ kỳ, chuông, đổi en đổi nhãn sidebar` · `E9-S1 điểm gãy 767/768 và 1279/1280` · `E9-S1 trang member giữ giao diện cũ`.

### 5.2 S2 — Tổng hợp kỳ + Món ngoài danh mục

#### B1 Tổng hợp kỳ — `/admin/summary?ym=&view=person|item&filter=&q=`

- **Vùng:** `PageHeader` (breadcrumb "Hằng tháng", h1 "Tổng hợp kỳ", mô tả "Ai đã đăng ký, món nào cần mua, phiếu nào cần sửa — trong một bảng.", actions: `MonthSwitcher` + badge kỳ) → `StatRow` 4 thẻ → `Toolbar` (ô tìm, segmented Theo người/Theo món, nút secondary "Sao chép danh sách chưa đăng ký (n)", nút primary "Tạo phiếu hộ") → `FilterNotice` → bảng.
- **Dữ liệu:** `GET periods/current` (kỳ mở, trần tháng) · `GET admin/periods/:ym/summary` · `GET admin/periods/:ym/requests?by=person&filter=&q=&limit=100&cursor=` · `GET admin/periods/:ym/requests?by=item` · `GET admin/periods/:ym/unregistered` · `GET admin/items` (tồn, nhóm, ảnh cho bảng theo món) · `GET item-categories?all=1` (tông nhóm) · `GET admin/stock/low`.
- **Thẻ số liệu:**

| Thẻ | Số | Dòng phụ | Bấm |
|---|---|---|---|
| Phiếu đã đăng ký | `registered/headcount` người | "tính hiện tại"/"tính tại lúc khóa" (`headcount_source`) · "{unregistered} chưa đăng ký" | `filter=unregistered`: bảng hiện danh sách chưa đăng ký (từ `…/unregistered`), mỗi hàng nút "Tạo phiếu hộ" (kỳ khóa: nút vô hiệu, chú thích "Kỳ đã khóa — không tạo phiếu mới được.") |
| Dòng chờ giao | `lines_pending_delivery` dòng | kỳ mở: số "—", dòng phụ "giao sau khi khóa 00:00 ngày {d}/{M}", thẻ không bấm được | `filter=pending_delivery` |
| Món ngoài danh mục chờ xem | `custom_pending` món | "xem ở mục riêng" | `filter=custom_pending` |
| Món sắp hết | `low_stock` món | "· {out} hết hàng" (`out` = số `admin/items` `active && stock_state='out'`) | chuyển `view=item&filter=low` (chỉ món có trong `admin/stock/low` hoặc `stock_state='out'`) |

- **Bảng theo người** (`DataTable` `groupBy` phòng ban, nhóm null cuối "Chưa có phòng ban"): cột Người (avatar, tên, nhãn "Người đã nghỉ" khi `user_status ≠ active`) · Số món (`line_count`) · Tổng (`total_qty`) · Giao (kỳ khóa: `Progress` + "đã giao {delivered_qty+cancelled_qty}/{total_qty}"; kỳ mở: "Giao sau khi khóa kỳ") · Ghi chú ("{custom_pending} món ngoài DM chờ xem" badge warn) · Lưu lúc (`updated_at`, "hh:mm hôm nay"/"dd/MM · hh:mm") · thao tác "Điều chỉnh" (sm secondary, `aria-label` "Điều chỉnh phiếu của {tên}") và icon "Giao" (kỳ khóa, sang `/admin/delivery?ym=&request=`). Bấm hàng = mở ngăn kéo. "Xem thêm" khi `next_cursor`.
- **Bảng theo món** (`groupBy` nhóm, tiêu đề nhóm dải tông nhóm "{n} món · {k} sắp hết/hết hàng"): Món (thumb 36, tên, badge "Chỉ Hành chính") · ĐVT · SL đăng ký (`requested_qty`) · Số người (`people`) · Tồn kho (`stock_qty` + badge "Sắp hết"/"Hết hàng" theo `stock_state`) · cột "Cần mua thêm" **bỏ** (G4) — thay bằng liên kết đầu bảng "Xem số cần mua ở Báo cáo". Dòng ngoài danh mục (`item_id = null`) nhóm "Ngoài danh mục" tông g0, Tồn "—".
- **Tìm:** `q` gửi server (≤ 100 ký tự, `maxLength=100`), debounce 300 ms ở theo người; theo món lọc phía trang theo tên bỏ dấu.
- **Sao chép danh sách chưa đăng ký** (`unregistered-copy.tsx` giữ logic): `navigator.clipboard.writeText("Chưa đăng ký VPP tháng {M} (hạn 23:59 ngày {d}):\n- {tên} ({phòng ban})…")` → toast "Đã sao chép {n} người"; bị chặn → hộp thoại B1c (văn bản chọn sẵn, "nhấn Ctrl+C rồi dán vào nhóm chat"). n = 0 → nút vô hiệu, chú thích "Mọi người đã đăng ký".
- **Rỗng:** `EmptyState art="no-match"` "Không có phiếu nào khớp" + "Bỏ lọc".

**B1a Ngăn kéo Điều chỉnh phiếu** (`features/summary/adjust-drawer.tsx` + `adjust-lines.tsx` + `use-adjust.ts`, restyle; tách `adjust-line-row.tsx` nếu > 250 dòng): eyebrow "Tháng {M}/{Y} · {phòng ban}", tiêu đề "Phiếu của {tên}", badge kỳ; kỳ khóa: cảnh báo warn "Kỳ đã khóa. Chỉ Hành chính sửa được, phải ghi lý do; không giảm dưới số đã giao."; mục "Món trong phiếu · {n} dòng" + "{tổng} đơn vị"; mỗi dòng: thumb 48 tông nhóm, tên, meta "{ĐVT} · tối đa {max}/tháng" (admin_only: "{ĐVT} · Hành chính đặt"), badge "Mới thêm" (info) / "Chỉ Hành chính" (dark) / "Trước khi sửa: {cũ}" (warn) / "đã giao {n}" (ok) / "đã hủy nợ {n}" / "Sẽ bỏ khỏi phiếu" (danger) + nút "Giữ lại"; `Stepper` `min = delivered_qty + cancelled_qty`, `max = max_qty` (admin_only không có trần UI — server quyết); dòng ngoài danh mục: thumb ảnh dòng, "{SL} {ĐVT} · ngoài danh mục", ghi chú, trạng thái review; dòng `pending` có `ReviewActions` (3 nút, áp dụng ngay, cập nhật `expected_updated_at` theo `request_updated_at`) + liên kết "Xem ở Món ngoài danh mục"; "+ Thêm món vào phiếu" → ô tìm món (`add-line-picker.tsx`, 6 kết quả, gồm món admin_only, không món đã có); ô "Lý do điều chỉnh" (bắt buộc khi kỳ khóa, "*"; kỳ mở: tùy chọn, gợi ý "Không bắt buộc khi kỳ đang mở — nhân viên thấy lý do trong Lịch sử."), `maxLength=500`, đếm ký tự; chân: "{n} thay đổi chưa lưu"/"Lưu lần cuối {updated_at}", Hủy, "Lưu điều chỉnh".
- Gửi: `PUT admin/requests/:id/lines {lines, expected_updated_at, reason?}`. Thành công → toast "Đã lưu điều chỉnh phiếu của {tên}", đóng, refetch Tổng hợp. Không còn dòng → server trả `request: null` → toast "Đã bỏ phiếu của {tên}".
- Lỗi: `REASON_REQUIRED` → ô lý do; `QTY_EXCEEDS_MAX`, `QTY_BELOW_DELIVERED {delivered}`, `QTY_INVALID`, `ITEM_INACTIVE`, `DUPLICATE_ITEM`, `LINE_NOT_FOUND` (400) → dòng theo `line_id`/`line_index`; `STALE_UPDATE` → khối đầu thân "Nhân viên vừa sửa phiếu này — tải bản mới nhất rồi sửa lại." + nút "Tải bản mới nhất"; `PERIOD_LOCKED` → khối; `REQUEST_NOT_FOUND` → khối "Phiếu không còn."; review: `LINE_ALREADY_REVIEWED` → khối của dòng.
- Bàn phím: ↑/↓ chuyển người kế trong bảng (ngăn kéo hỏi bỏ thay đổi nếu bẩn).

**B1b Hộp thoại Tạo phiếu hộ** (`create-request-dialog.tsx`, 520): "Tạo phiếu hộ — Tháng {M}/{Y}", mô tả "Đăng ký thay người không tự lưu được phiếu (đi công trường, nghỉ phép)."; kỳ đang xem đã khóa → cảnh báo "Kỳ tháng {M} đã khóa lúc 00:00 ngày 11/{M} — không tạo phiếu mới được. Dùng Điều chỉnh phiếu hoặc Xuất lẻ ở Kho." và nút Tạo phiếu vô hiệu (server vẫn là nơi quyết: `POST admin/requests` luôn vào kỳ đang mở). Ô "Người đăng ký *" (`UserPicker`, kết quả kèm badge "Đã có phiếu"/"Chưa đăng ký" dẫn xuất từ danh sách chưa đăng ký của kỳ mở); "Món trong phiếu *" (picker + stepper `min 1`, `max max_qty`); gợi ý "Theo luật kỳ: không vượt tối đa/tháng của từng món; {tên} vẫn tự sửa được đến hết {d}/{M}." Gửi thiếu → "Cần thêm: người đăng ký." / "Cần thêm: ít nhất một món." (cũng là luật server `LINES_EMPTY`; FE chỉ báo sớm). Lỗi: `REQUEST_EXISTS {request_id}` → khối "{tên} đã có phiếu tháng {M} — sửa phiếu đó thay vì tạo phiếu mới." + "Mở Điều chỉnh"; `USER_IS_ADMIN` → ô người; `USER_INACTIVE`, `USER_NOT_FOUND` → ô người; `ADMIN_ONLY_ITEM`, `QTY_EXCEEDS_MAX`, `ITEM_INACTIVE` → dòng; `PERIOD_LOCKED` → khối. Thành công → toast "Đã tạo phiếu cho {tên}".

i18n: `summary.page.*`, `summary.kpi.*`, `summary.table.*`, `summary.adjust.*`, `summary.create.*`, `summary.unregistered.*`.

#### B2 Món ngoài danh mục — `/admin/review?status=pending|accepted|converted|rejected&ym=`

- **Vùng:** `PageHeader` (mô tả "Món nhân viên tự thêm vào phiếu — xem từng món trước khi mua."; actions: chọn kỳ "Mọi kỳ" + 12 tháng tới kỳ mở) → segmented trạng thái 4 mục kèm đếm (badge) → chú thích "Chấp nhận = mua riêng lần này. Thêm vào danh mục = mọi người đặt được từ kỳ sau." → lưới thẻ dòng (`repeat(auto-fill, minmax(360px,1fr))`, khoảng 16).
- **Dữ liệu:** `GET admin/review?status=&ym=` cho trạng thái đang xem; đếm 4 tab = 4 truy vấn song song cùng `ym` (D9); `GET admin/items` (tên món đích của dòng converted), `GET item-categories?all=1`.
- **Thẻ dòng** (`review-card.tsx` restyle): ảnh lớn 120 (`ItemThumb fileId=image_file_id tone=g0`, `alt` "Ảnh {tên} do nhân viên gửi"), tên, "{qty} {ĐVT} · Phiếu tháng {M}/{Y}", ghi chú, "{tên người} · {phòng ban} · thêm lúc {created_at}", gợi ý warn "Đã chấp nhận kỳ trước → nên Thêm vào danh mục" khi `previously_accepted`; hành động: secondary "Chấp nhận", secondary "Thêm vào danh mục…", danger "Từ chối…" (lưới nhiều thẻ là một khung nhìn nên không có nút nhấn đặc trên thẻ; nút đặc chỉ ở hộp thoại). Đã xử lý trong phiên: thẻ ở lại với badge ("Đã chấp nhận" ok / "Đã thêm vào danh mục" info / "Đã từ chối" danger) + câu quyết định + "vừa xong" (G7).
- **Hộp thoại:** Chấp nhận ("Chấp nhận {tên}?" — "Hành chính sẽ mua {qty} cho phiếu tháng {M} của {người}. Món không vào danh mục — tháng sau muốn đặt lại, nhân viên phải thêm lại." · Quay lại / Chấp nhận); Từ chối ("Từ chối {tên}?" · "Lý do từ chối *" `maxLength 500`, gợi ý "Ít nhất 3 ký tự. Viết cho người đăng ký đọc." · Quay lại / Từ chối (danger đặc)); Thêm vào danh mục (`convert-dialog.tsx`, 520: segmented "Món mới"/"Món có sẵn"; Món mới: Tên món * (≤ 120), Tên tiếng Anh, ĐVT * (`UnitSelect`, mặc định = `custom_unit`), Tối đa mỗi tháng * (1–999, mặc định `default_max_qty`), Nhóm * (chip có chấm tông nhóm), Chỉ Hành chính, chú thích "Dùng ảnh nhân viên đã gửi làm ảnh món; đổi được ở Danh mục."; Món có sẵn: ô tìm + danh sách (thumb, tên, "tính theo {ĐVT} · {nhóm}"), cảnh báo warn khi ĐVT khác "Nhân viên đặt theo «{a}», {món} tính theo «{b}». Số lượng giữ nguyên {qty} — kiểm tra lại với {người}.").
- **Gửi:** `POST admin/lines/:id/review {action, note?, item?}`. Toast: "Đã chấp nhận {tên}" / "Đã từ chối {tên}" / "Đã thêm {tên} vào danh mục" / "Đã gắn {tên} vào {món}"; `unit_mismatch` → toast warn kèm câu.
- **Lỗi:** `REASON_REQUIRED` → ô lý do; `VALIDATION {fields: ['item.name'|'item.max_qty'|…]}` → ô tương ứng; `UNIT_REQUIRED` → ô ĐVT; `ITEM_NOT_FOUND`/`ITEM_INACTIVE` → ô món có sẵn; `CATEGORY_NOT_FOUND` → ô nhóm; `LINE_ALREADY_REVIEWED` → khối trong hộp thoại "Dòng này vừa được xử lý ở nơi khác." + đóng làm mới thẻ; `LINE_NOT_FOUND` → khối.
- **Rỗng:** theo tab: "Không còn món nào chờ xem" (`es-no-match`) + "Xem món đã chấp nhận"; "Chưa chấp nhận món nào"; "Chưa thêm món nào vào danh mục"; "Chưa từ chối món nào".

i18n: `review.page.*`, `review.card.*`, `review.accept.*`, `review.reject.*`, `review.convert.*`.

AC (E9-S2):
1. Bấm thẻ "Dòng chờ giao" (kỳ khóa) → URL có `filter=pending_delivery`, `aria-pressed="true"`, nhãn "Đang lọc: Còn dòng chờ giao · {n} người", bảng chỉ gồm phiếu còn dòng chờ giao; bấm lại → bỏ lọc. Kỳ mở: thẻ không có role button.
2. Bấm "Phiếu đã đăng ký" → bảng = danh sách chưa đăng ký, không chứa Hành chính (sau S0).
3. Ngăn kéo kỳ khóa: lý do 2 ký tự sau trim → lỗi tại ô `REASON_REQUIRED` (server trả, FE không chặn trước); 3 ký tự → lưu được. Lý do 500 ký tự gửi được, ô không cho gõ ký tự 501 (`maxLength`), e2e api đã có biên 500/501 ở `NOTE_MAX`.
4. Stepper: dòng `max_qty = 5`: ở 5 nút + vô hiệu; gõ 6 → server `QTY_EXCEEDS_MAX` hiện ở dòng; dòng đã giao 3: nút − vô hiệu ở 3, gõ 2 → `QTY_BELOW_DELIVERED` ở dòng.
5. `STALE_UPDATE` (Playwright: lưu phiếu ở tab member trước) → khối cảnh báo + nút tải bản mới.
6. Tạo hộ trùng → khối "đã có phiếu" + "Mở Điều chỉnh" mở đúng ngăn kéo; chọn Hành chính → lỗi tại ô người.
7. Review: từ chối với 2 ký tự → lỗi ô; 3 ký tự → thẻ đổi badge "Đã từ chối"; tên món mới 120 ký tự lưu được, 121 → lỗi ô `item.name`; tối đa 0 và 1000 → lỗi ô `item.max_qty`, 1 và 999 qua.
8. Tab đếm khớp số dòng từng trạng thái.

Playwright: `E9-S2 Tổng hợp: thẻ lọc dòng chờ giao, chưa đăng ký không có Hành chính, theo món nhóm có tồn` · `E9-S2 Điều chỉnh kỳ khóa: cận dưới đã giao, lý do 2/3 ký tự, lưu ra toast` · `E9-S2 Tạo phiếu hộ: trùng phiếu mở Điều chỉnh` · `E9-S2 Món ngoài danh mục: chấp nhận, từ chối có lý do, thêm vào danh mục món mới`.

### 5.3 S3 — Giao hàng + Còn nợ

#### B3 Giao hàng — `/admin/delivery?ym=&request=&all=1`

- **Vùng:** `PageHeader` (mô tả "Giao theo phiếu sau khi khóa kỳ — tồn kho trừ ngay khi bấm Giao.", actions `MonthSwitcher` trần = kỳ khóa gần nhất) → dải trạng thái (badge "Tháng {M}/{Y} đã khóa · Khóa 00:00 ngày 11/{M}" · "{full}/{total} phiếu đã giao đủ" · "{k} món thiếu kho: {tên…}" + liên kết "Nhập mua ở Kho") → master–detail `320px 1fr` khoảng 16.
- **Dữ liệu:** `GET admin/periods/:ym/summary` (tổng phiếu) · `GET admin/periods/:ym/requests?by=person&filter=pending_delivery|all` (danh sách; `full` = `registered` − số phiếu filter `pending_delivery` khi đã tải hết) · `GET admin/requests/:id` (chi tiết) · `GET admin/items` (tồn từng món) · `GET admin/reports/:ym` (món thiếu kho = hàng `byItem` có `need > 0`; G8).
- **Trái:** "Phiếu tháng {M} · Chưa giao đủ ({n})" + công tắc "Hiện cả phiếu đã giao đủ"; mỗi hàng nút (`aria-pressed` đang chọn): avatar, tên, phòng ban, `Progress` "đã giao {a}/{b}" (đơn vị, từ `delivered_qty + cancelled_qty` / `total_qty`). Không có nhãn "thiếu kho" ở hàng danh sách (G8). Phiếu vừa giao đủ: vòng ✓ 420 ms rồi rời bộ lọc sau 600 ms, chọn tự sang phiếu kế (giữ `useStickyRows` cho tới khi chuyển); giảm chuyển động → rời ngay.
- **Phải:** đầu: avatar, tên, "{phòng ban} · lưu phiếu lúc {updated_at}", "đã giao {a}/{b} dòng" (dòng = số dòng hiệu lực đã đủ / số dòng hiệu lực, dẫn xuất từ `lines`); bảng dòng: checkbox (`aria-label` "Chọn {tên}"), Món (thumb, tên, meta ĐVT) · Đăng ký (`qty`) · Đã giao (`delivered_qty`, + "đã hủy {cancelled_qty}") · Tồn (món: `stock_qty`; ngoài DM: "—") · Thực giao (`Stepper` `min 1`, `max = min(remaining, stock_qty)`; ngoài DM `max = remaining`; mặc định = max) · nút sm "Giao". Dòng `pending`: badge "Chờ xem — chưa giao được" + liên kết "Xem"; `rejected`: badge "Đã từ chối"; `remaining = 0`: "Đã giao đủ" ok, không stepper; tồn 0: "Hết hàng — còn nợ {remaining}", stepper vô hiệu. Cảnh báo warn khi có dòng thiếu kho: "{k} dòng thiếu kho. Giao phần đang có; phần còn lại tự chuyển sang Còn nợ."
- **Chân dính phải:** "Đã chọn {n} dòng" · secondary "Giao dòng đã chọn ({n})" · primary "Giao tất cả".
- **Hành động:**
  - Giao một dòng: `POST admin/lines/:id/deliver {qty, expected_delivered_qty}` (single-flight như hiện tại) → dòng cập nhật, toast "Đã giao {qty} {ĐVT} {tên}"; `request_complete` → toast "Đã giao đủ phiếu của {người}".
  - Giao dòng đã chọn (D6): lần lượt `POST admin/lines/:id/deliver` theo thứ tự hiển thị với `qty` = số trong stepper, mỗi dòng `expected_delivered_qty` hiện tại; lỗi một dòng không dừng các dòng sau; xong → khối kết quả `role="status"` "Đã giao {n} dòng · Không giao được {k}: {tên — lý do}".
  - Giao tất cả: `POST admin/requests/:id/deliver-all` → khối kết quả từ `{delivered, failed}`: "Đã giao {n} dòng · Không giao được: {tên} (chỉ còn {available})" (`STOCK_INSUFFICIENT`), "{tên} (chờ xem)" (`LINE_NOT_REVIEWED`), "{tên} (đã từ chối)" (`LINE_REJECTED`); `delivered: []` và `failed: []` → "Không còn dòng nào cần giao".
- **Lỗi:** `STOCK_INSUFFICIENT {available}` → dòng "Chỉ còn {available} {ĐVT}." + stepper kẹp lại; `DELIVER_EXCEEDS_QTY {remaining}` → dòng "Chỉ còn {remaining} chưa giao."; `STALE_UPDATE {delivered_qty}` → dòng "Dòng vừa được giao ở nơi khác — đã cập nhật." + refetch phiếu; `PERIOD_NOT_LOCKED` → khối đầu chi tiết "Kỳ chưa khóa — giao sau 00:00 ngày 11/{M}."; `LINE_NOT_REVIEWED`/`LINE_REJECTED` → dòng; `REQUEST_NOT_FOUND`/`LINE_NOT_FOUND` → khối.
- **Rỗng:** `es-nothing-deliver` "Không còn phiếu cần giao" — "Mọi phiếu tháng {M} đã giao đủ. Phần thiếu kho nằm ở Còn nợ." + "Xem Còn nợ".

i18n: `delivery.page.*`, `delivery.list.*`, `delivery.detail.*`, `delivery.result.*`.

#### B4 Còn nợ — `/admin/backlog?by=item|person&filter=available|left`

- **Vùng:** `PageHeader` (mô tả "Phần chưa giao của các kỳ đã khóa — giao bổ sung khi có hàng, hoặc hủy nợ kèm lý do.", actions segmented "Theo món/Theo người") → `StatRow` 3 thẻ → `FilterNotice` → bảng nhóm.
- **Dữ liệu:** `GET admin/backlog?by=` · `GET admin/lines/:id/deliveries` (ngăn kéo) · `GET admin/items`, `GET item-categories?all=1` (thumb, tông).
- **Thẻ:** Tổng còn nợ (Σ `remaining_qty` đơn vị, "{n} dòng · {m} người", không bấm) · Có hàng để giao bổ sung (số dòng `stock_qty > 0` hoặc ngoài DM; bấm `filter=available`) · Của người đã nghỉ (số dòng `user_status ≠ 'active'`, "nên hủy nợ để đóng phiếu"; bấm `filter=left`).
- **Bảng:** tiêu đề nhóm dính: theo món — thumb, tên, "còn {remaining_qty} {ĐVT}", "Tồn {stock}" hoặc badge "Hết hàng" (ngoài DM: không hiện tồn); theo người — avatar, tên, phòng ban, "Người đã nghỉ". Dòng: (theo món: người · phòng ban / theo người: món) · Kỳ ("Tháng {M}/{Y}") · Còn nợ "còn {remaining} {ĐVT}" + "/ {qty}" · thao tác: secondary sm "Giao bổ sung…" (vô hiệu khi `stock_qty = 0`, chú thích "Hết hàng"), danger sm "Hủy nợ…", icon `u-history` "Lịch sử giao".
- **Hộp thoại Giao bổ sung** (`deliver-more-dialog.tsx`): "Giao bổ sung {món} cho {người}", "Tháng {M} · Còn nợ {r} {ĐVT} · Tồn {s} {ĐVT}", "Số lượng giao" `Stepper` `min 1`, `max = min(r, s)` (ngoài DM: `r`), "Tồn sau khi giao {s − q}", gợi ý "Giao được tối đa {max} {ĐVT} (ít hơn giữa số còn nợ và tồn kho)."; gửi `POST admin/lines/:id/deliver {qty, expected_delivered_qty}`; toast "Đã giao bổ sung {q} {ĐVT} {món} cho {người}". Lỗi như B3, gắn dưới ô số lượng.
- **Hộp thoại Hủy nợ** (`cancel-dialog.tsx`): "Hủy {r} {ĐVT} còn lại của {người}?", "{món} · Tháng {M}. Phần này sẽ không giao nữa; {tên ngắn} thấy lý do trong Lịch sử.", "Lý do hủy nợ *" (`maxLength 500`, gợi ý "Bắt buộc, ít nhất 3 ký tự. Ghi vào Nhật ký."), nút danger đặc "Hủy nợ"; gửi `POST admin/lines/:id/cancel-remaining {reason, expected_delivered_qty, expected_qty}`; `cancelled_now = 0` → toast info "Dòng này không còn nợ."; > 0 → toast "Đã hủy nợ {r} {ĐVT} {món} của {người}". Lỗi: `REASON_REQUIRED` → ô; `STALE_UPDATE {qty, delivered_qty}` → khối "Dòng vừa thay đổi (đăng ký {qty}, đã giao {delivered_qty}) — kiểm tra lại." + cập nhật số trong tiêu đề; `PERIOD_NOT_LOCKED`, `LINE_NOT_REVIEWED`, `LINE_REJECTED`, `LINE_NOT_FOUND` → khối.
- **Ngăn kéo Lịch sử giao** (`deliveries-drawer.tsx`): eyebrow "{món} · Tháng {M}", "Lịch sử giao {người}", 3 số (đăng ký / đã giao / còn nợ hoặc đã hủy), danh sách đợt cũ trước: "Giao {qty} {ĐVT}" · "{giờ} · {actor_name}"; "Đã hủy {cancelled} — {cancel_note}". Chỉ xem.
- **Rỗng:** `es-no-backlog` "Không còn nợ" — "Mọi dòng của các kỳ đã khóa đã giao đủ hoặc đã hủy."

i18n: `delivery.backlog.*`, `delivery.deliverMore.*`, `delivery.cancel.*`, `delivery.history.*`.

AC (E9-S3):
1. Stepper Thực giao: dòng còn 5, tồn 3 → max 3, ở 3 nút + vô hiệu; Playwright giả tồn giảm còn 2 giữa chừng (nhập điều chỉnh qua API) → bấm Giao 3 → server `STOCK_INSUFFICIENT {available: 2}` → câu "Chỉ còn 2" ở dòng. Dòng còn 2, tồn 10 → max 2; e2e api đã có `DELIVER_EXCEEDS_QTY` ở remaining+1.
2. Bấm Giao hai lần nhanh → một movement (single-flight); request thứ hai lọt tới server → dòng hiện câu `STALE_UPDATE` (giữ E4-S1).
3. Giao dòng đã chọn 2 dòng, một dòng hết hàng → khối kết quả 1 giao, 1 không giao được, dòng còn lại vẫn giao.
4. Giao tất cả phiếu đủ kho → toast "Đã giao đủ phiếu của …", phiếu rời danh sách "Chưa giao đủ" sau 600 ms (Playwright chờ biến mất), chọn tự sang phiếu kế.
5. Kỳ chưa khóa (route giả 409 `PERIOD_NOT_LOCKED`) → khối đúng câu.
6. Giao bổ sung: còn 4, tồn 2 → max 2; số 1 và 2 gửi được, 3 không bấm được. Hủy nợ 2/3 ký tự; 500 ký tự gửi được, ký tự 501 không gõ được.
7. Thẻ "Của người đã nghỉ" lọc đúng dòng có nhãn.

Playwright: `E9-S3 Giao hàng: thực giao kẹp theo tồn và còn lại, giao dòng đã chọn, giao tất cả rời bộ lọc` · `E9-S3 Giao hàng bấm đúp: tồn trừ một lần` · `E9-S3 Còn nợ: thẻ lọc, giao bổ sung tối đa min(nợ, tồn), hủy nợ có lý do, lịch sử đợt giao`.

### 5.4 S4 — Báo cáo + Bản in A4 + Excel

#### B5 Báo cáo & in — `/admin/reports?ym=`

- **Vùng:** `PageHeader` (mô tả "Số đặt mua của tháng, xuất Excel và in giấy trình ký. Excel và bản in luôn lấy từ một bản chốt, giao thêm sau đó không làm đổi số đã chốt."; actions: secondary "Xuất Excel" (icon `u-sheet`), primary "In trình ký" (`u-printer`); đang chốt → "Đang chốt…") → hàng tháng (`MonthSwitcher` mặc định kỳ khóa gần nhất, trần kỳ mở; badge "Đã khóa" / "Đang mở · hạn {d}/{M}") → cảnh báo (kỳ mở: info "Kỳ tháng {M} đang mở — số liệu tạm tính theo phiếu đã lưu."; `pending_custom_count > 0`: warn "Còn {n} món ngoài danh mục chưa xem — chưa được tính vào báo cáo này." + "Xem món chờ" → `/admin/review?ym=`; có ô lỗi sau khi bấm chốt: danger "Sửa {n} ô Đặt mua đang lỗi trước khi chốt.") → Phần 1 → Xuất lẻ trong kỳ → Phần 2 → Bản chốt → khối "Cách tính Cần mua".
- **Dữ liệu:** `GET admin/reports/:ym` · `GET admin/reports/:ym/snapshots` · `POST admin/reports/:ym/snapshots {kind, order_qty}` · `GET admin/reports/snapshots/:id/export.xlsx?lang=` (tải qua `apiFetchBlob`) · `GET admin/items` + `GET item-categories?all=1` (nhóm Phần 1, G12).
- **Phần 1 · Tổng hợp theo món:** công tắc "Chỉ món cần mua" (lọc `need > 0` phía trang), nút ghost "Về Cần mua tất cả ({n})" khi có ô sửa; bảng `groupBy` nhóm (theo `category_id` của món từ `admin/items`; món không có trong `admin/items` hoặc không nhóm → "Chưa xếp nhóm" g0), nhóm cuối "Ngoài danh mục (đã chấp nhận)" từ `custom`; cột Món (tên + quy cách) · ĐVT · Chưa giao kỳ này (`requested`) · Nợ kỳ trước (`backlog_prev`) · Tồn (`stock`; ngoài DM "—") · Cần mua (`need`) · **Đặt mua** (ô số `inputMode=numeric`, mặc định = `need`, nền `--c-warn-soft` khi khác `need`, nút nhỏ "Về Cần mua ({need})", gợi ý lỗi "Từ 0 đến 99 999.") · Số người: chỉ hàng ngoài DM (`people`); hàng món để trống (G12). Chân bảng tổng số hàng.
- **Xuất lẻ trong kỳ:** "Xuất ngoài phiếu tháng, đã trừ tồn ở Kho. In kèm trong bản chốt." + liên kết "Mở Kho"; cột Món · Người nhận (`recipient_name` hoặc "Dùng chung") · SL · Lý do · Lúc.
- **Phần 2 · Chi tiết theo phòng ban:** "Theo phòng ban ghi trên phiếu lúc lưu."; segmented/chip phòng ban (mỗi phòng ban + số người; "Tất cả"); bảng Người · Món đăng ký ("{tên} {qty} · …") · Tổng. Cột "Đã giao" và mã NV **bỏ** (G13).
- **Bản chốt:** "Mỗi lần Xuất Excel hoặc In trình ký tạo một bản chốt."; mỗi bản: icon theo loại, "Excel"/"Bản in", badge "Mới" cho bản vừa tạo trong phiên, "Lập {created_at} · {created_by_name}", icon button "Tải lại Excel lập {giờ}" (`export.xlsx?lang=<ngôn ngữ UI>`) hoặc "In lại bản lập {giờ}" (mở `/admin/reports/snapshots/:id/print` tab mới). Rỗng: "Chưa có bản chốt nào."
- **Chốt:** bấm Xuất Excel/In trình ký → kiểm ô lỗi phía trang (định dạng 0–99999, cùng giới hạn server; server vẫn kiểm) → nếu `pending_custom_count > 0` hộp thoại "Còn {n} món ngoài danh mục chưa xem" ("Các món này chưa được tính vào báo cáo. Chốt bây giờ thì bản chốt không có chúng." · "Xem món chờ" / "Vẫn chốt") → `POST …/snapshots {kind, order_qty}` (chỉ gửi ô khác `need`) → Excel: tải tệp ngay, toast "Đã xuất Excel tháng {M}/{Y} · bản chốt {hh:mm}"; In: toast "Đã tạo bản in … · bản chốt {hh:mm}" + action "Mở bản in". Đổi tháng khi có ô sửa → `useConfirm` "Bỏ số Đặt mua đã sửa?" ("Bạn đã sửa {n} ô Đặt mua của tháng {M} nhưng chưa chốt. Sang tháng khác sẽ bỏ các số này." · Tiếp tục sửa / Bỏ thay đổi).
- **Lỗi:** `VALIDATION {fields: ['order_qty.<key>']}` → ô Đặt mua của hàng `key`; `INVALID_PERIOD` → trang `LoadError`/về tháng mặc định; tải Excel lỗi → khối trong mục Bản chốt "Không tải được tệp — thử lại."

#### B6 Bản in A4 — `/admin/reports/snapshots/:id/print`

- Không shell; `useShellFont('admin')`; `IconSprite`. Thanh công cụ màn hình (`aria-label` "Thanh công cụ bản in (không in ra giấy)", ẩn khi in): "Quay lại" (→ `/admin/reports?ym=`), "Bản in tháng {M}/{Y} · bản chốt {hh:mm dd/MM} · A4 dọc", primary "In" (`window.print()`).
- Tờ (đen trắng, không dùng màu nhóm): đầu "Công ty Phú Mỹ Hưng" / "Phòng Công trình · Văn phòng phẩm"; phải "Lập lúc {hh:mm} ngày {dd/MM/yyyy} bởi {created_by.name}" + "Bản chốt số {k} của kỳ" (k = vị trí của `id` trong `GET admin/reports/:ym/snapshots` sắp cũ trước) + "· Đặt mua mặc định" khi mọi `order_qty = need` (dẫn xuất); tiêu đề "Báo cáo văn phòng phẩm tháng {M}/{Y}"; dòng "{n} phiếu · {m} món có đăng ký" (n = số người trong `byDepartment`, m = số hàng `byItem` + `custom`).
- Phần 1: TT · Món · ĐVT · Chưa giao kỳ này · Nợ kỳ trước · Tồn · Cần mua · Đặt mua (`order_qty[key]`) · Số người (chỉ ngoài DM); **không** nhóm theo danh mục sống (bản chốt phải đứng yên) — thứ tự như bản chốt, nhóm "Ngoài danh mục (đã chấp nhận)" cuối; tiêu đề cột lặp mỗi trang (`thead { display: table-header-group }` sẵn có). Dòng công thức "Cần mua = Chưa giao kỳ này + Nợ kỳ trước − Tồn (không âm)".
- Xuất lẻ trong kỳ: TT · Món · Người nhận · SL · Lý do · Ngày.
- Phần 2: Phòng ban · Người · Món đăng ký · Tổng.
- Chân: "TP. Hồ Chí Minh, ngày … tháng … năm {Y}", 3 ô ký "Người lập" / "Trưởng phòng" / "Duyệt" "(Ký, ghi rõ họ tên)" + tên từ `signers` (trống → dòng chấm); dòng cuối "VPP Công trình · Bản chốt lập {…} — số liệu không đổi khi giao thêm". `@page A4 portrait; margin 14mm` giữ.
- Lỗi: `SNAPSHOT_NOT_FOUND` → `NotFound`; `VALIDATION` (id sai) → `NotFound`.

i18n: `reports.page.*`, `reports.part1.*`, `reports.issues.*`, `reports.part2.*`, `reports.snapshots.*`, `reports.print.*`.

AC (E9-S4):
1. Ô Đặt mua: 0 và 99999 hợp lệ; −1, 100000, 1.5, chữ → lỗi tại ô "Từ 0 đến 99 999.", nút chốt báo "Sửa {n} ô…" và không gửi; e2e api đã có biên `order_qty` 99999/100000 (giữ).
2. `pending_custom_count = 1` → hộp thoại trước khi chốt; "Xem món chờ" không tạo bản chốt; "Vẫn chốt" tạo một bản.
3. Xuất Excel → tệp `vpp-bao-cao-<ym>.xlsx` tải về, danh sách bản chốt thêm 1; "Tải lại" không thêm bản (đếm `GET …/snapshots` không đổi).
4. Trang in hiện đúng tên người ký từ bản chốt; giao thêm sau chốt → số trên trang in không đổi; "Bản chốt số 2 của kỳ" khi là bản thứ hai.
5. Đổi tháng khi có ô sửa → hỏi; "Tiếp tục sửa" giữ tháng và số.

Playwright: `E9-S4 Báo cáo: Đặt mua biên 0/99999/100000, chốt hỏi món chưa xem, Excel tải về và tải lại không tạo bản mới` · `E9-S4 Bản in A4: ô ký, số chốt không đổi sau giao thêm, in lại không tạo bản mới` (giữ E5-S2/E5-S3).

### 5.5 S5 — Danh mục + Nhóm món + Kho

#### B8 Danh mục — `/admin/catalog?cat=&q=&inactive=1&filter=low|out|noimage`

- **Vùng:** `PageHeader` (mô tả "Nhân viên thấy món theo đúng thứ tự nhóm dưới đây. Mỗi món cần ảnh để nhân viên chọn bằng mắt."; actions secondary "Nhóm món" → `/admin/categories`, primary "Thêm món") → `StatRow` (Đang dùng "{n} món · {k} nhóm" bấm = bỏ lọc · Sắp hết · Hết hàng · Thiếu ảnh "nhân viên không chọn được") → thanh công cụ (ô tìm "Tìm trong {n} món", công tắc "Hiện món đã ngừng ({n})", nút "Thu tất cả/Mở tất cả") hoặc `BulkBar` khi có chọn → chip nhóm (Tất cả nhóm + mỗi nhóm có chấm tông + đếm; `aria-pressed`) → `FilterNotice` → bảng.
- **Dữ liệu:** `GET admin/items` · `GET item-categories?all=1` · `GET admin/periods/{kỳ mở}/requests?by=item` (số người đăng ký kỳ này trong ngăn kéo, D13) · `PATCH admin/items/:id` · `POST admin/items` · `DELETE admin/items/:id` · `POST files {purpose: item_image}`.
- **Bảng** `groupBy` nhóm (theo thứ tự nhóm; tiêu đề dải tông nhóm 52: thumb trắng mờ, tên, "{n} món · {k} sắp hết · {h} hết hàng", "+ Thêm món vào nhóm", chevron; checkbox "Chọn cả nhóm {tên}" lửng): checkbox · Món (thumb 36, tên + quy cách, badge "Chỉ Hành chính"/"Thiếu ảnh"/"Ngừng") · ĐVT · Tối đa/tháng (`InlineNumber`, `aria-label` "Sửa tối đa/tháng của {tên}, đang là {n}") · Tồn kho (`stock_qty` + nhãn trạng thái) · Dùng (công tắc `role="switch"` `aria-label` "Ngừng {tên}"/"Mở lại {tên}", qua `useConfirm` "Ngừng {tên}?" — "Nhân viên không thấy món này từ bây giờ; phiếu đã lưu giữ nguyên.") · icon "Sửa {tên}". Món đã ngừng: chữ muted, ảnh xám. Bấm hàng = ngăn kéo.
- **Sửa tại chỗ tối đa/tháng:** Enter → `PATCH {max_qty}` → toast "Đã lưu tối đa {n} cho {tên}"; lỗi `VALIDATION {fields:['max_qty']}` → câu "Tối đa từ 1 đến 999." trong hàng.
- **Hàng loạt** (D12): "Đổi tối đa/tháng" (hộp thoại một ô 1–999), "Chuyển nhóm" (chọn nhóm đích), "Ngừng" (xác nhận danger) → lần lượt `PATCH admin/items/:id` từng món đã chọn; xong → toast "Đã đổi tối đa/tháng của {n} món" (hoặc chuyển/ngừng); món lỗi giữ chọn, hàng lỗi hiện câu lỗi, toast warn "Đã đổi {a}/{n} món — xem dòng lỗi.".
- **Ngăn kéo Thêm/Sửa món** (`item-form.tsx` chuyển từ Dialog sang `Drawer` 384; tách `item-drawer.tsx` + `item-fields.tsx`): eyebrow "{nhóm} · thứ {k}", tiêu đề tên món/"Thêm món", ↑/↓ "Món trước/Món sau"; khối "Cần thêm: {ảnh, tên…}." khi gửi thiếu; Ảnh món * (`image-field.tsx`: khung 96 nét đứt "Chụp hoặc chọn ảnh", có ảnh → ảnh trên nền tông nhóm + "Đổi ảnh"/"Xóa ảnh", gợi ý "JPG/PNG tới 5 MB. Nhân viên chọn món bằng ảnh nên ảnh là bắt buộc."; nén `image-compress.ts` sẵn có); Tên món * (≤ 120); Tên tiếng Anh (≤ 120); ĐVT * (`UnitSelect`); Quy cách (≤ 120); Nhóm * (chip tông); Tối đa mỗi tháng * (1–999, mặc định `config.default_max_qty`); Thứ tự hiển thị (số nguyên); "Chỉ Hành chính được đặt" (công tắc + giải thích); chỉ khi sửa: "Tồn hiện có {n} {ĐVT}" + "Mở Kho", "Đăng ký kỳ tháng {M}: {people} người". Dòng "Sửa lần cuối …" **bỏ** (G18). Chân: Hủy / "Lưu thay đổi" (sửa) hoặc "Thêm món". Món chưa từng vào phiếu: nút ghost danger "Xóa món" (xác nhận) → `DELETE`, `ITEM_IN_USE` → câu "Món đã có trong phiếu — chỉ ngừng được.".
- **Lỗi:** `IMAGE_REQUIRED` → ô ảnh; `FILE_TOO_LARGE`/`FILE_TYPE_INVALID`/`FILE_FORBIDDEN` → ô ảnh; `UNIT_REQUIRED` → ô ĐVT; `VALIDATION {fields}` → ô; `CATEGORY_NOT_FOUND` → ô nhóm; `ITEM_CODE_EXISTS` → khối (mã không có ô trên UI mới — giữ trường `code` không hiển thị); `ITEM_NOT_FOUND` → khối.
- **Rỗng:** `es-no-match` "Không có món nào khớp" — "Thử tên khác hoặc bỏ lọc. Món chưa có thì thêm vào danh mục." + "Bỏ lọc" + "Thêm món".

#### B9 Nhóm món — `/admin/categories`

- **Vùng:** breadcrumb "Kho & danh mục › Danh mục › Nhóm món", h1 "Nhóm món", mô tả "Thứ tự nhóm quyết định thứ tự trên trang Đăng ký và màu của từng nhóm.", actions secondary "Về Danh mục", primary "Thêm nhóm" → dải "Thứ tự đã đổi ({n} nhóm)" + "Hoàn về" + primary "Lưu thứ tự" (khi bẩn; lúc đó "Thêm nhóm" thành secondary) → bảng + cột xem trước bên phải (320: "Nhân viên sẽ thấy" hàng chip theo thứ tự; "Màu theo thứ tự" 7 ô; chú thích "Màu theo vị trí, kể cả nhóm đã ngừng — ngừng một nhóm không làm đổi màu nhóm khác. Từ nhóm thứ 8 màu lặp lại.").
- **Dữ liệu:** `GET item-categories?all=1` · `GET admin/items` (số món mỗi nhóm) · `POST|PATCH admin/item-categories`.
- **Bảng:** Thứ tự (nút "Đưa {tên} lên"/"Đưa {tên} xuống" + số vị trí) · Màu (chấm tông + `title` tên màu) · Tên nhóm (sửa tại chỗ chữ: Enter lưu `PATCH {name}`, Esc bỏ) · Tên tiếng Anh (sửa tại chỗ) · Số món · Trạng thái (badge "Đang dùng"/"Ngừng") · công tắc "Ngừng {tên}"/"Mở lại {tên}" (`PATCH {active}`).
- **Lưu thứ tự** (D12): gán `sort_order = (vị trí)*10` cho mọi nhóm đổi vị trí, lần lượt `PATCH admin/item-categories/:id {sort_order}`; toast "Đã lưu thứ tự {n} nhóm"; lỗi giữa chừng → toast warn + tải lại danh sách (thứ tự server là chuẩn).
- **Hộp thoại Thêm nhóm:** Tên nhóm * (≤ 120), Tên tiếng Anh; "Nhóm mới đứng thứ {k} và nhận màu {tên màu}." (dẫn xuất `groupTone`); `POST {name, name_en, sort_order: max+10}`.
- **Lỗi:** `CATEGORY_EXISTS` → ô tên "Đã có nhóm tên này."; `VALIDATION` → ô; `CATEGORY_NOT_FOUND` → khối.
- **Rỗng:** "Chưa có nhóm nào" + "Thêm nhóm".

#### B7 Kho — `/admin/stock?filter=low|out&q=`

- **Vùng:** `PageHeader` (mô tả "Tồn kho từng món và mọi lần nhập, điều chỉnh, xuất lẻ. Giao hàng tự trừ tồn.", action secondary "Danh mục") → `StatRow` (Đang theo dõi "{n} món" bấm bỏ lọc · Sắp hết bấm `filter=low` · Hết hàng bấm `filter=out` · Còn nợ "{Σ} đơn vị · {k} món" (D10, không bấm)) → ô tìm ("/") → `FilterNotice` → bảng.
- **Dữ liệu:** `GET admin/items` (món `active`) · `GET admin/stock/low` · `GET admin/backlog?by=item` (cột Còn nợ) · `GET admin/items/:id/movements?limit=20&cursor=` · `POST admin/items/:id/stock` · `POST admin/items/:id/issue` · `GET admin/users` (người nhận, tên người thao tác qua `useDirectoryNames`).
- **Bảng:** Món (thumb, tên — nút "Mở sổ cái {tên}", nhóm) · ĐVT · Tồn kho (`stock_qty`; không có "mức an toàn", G15) · Trạng thái (badge "Hết hàng" danger / "Sắp hết" warn / "Đủ dùng" ok / không nhãn khi `untracked`) · Còn nợ (Σ `remaining_qty` của nhóm `item_id` trong backlog, 0 → "—") · thao tác "Nhập mua…", "Điều chỉnh…", "Xuất lẻ…" (vô hiệu khi tồn 0, `title` "Hết hàng — nhập mua trước"), icon "Sổ cái {tên}".
- **Hộp thoại Nhập mua / Điều chỉnh / Xuất lẻ** (`stock-dialogs.tsx`, 520; tách mỗi loại một tệp nếu > 250 dòng): tiêu đề "Nhập mua {tên}" / "Điều chỉnh tồn {tên}" / "Xuất lẻ {tên}"; "Tồn hiện tại {s} {ĐVT}" · "Tồn sau khi lưu {s'}"; ô số: Nhập mua "Số lượng nhập *" (nguyên ≥ 1); Điều chỉnh "Thay đổi *" (nguyên khác 0, "giảm thì thêm dấu trừ (VD -2)"); Xuất lẻ "Số lượng *" (1…tồn); Xuất lẻ thêm "Người nhận *" (`UserPicker`) hoặc ô chọn "Dùng chung"; "Ghi chú" (Nhập mua, tùy chọn) / "Lý do *" (Điều chỉnh, Xuất lẻ), `maxLength 500`. Nút "Lưu nhập mua"/"Lưu điều chỉnh"/"Xuất lẻ". Gửi `POST …/stock {delta, reason: purchase|adjust, note}` hoặc `POST …/issue {qty, recipient_sub?, reason}`; toast "Đã nhập {n} {ĐVT} {tên}" / "Đã điều chỉnh tồn {tên}: {±n}" / "Đã xuất lẻ {n} {ĐVT} {tên} cho {người|Dùng chung}".
- **Lỗi:** `VALIDATION {fields:['delta'|'qty'|'note'|'reason']}` → ô; `REASON_REQUIRED` → ô lý do; `STOCK_INSUFFICIENT {available}` → ô số "Chỉ còn {available} {ĐVT}."; `USER_INACTIVE`/`USER_NOT_FOUND` → ô người nhận; `ITEM_NOT_FOUND` → khối.
- **Ngăn kéo Sổ cái** (`movements-drawer.tsx`): eyebrow "{nhóm} · {ĐVT}", "Sổ cái · {tên}", số tồn lớn + trạng thái, "Còn nợ: {n}"; dòng mới trước: nhãn loại ("Nhập mua" / "Điều chỉnh" / "Xuất lẻ · {người nhận|Dùng chung}" badge info / "Giao" / "Hoàn" — `return`), "{giờ} · {người thao tác}", ghi chú, "±{delta}" (+ ok, − danger chữ), "tồn {sau}" (D11); "Xem thêm" theo `next_cursor`; chân: ba nút thao tác.
- **Rỗng:** lọc Sắp hết rỗng → "Không có món nào sắp hết" + "Xem tất cả món".

i18n: `catalog.page.*`, `catalog.table.*`, `catalog.bulk.*`, `catalog.drawer.*`, `catalog.categories.*`, `stock.page.*`, `stock.dialog.*`, `stock.ledger.*`.

AC (E9-S5):
1. Tối đa/tháng sửa tại chỗ: 1 và 999 lưu; 0 và 1000 → câu lỗi trong hàng từ `VALIDATION`; Esc trả giá trị cũ, không gọi API.
2. Tên món 120 ký tự lưu; 121 → lỗi ô `name`. Ảnh 5 MB sau nén vẫn qua (e2e api đã có 5 MB / 5 MB + 1 → 413 `FILE_TOO_LARGE`); thiếu ảnh → "Cần thêm: ảnh." và ô ảnh `aria-invalid`.
3. Hàng loạt đổi tối đa 2 món → 2 `PATCH`, bảng cập nhật, toast; một món lỗi → giữ chọn món đó.
4. Nhóm: đổi thứ tự rồi "Lưu thứ tự" → tải lại trang vẫn đúng thứ tự, chấm màu đổi theo vị trí; tạo nhóm trùng khác hoa thường → `CATEGORY_EXISTS` tại ô.
5. Xuất lẻ: tồn 3 → số 3 gửi được; 4 → `STOCK_INSUFFICIENT` "Chỉ còn 3" tại ô (server); điều chỉnh −3 với tồn 3 → tồn 0 badge "Hết hàng"; −4 → lỗi tại ô. Lý do rỗng (Điều chỉnh) → `REASON_REQUIRED` tại ô; 500 ký tự gửi được.
6. Sổ cái: sau nhập 10 rồi xuất 3 → 2 dòng, dòng mới "tồn 7", dòng cũ "tồn 10".
7. Thẻ Sắp hết lọc qua URL `?filter=low` (chuông `low_stock` mở đúng lọc — giữ).

Playwright: `E9-S5 Danh mục: sửa tại chỗ tối đa 0/1/999/1000, thêm món có ảnh trong ngăn kéo, hàng loạt đổi tối đa` · `E9-S5 Nhóm món: đổi thứ tự, màu theo vị trí, trùng tên` · `E9-S5 Kho: nhập 10, xuất lẻ 3 rồi 4 bị chặn, sổ cái tồn sau từng dòng`.

### 5.6 S6 — Danh bạ + Nhật ký + Cấu hình

#### B10 Danh bạ — `/admin/users?q=&dept=&status=active|never|locked`

- **Vùng:** `PageHeader` (breadcrumb "Hệ thống", mô tả "Người dùng đồng bộ từ PMH ID. Thông tin cá nhân sửa ở PMH ID, không sửa trong app.", action primary "Đồng bộ ngay" — đang chạy "Đang đồng bộ…") → khối kết quả đồng bộ (ok: "Đã đồng bộ từ PMH ID: {created} người mới, {updated} cập nhật." + nút đóng; lỗi `SSO_UNAVAILABLE`/5xx: danger "Không liên lạc được PMH ID — thử lại sau ít phút." + "Thử lại") → `StatRow` 3 thẻ + thẻ chú thích "Tự đồng bộ từ PMH ID mỗi 60 phút." (thẻ "Đồng bộ lần cuối {giờ}" **bỏ**, G22) → thanh công cụ (ô "Tìm người" placeholder "Tìm theo tên, email hoặc mã NV" ≤ 200, nút xóa ô; chọn "Phòng ban" Mọi phòng ban + danh sách dẫn xuất) → "Hiện {shown} / {total} người" + `FilterNotice` → bảng.
- **Dữ liệu:** `GET admin/users?search=&limit=200&cursor=` tải hết các trang (như `useDirectoryNames`) cho thẻ số liệu và lọc phòng ban/trạng thái phía trang (D14); `POST admin/directory/sync`.
- **Thẻ:** Đang dùng (`status = active`) · Chưa đăng nhập lần nào (`lastLoginAt = null`) · Đã khóa (`status = locked`); mỗi thẻ bấm lọc.
- **Bảng:** Họ tên (avatar, tên, email) · Mã NV · Phòng ban · Nhóm PMH ID (badge từng nhóm) · Trạng thái (badge "Đang dùng" ok / "Đã khóa" danger) · Lần đăng nhập cuối ("hh:mm dd/MM/yyyy" / "Chưa đăng nhập"). Badge "Mới" **bỏ** (G23). Bấm hàng → ngăn kéo.
- **Ngăn kéo Thông tin người dùng:** eyebrow "Danh bạ · người {k}", ↑/↓ "Người trước/Người kế tiếp"; avatar, tên, phòng ban; danh sách Email · Mã nhân viên · Phòng ban · Nhóm PMH ID · Trạng thái · Đăng nhập cuối; "Dữ liệu từ PMH ID, không sửa trong app."; `status = locked` → cảnh báo "Tài khoản đã khóa ở PMH ID — không đăng nhập được. Phần còn nợ của người này hiện nhãn "Người đã nghỉ" ở Còn nợ."; liên kết "Xem nhật ký" → `/admin/audit?actor=<sub>`; chân "Đóng". Mục "Vai trò trong app" và "Phiếu văn phòng phẩm" **bỏ** (G25).
- **Rỗng:** "Không có ai khớp tìm kiếm." — "Thử tên không dấu, email hoặc mã NV. Người mới vào công ty sẽ có sau lần đồng bộ kế tiếp." + "Bỏ lọc".

#### B11 Nhật ký — `/admin/audit?actor=&action=&from=&to=`

- **Vùng:** `PageHeader` (mô tả "Mọi thay đổi dữ liệu và lần đăng nhập, mới nhất trước. Chỉ xem — không sửa hay xóa được.") → khối lọc (`aria-label` "Lọc nhật ký"): Người thực hiện (`UserPicker` + lựa chọn "Hệ thống (tự động)" = `actor=system`), Hành động (select nhãn tiếng Việt từ `audit-actions.ts`, "Mọi hành động"), Từ ngày, Đến ngày (lỗi tại ô "“Đến ngày” phải bằng hoặc sau “Từ ngày”."), primary "Lọc", ghost "Xóa lọc"; hàng "Nhanh:" chip "Hôm nay" · "7 ngày qua" · "Tháng {M}/{Y}" (tháng hiện tại theo giờ VN) · "Đăng nhập bị từ chối" (action tương ứng trong `audit-actions.ts`) — chip lọc ngay; chỉnh tay thì bấm Lọc → "{n} dòng nhật ký" + `FilterNotice` → bảng.
- **Dữ liệu:** `GET admin/audit?actor&action&from&to&limit=50&cursor` (D15: nhóm theo ngày, tính khoảng ngày nhanh, bảng Trước/Sau đều dẫn xuất phía client).
- **Bảng:** dòng tiêu đề ngày dính ("Thứ … dd/MM/yyyy" + số dòng) → Thời gian (hh:mm:ss) · Người (avatar, `actorName ?? actor`) · Hành động (nhãn + mã thô `--t-cap` muted) · Đối tượng (`objectType` + `objectId` rút gọn) · Chi tiết (nút "Xem"/"Thu" `aria-expanded`). Mở rộng: nếu `detail.before`/`detail.after` là object → bảng Trường · Trước · Sau chỉ các khóa khác nhau; khóa khác → cặp khóa–giá trị; dưới cùng JSON gọn Trước/Sau và "Mã sự kiện #{id}".
- "Xem thêm" theo `next_cursor`; hết → "Đã hiện hết nhật ký trong khoảng lọc."
- **Lỗi:** `VALIDATION {fields:['from'|'to']}` → ô ngày tương ứng.
- **Rỗng:** "Không có dòng nhật ký nào khớp bộ lọc." — "Nới khoảng ngày hoặc chọn "Mọi hành động" để xem rộng hơn." + "Xóa lọc".

#### B12 Cấu hình — `/admin/config`

- **Vùng:** `PageHeader` (mô tả "Tham số chung của app. Mỗi khối lưu riêng; mọi lần lưu được ghi vào Nhật ký.", phải: "{n} khối chưa lưu" khi bẩn) → lưới `1fr 300px`: trái 4 khối (`config-section.tsx` restyle: thẻ `--r-lg`, khối đang sửa có vạch trái `--c-warn-fill` 4 px; chân khối: trạng thái "Đang lưu…"/"Đã lưu." + Hủy + nút chính riêng), phải cột "Lưu thế nào" (3 câu) + "Thay đổi gần đây" (3 dòng mới nhất `GET admin/audit?action=config.updated&limit=3`: giờ · người, liên kết "Xem trong Nhật ký").
- **Khối Kỳ đăng ký:** "Ngày hạn đăng ký hằng tháng" (ô số + nút "Lùi một ngày"/"Thêm một ngày", "hằng tháng", gợi ý "Từ ngày 3 đến ngày 28."); "Số lượng tối đa mặc định mỗi món" (đơn vị/tháng, "Gợi ý sẵn khi thêm món mới, từ 1 đến 999."); cảnh báo info "Chỉ áp dụng cho kỳ tạo sau; kỳ đang mở giữ hạn cũ (tháng {M} vẫn khóa 00:00 ngày {d}/{M})." (từ `periods/current.deadline`); xem trước lịch tháng kế ("Mở đăng ký" ngày 1…n, "Ngày hạn (đến 23:59)" ngày n, "Đã khóa · Hành chính giao hàng" từ n+1) vẽ thuần từ số đang nhập — minh họa, không phải luật (server tính hạn thật); số ngoài 3–28 → thay lịch bằng "Nhập ngày hạn hợp lệ để xem trước". Nút "Lưu kỳ đăng ký".
- **Khối Quyền Hành chính:** "Nhóm PMH ID của Hành chính" (≤ 200, gợi ý "Người thuộc nhóm này vào được trang quản lý." + "{n} người trong danh bạ thuộc nhóm này" — dẫn xuất từ `GET admin/users` khớp không phân biệt hoa thường); n = 0 → cảnh báo warn "Nhóm này chưa có người trong danh bạ. Sau khi lưu, {tên bạn} sẽ mất quyền vào trang quản lý từ lần bấm kế tiếp." (chỉ khi người đang đăng nhập không thuộc nhóm mới); "Nhóm PMH ID được dùng app" chỉ đọc (badge từng nhóm + số người) "Lấy từ PMH ID khi đồng bộ danh bạ — không sửa ở đây." + "Mở Danh bạ". Lưu nhóm Hành chính hỏi xác nhận (danger) "Đổi nhóm Hành chính?" vì có thể tự khóa mình. Nút "Lưu quyền Hành chính".
- **Khối Người ký báo cáo:** Người lập · Trưởng phòng · Người duyệt (mỗi ô ≤ 200); xem trước 3 ô ký như bản in ("Để trống thì in dòng chấm để ký tay"); "Bản chốt đã in giữ tên cũ." Nút "Lưu người ký".
- **Khối Liên hệ & thông báo:** "Tên và cách liên hệ Hành chính" (textarea ≤ 500, đếm "{n}/500", gợi ý "Hiện ở trang Tôi và trang “Chưa được cấp quyền”. VD: chị Bình — Hành chính, máy lẻ 123."); công tắc "Báo Hành chính khi món sắp hết" + "Hiện có {n} món sắp hết." (`GET admin/stock/low`). Nút "Lưu liên hệ".
- **Gửi:** `PUT admin/config` chỉ các khóa của khối (giữ `config-form.ts`); thành công → "Đã lưu." trong chân khối + toast "Đã lưu {tên khối}". Rời trang khi bẩn → "Bỏ thay đổi chưa lưu?" liệt kê khối.
- **Lỗi:** `CONFIG_INVALID {field}` → ô theo `field` (`registration_last_day` "Nhập số từ 3 đến 28.", `default_max_qty` "Nhập số nguyên từ 1 đến 999.", `admin_group` "Nhập tên nhóm PMH ID (không để trống, tối đa 200 ký tự).", `signers.*`, `admin_contact`); `VALIDATION` → ô.

i18n: `users.page.*`, `users.drawer.*`, `audit.page.*`, `audit.quick.*`, `audit.detail.*`, `config.page.*`, `config.period.*`, `config.access.*`, `config.signers.*`, `config.contact.*`.

AC (E9-S6):
1. Ngày hạn 3 và 28 lưu được; 2 và 29 → lỗi tại ô từ `CONFIG_INVALID` (nút ± dừng ở 3/28 nhưng gõ tay vẫn gửi được để server quyết); tối đa mặc định 1/999 qua, 0/1000 lỗi.
2. Người ký 200 ký tự lưu; 201 → lỗi ô; liên hệ 500 lưu, ô không nhận ký tự 501, đếm "500/500".
3. Lưu `admin_contact` → trang "Chưa được cấp quyền" hiện đúng tên (giữ E0-S8); "Thay đổi gần đây" thêm một dòng.
4. Nhật ký: Đến ngày < Từ ngày → lỗi tại ô, không gọi API; chip "Hôm nay" gửi `from = to =` ngày VN hôm nay; "Xem thêm" xuất hiện khi trang trả `next_cursor` (51 dòng seed → 50 + nút; 50 dòng → không nút).
5. Danh bạ: "Đồng bộ ngay" khi PMH ID không liên lạc được → khối lỗi, bảng vẫn còn (giữ E0-S7); ô tìm 200 ký tự gửi được, 201 không gõ được.

Playwright: `E9-S6 Danh bạ: thẻ lọc trạng thái, đồng bộ lỗi PMH ID bảng vẫn còn, ngăn kéo người` · `E9-S6 Nhật ký: lọc nhanh Hôm nay, khoảng ngày sai báo tại ô, mở Trước/Sau` · `E9-S6 Cấu hình: ngày hạn 2/3/28/29, liên hệ 500 ký tự, mỗi khối lưu riêng`.

### 5.7 S7 — Hành chính ở 390 px

Áp cho mọi màn đã port; thực hiện sau S6 nhưng mỗi lát S2–S6 đã phải chạy được ở 390 (không cuộn ngang, thao tác chính làm được) — S7 hoàn thiện bố cục theo B13.

- **Thanh trên** (`admin-topbar.tsx`, cao 56 + safe-area, nền surface, viền dưới): nút "Mở menu quản lý" (icon `u-menu`, 44) · tiêu đề trang + dòng phụ (vd "Tháng 10/2026 · đã khóa") · chuông · avatar (`aria-label` "{tên}, Hành chính"). Ở màn chi tiết (Giao hàng phiếu) nút trái thành "Quay lại danh sách phiếu" (`u-back`).
- **Menu sheet trái** (Radix Dialog, rộng `min(320px, 88vw)`, tiêu đề "Menu quản lý", "VPP Công trình · Hành chính", nút "Đóng menu"): đúng các mục sidebar §4.1 + thẻ kỳ + ngôn ngữ + Đăng xuất; chọn mục → đóng.
- **Bảng → danh sách thẻ hàng** (`DataTable` prop sẵn có `stackOnMobile`, restyle): mỗi hàng một thẻ: ảnh/avatar, tên, số chính, một hành động; tiêu đề nhóm vẫn dính.
- **Thẻ số liệu:** hàng cuộn ngang, thẻ rộng 160.
- **Ngăn kéo → sheet toàn màn**, hộp thoại → sheet đáy (góc trên `--r-xl`, tay nắm), nút 48 dính đáy.
- **Giao hàng 390:** màn danh sách (segmented "Chưa giao đủ ({n})"/"Tất cả ({n})", dải "{full}/{total} phiếu đã giao đủ · đã khóa 11/{M}", "{k} món thiếu kho — phần thiếu chuyển sang Còn nợ") → chạm hàng (`aria-label` "Mở phiếu của {tên}, đã giao {a} trên {b} dòng") mở màn chi tiết toàn màn (URL `?request=`); mỗi dòng: thumb, tên, "Thực giao" stepper, badge; chân dính "Giao tất cả" + dòng kết quả. Giao đủ → "Đã giao đủ phiếu · Đã báo cho {tên}." rồi tự về danh sách sau 1,4 s.
- Toast nằm trên mép dưới 16 px; nội dung có `padding-bottom` đủ cho chân dính.

i18n: `nav.mobile.*` ("Mở menu quản lý", "Menu quản lý", "Đóng menu", "Quay lại danh sách phiếu").

AC (E9-S7):
1. Ở 390 px mọi route `/admin/*` không cuộn ngang trang (`document.documentElement.scrollWidth ≤ 390`), trừ vùng cuộn có chủ đích (hàng thẻ số liệu, chip).
2. Mọi trang Hành chính tới được trong ≤ 2 chạm từ bất kỳ trang Hành chính nào (Mở menu → mục).
3. Giao hàng 390: danh sách → chi tiết → Giao tất cả → về danh sách; nút Quay lại về đúng danh sách giữ bộ lọc.
4. axe `color-contrast` sạch ở 390 trên: Tổng hợp, Món ngoài danh mục, Giao hàng (danh sách + chi tiết), Còn nợ, Báo cáo, Kho, Danh mục, Nhóm món, Danh bạ, Nhật ký, Cấu hình, menu sheet mở, một ngăn kéo mở, một hộp thoại mở.
5. Vùng chạm mọi nút ≥ 44×44 (Playwright đo `boundingBox` các `button` hiển thị trên Giao hàng chi tiết và Danh mục).

Playwright: `E9-S7 Hành chính 390: menu sheet ≤ 2 chạm, không cuộn ngang mọi trang` · `E9-S7 Giao hàng 390: danh sách → chi tiết → giao tất cả → về danh sách` · `E9-S7 axe 390 các màn Hành chính`.

## 6. Dữ liệu: khoảng trống API và dẫn xuất phía client

### 6.1 Khoảng trống API (bản mẫu cần, API không có) — 11 mục

| # | Màn · phần tử bản mẫu | Thiếu gì | Khuyến nghị |
|---|---|---|---|
| G1 | B1 nhãn "Hành chính tạo hộ" trên hàng người | `PersonRow` không có `created_by_sub` | **Bỏ khỏi UI.** Tùy chọn API đọc-only: thêm `created_by_admin: boolean` vào `GET admin/periods/:ym/requests?by=person` (Q3) |
| G4 | B1 theo món cột "Cần mua thêm" | Không có ở `by=item`; tự tính `max(0, SL − tồn)` ở FE = nhân bản BR-15 (và sai vì thiếu nợ kỳ trước) | **Bỏ**, thay liên kết "Xem số cần mua ở Báo cáo" |
| G7 | B2 "Trần Hạnh · vừa xong" người/giờ quyết định trên thẻ đã xử lý | `ReviewRow` không có người/giờ review | **Bỏ** khi tải danh sách; chỉ hiện "vừa xong" cho thẻ vừa xử lý trong phiên |
| G8 | B3/B13 nhãn "thiếu kho" trên từng phiếu ở danh sách | `PersonRow` không có thông tin tồn theo phiếu | **Bỏ** ở danh sách; hiện trong chi tiết phiếu (dẫn xuất D4) |
| G12 | B5/B6 cột "Số người" cho hàng món; Phần 1 bản in nhóm theo danh mục | `ReportItemRow` không có `people` (chỉ `ReportCustomRow` có); bản chốt không lưu nhóm, ghép nhóm sống làm bản chốt đổi theo danh mục | **Bỏ** "Số người" ở hàng món (giữ cho ngoài DM); **bản in danh sách phẳng** theo thứ tự bản chốt, trang Báo cáo sống vẫn nhóm (D7); tùy chọn API thêm `people` + `category_name` vào hàng báo cáo/bản chốt (Q3) |
| G13 | B5/B6 Phần 2 cột "Đã giao", mã NV | `byDepartment.people.lines` chỉ có `qty` | **Bỏ** |
| G15 | B7 "an toàn ≥ n", "mức an toàn" | `min_stock` đã bỏ (migration 0107); `restock_level` là mốc nội bộ FR-50 | **Bỏ**; trạng thái lấy từ `stock_state` |
| G18 | B8 "Sửa lần cuối 14:20 20/10/2026 · Trần Hạnh" | `items` không có `updated_at`/người sửa; `GET admin/audit` không lọc theo `objectId` | **Bỏ** |
| G22 | B10 thẻ "Đồng bộ lần cuối", câu "giữ bản đồng bộ lúc …" | Marker `config.directory_sync_last_at` không có trong `GET admin/config` | **Bỏ**; tùy chọn API trả `directory_sync_last_at` trong `GET admin/config` (Q3) |
| G23 | B10 badge "Mới" sau đồng bộ | Sync chỉ trả `{created, updated}` | **Bỏ** |
| G25 | B10 ngăn kéo "Vai trò trong app", "Phiếu văn phòng phẩm tháng 11/10" | Không có trường vai trong `admin/users`; tính vai ở FE = nhân bản `resolveRole`; phiếu theo người cần truy vấn riêng | **Bỏ** cả hai mục |

Không mục nào bắt buộc thêm API; ba đề xuất API đọc-only tùy chọn gom ở Q3.

### 6.2 Dẫn xuất phía client từ endpoint có sẵn (chỉ hiển thị, server vẫn quyết)

| # | Dẫn xuất | Từ | Ghi chú |
|---|---|---|---|
| D1 | Tông nhóm | `item-categories?all=1` | `lib/group-tone.ts`, luật SYSTEM §2.1 |
| D2 | B1 theo món: tồn, nhóm, ảnh | `admin/items` ghép theo `item_id` | — |
| D3 | B1 KPI "· n hết hàng" | `admin/items` `stock_state='out'` | — |
| D4 | B3 chi tiết: thiếu kho từng dòng, `max` stepper = `min(remaining, stock_qty)` | `admin/requests/:id` + `admin/items` | Chỉ để kẹp nút; server `STOCK_INSUFFICIENT`/`DELIVER_EXCEEDS_QTY` là chuẩn |
| D5 | B3 dải "n món thiếu kho" | `admin/reports/:ym` hàng `need > 0` | Dùng số server tính (BR-15) |
| D6 | B3/B4 "Giao dòng đã chọn" | lặp `POST admin/lines/:id/deliver` | Mỗi dòng một tx độc lập, có `expected_delivered_qty` |
| D7 | B5 nhóm Phần 1 | `admin/items` + `item-categories?all=1` | Chỉ trang sống |
| D8 | B6 "Bản chốt số k", "Đặt mua mặc định", số phiếu/món | `…/snapshots`, dữ liệu bản chốt | — |
| D9 | B2 đếm 4 tab | 4 × `admin/review?status=` | — |
| D10 | B4 thẻ "Có hàng", "Người đã nghỉ"; B7 cột/ thẻ "Còn nợ" | `admin/backlog` | — |
| D11 | B7 sổ cái "tồn sau" | tồn hiện tại − Σ delta các dòng mới hơn (trang tải tuần tự mới trước) | — |
| D12 | B8 hàng loạt, B9 lưu thứ tự | lặp `PATCH` | Mỗi PATCH một audit riêng; lỗi từng món hiện tại hàng |
| D13 | B8 "Đăng ký kỳ này: n người" | `admin/periods/{kỳ mở}/requests?by=item` `people` | — |
| D14 | B10 thẻ, lọc phòng ban/trạng thái | tải hết `admin/users` | Danh bạ ~ vài trăm người |
| D15 | B11 nhóm ngày, khoảng ngày nhanh, bảng Trước/Sau | `admin/audit` | Ngày theo giờ VN |
| D16 | B12 "n người thuộc nhóm", cảnh báo tự mất quyền, "Thay đổi gần đây", "n món sắp hết", lịch xem trước | `admin/users`, `admin/audit?action=config.updated`, `admin/stock/low`, số đang nhập | Lịch xem trước là minh họa |
| D17 | Sidebar đếm | §4.1 | — |

## 7. Kiểm thử và xác minh

### 7.1 Cách làm

- TDD từng thành phần/màn: vitest + Testing Library kiểm hành vi người thấy (nhãn, `aria-pressed`, nút vô hiệu, lỗi gắn đúng ô qua `aria-describedby`), không kiểm lớp CSS. Test hiện có của từng feature giữ và sửa theo nhãn mới; test xóa phải có test mới thay cùng hành vi.
- Mỗi lát: `npm test` + `npm run test:e2e` + `npm run test:db` (api; S0 có thay đổi, S1–S7 phải xanh không đổi), `npm test` + `npm run lint` + `npm run build` (web), `npx madge --circular src` = 0 (api và web), Playwright cả bộ ở 1280 + 390 trên compose dev.
- `web/src/test/i18n-screens.test.tsx` và `locales/parity.test.ts` mở rộng cho key mới; Playwright `E6-S4` (en không còn chữ Việt) chạy lại cho mọi màn Hành chính đã port.
- Mỗi màn thêm một test Playwright "trạng thái lỗi tải": route `/api/admin/...` trả 500 → thấy "Không tải được dữ liệu — thử lại." và nút "Thử lại".
- Báo cáo lát: RED/GREEN (lệnh + output), bảng biên → tầng test, danh sách tệp, điều còn băn khoăn (CLAUDE.md DoD).

### 7.2 Bảng biên (lát nào chạm thì test cả hai phía)

| Giới hạn | Giá trị hai phía | Tầng rẻ nhất có sẵn / thêm | Tầng hiển thị |
|---|---|---|---|
| Vai đổi member↔admin | trước/sau đổi `users.groups` | e2e api (S0, mới) | Playwright E9-S0 |
| Mẫu số loại Hành chính | user có/không `admin_group` (khác hoa thường) | db-spec (S0, mới) | Playwright E9-S2 |
| Lý do điều chỉnh / từ chối / hủy nợ | trim 2 ✗ / 3 ✓; 500 ✓ / 501 ✗ | e2e api (có) | vitest ô + Playwright S2, S3 |
| `qty` dòng phiếu | `max_qty` ✓ / `max_qty+1` ✗; `delivered+cancelled` ✓ / −1 ✗ | e2e api (có) | vitest Stepper + Playwright S2 |
| Thực giao | `min(remaining, stock)` ✓ / +1 ✗ (server) | e2e/db api (có) | vitest Stepper + Playwright S3 |
| Giao `qty` | 1…9999 / 0, 10000 | e2e api (có) | vitest ô |
| Đặt mua | 0, 99999 ✓ / −1, 100000 ✗ | e2e api (có) | vitest + Playwright S4 |
| Tối đa/tháng | 1, 999 ✓ / 0, 1000 ✗ | e2e api (có) | vitest `InlineNumber` + Playwright S5 |
| Tên món/nhóm | 120 ✓ / 121 ✗ | e2e api (có) | vitest + Playwright S5 |
| Ảnh | 5 MB ✓ / 5 MB + 1 → 413 | e2e api (có) | Playwright E2-S5 (có) |
| Xuất lẻ / điều chỉnh âm | `qty = tồn` ✓ / `tồn+1` ✗ | e2e api (có) | Playwright S5 |
| Ngày hạn | 3, 28 ✓ / 2, 29 ✗ | unit + e2e api (có) | Playwright S6 |
| Tối đa mặc định | 1, 999 / 0, 1000 | unit (có) | vitest S6 |
| Người ký / liên hệ | 200 / 201; 500 / 501 | unit (có) | vitest S6 |
| Ô tìm Tổng hợp / Danh bạ | 100 / 101; 200 / 201 | e2e api (có) | vitest `maxLength` |
| Phân trang | 50 dòng (không cursor) / 51 (có "Xem thêm") | e2e api (có) | Playwright S6 Nhật ký |
| Ngày cuối kỳ (thẻ kỳ) | `days_left` 1 / 2 | unit `period.ts` (có) | vitest S1 |
| Điểm gãy | 767/768, 1279/1280 | — | Playwright S1 |
| Toast tự tắt | 3999 ms còn / 4000 ms tắt | vitest fake timers | — |
| Khung xương | 299 ms chưa hiện / 300 ms hiện | vitest fake timers | — |

## 8. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Đổi CSS dùng chung (`ui/*`) làm đổi giao diện Nhân viên | Mọi luật M1 dưới `[data-shell='admin']` + test `m1-scope`; Playwright member không sửa phải xanh; AC1 của S1 đo màu/font trang member |
| Playwright admin hiện có (selector theo nhãn cũ) vỡ hàng loạt | Mỗi lát sửa test của màn mình trong cùng lát; không hạ assertion nghiệp vụ; test bị đổi tên giữ tiền tố story cũ (E3-S2 …) trong tên mới |
| Thao tác lặp phía client (D6, D12) bị lỗi giữa chừng để dữ liệu nửa vời | Mỗi lệnh độc lập, idempotent theo `expected_*`/PATCH; UI báo đúng phần đã làm, giữ chọn phần lỗi; câu hỏi Q5 |
| Tải hết danh bạ (D14) chậm khi danh bạ lớn | Trang 200, tải tuần tự; > 2 000 người thì quay về tìm server (ngưỡng ghi hằng `DIRECTORY_FULL_LOAD_MAX = 2000`) |
| Ngăn kéo không mờ nền nhưng vẫn modal: người dùng tưởng bấm được bảng | Bấm ra ngoài = đóng (hỏi nếu bẩn), trả focus hàng; đúng SYSTEM wow 6 |
| S0 làm hỏng dữ liệu test/seed dùng admin tự đăng ký (`web/playwright/p2-flow.spec.ts`, `p1-flow.spec.ts`, `p3-seed.ts`) | S0 rà mọi spec/seed: phiếu của người là Hành chính seed bằng SQL, người đăng ký trong luồng dùng vai member |
| Hành chính hiện đang có phiếu kỳ mở (dữ liệu thật/dev) | Theo §5.0.4; Q4 |
| Google Fonts bị chặn ở mạng nội bộ | Fallback `system-ui` trong `--font`; giống hiện trạng Nunito/IBM Plex |
| File vượt 400 dòng / component vượt 250 khi port màn lớn (Tổng hợp, Danh mục) | Tách sẵn theo bảng §5 (hàng, ngăn kéo, hộp thoại, thanh công cụ mỗi tệp một trách nhiệm) |

## 9. Câu hỏi cho chủ dự án (5, đã chốt hết)

| # | Câu hỏi | Khuyến nghị |
|---|---|---|
| Q1 | Món ngoài danh mục có **bắt buộc ảnh** không? | **Đã chốt 2026-10-30: không.** Nhân viên chỉ ghi tên + ghi chú, không tải ảnh (luật R7, lát S0). Chuyển thành món mới thì Hành chính tải ảnh món (giữ luật "món mới phải có ảnh"). |
| Q2 | Cho **chốt báo cáo (Excel/In) khi kỳ còn mở** không? API cho; bản mẫu khóa nút. | **Đã chốt 2026-10-30: cho.** In/Excel bản tạm khi kỳ còn mở, kèm cảnh báo "tạm tính" như §5.4 (không đổi API). |
| Q3 | Có thêm **3 trường API đọc-only** để giữ các chi tiết bản mẫu không? (`created_by_admin` ở Tổng hợp theo người — G1; `people` + `category_name` ở hàng báo cáo/bản chốt — G12; `directory_sync_last_at` ở `GET admin/config` — G22) | **Đã chốt 2026-10-30: bỏ.** Port với bản bỏ bớt; cần thì làm một lát API nhỏ sau. |
| Q4 | Phiếu **kỳ đang mở** của người nay là Hành chính (nếu có) xử lý thế nào? | **Đã chốt 2026-10-30: giữ nguyên.** |
| Q5 | Thao tác **hàng loạt** ở Danh mục (đổi tối đa, chuyển nhóm, ngừng) và "Giao dòng đã chọn" chạy bằng nhiều lệnh riêng lẻ có chấp nhận được không (có thể thành công một phần)? | **Đã chốt 2026-10-30: chấp nhận.** |

## 10. Tài liệu cập nhật theo lát

- S0: như §5.0.6.
- S1: `docs/architecture.md` §11 (token: `tokens-m1.css` cho Hành chính, `tokens.css` cũ cho Nhân viên; phạm vi `data-shell`); `design-preview/_SPEC.md` thêm dòng đầu "Phần Hành chính thay bởi `docs/specs/2026-10-30-giao-dien-moi-hanh-chinh.md`"; PRD §7 dòng 156 (hệ thị giác) ghi M1/P3 cho Hành chính; `docs/map.md` dòng `shell`, `ui`.
- S2–S7: `docs/map.md` dòng feature tương ứng (file chính mới, endpoint gọi thêm như `admin/reports/:ym` ở Giao hàng, `admin/backlog` ở Kho); `docs/backlog/epic-9-giao-dien-hanh-chinh.md` đánh dấu story.
- Cuối plan: vẽ lại sơ đồ bằng `archify` (luồng Hành chính mới) vào `docs/diagrams/`, ghi lệch vào `docs/review-spec.md`.
