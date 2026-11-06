# VPP — Plan 3c: Trang Nhân viên theo "Mẫu 1 — Nhân viên đặt hàng" (E10-S0…S6)

> **THAY THẾ bởi `docs/plans/2026-11-05-v2c-nhan-vien.md` (v2-C).** Giữ lại làm nguồn mục "Giữ hành vi hiện có". ⏸ **TẠM HOÃN (2026-11-05)** — xem `docs/quyet-dinh-2026-11-05-luong-hanh-chinh.md`. Chưa làm cho tới khi luồng Hành chính chốt và có người dùng thật thử.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm GỌN trang Nhân viên theo bố cục Mẫu 1 mà chủ dự án đã duyệt: **header mảnh · cột nhóm trái · lưới thẻ dày · giỏ phải**, giữ màu P3 "Navy & cát", font Be Vietnam Pro. Ở 1280 px lưới phải có **4–5 thẻ mỗi hàng, đều hai bên**, không còn khoảng trống thừa trái/phải như hiện nay (3 thẻ/hàng, `max-width: 1240`, trang 390 cao ~26 000 px với 169 món Booking). Áp cùng hệ cho Lịch sử, Chi tiết phiếu, Tôi, chuông.

**Architecture:**
- Chỉ đổi web. **Không đổi API/DTO/mã lỗi/luật/migration.** Mọi luật (kỳ 1–10, `max_qty`, `default_max_qty`, `admin_only`, khóa kỳ, `expected_updated_at`) vẫn ép ở server như hiện tại; UI chỉ hỗ trợ.
- Dùng lại nền M1 của Hành chính: `tokens-m1.css`, `ui/*` (`item-thumb`, `stepper`, `dialog` dạng sheet, `toast`, `progress`, `empty-art`, `load-state`, `skeleton`, `icon`), và luật bố cục đang làm ở `docs/plans/2026-11-02-tinh-chinh-ux-hanh-chinh.md` (thang `--s-*`/`--t-*`, `.toolbar`, `ui/select`, script `check-css-scale`).
- CSS nhân viên chuyển sang phạm vi `[data-shell='member']` (giống `[data-shell='admin']`), tệp `web/src/css/m1/member-*.css` và `features/request/*.m1.css`; xóa `request.css`, `history.css`, phần member của `member.css` khi port xong.
- Logic giỏ/lưu (`use-cart`, `use-save-flow`, `use-copy-previous`, `use-leave-guard`, `request.api`) **giữ nguyên**; chỉ tách/đổi component trình bày.

**Tech Stack:** React 19, Vite 8, TS 6, TanStack Query 5, react-router 7, react-i18next, Radix Dialog, vitest + Testing Library, Playwright + `@axe-core/playwright`. **Không thêm dependency** (scroll-spy dùng `IntersectionObserver` có sẵn).

**Nguồn sự thật (theo CLAUDE.md):** `docs/prd.md` FR-20…FR-28, BR-2/BR-12 → `docs/architecture.md` §6–7 → `docs/backlog/epic-2-phieu-dang-ky.md`, `epic-6-*.md` → `design-preview/_SPEC.md` mục "Thay đổi sau review" → `design-preview/redesign/m1/SYSTEM.md` (§3 thành phần, §4 bố cục, §6 wow, §8 trợ năng, §9 điều cấm), `SCREENS.md` A1–A8. Hình: canvas https://claude.ai/artifact/JtGUQXgPxo4aGpUb7T97sj artboard "Mẫu 1 — Nhân viên đặt hàng" (`Main.dc.html`); artboard nhân viên chi tiết ở canvas https://claude.ai/artifact/LWVLQXEpeFbzdBCotCYFzT (`S-dangky-mobile`, `S-lichsu`, `S-chitiet`, `S-toi`).

## Global Constraints

- Nhánh `feat/giao-dien-hanh-chinh`, commit theo task, tiếng Việt, `git add <path>` cụ thể, **không** `git add -A`/`stash`/push. **Bắt đầu sau khi T1–T2 của plan tinh chỉnh UX Hành chính đã commit** (cần thang chữ/khoảng cách, `ui/select`, `.toolbar`, `check-css-scale`); không sửa tệp mà plan đó đang sửa trong cùng lúc.
- Lấy từ Mẫu 1: bố cục và nhịp. **Bỏ** phần không có dữ liệu/không có trong PRD: giá, "Tạm tính", định mức phòng ban, ô ghi chú cho Hành chính, "Gửi trưởng phòng duyệt", ô "Sắp xếp", tên mục "Đặt hàng / Yêu cầu của tôi / Hàng đã nhận" (giữ **Đăng ký · Lịch sử · Tôi**), màu xanh `#2457D6` của mockup (dùng token P3). Mã chữ "A4/TL" trên ảnh không dùng (SYSTEM §9 cấm chữ làm ảnh món).
- Ảnh món: **ô ảnh cố định** (tỉ lệ 4:3, `object-fit: contain`, nền tông nhóm) cho ảnh thật Hành chính tải lên. SVG minh họa chỉ để mockup, không đưa vào code. Món thiếu ảnh: placeholder trung tính của `ui/item-thumb` (xem câu hỏi Q4), không còn chữ cái "B".
- Điểm gãy giữ theo PRD FR-28 và Playwright `E0-S9 … mốc 900/901`: **≤ 900 px là điện thoại** (thanh dưới 3 mục, thanh giỏ), ≥ 901 px là máy tính. Không dùng 767 của SYSTEM cho trang nhân viên (ghi `review-spec.md`).
- Giữ hành vi hiện có (đối chiếu test hiện tại, không được đỏ):
  1. kỳ mở ngày 1–10, `days_left` tính cả hôm nay, "Hôm nay là ngày cuối" ngày 10, khóa từ 00:00:00 ngày 11 (luật ở server, UI hiển thị `is_open`);
  2. "Lưu phiếu" → hộp "Lưu phiếu tháng N?" có bảng món, dòng tổng "x loại món · y đơn vị", "Quay lại sửa"/"Lưu phiếu"; lưu rỗng = bỏ phiếu; nhãn "n thay đổi chưa lưu · Lưu"; hero "Đã lưu HH:MM · sửa tiếp đến hết dd/mm"; rời trang chưa lưu hỏi; toast "Đã lưu phiếu tháng N";
  3. `max_qty` mỗi món ("tối đa 20/tháng"), stepper chặn `+` ở max, gõ > max/ < 1 báo lỗi; lỗi dòng từ server (`QTY_EXCEEDS_MAX`, `ITEM_INACTIVE`…) gắn vào dòng giỏ và focus dòng lỗi đầu;
  4. "Thêm món khác": tên, ĐVT (chọn từ danh sách đơn vị đang dùng), số lượng ≤ `default_max_qty`, ghi chú, **không có ô ảnh** (PRD FR-22 chốt 2026-10-30; Playwright `request-extra` kiểm "không có ô ảnh"); nút viền đứt cạnh ô tìm + thẻ cuối lưới "Không thấy món cần? Thêm tại đây"; sửa/xóa dòng trong giỏ;
  5. "Chép lại danh sách tháng X": hỏi "Thay giỏ hiện tại?", tóm tắt món bị bỏ/giảm, giỏ chưa lưu;
  6. kỳ khóa: chỉ đọc, tiến độ giao từng dòng, trạng thái món ngoài danh mục; hai biến thể khóa giữa chừng (`request.locked` mang giỏ sang tháng sau / `lockedSaved`); hộp "Phiếu vừa được cập nhật ở nơi khác";
  7. món xếp theo thứ tự nhóm rồi `sort_order` như API trả (`catalog.service` `ORDER BY group_sort, …`); món `admin_only` và món không `usable` không hiện trong lưới; dòng "Hành chính thêm" chỉ đọc với tooltip liên hệ (lấy từ Cấu hình);
  8. thẻ "Tháng M đang giao · a/b món" → Lịch sử;
  9. **nhân viên không bao giờ thấy tồn kho** (không có "Hết hàng"/"Sắp hết" trên thẻ; chữ "Hết hàng" chỉ xuất hiện khi là lý do hủy nợ trong Lịch sử);
  10. i18n vi + en toàn bộ; dữ liệu `name_en`.
- Playwright: giữ **nguyên tên mọi test** ở `request.spec.ts`, `request-extra.spec.ts`, `history.spec.ts`, `camera-photo.spec.ts`, `smoke.spec.ts`, `notifications.spec.ts`, `i18n.spec.ts`, `file-access.spec.ts`, `review.spec.ts`, `p1/p2/p3-flow.spec.ts`. Được sửa bước bên trong khi bố cục đổi (vd 390 mở sheet giỏ trước khi thao tác dòng), không được bỏ assert. Test mới mang tiền tố `E10-Sn`. Mỗi test chạy 1280 + 390; axe `color-contrast` ở 390.
- File ≤ 400 dòng (350 thì tách), component ≤ 250, hàm ≤ 50; `madge --circular` = 0; `ui/`, `lib/` không import `features/`. Chữ phụ ≥ 14 px, nhãn trạng thái ≥ 12 px đậm (_SPEC); dùng thang `--t-*` (14 cho chữ phụ nhân viên, không dùng 13).

## Bố cục (nguồn cho T3–T6)

Khung trang `.mx-page` (`[data-shell='member']`): lề 24 (≥ 901), 16 (≤ 900); `max-width: 1600px; margin-inline: auto` (bỏ 1240 hiện tại).

| Bề ngang | Cột | Nhóm món | Lưới thẻ | Giỏ |
|---|---|---|---|---|
| **≥ 1200** (1280, 1440) | `184px minmax(0,1fr) 320px`, gap 16 | cột trái dính `top: header+16`, danh sách nhóm có số món, scroll-spy + bấm để nhảy | `repeat(auto-fill, minmax(150px, 1fr))` gap 12 → **1280: 4 cột (~165 px)**, 1440: 5, 1600: 6 | cột phải dính, danh sách dòng cuộn trong, nút "Lưu phiếu" luôn thấy |
| **901–1199** (~1024) | `minmax(0,1fr) 300px`, gap 16 | hàng chip ngang dính trên lưới (cuộn ngang, scroll-spy) | như trên → 1024: 4 cột, 960: 3 | cột phải dính 300 |
| **≤ 900** (390) | 1 cột | hàng chip ngang dính dưới header, tràn lề | `repeat(2, minmax(0,1fr))` gap 12 | thanh giỏ nổi trên thanh dưới (cao 60, "n món" + "Lưu phiếu"); chạm → sheet đáy 85% chứa giỏ đầy đủ |

Trong cột giữa, từ trên xuống:
1. **Dải kỳ gọn** (thay hero xanh to, cao ≤ 72 ở 1280): `h1` "Phiếu tháng 11" · "còn 9 ngày · hạn 23:59 ngày 10/11" · trạng thái lưu ("Chưa lưu phiếu tháng này" / "Đã lưu 09:41 · sửa tiếp đến hết 10/11" + chấm khi có thay đổi) · bên phải nút phụ "Chép lại danh sách tháng X". Tông: thường (nền surface), ≤ 3 ngày (warn-soft), ngày cuối (`--c-dark`, "Hôm nay là ngày cuối"), khóa (g0 "Phiếu tháng 11 đã khóa"). Thẻ "Tháng 10 đang giao · 5/10 món →" là một dòng liên kết ngay dưới dải.
2. **`.toolbar`**: ô tìm (co giãn, cao 40, phím "/" focus, Esc xóa) + nút viền đứt "Thêm món khác". Toolbar + chip (≤ 1199) dính cùng nhau khi cuộn.
3. **Các mục nhóm**: `<section aria-labelledby>` mỗi nhóm, tiêu đề `--t-h3` "Bút & viết" + "12 món" muted, rồi lưới thẻ. Món không có nhóm/nhóm lạ → mục "Chưa xếp nhóm" cuối (`groupTone` g0). Tìm kiếm lọc trong mọi mục, ẩn mục rỗng; không khớp → `EmptyState` "Không có món nào khớp" + "Thêm món khác". Thẻ cuối lưới "Không thấy món cần? Thêm tại đây" nằm cuối mục cuối.

**Thẻ món** (`ItemCard`, ~165×230 ở 1280): ô ảnh 4:3 `--r-lg` nền tông nhóm; dưới: tên (tối đa 2 dòng, cắt …, `title` đủ tên) + quy cách; "cây · tối đa 20/tháng" (14 muted); hàng cuối: nút "+" 44 tròn → khi qty > 0 thành stepper card 40 (`ui/stepper`), badge "Trong phiếu" góc ảnh. Trạng thái: tại max (`+` tắt, chú thích chuyển warn), khóa "Đã đăng ký n", "Hành chính thêm · n", skeleton. Chuỗi en dài hơn 30% không vỡ thẻ.

**Header mảnh** (≥ 901, cao 56, surface, viền dưới): logo + "VPP Công trình" · nav pill "Đăng ký · Lịch sử" (`aria-label="Chuyển trang"`, đang chọn nền `--c-dark`) · khoảng trống · chuông · avatar (liên kết "Tôi"). Giữ đúng nhãn/ARIA mà `smoke.spec.ts` kiểm. ≤ 900: header 56 chỉ logo + chuông; **thanh dưới đúng 3 mục** Đăng ký · Lịch sử · Tôi (`aria-label="Điều hướng chính"`, 64 + safe-area, mục chọn nền acc-soft); nội dung `padding-bottom` = thanh dưới + thanh giỏ + 16.

**Lịch sử / Chi tiết / Tôi** dùng cột giữa `max-width: 880px` căn giữa (không để 1 cột 760 lọt giữa nền trống như ảnh hiện tại nhưng cũng không giãn hết 1600): Lịch sử = danh sách thẻ tháng (vòng tiến độ 40, "Đã giao đủ / Còn nợ k / Chưa giao / Đã hủy", "x loại món · y đơn vị", số món ngoài danh mục, nhãn "Đang mở"), "Xem thêm", mục "Nhận lẻ"; trống = `EmptyState` (es-no-request) + "Về trang Đăng ký". Chi tiết = dòng món (ảnh 48, tên, SL, `LineProgress` "Đã giao 3 trên 5", "còn nợ 2", "Đã hủy 1 — lý do", trạng thái duyệt), nút quay lại Lịch sử. Tôi = thẻ tài khoản (avatar, cặp nhãn/giá trị, "Dữ liệu từ PMH ID, không sửa trong app"), thẻ ngôn ngữ (segmented), liên hệ Hành chính, nút Đăng xuất (danger ghost). Chuông: popover 380 (≥ 901) / sheet toàn màn (≤ 900) theo SYSTEM §3.

## Story mới (ghi vào `docs/backlog/epic-10-giao-dien-nhan-vien.md` ở T0)

- **E10-S1** Nền + shell nhân viên M1 (header mảnh, thanh dưới 3 mục, phạm vi CSS).
- **E10-S2** Trang Đăng ký: dải kỳ gọn, cột nhóm scroll-spy/chip, lưới 4–5 cột.
- **E10-S3** Thẻ món gọn + ô ảnh cố định.
- **E10-S4** Giỏ phải dính + thanh giỏ/sheet 390; dialog/toast/khóa trên nền M1.
- **E10-S5** Lịch sử, Chi tiết phiếu, Tôi, chuông.
- **E10-S6** Chốt: axe 390, vùng chạm 44, tài liệu, sơ đồ.

## Bảng biên → tầng test (mọi task báo lại bảng này cho phần mình chạm)

| Giới hạn | Hai phía | Tầng |
|---|---|---|
| Điện thoại/máy tính | 900 thanh dưới + thanh giỏ / 901 tab trên + giỏ phải | Playwright (giữ `E0-S9 … 900/901`, thêm giỏ ở E10-S4) |
| Cột nhóm trái | 1199 chip ngang / 1200 cột trái | vitest (`useMediaQuery` giả) + Playwright E10-S2 |
| Số cột lưới | 390 = 2; 960 = 3; 1024 = 4; 1280 = 4 (≥ 4, ≤ 5); 1440 = 5 | Playwright E10-S2 (đếm thẻ cùng `boundingBox().y` ở hàng đầu) |
| Tông dải kỳ | `days_left` 4 thường / 3 cảnh báo; 2 cảnh báo / 1 ngày cuối; `is_open=false` khóa | unit `period-tone.test.ts` |
| Scroll-spy | đỉnh mục = mốc → mục đó active; mốc − 1 px → mục trước; cuộn tới cuối → mục cuối | unit `pick-active.test.ts` |
| `max_qty` trên thẻ | qty = max → `+` tắt, chú thích warn; max − 1 → `+` bật; gõ max+1 → "Tối đa {max}/tháng." | vitest `item-card.test.tsx` (server đã có e2e `QTY_EXCEEDS_MAX` max/max+1, không đổi) |
| `default_max_qty` Món khác | = max được / max+1 lỗi tại ô | vitest `custom-line-dialog.test.tsx` (giữ test hiện có) |
| Thanh giỏ 390 | giỏ 0 dòng + chưa lưu → ẩn; 1 dòng → hiện "1 món"; đã lưu rồi bỏ hết → vẫn hiện (để lưu phiếu rỗng) | vitest `cart-bar.test.tsx` |
| Tên thẻ | tên 1 dòng không cắt; tên dài (en +30%, 80 ký tự) cắt 2 dòng và có `title` đủ | vitest + ảnh Playwright |
| Kỳ khóa | 23:59:59.999 ngày 10 sửa được / 00:00:00 ngày 11 `PERIOD_LOCKED` | đã có ở e2e api + Playwright `request-extra` (route giả); không đổi, chỉ chạy lại |
| Lịch sử phân trang | đúng một trang không có "Xem thêm" / trang + 1 có | vitest `history-page.test.tsx` (giữ) |

---

## Task 0: Chuẩn bị tài liệu (docs, không code)

**Files:** `docs/backlog/epic-10-giao-dien-nhan-vien.md` (mới: E10-S1…S6, AC lấy từ mục Bố cục), `docs/review-spec.md` (điểm gãy nhân viên 900 thay 768 của SYSTEM; Mẫu 1 bỏ giá/định mức/duyệt trưởng phòng; Món khác không ảnh dù SCREENS A3 vẽ ô ảnh), `design-preview/_SPEC.md` mục "Thay đổi sau review (2026-11-02) — trang Nhân viên Mẫu 1" tóm tắt bảng bố cục.
- [ ] Ghi các câu trả lời Q1–Q6 của chủ dự án vào `_SPEC.md` trước khi làm T3.
- [ ] Commit `docs: backlog E10 và spec bố cục Nhân viên Mẫu 1`.

## Task 1 (E10-S1): Phạm vi CSS member + token P3

**Files:** `web/src/test/m1-scope.test.ts` (mở rộng), `web/src/css/m1/member-base.css` (mới), `web/src/main.tsx`, `web/src/shell/member-shell.tsx` (gắn `data-shell="member"` ở gốc, `useShellFont('member')` giữ), `web/src/css/member.css` (bớt dần), `web/scripts/check-css-scale.mjs` (chỉ thêm đường dẫn `css/m1/member-*.css` nếu chưa quét).
- [ ] **RED:** `m1-scope.test.ts`: tệp `css/m1/member-*.css` và `features/request|profile|notifications/*.m1.css` phải có mọi selector cấp cao bắt đầu bằng `[data-shell='member']`; không chứa hex; tệp admin vẫn bắt buộc `[data-shell='admin']` (không nới luật cũ). Tạo `member-base.css` rỗng có `.x{}` sai phạm vi để thấy FAIL đúng lý do.
- [ ] GREEN: `member-base.css` = nền `--c-page`, font `--font`, `color-scheme`, reduced-motion, `.mx-page` (lề, `max-width: 1600px`). Không màu cũ (`--brand*`) trong tệp mới.
- [ ] `npm test && npm run lint && npm run build`; Playwright `smoke.spec.ts` xanh (chưa đổi hình).
- [ ] Commit `feat(web): phạm vi CSS data-shell member và nền P3 cho trang Nhân viên`.

## Task 2 (E10-S1): Shell nhân viên — header mảnh, thanh dưới

**Files:** `shell/member-shell.tsx`, `shell/bottom-nav.tsx`, `shell/member-shell.test.tsx`, `css/m1/member-shell.css` (mới), `ui/icon` (dùng icon sprite thay `ui/icons` cũ nếu có symbol tương ứng), i18n `nav.*` (chỉ khi thêm key).
- [ ] **RED** (`member-shell.test.tsx`): ≥ 901 → `navigation "Chuyển trang"` có đúng `["Đăng ký","Lịch sử"]`, liên kết đang ở có `aria-current="page"`, có nút chuông và liên kết "Tôi"; ≤ 900 → không có "Chuyển trang", `navigation "Điều hướng chính"` có đúng 3 liên kết; skip-link "Tới nội dung" trỏ `#main`.
- [ ] GREEN: header 56, nav pill, chuông 44, avatar 40 (vùng chạm 44); thanh dưới 64 + safe-area, icon 22 + nhãn 12 đậm.
- [ ] Playwright: giữ `E0-S9 member: 390 px thanh dưới 3 mục…` và `E0-S9 member: mốc 900 px…`; thêm `E10-S1 shell Nhân viên: header ≤ 56 px ở 1280, thanh dưới 3 mục ở 390, axe 390 sạch`.
- [ ] Commit `feat(web): shell Nhân viên M1 — header mảnh, thanh dưới 3 mục`.

## Task 3 (E10-S2): Khung trang Đăng ký + dải kỳ gọn

**Files:** `features/request/request-page.tsx` (chỉ bố cục), `features/request/request-layout.tsx` (mới: ba vùng nav/main/cart theo media query), `period-hero.tsx` → `period-bar.tsx` (+ `period-tone.ts` thuần), `previous-period-card.tsx`, `copy-previous-dialog.tsx` (nút phụ), `features/request/request.m1.css` (mới, tách `request-grid.m1.css`/`request-cart.m1.css` nếu > 350 dòng), `lib/use-media-query.ts` (thêm `MEMBER_WIDE_QUERY = '(min-width: 1200px)'`, giữ `NARROW_QUERY`), i18n `request.hero.*` (thêm `deadlineShort` vi/en nếu cần).
- [ ] **RED:**
  - `period-tone.test.ts`: `periodTone({days_left: 4, is_open: true})='normal'`, `3→'soon'`, `2→'soon'`, `1→'last'`, `is_open=false→'locked'`.
  - `period-hero.test.tsx` đổi thành `period-bar.test.tsx` giữ mọi assert cũ (h1 "Phiếu tháng 11", "Chưa lưu phiếu tháng này", "Đã lưu 09:41 · sửa tiếp đến hết 10/11", "Hôm nay là ngày cuối") + nút "Chép lại danh sách tháng 10" nằm trong dải.
  - `request-page.test.tsx`: ≥ 1200 có `navigation "Nhóm món"` trái; 901–1199 có nhóm chip `group "Nhóm món"`, không có cột trái; ≤ 900 không có `complementary "Phiếu của tôi"` mở sẵn (giỏ vào sheet ở T6 — tạm thời giữ cột, assert thêm ở T6).
- [ ] GREEN theo mục Bố cục. Bỏ `rq-hero` gradient/vòng tròn trang trí.
- [ ] `npm test` cả gói; Playwright `request.spec.ts`, `smoke.spec.ts` xanh.
- [ ] Commit `feat(web): khung trang Đăng ký Mẫu 1 — ba cột, dải kỳ gọn`.

## Task 4 (E10-S2): Mục theo nhóm, cột nhóm scroll-spy, chip, tìm

**Files:** `item-grid.tsx` → `catalog-sections.tsx` (mới, ≤ 250 dòng) + `item-section.tsx`, `group-nav.tsx` (mới: một component, hai biến thể `rail`/`chips`), `use-scroll-spy.ts` + `pick-active.ts` (thuần), `request-format.ts` (`groupItems(items, categories)` giữ thứ tự API, nhóm lạ → "Chưa xếp nhóm"), `lib/group-tone.ts` (dùng lại), i18n `request.grid.sectionCount`, `request.grid.ungrouped` (vi/en).
- [ ] **RED:**
  - `pick-active.test.ts`: biên mốc như bảng biên; danh sách rỗng → null.
  - `request-format.test.ts` (`groupItems`): giữ thứ tự xuất hiện của API; món `category_id` null/không có trong danh sách → mục "Chưa xếp nhóm" cuối; nhóm không còn món sau lọc tìm → bị bỏ; tìm không dấu "but bi" khớp "Bút bi".
  - `catalog-sections.test.tsx`: mỗi nhóm là `region` tên nhóm có "n món"; bấm "Giấy & sổ" ở nav gọi `scrollIntoView` của mục đó và đặt `aria-current="true"` trên mục nav (giả `IntersectionObserver`/`scrollIntoView` trong `test/setup.ts`); tìm không khớp → "Không có món nào khớp" + nút "Thêm món khác"; thẻ "Không thấy món cần? Thêm tại đây" là phần tử cuối; món `admin_only`/không `usable` không có thẻ (giữ test cũ).
- [ ] GREEN: cột trái/chip cùng dữ liệu; chip active tự cuộn vào tầm nhìn; `prefers-reduced-motion` → `scrollIntoView({behavior:'auto'})`. Phím "/" focus ô tìm (bỏ qua khi đang gõ trong ô khác), Esc xóa.
- [ ] Playwright mới `request-layout.spec.ts`: `E10-S2 Đăng ký: 1280 lưới ≥ 4 và ≤ 5 thẻ mỗi hàng, 1440 = 5, 1024 = 4, 390 = 2; bấm nhóm nhảy tới mục và nhóm sáng theo cuộn`; `E10-S2 Đăng ký: mốc 1199 chip ngang / 1200 cột nhóm trái`. Kiểm `document.documentElement.scrollWidth <= innerWidth` ở 390.
- [ ] Commit `feat(web): lưới món theo nhóm, cột nhóm scroll-spy, chip điện thoại`.

## Task 5 (E10-S3): Thẻ món gọn + ô ảnh cố định

**Files:** `item-card.tsx` (bỏ `ItemThumb` cục bộ, dùng `ui/item-thumb` với `ratio="4/3"`), `ui/item-thumb.tsx` (+ test, chỉ thêm prop tỉ lệ/tông nếu chưa có — không đổi hành vi phía Hành chính), `cart-panel.tsx` (thumbnail 40 dùng `ui/item-thumb`), `item-card.test.tsx` (mới), CSS thẻ trong `request.m1.css`, i18n `request.grid.inCart`, `request.grid.add` ("Thêm {{name}}").
- [ ] **RED** (`item-card.test.tsx`):
  - qty 0 → một nút "Thêm Bút bi xanh" (44×44, `aria-label` i18n); bấm → gọi `onQty(1)`;
  - qty > 0 → stepper có "Bớt/Thêm Bút bi xanh", badge "Trong phiếu";
  - biên `max_qty` theo bảng biên;
  - dòng chỉ đọc → "Đã đăng ký 5" / "Hành chính thêm · 2", không có nút;
  - có ảnh → `img[alt=""]` trong ô `aria-hidden` (tên đã là chữ của thẻ); ảnh lỗi → placeholder; không còn chữ cái làm ảnh;
  - tên dài → phần tử tên có `title` bằng tên đủ.
- [ ] GREEN: ảnh `object-fit: contain`, 78% khung, `drop-shadow` mềm; không `cover`.
- [ ] Playwright `request.spec.ts` (giữ tên) xanh; ảnh 1280/390 nhìn lại.
- [ ] Commit `feat(web): thẻ món gọn Mẫu 1, ô ảnh cố định 4:3`.

## Task 6 (E10-S4): Giỏ phải dính + thanh giỏ/sheet 390

**Files:** `cart-panel.tsx` (trình bày, ≤ 250 dòng; tách `cart-line.tsx`), `mobile-save-bar.tsx` → `cart-bar.tsx` (+ test), `cart-sheet.tsx` (mới, dùng `ui/dialog` biến thể sheet), `use-save-flow.ts` (chỉ thêm callback `onLineError` để mở sheet trước khi focus dòng lỗi — không đổi luật), `request.m1.css`, Playwright `request.spec.ts`, `request-extra.spec.ts`, `p2-flow.spec.ts`, `review.spec.ts`, `file-access.spec.ts` (chỉ bước 390: mở sheet "Phiếu của tôi" trước khi thao tác dòng), i18n `request.cart.open` ("Xem phiếu, {{n}} món").
- [ ] **RED:**
  - `cart-bar.test.tsx`: biên thanh giỏ (bảng biên); nhãn "2 thay đổi chưa lưu · Lưu" khi bẩn; nút Lưu tắt khi chưa bẩn hoặc đang lưu; bấm thân thanh mở sheet `dialog "Phiếu của tôi"`, bấm "Lưu phiếu" mở hộp xác nhận.
  - `request-page-flows.test.tsx`: ở 390 lưu bị lỗi dòng `QTY_EXCEEDS_MAX` → sheet tự mở, focus dòng lỗi, câu lỗi gắn `aria-describedby`; vùng `aria-live` đọc "3 món trong phiếu".
  - ≥ 901: giỏ `complementary "Phiếu của tôi"` dính (`position: sticky`), danh sách dòng cuộn trong khi phiếu dài, nút "Lưu phiếu" luôn trong màn (Playwright đo `boundingBox` với 25 dòng ở 1280×800).
- [ ] GREEN. Toast/notice chuyển sang `ui/toast` (đáy giữa; 390 trên thanh giỏ); lỗi không bao giờ chỉ là toast. `SaveDialog`, `StaleDialog`, `CopySummaryDialog`, `CustomLineDialog` dùng `ui/dialog` (390: sheet đáy), câu chữ giữ nguyên.
- [ ] Kỳ khóa: thẻ khóa, giỏ chỉ đọc với `LineProgress` từng dòng, dải kỳ tông locked; hai biến thể khóa giữa chừng giữ câu báo.
- [ ] Playwright: các test giữ tên xanh ở 1280 + 390; thêm `E10-S4 Đăng ký 390: thanh giỏ → sheet → Lưu phiếu, lỗi dòng mở sheet và focus dòng`; `E10-S4 Đăng ký 1280: giỏ dính, 25 dòng vẫn thấy nút Lưu phiếu`.
- [ ] Commit `feat(web): giỏ dính bên phải và thanh giỏ + sheet ở điện thoại`.

## Task 7 (E10-S5): Lịch sử + Chi tiết phiếu

**Files:** `history-page.tsx`, `history-detail-page.tsx`, `issues-section.tsx` (Nhận lẻ), `line-progress.tsx` (dùng `ui/progress`), `features/request/history.m1.css` (thay `history.css`), test tương ứng, i18n chỉ khi thêm key.
- [ ] **RED:** `history-page.test.tsx`: mỗi tháng là liên kết có tên "Tháng 10/2026", có `progressbar`/vòng với giá trị chữ "đã giao 3/5"; kỳ đang mở dẫn về `/`; trống → `EmptyState` "Chưa có phiếu nào" + "Về trang Đăng ký" và vẫn có mục "Nhận lẻ" khi có dữ liệu. `history-detail-page.test.tsx` giữ assert cũ ("Đã hủy 5 — Hết hàng", "Từ chối: …").
- [ ] GREEN: cột 880 căn giữa; thẻ tháng hàng ngang ở ≥ 901, xếp dọc ở 390.
- [ ] Playwright `history.spec.ts` (giữ 2 tên, ≤ 2 chạm) xanh; thêm `E10-S5 Lịch sử 390: không cuộn ngang, axe sạch`.
- [ ] Commit `feat(web): Lịch sử và Chi tiết phiếu theo M1`.

## Task 8 (E10-S5): Tôi + chuông

**Files:** `features/profile/profile-page.tsx`, `profile-page.test.tsx`, `features/profile/profile.m1.css`, `features/notifications/notification-bell.tsx` (chỉ phần trình bày phía member; bảng chuông ở shell Hành chính không đổi hình — kiểm `admin-shell.test.tsx` vẫn xanh), `notifications.css` → phạm vi theo shell.
- [ ] **RED:** profile: có `heading "Tôi"`, các cặp nhãn/giá trị Họ tên/Email/Phòng ban/Vai trò "Nhân viên", "Dữ liệu từ PMH ID, không sửa trong app", ngôn ngữ là `radiogroup`, nút "Đăng xuất". Chuông ≤ 900: mở `dialog "Thông báo"` toàn màn; ≥ 901 popover; `aria-label "Thông báo, 2 chưa đọc"`.
- [ ] Playwright `notifications.spec.ts`, `smoke.spec.ts` (đổi ngôn ngữ), `i18n.spec.ts` xanh.
- [ ] Commit `feat(web): trang Tôi và chuông Nhân viên theo M1`.

## Task 9 (E10-S6): Chốt plan

**Files:** Playwright mới `web/playwright/member-a11y.spec.ts`; xóa `features/request/request.css`, `history.css`, phần member trong `css/member.css` (giữ phần đăng nhập nếu chưa port); `docs/map.md`; `docs/diagrams/` (archify); `docs/backlog/epic-10-*.md` (đánh dấu xong).
- [ ] `E10-S6 axe 390 các màn Nhân viên`: Đăng ký (thường, sheet giỏ mở, hộp Lưu phiếu, hộp Thêm món khác, kỳ khóa seed SQL), Lịch sử, Chi tiết, Tôi, chuông mở → 0 vi phạm `color-contrast`; mọi `button`/`a` hiển thị ở Đăng ký 390 ≥ 44×44.
- [ ] `grep -rn "rq-hero\|--brand" web/src/features/request web/src/shell/member*` = 0; `grep -ri qlts api web` = 0; không tệp > 400 dòng; `npx madge --circular src` (web) = 0.
- [ ] Chạy đủ: web `npm test && npm run lint && npm run build`; api không đổi nhưng vẫn chạy `npm test && npm run test:e2e && npm run test:db` một lần; dựng lại `docker compose up -d --build web`; Playwright cả bộ 1280 + 390.
- [ ] Chụp 1280/1024/390 trang Đăng ký (giỏ trống, giỏ 6 món, kỳ khóa), Lịch sử, Tôi bằng tài khoản dev và NHÌN; so với ảnh trước ở scratchpad `live-real/ux/member/`. Thử tay bằng tài khoản PMH ID Nhân viên trong `test-accounts.local.md` (không chép mật khẩu).
- [ ] Vẽ lại sơ đồ shell Nhân viên + luồng Đăng ký → Lưu → Lịch sử bằng skill `archify`; lệch `architecture.md` thì ghi `review-spec.md`.
- [ ] Commit `test(web): axe 390 và vùng chạm Nhân viên` + `docs: chốt plan Nhân viên Mẫu 1`.
- [ ] Review toàn đợt (Opus) + code review mức high → một đợt sửa → re-review → báo chủ dự án (đường dẫn, 3–6 việc thử bằng `huuthong123`). Không gộp `main`, không push khi chưa được bảo.

## Phân công model

| Task | Làm | Review |
|---|---|---|
| 0, 7, 8 | Sonnet | Opus |
| 1, 2, 5 | Sonnet | Opus |
| 3, 4, 6 | Opus (bố cục lõi, scroll-spy, sheet + lỗi dòng) | Opus |
| 9 | Sonnet | Opus (toàn nhánh) |

Mốc kiểm của chủ dự án: sau T4 (nhìn lưới 4–5 cột + cột nhóm trên de-vpp) và sau T9. Giữa hai mốc làm liền.

## Câu hỏi cho chủ dự án (mỗi câu có gợi ý)

- **Q1. Bấm nhóm ở cột trái: nhảy tới mục hay lọc chỉ nhóm đó?** Gợi ý: **nhảy tới mục + tô sáng theo cuộn** (vẫn thấy cả danh mục, giống Mẫu 1); ô tìm vẫn lọc.
- **Q2. Điện thoại có 169 món → 2 cột thẻ vẫn rất dài.** Gợi ý: giữ **2 cột thẻ** như Mẫu 1 nhưng thẻ thấp hơn (ảnh 4:3) và chip nhóm dính để nhảy nhanh; chưa làm kiểu danh sách hàng. Nếu sau khi thử vẫn dài, làm thêm nút "Dạng danh sách" ở đợt sau.
- **Q3. Ô tìm đặt ở đâu?** Mẫu 1 đặt trên header. Gợi ý: đặt ở **đầu cột giữa, dính khi cuộn** (header chung cho Lịch sử/Tôi, nơi đó không có gì để tìm); phím "/" vẫn nhảy vào ô tìm.
- **Q4. Món chưa có ảnh (đa số món Booking hiện nay) hiện gì?** Gợi ý: **ô ảnh nền tông nhóm + icon hộp đồ trung tính** (không chữ cái, không minh họa theo loại món); Hành chính tải ảnh thật dần trong Danh mục, nhãn "Thiếu ảnh" đã có ở đó.
- **Q5. Bề ngang tối đa của trang trên màn rất rộng.** Gợi ý: **1600 px** (1280 → 4 thẻ, 1440 → 5, ≥ 1600 → 6 thẻ/hàng), hai bên chỉ là lề khi màn > 1600.
- **Q6. Hero kỳ to màu xanh hiện nay thành dải mảnh một hàng — có giữ hiệu ứng "đếm ngược" (≤ 3 ngày nền cảnh báo, ngày cuối nền đậm) không?** Gợi ý: **giữ đổi tông theo độ gấp ngay trên dải mảnh**, bỏ khối to; ngày cuối hiện "Hôm nay là ngày cuối" + nút Lưu phiếu nổi bật.

## Quyết định chủ dự án (2026-11-02) — thay cho mục câu hỏi ở trên

- Q1: bấm nhóm ở cột trái = **nhảy tới mục** (scroll-spy tô sáng); ô tìm vẫn lọc.
- Q2: điện thoại **2 cột, thẻ thấp** (ảnh 4:3), chip nhóm dính.
- Q3, Q5, Q6: theo gợi ý (tìm ở đầu cột giữa dính khi cuộn; rộng tối đa 1600 px; dải kỳ mảnh giữ đổi tông).
- Q4: **ảnh mặc định = nền màu nhóm + icon trung tính**, dùng cho mọi món không có ảnh. **Đổi BR-10 / FR-10:** tạo món mới qua giao diện **không còn bắt buộc ảnh** — không tải ảnh thì hiện ảnh mặc định; Hành chính sẽ tải ảnh thật cho ~160 món sau. Thêm **Task 5b (api + web)**: bỏ `IMAGE_REQUIRED` khi tạo món ở Danh mục và khi "Thêm vào danh mục" từ món ngoài danh mục (TDD: tạo không ảnh → 201; có ảnh vẫn được; e2e + Playwright), cập nhật prd FR-10/BR-9/BR-10 + bảng quyết định, architecture §7 nếu mã lỗi thôi dùng; ảnh mặc định cũng thay ảnh tạm ở trang Hành chính (Danh mục, Kho, Giao hàng); giữ bộ lọc "Chưa có ảnh" ở Danh mục để Hành chính biết món nào cần tải ảnh.
