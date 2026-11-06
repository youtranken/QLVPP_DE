# Spec v2-D — Góp ý Hành chính 2026-11-06 (vòng 4)

> 2026-11-06 · Trạng thái: **vòng 4, sau review 4 vai, rà soát UX trực tiếp và kịch bản chuẩn một tháng** · Nhánh tham chiếu: `feat/giao-dien-v2c` (đọc mã tại `8acd7fb`) · Chỉ là tài liệu, chưa đổi mã.
> Nguồn, theo thứ tự ưu tiên: (1) **câu chốt `docs/specs/2026-11-06-v2d-chot-cua-chu.md` Đ0a–Đ44 và đoạn "Luồng chuẩn"** — ràng buộc, đè mọi đề xuất; (1b) **kịch bản chuẩn `docs/specs/2026-11-06-v2d-kich-ban-chuan.md`** — bản đi thử một tháng (B1–B34) làm tham chiếu; 24 lỗ hổng GAP-01…24 và bảng 40 cảnh báo mục 6 đã vào spec (Cao/Vừa thành quy tắc, Thấp ở L); mục **K** ghi quy tắc cho từng bước B1–B34; (2) rà soát UX trực tiếp `docs/specs/2026-11-06-v2d-ux-audit.md` (ảnh `live-real/v2c/ux-audit/`): mọi mục **Cao** và **Vừa** thành quy tắc hoặc có lý do bác (mục R), mục **Thấp** ở danh sách **L. Làm khi tiện**; (3) review `.superpowers/sdd/v2d-spec-review/{pm,architect,qa,ux}.md` — mọi mục Blocking/Should-fix đã xử lý: nhận thì sửa quy tắc, bác thì có lý do (mục **R. Mục review bị bác**); (4) `docs/prd.md`, `docs/architecture.md`, `docs/quyet-dinh-2026-11-05-luong-hanh-chinh.md`, `design-preview/v2-glass/*.dc.html`.
> **Đánh dấu thay đổi:** `[r2·sửa]`/`[r2·mới]` = đổi/thêm ở vòng 2; `[r3·sửa]`/`[r3·mới]` = đổi/thêm ở vòng 3; `[r4·sửa]`/`[r4·mới]` = đổi/thêm ở vòng 4 (nhãn vòng sau thay nhãn vòng trước trên cùng quy tắc); không đánh dấu = giữ nguyên vòng 1. Số quy tắc đã bỏ **không dùng lại** (ghi "— bỏ").
> **Luồng chuẩn (chủ dự án):** NV đăng ký → khóa sổ → HC xem số tổng theo món, sửa tăng/giảm (tăng dư vào kho, giảm vì tủ còn) → In trình ký báo ADM → Hàng về: đối chiếu bản in, đúng thì nhập kho → Giao: lấy từ kho trừ cho từng NV. Hai mức sửa (Đ36): **số tổng** sửa tự do ở Gửi ADM, không lý do; **phiếu từng người** giảm ở Tổng hợp (hiếm), có lý do + chuông. Mọi bước có cảnh báo lệch số (D17).
> Cách đọc: mỗi mục có **Hiện trạng** (`file:dòng`, `web/…` = `web/src/…`, `api/…` = `api/src/…`), **Quy tắc mới** `R-D<mục>.<số>`, **Trạng thái & biên**, **Dữ liệu/API**, **Giao diện** (vi/en), **Tiêu chí nghiệm thu** (cột *Quy tắc* nêu quy tắc được phủ; mọi quy tắc có ít nhất một tiêu chí; mọi mốc kiểm **cả hai phía**). Bảng ma trận test tổng ở mục **T**.
> Tầng test: **API** = `api/test/*.e2e-spec.ts` (Postgres thật, `CLOCK_OFFSET_MS`) · **DB** = `api/test/*.db-spec.ts` (ràng buộc/migration/SQL) · **Vitest** = `web/src/**/*.test.ts(x)` hoặc `api/src/**/*.spec.ts` · **PW** = Playwright `web/playwright` (1280 + 390, axe ở 390; PW không giả lập đồng hồ server; chạy trên DB dev chung `vpp`, Đ35, R-D9.7).
> Thuật ngữ thời gian: **khóa sổ kỳ K** = `periods.deadline` của K = 00:00:00 giờ VN của ngày `registration_last_day + 1` (`api/common/period.ts` `deadlineOf`; kỳ 2026-11 → `2026-11-10T17:00:00.000Z`). Kỳ **đã khóa** ⇔ `K < openPeriod(now).ym` với `now = ClockService.now()` (R-D8.1). Không bao giờ dùng giờ trình duyệt. **Câu khóa sổ duy nhất** hiện cho người dùng: "00:00 ngày {{dd/mm}}" với `dd/mm` = ngày của `deadline` theo giờ VN (R-D8.11).

---

## D1. Mọi trang Hành chính toàn màn hình; sửa một mục bằng panel trượt phủ từ phải (Đ4)

### Hiện trạng
- Panel nội dung bị chặn rộng: `[data-shell='admin'] .shell__panel { max-width: 1280px; margin-inline: auto }` (`web/css/m1/shell.css:3`). Sidebar 252 px (`shell.css:1`). Màn 1920 px → mỗi bên thừa ≈ 174 px; 2560 px → ≈ 494 px.
- Trang tự chặn thêm: Đơn vị tính `.un-block { max-width: 960px }` (`web/features/units/units.m1.css:1`), chi tiết Nhật ký 880 px (`web/features/admin/audit.m1.css:33`), cột trái Gửi ADM 480 px + tờ A4 760 px (`web/features/send-adm/send-adm.m1.css:2,29`), trang in 860 px (`web/features/reports/print.m1.css:1`).
- Sửa một mục dùng `Drawer` (Radix, nền mờ, 384 px, `web/ui/drawer.tsx:42,70-82`) ở 6 nơi: `item-drawer.tsx`, `summary/adjust-drawer.tsx`, `directory/user-drawer.tsx`, `stock/movements-drawer.tsx`, `delivery/deliveries-drawer.tsx`, người ở Giao hàng < 1280 px (`delivery-people-page.tsx:133-145`). Ở ≥ 1440 px drawer **đẩy** `#main` (`drawer.tsx:24-35`, `web/css/m1/overlay.css:29`, `web/lib/use-media-query.ts:6`).
- Giao hàng ≥ 1280 px có panel người cố định chiếm cột phải (`delivery-people-page.tsx:120-131`, `delivery-people.m1.css:1-3`).
- Router là `BrowserRouter` (`web/App.tsx:1,20`), không phải data router → không có `useBlocker`.

### Quy tắc mới
- **R-D1.1** `.shell__panel` không còn `max-width`; panel lấp đầy cột nội dung (`100vw − sidebar − 2×20 px`). Lề trong 24 px (≥ 768 px), 16 px (< 768 px).
- **R-D1.2** `[r2·sửa]` Mọi trang Hành chính **lỏng**: không trang/khối bố cục nào có `max-width` + căn giữa; xóa `max-width` của `.un-block`, `.au-detail`, `.sa-left` (thay bằng `minmax`). **Danh sách cho phép** (duy nhất, khai báo trong test D1 #6):
  1. tờ giấy A4 (210 mm): xem trước Gửi ADM, vùng in, trang in riêng;
  2. ô nhập `input/select/textarea` và nhóm trường form (`.field`) — bề rộng tự nhiên, tối đa 480 px;
  3. **văn xuôi**: dòng phụ trang (`.page-sub`), gợi ý dưới trường, chữ trạng thái trống/lỗi, chữ chi tiết Nhật ký — `max-inline-size: 72ch` (căn trái, không căn giữa khối);
  4. nội dung khung trạng thái trống (D3, R-D8.10) tối đa 480 px căn giữa trong khung rộng hết;
  5. hộp thoại và panel phủ (R-D1.4).
- **R-D1.3** Bảng theo route (mọi route trong `web/shell/app-routes.tsx:51-85`):

| Route | Bề rộng | Bấm một mục mở |
|---|---|---|
| `/admin/home` Tháng này | Lỏng; dải bước + thẻ `repeat(auto-fill, minmax(320px, 1fr))` | Không có panel |
| `/admin/send-adm` Gửi ADM | Lỏng 2 cột `minmax(400px, 1fr)` + cột A4 | Không có panel (In: D5) |
| `/admin/arrivals` Hàng về | Lỏng, bảng gom nhóm (D11) | Không có panel |
| `/admin/delivery` Giao hàng | Lỏng, lưới thẻ người chiếm hết (bỏ cột cố định) | **Panel phủ**: người; giao bằng hộp D7 |
| `/admin/delivery/classic` | Lỏng; cột trái 256–280 px + chi tiết | **Panel phủ**: lịch sử giao một dòng |
| `/admin/backlog` Còn nợ | Lỏng, bảng | **Panel phủ**: lịch sử giao một dòng |
| `/admin/catalog` Danh mục món | Lỏng, lưới thẻ `repeat(auto-fill, minmax(220px, 260px))` căn trái / bảng | **Panel phủ**: sửa/thêm món |
| `/admin/stock` Tủ / Kho | Lỏng, bảng | **Panel phủ**: sổ cái món |
| `/admin/review` Món ngoài danh mục | Lỏng, lưới thẻ | Không có panel |
| `/admin/categories` Nhóm & đơn vị — tab Nhóm món `[r3·sửa]` | Lỏng, bảng | **Panel phủ**: món trong nhóm (D12) |
| `/admin/categories/units` Nhóm & đơn vị — tab Đơn vị tính `[r3·sửa]` | Lỏng (bỏ 960 px) | Hộp thoại sẵn có |
| `/admin/units` (cũ) | Chuyển hướng `replace` → `/admin/categories/units` (R-D12.7) | — |
| `/admin/users` Nhân viên | Lỏng, bảng | **Panel phủ**: chi tiết người |
| `/admin/audit` Nhật ký | Lỏng, bảng; chi tiết lỏng, chữ 72ch | Mở rộng tại chỗ |
| `/admin/config` Cấu hình | Lỏng, `repeat(auto-fill, minmax(420px, 1fr))` (`auto-fill` để một khối lẻ không kéo hết hàng) | Không có panel |
| `/admin/summary` Tổng hợp kỳ | Lỏng, bảng | **Panel phủ**: điều chỉnh phiếu (D6) |
| `/admin/reports` Báo cáo | Lỏng, bảng | Không có panel |
| `/admin/*` không khớp (404) | Lỏng | — |
| `/admin/reports/snapshots/:id/print` | Ngoài shell; A4 (D5) | — |

- **R-D1.4** `[r2·sửa]` **Panel phủ** (mọi ô "Panel phủ"): trượt từ mép phải (`translateX(100%) → 0`, 200 ms ease-out; nền mờ hiện dần 150 ms; tắt hoạt ảnh khi `prefers-reduced-motion`), cao hết khung nhìn, **nằm trên** nội dung, **không** đẩy/co (bỏ `usePushContent`, `.has-drawer`). **Nền mờ phủ cả khung nhìn kể cả sidebar** (`rgb(14 42 51 / .32)` + `blur(2px)`). Panel: nền kính như thẻ v2 (`rgb(255 255 255 / .86)` + `backdrop-filter`), bo 20 px hai góc trái. Modal: bẫy focus; Esc / bấm nền / × đóng; đang lưu thì chặn đóng. Rộng 440 px (≥ 768 px); 100 % (< 768 px) kèm thanh đầu 56 px có "← Đóng" để đọc ra là một lớp. Lưới phía sau giữ vị trí cuộn và số cột.
- **R-D1.5** `[r2·sửa]` Lịch sử trình duyệt: mở panel **đẩy** một mục lịch sử (`?item=`, `?person=`, `?request=`, `?group=`…); ↑/↓ sang mục kề **thay** mục đó (`replace`, 10 lần ↑/↓ vẫn chỉ cần 1 Back). Back = đóng panel; F5 / dán URL = mở lại đúng mục. Tham số trỏ tới mục không tồn tại / đã xóa / sai dạng → không mở panel, gỡ tham số (`replace`), không báo lỗi.
- **R-D1.6** `[r2·sửa]` Có thay đổi chưa lưu mà ↑/↓, ×, Esc, bấm nền, Back, hoặc rời trang → hỏi "Bỏ thay đổi?" (`discardOptions`, `item-drawer.tsx:121-125`). Với Back: trình nghe `popstate` thấy panel bẩn thì đẩy lại mục lịch sử của panel rồi hỏi (vì `BrowserRouter` không có `useBlocker`); "Ở lại" giữ nháp, "Bỏ" thì `history.back()`. Rời trang/đóng tab: `beforeunload`. Chưa đổi gì → đóng/chuyển ngay.
- **R-D1.7** `[r2·sửa]` Đóng panel → focus về thẻ/dòng đã mở nó. Mục đang mở có viền chọn ở lưới, thấy được qua nền mờ. Đầu panel 64 px: tiêu đề · bộ đếm "3/48" (vị trí trong danh sách đang hiện) · ↑ ↓ · ×. Chân panel dính đáy: Lưu / Hủy.
- **R-D1.8** `[r2·sửa]` Giao hàng: bỏ cột `.pp-side`; "Xem" mở panel phủ người ở mọi bề rộng; "Giao…" trong panel mở hộp D7 **trên** panel. Giao **thành công hết** từ panel → đóng cả hộp lẫn panel, toast "Đã giao cho {{name}}" + "Người tiếp theo" (R-D7.6).
- **R-D1.9** `[r2·mới]` Thứ tự lớp: panel (z 40) < hộp "Bỏ thay đổi?" và hộp D7 (z 50) < toast (z 60). Esc và bẫy focus chỉ tác động **lớp trên cùng**. Hộp "Bỏ thay đổi?" không bao giờ mở khi hộp D7 đang mở (D7 không sửa nháp panel).
- **R-D1.10** `[r2·mới]` Bảng trên màn rộng: tiêu đề bảng dính (`position: sticky`), hàng có màu nền khi hover; cột cố định `minmax(120px, 280px)`, **một** cột tự do (tên món/người) nhận phần dư.
- **R-D1.11** `[r4·mới]` (GAP-10) **Menu theo luồng chuẩn.** Nhóm "Hằng tháng" (luôn mở) theo thứ tự: Tháng này · **Tổng hợp kỳ** · Gửi ADM · Hàng về · Giao hàng · **Còn nợ** · **Báo cáo & in**; ba trang in đậm chuyển ra khỏi nhóm thu gọn "Xem lại sau" (Tổng hợp là nơi duy nhất giảm phiếu từng người — Đ36b; Còn nợ là nơi duy nhất Hủy nợ; Báo cáo là nơi in lại bản cũ). Mỗi hàng ở Gửi ADM có liên kết "Xem ai đăng ký ({{n}} người)" → `/admin/summary?ym=&view=items&item=<key>` (Tổng hợp theo món, lọc sẵn món đó).

### Trạng thái & biên
- Mốc bề rộng duy nhất cho panel: **767 px → 100 %**, **768 px → 440 px**; lề 16/24 đổi cùng mốc. Không còn mốc 1280/1440.
- Mục đang mở bị lọc khỏi danh sách: panel vẫn mở; ↑/↓ vô hiệu, bộ đếm hiện "—/48".
- Mục đầu: ↑ vô hiệu; mục cuối: ↓ vô hiệu.
- Lưu thành công: panel ở lại mục đó (trừ R-D1.8), toast "Đã lưu". Xóa mục: panel đóng.
- Màn 2560 px: lưới Danh mục ~9 cột thẻ ≤ 260 px căn trái (Đ4 chấp nhận).

### Dữ liệu/API
Không đổi.

### Giao diện
| Khóa | vi | en |
|---|---|---|
| `common.panel.close` | ← Đóng | ← Close |
| `common.panel.position` | {{i}}/{{n}} | {{i}}/{{n}} |
| `catalog.panel.edit` / `add` | Sửa món {{name}} / Thêm món | Edit item {{name}} / Add item |

### Tiêu chí nghiệm thu
| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 1 | R-D1.1, R-D1.3 | 1280 và 1920: bề rộng `.shell__panel` = vw − 252 − 40 (±2) ở **mọi** route bảng R-D1.3; 390: không cuộn ngang ở mọi route | PW |
| 2 | R-D1.4 | 1280: mở món ở Danh mục → bề rộng/vị trí lưới không đổi; panel trên, nền mờ phủ cả sidebar (điểm (10,10) thuộc nền mờ) | PW |
| 3 | R-D1.3, R-D1.4 | Như #2 cho Giao hàng, Tổng hợp, Tủ/Kho, Nhân viên, Còn nợ, Nhóm món | PW |
| 4 | R-D1.4 | 767 px: panel rộng 100 % có "← Đóng"; 768 px: panel 440 px, không có thanh đầu 56 px | PW |
| 5 | R-D1.4 | `prefers-reduced-motion: reduce` → không có `transition` trên panel; mặc định → 200 ms | Vitest |
| 6 | R-D1.2 | Quét CSS: không có `max-width` cấp trang/khối trong `web/src/**/*.m1.css` ngoài danh sách cho phép (5 nhóm R-D1.2, khai báo bằng selector); thêm selector lạ → fail | Vitest |
| 7 | R-D1.4 | Không còn class `has-drawer` / `padding-right: var(--drawer-w)` | Vitest |
| 8 | R-D1.5 | Mở món → `history.length` +1; ↓ 3 lần → không tăng; Back → panel đóng, URL không còn `?item`; F5 với `?item=<id>` → panel mở đúng món | PW |
| 9 | R-D1.5 | `?item=<uuid không tồn tại>` và `?item=rac` → không panel, tham số bị gỡ, không toast lỗi; `?item=<id hợp lệ>` → panel mở | Vitest |
| 10 | R-D1.6 | Sửa tên rồi ↓ → hỏi; "Ở lại" → vẫn món cũ, nháp còn; "Bỏ" → sang món kề. Không sửa gì rồi ↓ → sang ngay | Vitest |
| 11 | R-D1.6 | Sửa tên rồi Back → hỏi, URL vẫn có `?item`; "Bỏ" → panel đóng | PW |
| 12 | R-D1.7 | Đóng bằng Esc → `document.activeElement` = thẻ đã mở; bộ đếm "3/48" đúng; mục đầu ↑ vô hiệu, mục thứ hai ↑ bật | Vitest |
| 13 | R-D1.8 | Giao thành công từ panel → panel và hộp đều đóng, toast có "Người tiếp theo"; giao có lỗi → panel và hộp ở lại | Vitest |
| 14 | R-D1.9 | Panel + hộp D7 mở: Esc lần 1 đóng hộp D7 (panel còn), Esc lần 2 đóng panel | Vitest |
| 15 | R-D1.10 | 1920 Tủ/Kho: cuộn 600 px → hàng tiêu đề vẫn ở đỉnh vùng bảng; cột số rộng ≤ 280 px | PW |
| 16 | R-D1.4 | axe 390 với panel mở (Danh mục) và bản en: 0 vi phạm | PW |

**Tiêu chí bổ sung (vòng 4)**

| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 4.1 | R-D1.11 | Menu: nhóm "Hằng tháng" đúng 7 mục, đúng thứ tự; "Xem lại sau" không còn Tổng hợp, Còn nợ, Báo cáo; liên kết "Xem ai đăng ký (3 người)" ở Gửi ADM mở Tổng hợp theo món với đúng `item` | Vitest |

---

## D2. Thứ tự món chung theo số ảnh; bỏ "Thứ tự hiển thị" và "Nhân viên sẽ thấy" (Đ7)

### Hiện trạng
- Ô "Thứ tự hiển thị" ở `web/features/catalog/item-fields.tsx:66`; nháp `sort_order` ở `item-draft.ts:13,26,52,71`. Khối "Nhân viên sẽ thấy" `staff-preview.tsx` (gọi ở `item-drawer.tsx:139`).
- `items.sort_order int NOT NULL DEFAULT 0` (`migrations/0100_vpp_catalog.sql:32`). DTO tùy chọn (`catalog.dto.ts:56`); tạo món không gửi → 0.
- Mỗi nơi xếp một kiểu: `catalog.service.ts:133` (nhóm → sort_order → tên, **thiếu `id`** phân hòa); `catalog-rows.ts:43` (`localeCompare('vi')`, khác `lower()` của PG); `report-queries.ts:64,99` (có `c.id, i.id`); `stock-query.service.ts:72` (không xét nhóm). Nhập Booking ghi `hàng × 10` (`booking-import.ts:104`).
- DB dev 2026-11-06: 50 món `active`, 5 món mới đang `sort_order = 0`. Ảnh gốc `/home/ims/Desktop/VPP-hinh-san-pham/NN - <tên>.jpg`; bảng ảnh ↔ `code` ở `live-real/v2c/catalog-reset.md`.

### Quy tắc mới
- **R-D2.1** Ô sửa món (tạo và sửa) **không còn** "Thứ tự hiển thị"; web không gửi `sort_order`.
- **R-D2.2** Ô sửa món **không còn** "Nhân viên sẽ thấy"; xem trước duy nhất là ô ảnh.
- **R-D2.3** `[r2·sửa]` **Một thứ tự chung**, hiện thực bằng **một** mảnh SQL `ITEM_ORDER` (`api/modules/catalog/item-order.ts`: `c.sort_order NULLS LAST, c.name, i.sort_order, lower(i.name) COLLATE "C", i.id`, nhóm NULL/không tồn tại cuối) và **một** comparator TS `compareItems` (`web/lib/item-order.ts`, cùng khóa, so chuỗi bằng `toLowerCase()` + so mã điểm, **không** `localeCompare`). Áp cho: lưới Đăng ký nhân viên (chế độ "Theo nhóm"), Danh mục (lưới, bảng), Tổng hợp theo món, Báo cáo, Excel mẫu phòng, bản in trình ký, xem trước Gửi ADM, Hàng về, Tủ/Kho, tủ sắp hết, panel Nhóm món (D12), hộp giao (trong cùng kỳ). Chế độ "Tên A→Z" và "Hay dùng trước" của nhân viên giữ nguyên.
- **R-D2.4** `[r2·sửa]` Bước dữ liệu một lần: `sort_order = số ảnh × 10` cho 50 món, khớp theo `code`. File `ops/data/2026-11-06-sort-order-from-photos.sql` là **một khối `DO $$ … $$`** tự kiểm: `GET DIAGNOSTICS n = ROW_COUNT; IF n <> 50 THEN RAISE EXCEPTION` (toàn khối rollback); cùng khối chèn **một** dòng `audit_log` `item.reordered` với `detail: {source: 'photo-number', count: 50, before: [{id, sort_order}]}` (giữ số cũ để đảo ngược bằng tay).
- **R-D2.5** `[r2·sửa]` Món mới (Danh mục, "Thêm vào danh mục" từ món ngoài DM, nhập Booking) không gửi `sort_order` → server gán `COALESCE(MAX(sort_order) cùng category_id (NULL là một nhóm), 0) + 10` trong cùng giao dịch → **cuối nhóm**. Đổi nhóm → cuối nhóm mới, cùng công thức. **Không khóa nhóm**: hai thao tác song song có thể ra cùng số; chấp nhận vì `lower(name)` rồi `id` phân hòa ổn định.
- **R-D2.6** Tương thích API: `sort_order` vẫn nhận (tùy chọn, `SortOrder`) và vẫn trả về; client cũ gửi không lỗi. Nhập Booking bỏ `hàng × 10`, dùng R-D2.5. Không migration schema.
- **R-D2.7** Thẻ Đăng ký và thẻ Danh mục dùng cùng `file_id`, khung 1:1, `object-fit: contain`.
- **R-D2.8** Kéo-thả sắp lại món: **ngoài phạm vi** (Đ7). Không có giao diện nào khác đổi `items.sort_order` trong vòng này.

### Bước dữ liệu (R-D2.4)
```sql
DO $$
DECLARE n int; before jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('id', id, 'sort_order', sort_order)) INTO before FROM items WHERE active;
  UPDATE items i SET sort_order = m.no * 10, updated_at = now()
  FROM (VALUES
    ('B05',1), ('B04',2), ('B47',3), ('K05',4), ('K04',5), ('B18',6), ('A01',7), ('BIA-CAY',8), ('B17',9), ('B19',10),
    ('B12',11), ('B22',12), ('BIA-2-KEP-F4',13), ('BIA-CONG-5CM',14), ('K03',15), ('RO-NHUA',16), ('B23',17), ('BUT-BI-TL-027',18), ('B41',19), ('B38',20),
    ('BUT-KIM-JELLITTO-04',21), ('B45',22), ('X01',23), ('R02',24), ('B35',25), ('B34',26), ('R01',27), ('C02',28), ('CHUOT-CHI-QUAY-TAY',29), ('G10',30),
    ('CUC-HIT-30MM',31), ('T06',32), ('G08',33), ('T05',34), ('T04',35), ('G11',36), ('KEP-GIAY',37), ('K10',38), ('KEO-NHO',39), ('DAO-RACH',40),
    ('D02',41), ('M01',42), ('K14',43), ('GO-KIM',44), ('M11',45), ('M03',46), ('M05',47), ('P01',48), ('S02',49), ('T01',50)
  ) AS m(code, no)
  WHERE i.code = m.code;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 50 THEN RAISE EXCEPTION 'sort-order: % dòng, cần 50', n; END IF;
  INSERT INTO audit_log (actor_sub, action, object_type, object_id, detail)
  VALUES ('ops', 'item.reordered', 'catalog', 'photo-number',
          jsonb_build_object('source', 'photo-number', 'count', n, 'before', before));
END $$;
```
Không phải migration (chỉ đúng với bộ 50 món); môi trường thật chạy khi nạp cùng bộ món. Không đảo ngược tự động; `detail.before` là bản sao số cũ.

### Trạng thái & biên
- Món 31 "Cục hít" (nhóm Kẹp & dán) vẫn nằm trong nhóm Kẹp & dán (nhóm trước, số sau).
- Hai món cùng `sort_order` → `lower(name)` → `id`.
- Nhóm rỗng: MAX NULL → 10. Món chưa xếp nhóm: nhóm NULL, đứng cuối, có MAX riêng.

### Dữ liệu/API
| Thay đổi | Chi tiết |
|---|---|
| `GET /items`, `GET /admin/items`, báo cáo, tủ sắp hết, Hàng về, Nhóm món | `ORDER BY ${ITEM_ORDER}` |
| `POST /admin/items`, `PATCH` đổi `category_id`, review convert, Booking import | Gán theo R-D2.5 |

### Giao diện
Xóa khóa `catalog.form.sortOrder`, `catalog.form.sortOrderHint`, `catalog.staffPreview.*` (vi/en) và `staff-preview.test.tsx`.

### Tiêu chí nghiệm thu
| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 1 | R-D2.1, R-D2.2 | Ô sửa món không có "Thứ tự hiển thị" và "Nhân viên sẽ thấy"; payload tạo/sửa không có khóa `sort_order` | Vitest |
| 2 | R-D2.3 | Cùng một fixture 6 món (2 nhóm + 1 chưa nhóm, 2 món trùng `sort_order`, tên có dấu "Ấn" vs "An"): cùng dãy `id` ở `/items`, `/admin/items`, báo cáo `byItem`, Excel mẫu phòng (đọc lại file), tủ sắp hết | API |
| 3 | R-D2.3 | `compareItems` cho cùng dãy với #2 trên cùng dữ liệu (test so khớp TS ↔ SQL, dữ liệu xuất từ #2) | Vitest |
| 4 | R-D2.4 | DB test tạo đúng 50 món theo `code` → chạy file ops → 50 dòng đổi, 1 dòng audit có `before` 50 phần tử; với **49** món → exception, 0 dòng đổi, 0 audit; với 51 món (thêm 1 mã lạ) → 50 dòng đổi, món lạ giữ số | DB |
| 5 | R-D2.5 | Nhóm max 480 → tạo món = 490; nhóm rỗng → 10; nhóm NULL max 30 → 40; đổi nhóm sang Lưu trữ (max 200) → 210 | API |
| 6 | R-D2.6 | Gửi `sort_order: 5` → 200, lưu 5; không gửi → R-D2.5 | API |
| 7 | R-D2.7 | Thẻ Đăng ký và thẻ Danh mục của cùng món render cùng `src` ảnh, `object-fit: contain` | Vitest |
| 8 | R-D2.8 | Quét TSX: không ô/nút nào gửi `sort_order` trong `features/catalog` | Vitest |

---

## D3. Món ngoài danh mục: trạng thái trống theo v2, hộp chấp nhận rõ nghĩa

### Hiện trạng
- `/admin/review` tab Chờ xem rỗng → `EmptyState art="no-match"` + "Không còn món nào chờ xem" + "Xem món đã chấp nhận" (`web/features/review/review-page.tsx:89-100`; `web/locales/vi/review.ts:22-23`).
- `no-match` là hình **kính lúp** M1 160×120 (`web/ui/empty-art-paths.ts:1,6`), token P3 cũ (`web/css/tokens-m1.css:24,44`) — sai nghĩa và lệch bảng màu v2.
- Ngôn ngữ v2: khung trắng mờ bo 20, tiêu đề `#0E2A33`, phụ `#47636C` 14 px, nút pill; icon nét 24, `stroke-width 1.6`, đầu tròn.

### Quy tắc mới
- **R-D3.1** `[r2·sửa]` Tab Chờ xem rỗng dùng minh họa `review-clear`: vòng 96 px nền `--c-acc-soft` (#DDF1F5), giữa là icon nét 48 px "khay có dấu tích", nét `--c-acc` (#0E6A7B) 1.6, đầu/khớp tròn; thêm hai chấm 4 px góc trên phải `--c-acc` 40 %. Không dùng `--ill-*`, `--g*`, `--k-*`.
- **R-D3.2** `[r2·sửa]` Khung trống: rộng hết vùng danh sách, `min-height: 320px`, nền `rgb(255 255 255 / .6)`, bo 20, đệm 32; nội dung tối đa 480 px căn giữa; tiêu đề 20/700 `--c-ink`, phụ 14 `--c-muted`; nút phụ pill trắng.
- **R-D3.3** `[r2·sửa]` Chữ theo trạng thái kỳ (D8 chỉ cho xem kỳ đã khóa):
  - xem một kỳ đã khóa, còn 0 dòng chờ → tiêu đề "Không còn món nào chờ xem" + nút "Xem món đã chấp nhận";
  - kèm dòng phụ khi có kỳ đang mở: "Món ngoài danh mục của kỳ tháng {{month}} sẽ hiện ở đây từ {{lockPhrase}}." (`lockPhrase` theo R-D8.11, ví dụ "00:00 ngày 11/11");
  - chưa có kỳ nào khóa → khung trống chung R-D8.10 thay cho khung này.
- **R-D3.4** Minh họa `aria-hidden="true"`, không chữ trong SVG, không hoạt ảnh. Nét/nền ≥ 3:1.
- **R-D3.5** Ba tab còn lại rỗng dùng `review-none` (khay rỗng, nét `--c-muted`, nền `--c-surface-2`). Kính lúp chỉ còn cho "tìm/lọc không ra".

- **R-D3.6** `[r3·mới]` (rà soát #3, Cao) Hộp "Mua lần này" (chấp nhận) và "Mua và thêm vào danh mục": nếu kỳ của dòng **đã có bản chốt có hàng** (R-D5.16) và khóa món ngoài DM của dòng (`custom:[name,unit]`) **không có** trong `data.custom` của bản chốt đó (hoặc có với Đề nghị 0) → hộp hiện khối cảnh báo: "Phiếu gửi ADM lúc {{hh:mm dd/mm}} chưa có món này. Sau khi chấp nhận, vào Gửi ADM để làm bản mới và in lại, hoặc tự mua riêng." kèm liên kết "Mở Gửi ADM". Chưa có bản chốt → không cảnh báo. Dữ liệu: `GET /admin/review` thêm `in_sent_snapshot: boolean | null` mỗi dòng (`null` khi kỳ chưa có bản chốt).
- **R-D3.7** `[r3·mới]` (rà soát #3, Vừa) Ba nút trên thẻ món ngoài DM đổi chữ theo việc: **"Mua lần này"** (thay "Chấp nhận") · **"Mua và thêm vào danh mục"** (thay "Thêm vào danh mục") · **"Không mua"** (thay "Từ chối"); bỏ dòng chữ xám giải thích phía trên. Trạng thái trên tab giữ tên cũ (Đã chấp nhận / Đã thêm danh mục / Đã từ chối) vì là nhãn trạng thái, không phải hành động.

### Trạng thái & biên
- Đang tải → `Loading`; lỗi → `LoadError`; không bao giờ hiện minh họa trống khi lỗi (`web/ui/load-state.tsx:8`).
- `useCurrentPeriod` lỗi → bỏ dòng phụ, giữ tiêu đề.

### Dữ liệu/API
Không đổi.

### Giao diện
| Khóa | vi | en |
|---|---|---|
| `review.empty.pending` | Không còn món nào chờ xem | Nothing left to review |
| `review.empty.pendingHintOpen` (mới) | Món ngoài danh mục của kỳ tháng {{month}} sẽ hiện ở đây từ {{lockPhrase}}. | Off-catalogue items for {{month}} will appear here from {{lockPhrase}}. |
| `review.empty.pendingAction` | Xem món đã chấp nhận | View accepted items |
| `review.actions.accept` (sửa) | Mua lần này | Buy this time |
| `review.actions.convert` (sửa) | Mua và thêm vào danh mục | Buy and add to catalogue |
| `review.actions.reject` (sửa) | Không mua | Don't buy |
| `review.accept.notInSnapshot` (mới) | Phiếu gửi ADM lúc {{time}} chưa có món này. Sau khi chấp nhận, vào Gửi ADM để làm bản mới và in lại, hoặc tự mua riêng. | The ADM order sent at {{time}} doesn't include this item. After accepting, make a new order in Send to ADM and reprint, or buy it separately. |

### Tiêu chí nghiệm thu
| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 1 | R-D3.1, R-D3.5 | Chờ xem rỗng render `review-clear`; Đã chấp nhận rỗng render `review-none`; tìm không ra render `no-match` | Vitest |
| 2 | R-D3.3 | Có kỳ mở 2026-11 (deadline `2026-11-10T17:00Z`): dòng phụ chứa "00:00 ngày 11/11"; `useCurrentPeriod` lỗi → không dòng phụ, vẫn tiêu đề | Vitest |
| 3 | R-D3.3 | Chạy dưới `TZ=America/Los_Angeles` và `TZ=Pacific/Kiritimati`: vẫn "11/11" | Vitest (script TZ) |
| 4 | R-D3.1 | SVG mới không tham chiếu `--ill-`/`--g[0-9]`/`--k-` | Vitest |
| 5 | R-D3.2 | 1920: khung rộng = vùng danh sách, cao ≥ 320, khối chữ ≤ 480 px | PW |
| 6 | R-D3.4 | SVG có `aria-hidden="true"`, không `<text>`, không `<animate>` | Vitest |
| 7 | R-D3.2 | Ảnh chụp tab rỗng 1440 px khớp ảnh chuẩn (dữ liệu fixture, `maxDiffPixelRatio 0.01`, chụp trong container PW) | PW |
| 8 | R-D3.6 | Kỳ có bản chốt có hàng không chứa món X → `in_sent_snapshot: false`, hộp có cảnh báo + liên kết; bản chốt có X với Đề nghị 2 → `true`, không cảnh báo; Đề nghị 0 → `false`; kỳ chưa có bản chốt (hoặc chỉ có bản rỗng cũ) → `null`, không cảnh báo | API + Vitest |
| 9 | R-D3.7 | Thẻ có 3 nút đúng chữ vi/en; không còn dòng chữ xám giải thích; tab vẫn "Đã chấp nhận" | Vitest |

---

## D4. Kiểm tra nút: không còn chữ "biến mất" khi hover/nhấn

### Hiện trạng
- Kiểu nút ở `web/css/m1/base.css:105-131`. `.btn:hover:not(:disabled)` đặt nền `--c-surface-hover` (#F2F8FA), `.btn:active` nền `--c-surface-2` (`:106-107`), độ ưu tiên (0,4,0) cao hơn biến thể không có `:hover` riêng → chữ trắng trên nền gần trắng.

| # | Nút | Trạng thái | Nền / chữ | Tương phản | Nơi dùng |
|---|---|---|---|---|---|
| L1 | `.btn--danger.btn--solid` | hover | #FBE4E1 / #FFF | **1.21** | `confirm-dialog.tsx:49`, `cancel-dialog.tsx:123`, `reject-dialog.tsx:81` |
| L2 | `.btn--danger.btn--solid` | active | #EEF5F7 / #FFF | **1.10** | như trên |
| L3 | `.btn--dark` | hover | #F2F8FA / #FFF | **1.07** | chưa dùng — lỗi tiềm ẩn |
| L4 | `.btn--dark` | active | #EEF5F7 / #FFF | **1.10** | như trên |
| L5 | `.btn.hm-btn-dark` | active không hover | #EEF5F7 / #FFF | **1.10** | `home-cards.tsx:53,70` |

- Nhân viên: `.btn--primary:hover` cũ (`web/css/base.css:15`) phụ thuộc thứ tự nạp CSS. Test hiện có chỉ kiểm cặp token (`tokens-contrast.test.ts:25-31`).

### Quy tắc mới
- **R-D4.1** Mỗi biến thể nút khai báo **đủ 5 trạng thái**, **cả nền lẫn màu chữ**: mặc định, `:hover:not(:disabled)`, `:focus-visible`, `:active:not(:disabled)`, `:disabled`. Biến thể chữ sáng không thừa hưởng nền hover/active của `.btn` gốc.
- **R-D4.2** `[r2·sửa]` Ngưỡng (nền đã trộn alpha với tổ tiên thật):
  - chữ/nền ở mặc định, hover, focus-visible, active: **≥ 4.5:1**; disabled: **≥ 3:1**, không dùng `opacity < .55`;
  - vòng focus với nền kề: **≥ 3:1**;
  - **hover khác mặc định** và **active khác hover**: tỉ lệ độ sáng giữa hai nền **≥ 1.15:1** (nhìn ra được là đang hover/nhấn).
- **R-D4.3** `[r2·sửa]` Ma trận: mọi biến thể dùng thật × 5 trạng thái × 2 shell × nền đặt nút (panel sáng, thẻ trắng, dải tối `hm-hero`, sidebar kính, hộp thoại, **panel phủ kính** R-D1.4). Danh sách sinh tự động từ `className="btn …"` trong mã, **bắt buộc có** `.btn--primary` (teal #0E6A7B, vd "Thêm món") và nút pill trắng trên nền kính; cộng các `<button>` có chữ không mang lớp `btn` (`rq-f-clear`, `rq-bar-save`, `bulk-bar button`, `side__icon-btn`, `seg`, chip lọc dùng chung D11, công tắc D12).
- **R-D4.4** `[r2·sửa]` Sửa L1–L5: `.btn--danger.btn--solid` hover `#8A2418`, active `#71200F`, chữ trắng; `.btn--dark` hover `--c-ink-2`, active `#0A1F26`, chữ trắng; `.hm-btn-dark:active` cùng giá trị. Mọi biến thể nền tối: **nhấn = tối hơn hover**. Nút nhân viên khai báo trạng thái trong `[data-shell='member']`.
- **R-D4.5** Nút chỉ icon: icon/nền ≥ 3:1 mọi trạng thái; có `aria-label`.
- **R-D4.6** Biến thể nút mới phải có trong danh sách của ma trận (test fail nếu gặp tổ hợp lạ).
- **R-D4.7** `[r3·mới]` (rà soát C1, Vừa) **Nguyên nhân gốc**: `[data-shell='admin'] .btn:hover:not(:disabled)` và `.btn:active:not(:disabled)` (`web/css/m1/base.css:106-107`, độ ưu tiên (0,4,0)) đặt nền trắng cho **mọi** nút; biến thể nào khai hover yếu hơn bị đè — ví dụ `.hm-cta:hover` (`home.m1.css:28`, (0,3,0)) nên nút sáng "Mở Giao hàng" trên dải tối hover thành `#F2F8FA`. Sửa bằng **biến tùy chỉnh**: luật gốc chỉ đọc biến (`.btn { background: var(--btn-bg, var(--c-surface)); color: var(--btn-fg, var(--c-ink)) }`, `.btn:hover { background: var(--btn-bg-hover, var(--c-surface-hover)) }`, `.btn:active { background: var(--btn-bg-active, var(--c-surface-2)) }`); mỗi biến thể **chỉ khai biến** (`--btn-bg`, `--btn-bg-hover`, `--btn-bg-active`, `--btn-fg`), không viết lại `:hover`. Nền trắng mặc định chỉ còn là giá trị dự phòng của nút trắng. `.hm-cta`: `--btn-bg: var(--c-bar-fill)` (#9FE3F0), `--btn-bg-hover: #C4EEF6`, `--btn-bg-active: #8AD6E5`, `--btn-fg: var(--c-dark)`.
- **R-D4.8** `[r3·mới]` (rà soát C2, Vừa) Nút **đóng hộp thoại** (không làm gì) luôn là **"Quay lại"**, không bao giờ "Hủy"/"Tiếp tục sửa"; "Hủy …" chỉ dùng cho hành động thật (Hủy nợ). Áp cho mọi hộp: giao (D7), Hủy nợ (D14), Bỏ thay đổi ("Ở lại"/"Bỏ thay đổi" giữ vì là lựa chọn), xác nhận ngừng nhóm (D12), Đủ hàng (D11), Làm bản mới (D5).

### Trạng thái & biên
- Nền bán trong suốt: đo trên màu trộn tại tâm nút. `opacity` disabled đo sau khi trộn. `transform: scale(.97)` không ảnh hưởng.

### Dữ liệu/API
Không đổi.

### Giao diện
Không đổi chữ.

### Tiêu chí nghiệm thu
| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 1 | R-D4.1–R-D4.3 | **Ma trận nút**: chèn mọi biến thể vào mỗi nền × shell, ép trạng thái bằng CDP `CSS.forcePseudoState`, đo `getComputedStyle` (trộn alpha), fail liệt kê *biến thể × trạng thái × shell × nền × tỉ lệ*; ngưỡng 4.5 / 3 / 1.15 | PW |
| 2 | R-D4.4 | L1–L5 sau sửa: chữ ≥ 4.5. Ca âm: nạp bản CSS cũ (chuỗi fixture lấy từ `base.css` hiện tại) vào cùng ma trận → test báo đúng 5 ô L1–L5 dưới 4.5 | PW |
| 3 | R-D4.1 | Quét CSS: biến thể có `color: var(--c-on-dark|--c-on-acc)` phải có luật `:hover` và `:active` riêng đặt cả `background` lẫn `color` | Vitest |
| 4 | R-D4.6 | Quét TSX: mọi tổ hợp `className="btn …"` có trong danh sách khai báo; thêm tổ hợp lạ trong fixture → fail | Vitest |
| 5 | R-D4.2 | Quét CSS: không `opacity` < .55 trên `:disabled` của nút | Vitest |
| 6 | R-D4.5 | Mọi `<button>` không chữ có `aria-label` (quét render các trang chính) | Vitest |
| 7 | R-D4.2 | axe trên Tháng này, Giao hàng, Danh mục, Đăng ký, Hàng về ở 390: 0 lỗi `color-contrast` | PW |
| 8 | R-D4.7 | Ma trận nút thêm phép kiểm "giữ sắc": biến thể có nền mặc định ≠ `--c-surface` thì nền hover và active **không được** bằng `--c-surface-hover`/`--c-surface-2`; `.hm-cta` hover = `#C4EEF6` (trước sửa: `#F2F8FA` → ca âm fail) | PW |
| 9 | R-D4.7 | Quét CSS: ngoài `base.css` không còn luật `.btn…:hover`/`:active` đặt `background` trực tiếp trong `[data-shell='admin']`; mọi biến thể có `--btn-bg` thì có `--btn-bg-hover` và `--btn-bg-active` | Vitest |
| 10 | R-D4.8 | Quét `locales/*`: khóa nút đóng hộp (`*.cancel`, `*.back`, `*.close` của hộp thoại) có giá trị "Quay lại"/"Back"; không khóa nào của nút đóng là "Hủy" | Vitest |

---

## D5. Gửi ADM và "In trình ký": số đề nghị chỉ đọc, chốt bản, in tại chỗ, bản đã gửi (Đ5, Đ15, Đ27, Đ29, Đ30, Đ32)

### Hiện trạng
- "In trình ký" ở Gửi ADM (`send-adm-page.tsx:105`) và Báo cáo tạo bản chốt `POST /admin/reports/:ym/snapshots {kind:'print', order_qty}` (`use-snapshot.ts:76-84`), còn món ngoài DM chờ xem thì hỏi trước (`PendingDialog`, `send-adm-page.tsx:117`); mỗi lần bấm luôn tạo bản chốt **mới** (`snapshots.service.ts:37-87`).
- Xong chỉ toast "Mở bản in" → `window.open(…,'_blank')` sang tab mới, ở đó phải bấm "In" (`print-page.tsx:35`).
- Trang in riêng `/admin/reports/snapshots/:id/print` ngoài shell; Quay lại luôn về Báo cáo (`print-page.tsx:24`).
- `@page` **toàn cục** (`print.m1.css:44`, nạp tĩnh qua `app-routes.tsx:24`).
- `snapshots.service.ts:44-46`: nhận `ym ≤ kỳ mở` (kể cả kỳ mở), `ensurePeriod`.
- Rà soát UX (mục 4, 13): cột "Đề nghị" là ô nhập trắng có mũi tên, toàn số 0 sau Hàng về vì trang luôn **tính lại theo tủ hiện tại**; trang không cho biết kỳ đã gửi; app cho chốt và in **phiếu trống có chỗ ký** (bản 09:23 06/11 trên dev) — và vì Đ24 lấy bản mới nhất, chỉ cần in một phiếu trống là "Đủ hàng" ra 0. Báo cáo lặp lại Gửi ADM với ô sửa "Đặt mua" riêng (2 nơi lập số). Hộp rời trang ghi "Sang tháng khác sẽ bỏ" dù HC chỉ sang Hàng về; dòng giới thiệu bị cắt "…"; bảng cuộn trong khung cố định (6/11 món), xem trước A4 chiếm nửa màn.

### Quy tắc mới
- **R-D5.1** `[r3·sửa]` "In trình ký" **chỉ có ở Gửi ADM**, chế độ Lập phiếu (R-D5.13; Báo cáo chỉ đọc, R-D5.15). Bấm → (`PendingDialog` nếu cần) → `POST …/snapshots {kind:'print', order_qty, reuse_if_unchanged: true}` (R-D5.9) → server trả **cả `data`** → dựng tờ in vào vùng in → `window.print()`. Không đổi URL, không mở tab, không toast "Mở bản in".
- **R-D5.2** Nội dung in = đúng bản chốt (số đóng băng), dùng chung `PrintRequestForm`; phụ lục không in từ nút này. Cạnh nút có chữ nhỏ "Không in kèm phụ lục".
- **R-D5.3** `[r2·sửa]` Gọi `window.print()` sau khi: có `data`, `document.fonts.ready`, mọi `<img>` trong vùng in đã `decode()` — ảnh dùng `loading="eager"`; chờ **tối đa 3 s**, quá hạn vẫn in (ảnh lỗi không treo nút). Một lần bấm = một lần gọi. Nút ở trạng thái "Đang chuẩn bị bản in…" (spinner, vô hiệu, `aria-busy`) tới khi hộp in mở.
- **R-D5.4** `[r2·sửa]` Vùng in được **portal ra `document.body`**, ngoài cây shell. `@media print`: ẩn `#root` (toàn bộ shell, panel, toast, hộp thoại), chỉ hiện vùng in. Gỡ vùng in khi: `afterprint`; **hoặc** unmount trang; **hoặc** trước lần in kế (không dựa riêng `afterprint`, vì iOS/Firefox không tin cậy).
- **R-D5.5** `[r2·sửa]` `@page { size: A4 portrait; margin: 14mm 14mm 16mm; }` chỉ có hiệu lực trong lúc in từ app: chèn `<style>` ngay trước `window.print()`, gỡ cùng lúc với vùng in (R-D5.4); trang in riêng chèn khi mount, gỡ khi unmount. Không còn `@page` toàn cục. `thead { display: table-header-group }`, `tr { break-inside: avoid }`, khối ký `break-inside: avoid`, `print-color-adjust: exact`.
- **R-D5.6** Trang in riêng giữ cho in lại: "In lại" ở danh sách Bản chốt mở trang in riêng **cùng tab**, không tự in; Quay lại về trang đã mở (`?from=send-adm|reports`; thiếu hoặc giá trị lạ → Báo cáo). Tờ hiện 210 mm × tối thiểu 297 mm.
- **R-D5.7** `[r3·sửa]` Xem trước A4 ở Gửi ADM **thu vào nút "Xem trước bản in"** (rà soát #4): mở hộp thoại rộng, tờ 210 mm, thu bằng `transform: scale()` khi khung hẹp (không reflow). Bảng số chiếm bề rộng trang, cao theo nội dung (không khung cuộn cố định).
- **R-D5.8** `[r3·sửa]` "Xuất Excel mẫu phòng": ở chế độ Lập phiếu tạo bản chốt mới `kind: 'xlsx'` (cùng điều kiện Đ30, R-D5.11) rồi tải file; ở chế độ Đã gửi là "Xuất Excel bản này" → `GET /admin/reports/snapshots/:id/export.xlsx` của bản đang hiện, **không** tạo bản chốt.
- **R-D5.9** `[r3·sửa]` (Đ15) **Dùng lại bản chốt**: với `reuse_if_unchanged: true`, server dựng báo cáo trong tx REPEATABLE READ như hiện nay rồi so với **bản chốt có hàng (R-D5.16) mới nhất cùng `ym` và cùng `kind`**: nếu `canonicalJson(report + order_qty + signature_boxes)` (bỏ `generated_at`, `created_at`, `created_by`) **bằng nhau** → trả **200** `{id: <bản cũ>, reused: true, data}`, không chèn dòng, không audit; khác (hoặc chưa có bản nào) → **201** bản mới `{reused: false}`. Web gửi cờ này cho "In trình ký"; Excel không gửi.
- **R-D5.10** `[r2·mới]` Phát hiện bị chặn in: sau khi gọi `window.print()`, nếu không có `beforeprint` trong **1 s** → toast "Bấm để mở hộp in" có nút In (gọi lại trong cử chỉ người dùng). Sau `afterprint` (hoặc khi trang lấy lại focus mà vùng in còn) → toast nhẹ "Đã chốt bản {{time}}. Cần in lại: mở Bản chốt."
- **R-D5.11** `[r3·sửa]` (Đ30) **Không chốt phiếu trống**: sau khi áp `order_qty` (mặc định gộp R-D13.2 + ô đã sửa), nếu **tổng Đề nghị = 0** (kể cả kỳ không có hàng nào) → `POST …/snapshots` (mọi `kind`) trả 409 `ORDER_EMPTY`, không tạo bản chốt, không audit. Web: "In trình ký" và "Xuất Excel" vô hiệu kèm lý do **"Chưa có món nào để đề nghị"**. Thay mã `REPORT_EMPTY` của vòng 2.
- **R-D5.12** `[r3·sửa]` Dưới nút In trình ký (chỉ Gửi ADM, R-D5.15) có gợi ý: "Trong hộp in: chọn máy in, khổ A4; tắt 'Đầu trang và chân trang'."
- **R-D5.13** `[r4·sửa]` (Đ29) **Hai chế độ của Gửi ADM** cho một kỳ: `[r4]` Trạng thái đầy đủ và chuyển trạng thái của kỳ ở Gửi ADM: bảng vòng đời R-D5.19 (thêm trạng thái "Không cần đề nghị" của Đ42 và luật bản thay thế Đ44). Hộp "Làm bản mới" (Đ44) đổi chữ: "Làm bản mới? Bản mới sẽ **thay thế toàn bộ** bản in lúc {{hh:mm dd/mm}} — tờ in ghi rõ để ADM bỏ bản cũ. Hàng về và nút 'Đủ hàng' sẽ theo bản mới."
  - **Đã gửi** — khi kỳ có ≥ 1 bản chốt có hàng (R-D5.16): mặc định mở chế độ này. Băng xanh "Đã gửi ADM lúc {{hh:mm dd/mm}} · {{x}} món, {{y}} đơn vị" (bản có hàng mới nhất, mọi `kind`). Bảng **chỉ đọc** theo `data` của bản đó (Đề nghị = `order_qty`, không tính lại theo tủ hay phiếu hiện tại). Nút: **"In lại bản này"** (in tại chỗ từ `data` có sẵn, không `POST`, R-D5.3–R-D5.5), **"Xuất Excel bản này"** (R-D5.8), **"Làm bản mới"** (phụ). Có cảnh báo R-X.1 nếu có thay đổi sau bản này.
  - **Làm bản mới** → hộp xác nhận "Làm bản mới? Sau khi in bản mới, Hàng về và nút 'Đủ hàng' sẽ theo bản mới. Bản đã gửi vẫn giữ trong danh sách Bản chốt." [Quay lại] [Làm bản mới] → chế độ **Lập phiếu**: số mặc định tính sống (R-D13.2); các ô đã sửa ở bản trước **được mang sang** như số đã sửa (nhãn R-D5.14) nếu hàng còn tồn tại. Rời chế độ Lập phiếu mà chưa in/xuất → hỏi R-D5.17; bỏ → về chế độ Đã gửi.
  - **Lập phiếu** — khi kỳ chưa có bản chốt có hàng: mở thẳng chế độ này.
  - In trình ký trong chế độ Lập phiếu mà số liệu trùng bản có hàng mới nhất → dùng lại (R-D5.9), quay về chế độ Đã gửi với bản đó.
- **R-D5.14** `[r4·sửa]` (Đ27) Cột **Đề nghị** ở chế độ Lập phiếu là **số đậm chỉ đọc**, không khung; dòng xám ngay dưới: "= {{a}} đăng ký + {{b}} nợ" (luôn hiện, không cần rê chuột; không nhắc tủ — Đ25); liên kết nhỏ **"Sửa số"** → số thành ô nhập (`inputmode="numeric"`, **không** mũi tên tăng/giảm, không đổi số khi cuộn chuột) + liên kết "Về số gợi ý". Dòng đã sửa có nhãn cam **"Đã sửa: {{x}} (gợi ý {{y}})"**. Đầu bảng: "Số đề nghị app tự tính từ phiếu nhân viên. Chỉ sửa khi muốn xin dư hoặc bỏ món." Mọi ô số trong app Hành chính bỏ mũi tên tăng/giảm (`appearance: textfield`) và bỏ đổi số bằng con lăn. `[r4]` Dòng xám đầy đủ (Đ39, Đ40, Đ41, GAP-18): "= {{a}} đăng ký + {{b}} nợ" và nối thêm khi có: " − {{c}} ADM còn nợ giao (tháng {{m}})", " · không tính {{e}} của người đã nghỉ"; khi đã giao trước một phần của kỳ: "{{a}} đăng ký chưa giao". Ngay dưới là **dòng lệch số** D17 (W1). Dòng món ngừng: nhãn "Ngừng dùng" (R-D13.10).
- **R-D5.15** `[r3·mới]` (Đ32) **Báo cáo và trang in chỉ đọc**: bỏ ô sửa "Đặt mua" (`report-order-cell.tsx`, `use-order-qty.ts` khỏi Báo cáo), bỏ nút "In trình ký"/"Xuất Excel mẫu phòng" khỏi Báo cáo; Báo cáo hiện số Đề nghị **của bản có hàng mới nhất** nếu có (ghi "theo bản đã gửi {{time}}"), nếu chưa có thì số gợi ý gộp (ghi "gợi ý, chưa gửi"). Tên cột dùng **đúng tên ở Gửi ADM**: Đăng ký · Nợ tháng trước · Tủ hiện có (tham khảo) · Tổng cần · Đề nghị. Liên kết "Sửa số đề nghị ở Gửi ADM →". Danh sách Bản chốt ở Báo cáo giữ "In lại" (trang in riêng, R-D5.6) và tải Excel của bản.
- **R-D5.16** `[r3·mới]` **Bản chốt có hàng** ⇔ `Σ data.order_qty > 0` (truy vấn: `EXISTS (SELECT 1 FROM jsonb_each_text(data->'order_qty') e WHERE e.value::int > 0)`). Mọi chỗ cần "bản mới nhất" — chế độ Đã gửi (R-D5.13), nguồn Hàng về và "Đủ hàng" (R-D11.6), bước Gửi ADM ở Tháng này (R-D5.18), cảnh báo R-X.1, so sánh dùng lại (R-D5.9), cảnh báo món ngoài DM (R-D3.6) — **chỉ xét bản có hàng**. Bản rỗng tạo trước khi triển khai (vd 09:23 06/11 trên dev) vẫn nằm trong danh sách Bản chốt với nhãn xám "Không có món", trang in của nó hiện "Bản này không có món nào — không cần trình ký." và **tắt nút In**. Không bản rỗng nào có thể thành "mới nhất" (Đ30 chặn tạo mới, R-D5.11; vị từ này lọc bản cũ).
- **R-D5.17** `[r3·mới]` (rà soát #4, Vừa) Bố cục và chữ Gửi ADM: dòng giới thiệu xuống dòng, không cắt "…" ở 1024/1280; hộp rời trang khi có số đã sửa chưa in: "Bỏ số Đề nghị vừa sửa? Bạn đã sửa {{n}} món nhưng chưa In trình ký. Rời trang sẽ mất các số này." [Ở lại] [Bỏ thay đổi] — không còn câu "Sang tháng khác"; đổi tháng trong trang dùng cùng hộp.
- **R-D5.18** `[r3·mới]` (rà soát #1, Vừa) Bước "Gửi ADM" ở Tháng này: xong ⇔ có bản chốt có hàng; giá trị "Đã gửi {{hh:mm dd/mm}} · {{x}} món, {{y}} đơn vị" từ bản có hàng mới nhất + liên kết "Xem bản đã gửi" (mở Gửi ADM chế độ Đã gửi). Không còn "n bản chốt".
- **R-D5.19** `[r4·mới]` **Vòng đời phiếu gửi ADM của một kỳ** (kiểm Đ15, Đ29, Đ30, Đ42, Đ44 nhất quán). "Bản" = bản chốt **có hàng** (R-D5.16); bản rỗng cũ bị bỏ qua ở mọi trạng thái.

  | Trạng thái | Điều kiện (server) | Gửi ADM mở | Nguồn Hàng về / Đủ hàng | Bước Tháng này |
  |---|---|---|---|---|
  | **Chưa khóa** | kỳ mở | Không mở được (R-D8.10) | — | — |
  | **Chưa gửi** | khóa, 0 bản, `no_order_at` NULL | Lập phiếu | Số gộp, ghi chú "Chưa in trình ký" (R-D11.7); "Đủ hàng" vô hiệu | Gửi ADM: chưa xong |
  | **Không cần đề nghị** (Đ42) | khóa, 0 bản, `no_order_at` có | Băng "Tháng này không cần đề nghị ADM ({{hh:mm dd/mm}}, {{người}})" + nút "Lập phiếu" | Không có kế hoạch: chỉ "Thêm món khác" và "Về bù kỳ trước" | Gửi ADM: "Không cần đề nghị ADM · {{hh:mm dd/mm}}" (xong); Hàng về: "Không có đơn gửi ADM" (xong) |
  | **Đã gửi** | ≥ 1 bản | Đã gửi, chỉ đọc theo bản mới nhất (Đ29) | Bản mới nhất (Đ24, Đ44) | "Đã gửi {{time}} · x món, y đơn vị" (R-D5.18) |
  | **Đang làm bản mới** | (chỉ ở trình duyệt; server vẫn Đã gửi) | Lập phiếu, số đã sửa mang sang | Vẫn bản mới nhất cho tới khi in bản mới | Như Đã gửi |

  | Từ | Hành động | Điều kiện | Kết quả |
  |---|---|---|---|
  | Chưa gửi | In trình ký / Xuất Excel | tổng Đề nghị > 0 | Tạo bản (không dòng thay thế) → **Đã gửi** |
  | Chưa gửi | In trình ký / Xuất Excel | tổng = 0 | 409 `ORDER_EMPTY` (Đ30); hiện nút Đ42 → vẫn Chưa gửi |
  | Chưa gửi | "Tháng này không cần đề nghị ADM" + xác nhận | tổng = 0 (server tính lại có `order_qty` gửi kèm) | Ghi `no_order_at` → **Không cần đề nghị**; tổng > 0 → 409 `ORDER_NOT_EMPTY` |
  | Không cần đề nghị | "Lập phiếu" | — | Xóa cờ (audit) → **Chưa gửi** |
  | Không cần đề nghị | (gọi thẳng API tạo bản) | tổng > 0 | Tạo bản, **tự xóa cờ** → Đã gửi |
  | Đã gửi | "In lại bản này" / "Xuất Excel bản này" | — | Không tạo bản → Đã gửi (cùng bản) |
  | Đã gửi | "Làm bản mới" + xác nhận | — | **Đang làm bản mới** |
  | Đang làm bản mới | In / Excel | số trùng bản mới nhất (mọi hàng, cùng `kind`) | Dùng lại bản đó (Đ15, R-D5.9), không dòng thay thế → Đã gửi (cùng bản) |
  | Đang làm bản mới | In / Excel | số khác bản mới nhất | Tạo bản mới có `replaces` (Đ44, R-D5.20) → Đã gửi (bản mới thay nguồn Hàng về) |
  | Đang làm bản mới | Xuất Excel | số trùng bản in mới nhất nhưng khác `kind` | Tạo bản `xlsx` **không** có `replaces` (cùng số ⇒ không phải thay thế) |
  | Đang làm bản mới | In / Excel | tổng = 0 | 409 `ORDER_EMPTY`; **không** có nút Đ42 (đơn đã gửi; muốn hủy cả đơn thì báo ADM ngoài app) |
  | Đang làm bản mới | Rời trang / "Quay lại" | — | Hỏi R-D5.17 → Đã gửi |
- **R-D5.20** `[r4·mới]` (Đ44, GAP-13) **Bản thay thế toàn bộ.** Bản có hàng mới mà `order_qty` khác bản có hàng trước đó của kỳ → lưu `data.replaces = {id, created_at}` của bản trước. Tờ in trình ký, Excel mẫu phòng và trang in riêng của bản này có dòng đầu đậm **"Thay thế bản in lúc {{hh:mm dd/mm}}"**; băng Đã gửi ghi thêm "(thay thế bản {{hh:mm dd/mm}})". Trước khi chốt bản thay thế, hộp xác nhận in liệt kê món đổi số: "Đổi so với bản {{hh:mm dd/mm}}: {{tên}} {{x}} → {{y}}; …" (tối đa 10 dòng + "và n món khác"). Hàng về, "Đủ hàng" và mọi nơi R-D5.16 dùng bản mới nhất; `received` của kỳ **không** reset (đã về theo bản cũ vẫn tính).
- **R-D5.21** `[r4·mới]` (Đ42, GAP-08) **Tháng không cần đề nghị ADM.** Ở chế độ Lập phiếu, khi tổng Đề nghị = 0 **và** kỳ chưa có bản có hàng: thay lý do vô hiệu của In bằng nút phụ **"Tháng này không cần đề nghị ADM"** → hộp "Tháng này không cần đề nghị ADM? Tủ đã đủ cho mọi người đăng ký. Bước Gửi ADM và Hàng về sẽ tính là xong; cần thì vẫn lập phiếu lại được." [Quay lại] [Xác nhận] → `POST /admin/periods/:ym/no-order {order_qty}` (CSRF, `by-ym`, kỳ khóa): ghi `periods.no_order_at`, `no_order_by` (migration `0118_periods_no_order.sql`), audit `period.no_order` (Nhật ký); `DELETE` cùng đường xóa cờ, audit `period.no_order_cleared`. Lỗi: 409 `ORDER_NOT_EMPTY` (tổng server > 0), 409 `ALREADY_SENT` (đã có bản), `PUT` lặp → 200 không đổi. Sau đó Giao hàng làm như thường (giao từ tủ).
- **R-D5.22** `[r4·mới]` (GAP-18) **Cột rõ nghĩa.** Gửi ADM: cột "Đăng ký" = tổng số đăng ký **sau điều chỉnh** của người đang làm việc (không trừ phần đã giao); thêm cột "Đã giao" chỉ khi có hàng > 0; công thức và dòng xám dùng "chưa giao" (R-D5.14). Báo cáo của kỳ đã có bản: phần 1 lấy hàng theo **bản có hàng mới nhất** (không rỗng khi kỳ đã giao xong), kèm cột sống "Đã về" và "Đã giao" để đối chiếu.

### Trạng thái & biên
| Tình huống | Hành vi |
|---|---|
| Tạo bản chốt lỗi (`REPORT_CHANGED`, `INVALID_PERIOD`, `PERIOD_NOT_LOCKED`, `ORDER_EMPTY`, mạng) | Không mở hộp in; báo lỗi như `use-snapshot.ts:85-90` |
| `PendingDialog` → "Quay lại" | 0 bản chốt, 0 lần in |
| Bấm hai lần nhanh | Một request, một lần in (`useSingleFlight`) |
| Hủy trong hộp in, bấm lại, số liệu chưa đổi | Dùng lại bản cũ (200 `reused`), danh sách Bản chốt không thêm dòng |
| Hủy, HC giảm một dòng (D6), bấm lại | Bản mới (201) |
| Ảnh `decode()` reject hoặc treo | In sau tối đa 3 s, ảnh hỏng hiện khung trống |
| Trình duyệt chặn in | R-D5.10 |
| Có số Đề nghị sửa chưa xuất | Sau chốt thành công số đó thành mốc; rời trang không hỏi (`send-adm-page.tsx:86-98`) |
| Kỳ có bản rỗng 09:23 và bản có hàng 22:12 hôm trước | Chế độ Đã gửi theo 22:12; Hàng về theo 22:12 |
| Kỳ chỉ có bản rỗng | Chế độ Lập phiếu; Hàng về "Chưa in trình ký gửi ADM" |
| Mọi ô Đề nghị bị sửa về 0 | In/Excel vô hiệu "Chưa có món nào để đề nghị"; server 409 `ORDER_EMPTY` nếu vẫn gửi |
| Một ô 0, các ô khác > 0 | Cho chốt; hàng 0 vẫn in (Đề nghị 0) |

### Dữ liệu/API
| Endpoint | Thay đổi |
|---|---|
| `POST /admin/reports/:ym/snapshots` | Body thêm `reuse_if_unchanged?: boolean`; phản hồi thêm `reused`, `data`; 200 khi dùng lại, 201 khi tạo; lỗi mới 409 `ORDER_EMPTY` (Đ30); khóa kỳ theo R-D8.1 (`ym` = kỳ mở → 409 `PERIOD_NOT_LOCKED`, `ym` > kỳ mở → 400 `INVALID_PERIOD`) |
| `GET /admin/reports/:ym/snapshots` | Mỗi bản thêm `has_items: boolean`, `items_count`, `units_total` (R-D5.16) |
| `GET /admin/reports/:ym/sent` (mới, `by-ym`) | Bản có hàng mới nhất `{id, kind, created_at, items_count, units_total, data}` hoặc 404 `NO_SENT_SNAPSHOT` — nguồn chung cho chế độ Đã gửi, Tháng này, Báo cáo |

### Giao diện
| Khóa | vi | en |
|---|---|---|
| `reports.page.preparingPrint` | Đang chuẩn bị bản in… | Preparing the print… |
| `reports.page.printFailed` | Đã chốt bản {{time}} nhưng chưa mở được bản in. | Snapshot {{time}} saved, but the print could not be opened. |
| `reports.page.printBlocked` | Bấm để mở hộp in | Click to open the print dialog |
| `reports.page.printedToast` | Đã chốt bản {{time}}. Cần in lại: mở Bản chốt. | Snapshot {{time}} saved. To reprint, open Snapshots. |
| `reports.page.noAppendix` | Không in kèm phụ lục | Appendix not included |
| `reports.page.printTip` | Trong hộp in: chọn máy in, khổ A4; tắt "Đầu trang và chân trang". | In the print dialog: choose the printer and A4; turn off "Headers and footers". |
| `sendAdm.empty` | Chưa có món nào để đề nghị | Nothing to order yet |
| `common.errors.ORDER_EMPTY` | Chưa có món nào để đề nghị. | Nothing to order yet. |
| `sendAdm.sent.banner` | Đã gửi ADM lúc {{time}} · {{x}} món, {{y}} đơn vị | Sent to ADM at {{time}} · {{x}} items, {{y}} units |
| `sendAdm.sent.reprint` / `excel` / `newDraft` | In lại bản này / Xuất Excel bản này / Làm bản mới | Reprint this / Export this to Excel / Make a new order |
| `sendAdm.sent.confirmTitle` | Làm bản mới? | Make a new order? |
| `sendAdm.sent.confirmBody` | Sau khi in bản mới, Hàng về và nút "Đủ hàng" sẽ theo bản mới. Bản đã gửi vẫn giữ trong danh sách Bản chốt. | Once printed, Arrivals and "All arrived" will follow the new order. The sent one stays in Snapshots. |
| `sendAdm.order.formula` | = {{a}} đăng ký + {{b}} nợ | = {{a}} requested + {{b}} carried over |
| `sendAdm.order.edit` / `reset` | Sửa số / Về số gợi ý | Edit / Back to suggestion |
| `sendAdm.order.edited` | Đã sửa: {{x}} (gợi ý {{y}}) | Edited: {{x}} (suggested {{y}}) |
| `sendAdm.order.intro` | Số đề nghị app tự tính từ phiếu nhân viên. Chỉ sửa khi muốn xin dư hoặc bỏ món. | The app works out each order from staff requests. Edit only to order extra or drop an item. |
| `sendAdm.preview` | Xem trước bản in | Preview print |
| `sendAdm.leave.title` / `body` | Bỏ số Đề nghị vừa sửa? / Bạn đã sửa {{n}} món nhưng chưa In trình ký. Rời trang sẽ mất các số này. | Discard edited order numbers? / You edited {{n}} items but haven't printed. Leaving will lose them. |
| `reports.page.sentSource` / `draftSource` | Theo bản đã gửi {{time}} / Gợi ý, chưa gửi | From the order sent {{time}} / Suggested, not sent |
| `reports.page.editAtSendAdm` | Sửa số đề nghị ở Gửi ADM → | Edit order numbers in Send to ADM → |
| `reports.snapshots.empty` | Không có món | No items |
| `reports.print.emptySnapshot` | Bản này không có món nào — không cần trình ký. | This copy has no items — no signature needed. |
| `home.value.sent` | Đã gửi {{time}} · {{x}} món, {{y}} đơn vị | Sent {{time}} · {{x}} items, {{y}} units |
| `home.link.viewSent` | Xem bản đã gửi | View sent order |
| Bỏ `reports.page.toast.print`, `reports.page.toast.openPrint` | — | — |

### Tiêu chí nghiệm thu
| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 1 | R-D5.1 | Bấm In trình ký ở Gửi ADM → URL không đổi, 0 tab mới, `window.print` (stub tự bắn `beforeprint`/`afterprint`) gọi đúng 1 lần sau `POST` | PW |
| 2 | R-D5.4, R-D5.5 | `emulateMedia('print')`: chỉ vùng in hiện kể cả khi panel phủ đang mở; `page.pdf({preferCSSPageSize:true})` ra A4 dọc; báo cáo 60 dòng → ≥ 2 trang, `thead` lặp ở trang 2 | PW |
| 3 | R-D5.4, R-D5.5 | Sau `afterprint`: vùng in và `<style>@page` bị gỡ; stub **không** bắn `afterprint` rồi rời trang → cũng bị gỡ; ở `/admin/home` không có luật `@page` | PW |
| 4 | R-D5.3 | Ảnh `decode()` không bao giờ resolve → `print` gọi sau 3 s (đồng hồ giả) chứ không trước 3 s; ảnh resolve ngay → gọi ngay | Vitest |
| 5 | R-D5.3 | Bấm đúp → 1 `POST`, 1 `print`; nút `aria-busy` trong lúc chờ | Vitest |
| 6 | R-D5.2 | Vùng in không có phụ lục; có chữ "Không in kèm phụ lục" cạnh nút | Vitest |
| 7 | R-D5.6 | "In lại" → trang in riêng cùng tab, không gọi `print`; `?from=send-adm` → Quay lại về Gửi ADM; thiếu `from` và `from=rac` → Báo cáo | Vitest |
| 8 | R-D5.7 | Cột 400 px: tờ xem trước có `transform: scale(<1)`, bề rộng layout vẫn 210 mm | Vitest |
| 9 | R-D5.8 | Xuất Excel 2 lần không đổi số → 2 bản chốt `xlsx` | API |
| 10 | R-D5.9 | In 2 lần không đổi gì → lần 2 trả 200 `reused: true` cùng `id`, `report_snapshots` không thêm dòng, audit không thêm; giảm 1 dòng giữa hai lần → 201 `id` mới; đổi `order_qty` một hàng → 201 | API |
| 11 | R-D5.9 | Bản mới nhất là `xlsx`, in `print` lần đầu → 201 (không dùng lại khác `kind`) | API |
| 12 | R-D5.10 | Stub `print` không bắn `beforeprint` → sau 1 s có toast có nút In; bắn trong 0.5 s → không toast | Vitest |
| 13 | R-D5.11 | Kỳ 0 phiếu → 409 `ORDER_EMPTY`; mọi ô sửa về 0 → 409; một ô = 1 → 201; `kind: 'xlsx'` cùng luật; 0 bản chốt và 0 audit khi 409 | API |
| 14 | R-D5.11, R-D5.12 | Gửi ADM tổng Đề nghị 0: In/Excel vô hiệu, lý do "Chưa có món nào để đề nghị"; tổng 1: bật, có gợi ý in | Vitest |
| 16 | R-D5.13 | Kỳ có bản có hàng → mở chế độ Đã gửi, bảng chỉ đọc đúng `order_qty` của bản (kể cả khi tủ/phiếu hiện tại đã đổi); "In lại bản này" → 0 `POST`, 1 `print`; kỳ chỉ có bản rỗng → chế độ Lập phiếu | Vitest |
| 17 | R-D5.13 | "Làm bản mới" → hộp xác nhận; Quay lại → vẫn Đã gửi; xác nhận → Lập phiếu, ô đã sửa ở bản trước mang sang có nhãn cam; in không đổi số → 200 `reused`, về Đã gửi | Vitest |
| 18 | R-D5.14 | Ô Đề nghị là chữ (không `input`) tới khi bấm "Sửa số"; dòng xám "= 8 đăng ký + 2 nợ"; sửa 12 → nhãn "Đã sửa: 12 (gợi ý 10)"; "Về số gợi ý" bỏ nhãn; quét CSS: `input[type=number]` trong admin có `appearance: textfield`; lăn chuột trên ô không đổi số | Vitest |
| 19 | R-D5.15 | Báo cáo không có ô nhập, không có nút In trình ký/Xuất Excel mẫu; cột Đề nghị = bản có hàng mới nhất khi có, = gộp khi không; tên cột trùng Gửi ADM; có liên kết sang Gửi ADM | Vitest |
| 20 | R-D5.16 | `GET …/sent`: có bản rỗng 09:23 (mới hơn) và bản có hàng 22:12 → trả 22:12; chỉ bản rỗng → 404 `NO_SENT_SNAPSHOT`; trang in của bản rỗng: câu "không cần trình ký", nút In vô hiệu; bản có hàng: nút In bật | API + Vitest |
| 21 | R-D5.17 | 1024 và 1280: dòng giới thiệu không có `text-overflow: ellipsis` bị cắt (chiều cao > 1 dòng khi cần); sửa 1 ô rồi bấm menu Hàng về → hộp đúng chữ mới, "Ở lại" giữ số | PW + Vitest |
| 22 | R-D5.18 | Tháng này: bản có hàng 22:12 05/11 (11 món, 78 đơn vị) → "Đã gửi 22:12 05/11 · 11 món, 78 đơn vị" + liên kết; chỉ bản rỗng → bước chưa xong | Vitest |
| 15 | R-D5.1 | Bản en: nút, toast, gợi ý đúng chữ en | Vitest |

**Tiêu chí bổ sung (vòng 4)**

| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 23 | R-D5.13, R-D5.19 | Chạy hết bảng chuyển trạng thái: mỗi hàng một ca (13 ca) với đúng kết quả server (mã lỗi, bản tạo/dùng lại, cờ `no_order_at`) và đúng chế độ trang | API + Vitest |
| 24 | R-D5.14 | Dòng xám: đăng ký 8, nợ 2, ADM còn nợ 1 (tháng 11), người đã nghỉ 3 → "= 8 đăng ký + 2 nợ − 1 ADM còn nợ giao (tháng 11) · không tính 3 của người đã nghỉ"; đã giao 2 → "6 đăng ký chưa giao" | Vitest |
| 25 | R-D5.20 | Bản 1 (09:02) → không `replaces`; bản 2 khác số → `replaces.id` = bản 1, tờ in và Excel có "Thay thế bản in lúc 09:02 12/12"; bản `xlsx` cùng số bản 2 → không `replaces`; hộp in liệt kê đúng món đổi; Hàng về theo bản 2, `received` giữ | API + Vitest |
| 26 | R-D5.21 | Tổng 0, chưa có bản → nút hiện, xác nhận → `no_order_at` ghi + audit; Tháng này hai bước xong; tổng 1 → 409 `ORDER_NOT_EMPTY`; đã có bản → nút không hiện, API 409 `ALREADY_SENT`; "Lập phiếu" xóa cờ; tạo bản khi có cờ → cờ tự xóa | API + Vitest |
| 27 | R-D5.22 | Đăng ký 5, đã giao 2 → cột Đăng ký 5, cột Đã giao 2, công thức dùng 3; Báo cáo kỳ đã giao hết có phần 1 = hàng của bản mới nhất + Đã về + Đã giao | Vitest + API |

---

## D6. Tổng hợp kỳ — giảm/bỏ dòng có lý do từng dòng, nhân viên được báo (Đ0b, Đ2, Đ11, Đ12, Đ14, Đ18)

### Hiện trạng
- Hành chính sửa phiếu ở ngăn Điều chỉnh (`web/features/summary/adjust-drawer.tsx`, `use-adjust.ts`), lưu `PUT /admin/requests/:id/lines` (`admin-requests.controller.ts:14`).
- **Một** lý do cho cả phiếu (`SaveLinesBody.reason`, ≤ 500, `request.dto.ts:63-66`), bắt buộc ≥ 3 khi kỳ khóa (`request-lines.writer.ts:52,190-198`). Lý do chỉ nằm trong `audit_log.detail.reason` (`writer.ts:101-115`); `request_lines.admin_note` có trong schema nhưng không dùng (`0102:37`).
- Hành chính **tăng/thêm** được ở kỳ khóa (cần lý do phiếu). Nhân viên **không** được báo; Lịch sử không hiện lý do (`history-detail-page.tsx:23-48`) trong khi gợi ý ở ngăn hứa "nhân viên thấy lý do trong Lịch sử" (`locales/vi/summary.ts:132-133`): **hứa sai**.
- Sàn `delivered + cancelled` (`request-lines.diff.ts:121-125` → `QTY_BELOW_DELIVERED`). `qty > 0` ở DB (`0102:30`). Admin bỏ dòng bằng cách **không gửi** dòng, chỉ khi `isDeletable` (`request-lines.rules.ts:45-51`); dòng vắng mà không xóa được thì **giữ âm thầm** (`diff.ts:56-58`). Bỏ dòng cuối → xóa phiếu (`writer.ts:91-93`, BR-12).
- `LinesBody.lines` có `@Type(() => LineInput)` (`request.dto.ts:41-46`) và `whitelist: true` (`app.setup.ts:16`): trường lạ trên dòng bị lột âm thầm.
- Đồng thời: `expected_updated_at` bắt buộc → `STALE_UPDATE` (`request.dto.ts:63-64`, `writer.ts:144-147`).
- Chuông: `notifyWithin` chèn `ON CONFLICT (event_id, user_sub) DO NOTHING` trong SAVEPOINT (`notifications.service.ts:65-90`); `event_id` là text (`0104`).
- Nhánh BR-7 `!args.request` ở chế độ admin (`writer.ts:193-195`) chỉ phục vụ tạo hộ — thành mã chết sau D10.

### Quy tắc mới
Định nghĩa (một lần lưu của Hành chính, chế độ `admin`): với mỗi dòng có trước, **giảm** ⇔ `qty_mới < qty_cũ`; **bỏ dòng** = giảm về 0.

- **R-D6.1** `[r3·sửa]` (Đ0b, Đ2, Đ26) Mỗi dòng **giảm** (kể cả bỏ) có lý do **riêng**: `reason_code` bắt buộc ∈ `over_quota` (Vượt định mức) · `adm_out_of_stock` (ADM không còn hàng) · `duplicate` (Trùng với phiếu khác) · `user_left` (Người đã nghỉ — **không bắt ghi chú**, Đ26) · `other` (Khác). `reason_note`: chuẩn hóa NFC, `trim`; chỉ khoảng trắng = rỗng (lưu NULL); **≤ 200 ký tự đếm theo mã điểm Unicode** (`[...s].length` / `char_length`); **bắt buộc ≥ 3 khi `other`**, tùy chọn với mã khác. Thiếu mã hoặc `other` thiếu/ngắn ghi chú → 400 `REASON_REQUIRED` + `line_id`; mã lạ → 400 `VALIDATION` `fields:['lines.reason_code']` + `line_index`; ghi chú > 200 → 400 `VALIDATION` `fields:['lines.reason_note']`.
- **R-D6.2** `[r2·sửa]` Lý do cấp phiếu `reason` **bị bỏ** khỏi `SaveLinesBody` (Đ12 khiến chỉ còn giảm/bỏ, mỗi dòng đã có lý do riêng). Client cũ gửi `reason` → bị lột (whitelist), không lỗi. Audit không còn `detail.reason`.
- **R-D6.3** `[r3·sửa]` (Đ12; rà soát #3, Cao) Kỳ đã khóa, Hành chính **không** được tăng hay thêm: dòng có `qty_mới > qty_cũ` → 400 `QTY_INCREASE_FORBIDDEN` + `line_id`; dòng không có `id` (dòng mới, món hay ngoài DM) → 400 `LINE_ADD_FORBIDDEN` + `line_index`. Ngăn Điều chỉnh: **không có nút "+"** (chỉ "−", ô số và "Bỏ"; gõ số lớn hơn số cũ → kẹp về số cũ + "Không tăng được sau khóa sổ"), không còn nút "Thêm món".
- **R-D6.4** Dòng **không đổi** số: lý do dòng (nếu gửi) bị bỏ qua, không lưu, không báo.
- **R-D6.5** `[r2·sửa]` Bỏ dòng phải nói rõ: gửi `qty: 0` + lý do. Body admin phải có **mọi** dòng hiện có của phiếu (kể cả dòng `rejected`, dòng đã giao đủ, dòng không đổi); dòng vắng → 400 `LINE_MISSING` + `line_id`. `qty: 0` hợp lệ khi `delivered + cancelled = 0` **bất kể trạng thái duyệt**; còn lại → 400 `QTY_BELOW_DELIVERED` (giảm tối đa về `delivered + cancelled`). Bỏ mã `LINE_NOT_REMOVABLE` (không cần nữa). Chế độ member giữ nguyên (vắng = bỏ, `qty: 0` → `QTY_INVALID`). Xóa nhánh BR-7 chết ở `writer.ts:193-195`.
- **R-D6.6** `[r2·sửa]` Sàn giữ: `qty_mới ≥ delivered + cancelled` (`QTY_BELOW_DELIVERED`). Trần không còn áp dụng vì không được tăng (R-D6.3).
- **R-D6.7** `[r2·sửa]` Mỗi dòng **giảm/bỏ** tạo **một bản ghi điều chỉnh** chỉ-thêm trong `request_line_adjustments` (migration 0113). Cả lần lưu chung `batch_id` = `id` của dòng `audit_log` `request.updated` của lần lưu đó. `created_at` = `args.now` (cùng nguồn giờ với bản chốt, `snapshots.service.ts:54`). Nhân viên tự sửa không tạo bản ghi.
- **R-D6.8** `[r3·sửa]` (Đ14, Đ26) **Một chuông mỗi người mỗi ngày**: `event_id = line_adjusted:<user_sub>:<ym>:<YYYY-MM-DD theo giờ VN của now>`. Mỗi lần lưu có ≥ 1 dòng giảm: **upsert** (`ON CONFLICT (event_id, user_sub) DO UPDATE`) với `params` **tính lại** từ mọi bản ghi điều chỉnh của chủ phiếu, kỳ đó, ngày đó; `created_at = now`; `read_at = NULL` (thành chưa đọc, lên đầu). Phương thức mới `NotificationsService.upsertWithin` (SAVEPOINT như `notifyWithin`). Chủ phiếu có `users.status ≠ 'active'` → **không** chuông (bản ghi và Lịch sử vẫn có). `[r3·sửa]` (Đ26) Dòng giảm với lý do `user_left` **không** vào chuông: `params` chỉ tính các dòng có mã khác; lần lưu chỉ có dòng `user_left` → không upsert chuông.
- **R-D6.9** `[r2·sửa]` Giảm nhiều lần: mỗi lần lưu một bản ghi riêng (5→4, 4→3), không sửa bản ghi cũ. Chuông trong ngày hiện **số đầu ngày → số cuối** từng dòng (5 → 3); Lịch sử hiện đủ chuỗi.
- **R-D6.10** Điều chỉnh khiến phiếu giao đủ **không** gửi chuông "đã giao đủ" (như `cancel-remaining.service.ts:69`).
- **R-D6.11** `[r2·sửa]` Nhân viên thấy điều chỉnh (kỳ đã khóa, ở Lịch sử):
  - `<lý do>` = nhãn mã theo ngôn ngữ đang xem + ": <ghi chú>" nếu có; `other` hiện chính ghi chú. Ghi chú hiện **nguyên văn dạng chữ** (không HTML, giữ xuống dòng như dấu cách).
  - dòng giảm: "Hành chính giảm {{before}} → {{after}} {{unit}}: <lý do> · hh:mm dd/mm", nhiều lần liệt kê theo thời gian;
  - dòng bị bỏ (tên, ĐVT lấy từ bản ghi): "Hành chính bỏ món này khỏi phiếu ({{before}} {{unit}}): <lý do>";
  - phiếu bị bỏ hết (R-D6.16): đầu kỳ hiện "Hành chính đã bỏ toàn bộ: <các lý do khác nhau, nối bằng '; '>".
  - Link chuông: `/history/<ym>`.
- **R-D6.12** — bỏ (Đ6). Số không dùng lại; luật "chỉ kỳ khóa" nay là R-D6.15.
- **R-D6.13** `[r2·sửa]` Audit `request.updated`: `detail.adjustments: [{line_id, item_id, name, before, after, reason_code, reason_note}]`; giữ `diff`, `self`; bỏ `reason` (R-D6.2).
- **R-D6.14** `[r2·sửa]` (Đ2) Ngăn Điều chỉnh (panel phủ R-D1.4): khối lý do của một dòng **chỉ hiện khi số mới < số cũ** (kể cả bấm bỏ), ngay dưới dòng, mở bằng chiều cao 150 ms, **không** chuyển focus, thông báo `aria-live` "Chọn lý do giảm". Số trở lại = số cũ → khối **ẩn nhưng giữ nháp** tới khi Lưu/Hủy (không mất ghi chú vì bấm nhầm); nháp của dòng không giảm không được gửi. Khối: nhãn "Vì sao giảm?", 4 nút chọn nhanh `role="radiogroup"` (lưới 2×2 ở 440 px, 1 cột ở < 768 px), ô "Ghi thêm (nhân viên sẽ đọc)" có bộ đếm 200, bắt buộc khi Khác. Nút "Dùng cho các món giảm còn lại" ở dòng giảm đầu tiên đã có lý do: **chỉ điền dòng giảm chưa có lý do**. Lưu vô hiệu khi còn dòng giảm thiếu lý do; lỗi server gắn đúng dòng theo `line_id`.
- **R-D6.15** `[r2·mới]` (Đ6) Mọi điều chỉnh của Hành chính chỉ cho phiếu kỳ **đã khóa**; kỳ đang mở → 409 `PERIOD_NOT_LOCKED` cả đọc lẫn ghi (R-D8.3). Kỳ của phiếu xác định **sau** `SELECT … FOR UPDATE` của phiếu, trong cùng tx.
- **R-D6.16** `[r2·mới]` (Đ18) Hành chính bỏ **hết** dòng của phiếu: phiếu **được giữ** với 0 dòng (không xóa — BR-12 chỉ còn áp cho chế độ member), vẫn tính **đã đăng ký** (Tổng hợp x/N, Báo cáo, `unregistered`). Phiếu 0 dòng: không xuất hiện ở Giao hàng, Còn nợ, Báo cáo theo món/phòng, Excel, bản in; Tổng hợp theo người hiện "0 món — Hành chính đã bỏ toàn bộ". Panel Điều chỉnh của phiếu 0 dòng chỉ đọc.
- **R-D6.17** `[r2·mới]` (Đ11) Giảm **sau** khi đã có bản chốt (in/Excel) của kỳ vẫn được phép. Bản ghi có `created_at` > `created_at` bản chốt mới nhất của kỳ là **"giảm sau khi gửi ADM"**: Gửi ADM cảnh báo (R-X.1), Hàng về gắn nhãn trên hàng món đó (R-D11.9). Hàng về theo bản chốt nên phần dư vào tủ (D11).
- **R-D6.18** `[r2·mới]` Đồng thời giữa hai Hành chính: mỗi dòng trong body admin có `expected_qty` (số client đang thấy) **bắt buộc**; khác `qty` hiện tại trong DB (đọc sau `FOR UPDATE`) → 409 `STALE_UPDATE` + `line_id` + `qty` hiện tại; cả lần lưu bị từ chối. `expected_updated_at` giữ nguyên (kiểm trước). Web: thông báo "Phiếu vừa được người khác sửa — tải lại" + nút "Tải bản mới nhất".
- **R-D6.19** `[r2·mới]` DTO: `SaveLinesBody` **khai báo lại** `lines` với `@ValidateNested({each:true}) @Type(() => AdminLineInput)`; nếu không, `reason_code/reason_note/expected_qty` bị whitelist lột và mọi lần giảm ra `REASON_REQUIRED`.
- **R-D6.20** `[r2·mới]` Thứ tự kiểm của `PUT /admin/requests/:id/lines` (lỗi đầu tiên thắng): `VALIDATION` → phiếu tồn tại (`REQUEST_NOT_FOUND`) → `PERIOD_NOT_LOCKED` → `STALE_UPDATE` (`expected_updated_at`) → `STALE_UPDATE` (`expected_qty`, R-D6.18) → `LINE_MISSING` → `LINE_ADD_FORBIDDEN` / `QTY_INCREASE_FORBIDDEN` → `QTY_BELOW_DELIVERED` → `REASON_REQUIRED`. Ví dụ `lines: []` trên phiếu 2 dòng → `LINE_MISSING` của dòng đầu.
- **R-D6.21** `[r2·mới]` Dòng tham chiếu món đã ngừng (`items.active = false` hoặc nhóm ngừng, sau khi khóa) vẫn giảm/bỏ được như thường; panel hiện nhãn "Đã ngừng".

### Trạng thái & biên
| Trường hợp | Kết quả |
|---|---|
| 5 → 3 không `reason_code` | 400 `REASON_REQUIRED` `line_id` |
| 5 → 3 `over_quota`, ghi chú rỗng | 200 |
| `other`, ghi chú rỗng / "   " / "ab" / "abc" | 400 / 400 / 400 / 200 |
| Ghi chú 200 mã điểm (có dấu, NFD nhập vào → NFC) / 201 | 200 / 400 `VALIDATION` |
| 200 chữ + 1 dấu cách cuối | 200 (trim trước khi đếm) |
| `reason_code: 'xyz'` | 400 `VALIDATION` |
| 5 → 5 kèm lý do | 200, 0 bản ghi, 0 chuông |
| 5 → 6 / 5 → 4 | 400 `QTY_INCREASE_FORBIDDEN` / 200 |
| Dòng mới không `id` | 400 `LINE_ADD_FORBIDDEN` |
| Thiếu một dòng trong body | 400 `LINE_MISSING` |
| Phiếu kỳ đang mở | 409 `PERIOD_NOT_LOCKED`, 0 bản ghi |
| 5 → 0 chưa giao (mọi trạng thái duyệt) | Dòng xóa, bản ghi `after = 0` |
| Đã giao 2: 5 → 2 / 5 → 1 / 5 → 0 | 200 / 400 `QTY_BELOW_DELIVERED` / 400 `QTY_BELOW_DELIVERED` |
| Bỏ hết dòng | Phiếu còn, 0 dòng, vẫn đã đăng ký (R-D6.16) |
| 2 dòng giảm trong 1 lần | 2 bản ghi cùng `batch_id`; 1 chuông |
| Lưu 2 lần cùng ngày VN | Vẫn 1 chuông, nội dung lần sau, thành chưa đọc |
| Lưu lúc 23:59:59.999 và 00:00:00.000 giờ VN | 2 chuông (2 ngày) |
| Chủ phiếu đã nghỉ | 200, bản ghi có, 0 chuông |
| Hai HC cùng giảm một dòng | Một 200; một 409 `STALE_UPDATE` (`expected_updated_at` hoặc `expected_qty`), đúng 1 lần upsert chuông |
| HC giảm 5 → 1 trong lúc HC khác giao 2 | Hai tx tuần tự theo khóa dòng; sau giao, giảm về 1 → `QTY_BELOW_DELIVERED` hoặc `STALE_UPDATE` |
| Gửi lại đúng request | `STALE_UPDATE`, không bản ghi trùng |
| Nhân viên gửi `reason_code/expected_qty` | Bị lột (DTO member) |
| SA cục bộ | Như admin; `actor_sub = local SA` |

### Dữ liệu/API
**Migration `0113_request_line_adjustments.sql`** (chỉ thêm; **forward-only**, không có migration đảo; quay code về bản cũ vẫn boot vì bảng không ai đọc):
```sql
CREATE TABLE request_line_adjustments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id    uuid NOT NULL,                 -- = audit_log.id của request.updated
  period_ym   date NOT NULL,                 -- không FK (như audit_log): fixture test xóa periods/users/items tự do
  user_sub    text NOT NULL,                 -- chủ phiếu; không FK
  request_id  uuid NOT NULL,                 -- không FK; phiếu được giữ (R-D6.16) nhưng không ràng buộc
  line_id     uuid NOT NULL,                 -- không FK; dòng có thể bị xóa
  item_id     uuid,                          -- không FK; NULL với món ngoài DM; DELETE /admin/items không vướng
  name        text NOT NULL,                 -- chụp lúc điều chỉnh
  unit        text NOT NULL,
  qty_before  int  NOT NULL CHECK (qty_before > 0),
  qty_after   int  NOT NULL CHECK (qty_after >= 0),
  reason_code text NOT NULL CHECK (reason_code IN ('over_quota','adm_out_of_stock','duplicate','other','user_left')),
  reason_note text CHECK (reason_note IS NULL OR char_length(reason_note) BETWEEN 1 AND 200),
  actor_sub   text NOT NULL,
  created_at  timestamptz NOT NULL,          -- ghi tường minh = args.now (không DEFAULT now())
  CHECK (qty_after < qty_before),            -- chỉ giảm (Đ12)
  CHECK (reason_code <> 'other' OR (reason_note IS NOT NULL AND char_length(btrim(reason_note)) >= 3)),
  UNIQUE (batch_id, line_id)
);
CREATE INDEX request_line_adjustments_request_idx ON request_line_adjustments (request_id);
CREATE INDEX request_line_adjustments_period_idx  ON request_line_adjustments (period_ym, created_at);
CREATE INDEX request_line_adjustments_owner_idx   ON request_line_adjustments (user_sub, period_ym, created_at);
-- chỉ-thêm: trigger chặn UPDATE/DELETE/TRUNCATE như audit_log (0005, 0006)
```
`user_left` là mã chính thức (Đ26). Không FK nên `DELETE /admin/items/:id` (`catalog.service.ts:242`) và dọn fixture không vướng 23503.

**API**
| Endpoint | Thay đổi |
|---|---|
| `PUT /admin/requests/:id/lines` | `lines[]: AdminLineInput { id: uuid (bắt buộc), qty: int ≥ 0, expected_qty: int ≥ 1, reason_code?: …, reason_note?: string ≤ 200 }`; bỏ `reason`. Lỗi mới: `LINE_MISSING` (400), `LINE_ADD_FORBIDDEN` (400), `QTY_INCREASE_FORBIDDEN` (400), `STALE_UPDATE` + `line_id` (409); bỏ `LINE_NOT_REMOVABLE`. Trả như cũ + `adjustments` |
| `GET /admin/requests/:id` | `LineView.adjustments: {before, after, reason_code, reason_note, at, actor_name}[]`; view thêm `removed_lines: {name, unit, before, reason_code, reason_note, at}[]`; `line_count` |
| `GET /me/request?ym=` | Thêm `adjustments`, `removed_lines`, `removed_all: boolean` |
| `GET /me/requests` (Lịch sử) | Kỳ có phiếu 0 dòng vẫn liệt kê, `status: 'removed_by_admin'` |
| Chuông | Topic `line_adjusted`; `params: {ym, lines: [{name, name_en, unit, before, after, reason_code, reason_note}] (≤ 5 dòng đầu theo thứ tự chung R-D2.3), more: n}`; `name_en` null → dùng `name` |

### Giao diện
| Khóa | vi | en |
|---|---|---|
| `notifications.topics.line_adjusted.one` | Hành chính giảm {{name}} {{before}} → {{after}} {{unit}} (phiếu tháng {{month}}): {{reason}} | Admin reduced {{name}} {{before}} → {{after}} {{unit}} ({{month}} request): {{reason}} |
| `….line_adjusted.removed` | Hành chính bỏ {{name}} ({{before}} {{unit}}) khỏi phiếu tháng {{month}}: {{reason}} | Admin removed {{name}} ({{before}} {{unit}}) from your {{month}} request: {{reason}} |
| `….line_adjusted.many` | Hành chính giảm {{n}} món trong phiếu tháng {{month}}. Xem lý do trong Lịch sử. | Admin reduced {{n}} items in your {{month}} request. See History for reasons. |
| `notifications.fallback.line_adjusted` | Hành chính đã giảm phiếu của bạn. | Admin reduced your request. |
| `request.history.adjusted` | Hành chính giảm {{before}} → {{after}} {{unit}}: {{reason}} · {{at}} | Reduced by admin {{before}} → {{after}} {{unit}}: {{reason}} · {{at}} |
| `request.history.removed` | Hành chính bỏ món này khỏi phiếu ({{before}} {{unit}}): {{reason}} | Admin removed this item ({{before}} {{unit}}): {{reason}} |
| `request.history.removedAll` | Hành chính đã bỏ toàn bộ: {{reasons}} | Admin removed the whole request: {{reasons}} |
| `adjustReason.over_quota` | Vượt định mức | Over quota |
| `adjustReason.adm_out_of_stock` | ADM không còn hàng | Out of stock at ADM |
| `adjustReason.duplicate` | Trùng với phiếu khác | Duplicate of another request |
| `adjustReason.other` | Khác | Other |
| `adjustReason.user_left` | Người đã nghỉ | No longer with the company |
| `summary.adjust.lineReason` | Vì sao giảm? | Why reduce? |
| `summary.adjust.lineNote` | Ghi thêm (nhân viên sẽ đọc) | Note (the staff member will read this) |
| `summary.adjust.lineNotePlaceholder` | Ví dụ: quý này phòng đã đủ bút | e.g. the team already has enough pens this quarter |
| `summary.adjust.lineReasonRequired` | Chọn lý do giảm | Choose a reason |
| `summary.adjust.lineNoteRequired` | Chọn "Khác" thì ghi lý do, ít nhất 3 chữ | For "Other", write a reason (at least 3 characters) |
| `summary.adjust.reuseReason` | Dùng cho các món giảm còn lại | Use for the other reduced items |
| `summary.adjust.stale` | Phiếu vừa được người khác sửa — tải lại. | Someone else just changed this request — reload. |
| `summary.adjust.removedAll` | 0 món — Hành chính đã bỏ toàn bộ | 0 items — removed by admin |
| `summary.adjust.inactiveItem` | Đã ngừng | Discontinued |
| Bỏ `summary.adjust.reasonLocked`, `reasonOpen`, nút thêm món của ngăn | — | — |

### Tiêu chí nghiệm thu
| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 1 | R-D6.1 | Bảng biên mã/ghi chú: không mã → 400 `REASON_REQUIRED`; `over_quota` rỗng → 200; `other` rỗng / "   " / "ab" → 400, "abc" → 200; 200 mã điểm (gồm chữ ghép NFD) → 200, 201 → 400 `VALIDATION`; 200 + dấu cách cuối → 200; "xyz" → 400 `VALIDATION` | API |
| 2 | R-D6.1, R-D6.7 | CHECK DB: chèn trực tiếp `other` + NULL / "ab" / "  ab  " → lỗi; "abc" → OK; `qty_after = qty_before` → lỗi; `qty_after = qty_before − 1` → OK; `reason_code` NULL → lỗi; trùng `(batch_id, line_id)` → lỗi | DB |
| 3 | R-D6.7 | `UPDATE`, `DELETE`, `TRUNCATE` trên bảng → bị trigger từ chối; `INSERT` → OK | DB |
| 4 | R-D6.7 | Migration 0113: bảng, 3 index, không FK nào (`pg_constraint` contype 'f' = 0) | DB |
| 5 | R-D6.2 | Body có `reason: "x"` → 200, audit không có `detail.reason` | API |
| 6 | R-D6.3 | 5 → 6 → 400 `QTY_INCREASE_FORBIDDEN`; 5 → 5 → 200; dòng không `id` → 400 `LINE_ADD_FORBIDDEN` | API |
| 7 | R-D6.3, R-D6.14 | Ngăn: nút + vô hiệu ở số cũ, bật ở số cũ − 1; không có "Thêm món" | Vitest |
| 8 | R-D6.4 | 5 → 5 kèm `over_quota` → 0 bản ghi, 0 chuông | API |
| 9 | R-D6.5, R-D6.20 | Vắng 1 dòng → 400 `LINE_MISSING`; `lines: []` trên phiếu 2 dòng → `LINE_MISSING` dòng đầu; `qty:0`+lý do, chưa giao, trạng thái `accepted` → dòng xóa + bản ghi; đã giao 2: `qty:0` → `QTY_BELOW_DELIVERED`, `qty:2` → 200 | API |
| 10 | R-D6.6 | Đã giao 2 hủy 1: 5 → 3 → 200; 5 → 2 → 400 | API |
| 11 | R-D6.8 | Giảm 2 dòng → đúng 1 chuông `line_adjusted` cho chủ phiếu, 0 cho admin; lưu lần 2 cùng ngày → vẫn 1 dòng `in_app_notifications`, `params` theo lần 2, `read_at` NULL dù đã đọc trước đó; đồng hồ 23:59:59.999 VN rồi 00:00:00.000 VN → 2 dòng | API |
| 12 | R-D6.8 | Chủ phiếu `status = 'locked'` → 200, bản ghi có, 0 chuông; `active` → 1 chuông | API |
| 13b | R-D6.3 | Ngăn Điều chỉnh: không phần tử nào có nhãn "Tăng"/"+"; gõ 7 với số cũ 5 → về 5 + chữ "Không tăng được sau khóa sổ" | Vitest |
| 13a | R-D6.1, R-D6.8 | `user_left` không ghi chú → 200; lần lưu chỉ có dòng `user_left` → 0 chuông; 1 dòng `user_left` + 1 dòng `over_quota` → chuông chỉ liệt kê dòng `over_quota` | API |
| 13 | R-D6.8 | Chuông với 5 dòng giảm → `lines` 5, `more` 0; 6 dòng → `lines` 5, `more` 1; 1 giảm + 1 bỏ → biến thể `many` | API |
| 14 | R-D6.9 | 5→4 rồi 4→3 cùng ngày: `GET /me/request` có 2 bản ghi theo thứ tự; chuông hiện 5 → 3 | API |
| 15 | R-D6.10 | Giảm về đúng số đã giao → 0 chuông `request_delivered`; giảm về trên số đã giao → không đổi trạng thái giao | API |
| 16 | R-D6.11 | Lịch sử: "giảm 5 → 3 cây: Vượt định mức: …"; dòng bị bỏ; phiếu bỏ hết → "Hành chính đã bỏ toàn bộ: …"; ghi chú `<script>alert(1)</script>` hiện nguyên chữ | Vitest |
| 17 | R-D6.11 | Chuông `one/removed/many` × vi/en; `name_en` null ở en → tên vi | Vitest |
| 18 | R-D6.13 | Audit `request.updated` có `adjustments` đủ trường, không `reason`; `batch_id` của bản ghi = `audit_log.id` | API |
| 19 | R-D6.14 | Khối lý do hiện khi 5→4, ẩn khi về 5, hiện lại ở 4 **còn nguyên** ghi chú đã gõ; Lưu với dòng về 5 không gửi lý do dòng đó; Lưu vô hiệu khi dòng giảm thiếu lý do, bật khi đủ; "Dùng cho…" không ghi đè dòng đã chọn; bộ đếm 200/201; lỗi server dưới đúng dòng | Vitest |
| 20 | R-D6.15 | Phiếu kỳ mở: `GET`/`PUT` → 409 ở 23:59:59.999 VN ngày cuối; 200 ở 00:00:00.000 | API |
| 21 | R-D6.16 | Bỏ hết → phiếu còn, `GET periods/:ym/summary` `registered` không đổi, `unregistered` không chứa người đó; không có trong `delivery-people`, `backlog`, báo cáo; Lịch sử nhân viên `removed_all: true`; member bỏ dòng cuối kỳ mở → phiếu xóa (BR-12) | API |
| 22 | R-D6.17 | Bản chốt lúc T: giảm lúc T+1s → bản ghi tính "sau gửi ADM"; giảm lúc T−1s → không | API |
| 23 | R-D6.18 | `Promise.all` hai `PUT` cùng `expected_*` giảm cùng dòng → đúng một 200, một 409; đúng 1 bản ghi; `expected_qty` sai 1 → 409 + `qty` hiện tại; đúng → 200 | API |
| 24 | R-D6.19 | Gửi `reason_code` hợp lệ → service nhận được (giảm 200, không `REASON_REQUIRED`) | API |
| 25 | R-D6.21 | Dòng của món đã ngừng: giảm → 200; panel có nhãn "Đã ngừng" | API + Vitest |
| 26 | R-D6.14 | axe 390 với ngăn mở có khối lý do; bản en | PW |

---

## D7. Giao hàng: xác nhận bằng hộp thoại (Đ3, Đ13, Đ16)

### Hiện trạng
- `/admin/delivery` = lưới thẻ người (`delivery-people-page.tsx`); nút chính "Giao đủ" / "Giao x/y" / "Hết hàng" / "Chờ xem món ngoài DM" (`person-card.tsx:19-24,67-80`).
- Nút chính: thiếu hàng hoặc một món ở hai dòng (`needsPanel`, `:25-28`) → chỉ mở panel người (< 1280 px là Drawer toàn màn → như "chuyển trang"); còn lại **giao ngay không hỏi** (`use-quick-deliver.ts:49-62`): nợ cũ từng dòng `POST /admin/lines/:id/deliver` + `expected_delivered_qty`, rồi `POST /admin/requests/:id/deliver-all` (`:25-42`).
- Panel người: stepper, nút Giao giao ngay (`person-panel.tsx:46-71,102-107`). Chia tồn trong một người bằng `allocateLines` (nợ cũ trước); **giữa nhiều người** không có ưu tiên — ai được bấm trước lấy tồn.
- Không Hoàn tác (Q19). Chống đúp: `useSingleFlight` + `expected_delivered_qty` (BR-13). `deliverSelected` = N POST tuần tự, không nguyên tử (`use-deliver-selected.ts:33-43`).
- Hủy nợ `POST /admin/lines/:id/cancel-remaining {reason, expected_delivered_qty, expected_qty}` (`delivery.dto.ts:21-26`), chuông `line_cancelled` (`cancel-remaining.service.ts:41-60`).

### Quy tắc mới
- **R-D7.1** `[r3·sửa]` (Đ3) Mọi thao tác **ghi giao hàng** ở trang Giao hàng đi qua **một hộp thoại giao** (modal, không chuyển trang, không đổi URL): nút chính trên thẻ — **kể cả "Giao đủ"**, hiện giao thẳng không hỏi qua `use-quick-deliver.ts:49-62` (rà soát #6, Cao) — kể cả khi thiếu hàng/dòng chia tồn, và nút "Giao…" trong panel người. Xóa đường giao thẳng (`useQuickDeliver` chỉ còn tính số đề xuất; không còn gọi `deliver`/`deliver-all`). Trên thẻ, nút chính đổi chữ thành **"Giao…"** (dấu ba chấm báo có bước tiếp) và tách khỏi "Xem" ≥ 8 px; ở < 768 px hai nút không cùng cỡ (Xem là liên kết chữ).
- **R-D7.2** `[r4·sửa]` Không cần xác nhận: Xem, đổi tab/tìm, chỉnh stepper, "Người tiếp theo", link "Xem món ngoài danh mục". Còn nợ "Giao bổ sung" và Hủy nợ giữ hộp riêng. `/admin/delivery/classic` ngoài phạm vi. `[r4]` (GAP-11) `/admin/delivery/classic` **bị gỡ**: bỏ khỏi menu, route chuyển hướng `replace` sang `/admin/delivery` (giữ `?ym`), xóa trang và các nút ghi của nó — mọi đường giao đi qua hộp Đ3.
- **R-D7.3** `[r3·sửa]` Nội dung hộp (số tính bằng `allocateLines` + R-D7.9 từ dữ liệu vừa tải; mở từ panel thì lấy số panel đang chọn):
  - tiêu đề "Giao cho {{name}}?" (`tabindex="-1"`), dòng phụ phòng ban (+ "Người đã nghỉ" nếu `user_status ≠ active`, R-D7.12);
  - bảng 640 px: ảnh 40 · Món (flex; + "Nợ tháng M") · **Cần giao** 72 · **Giao lần này** = stepper 120 · **Còn lại sau lần này** 96 (`[r3·sửa]`, Đ28 thay chữ "Còn nợ sau khi giao" của Đ3: dòng tháng đang giao ghi "Chưa nhận n", dòng tháng trước ghi "Nợ n"; cam + chữ khi > 0). Trần `min(còn nợ, tủ còn sau các dòng trước cùng món)`; nút + vô hiệu ở trần; gõ vượt → kẹp về trần + "Tối đa n"; gõ âm/thập phân/rỗng/"e" → về số hợp lệ gần nhất (0 nếu rỗng). Hạ dòng trước cùng món → dòng sau được thêm;
  - nhóm "ADM hết hàng — hủy, không thành nợ" (D11, R-D11.12): dòng của món đã đánh dấu trong kỳ của dòng;
  - nhóm "Không giao lần này" (mờ): dòng chờ xem món ngoài DM, dòng hết tủ (giao 0), có lý do;
  - dòng tổng `aria-describedby`: "Giao {{give}} · còn {{left}} chưa nhận" (+ " · nợ tháng trước {{debt}}" nếu có) / "Giao đủ {{give}}"; kèm "Hủy {{n}} món ADM hết hàng" nếu có;
  - Xác nhận vô hiệu khi tổng giao = 0 **và** không có dòng ADM hết hàng để hủy;
  - mọi dòng giao 0 vì tủ = 0 → thay bảng bằng câu "Tủ chưa có hàng cho món nào — ghi Hàng về trước." (vẫn liệt kê nhóm ADM hết hàng nếu có).
- **R-D7.4** Tồn/còn nợ làm trần là **chụp lúc mở**; Xác nhận gửi đúng số đang hiện. Server là chuẩn; sai lệch trả lỗi theo dòng. Dòng giao 0 không gửi `deliver`.
- **R-D7.5** Chống gửi đúp: khi gửi, hai nút vô hiệu, "Đang giao…" + `aria-busy`; Esc/nền/× bị chặn; Enter lặp không gửi thêm. Server: `expected_delivered_qty` (giao lặp → `STALE_UPDATE`).
- **R-D7.6** `[r3·sửa]` Sau khi gửi: **tất cả thành công** → đóng hộp (và panel nếu mở từ panel, R-D1.8), focus về **ô tìm tên** (chọn sẵn chữ để gõ người kế — rà soát "luồng một chạm"; không có ô tìm thì về thẻ kế), làm mới danh sách + badge, toast "Đã giao cho {{name}}" + "Người tiếp theo". **Có lỗi** → hộp ở lại, chế độ kết quả: mỗi dòng ✓ "Đã giao n" / ✓ "Đã hủy (ADM hết hàng)" / ✗ lý do (`lineErrorText`); nút "Đóng" (chính) và "Mở chi tiết người". Không tự gửi lại.
- **R-D7.7** `[r2·sửa]` Bàn phím & a11y: mở hộp → **focus vào tiêu đề** (không vào "Xác nhận giao"); Tab vòng trong hộp; **Enter trong ô stepper chỉ chốt số, không gửi** (không có `<form>` submit ngầm); "Xác nhận giao" chỉ kích hoạt bằng click / Enter / Space **trên chính nút**, bỏ qua `keydown` có `repeat = true` và Enter đang giữ từ nút mở hộp; Esc = Hủy (khi không gửi; Esc trong stepper cũng đóng hộp); đóng → focus về nút mở; `<th scope>`; vùng kết quả `role="status"` `aria-live="polite"`; < 768 px: tấm đáy toàn rộng, bảng xếp dọc, vùng chạm ≥ 44 px.
- **R-D7.8** `[r2·sửa]` Nút chính trên thẻ vô hiệu khi không có gì giao **và** không có dòng ADM hết hàng để hủy (đã nhận, chưa duyệt hết, tồn 0) — giữ `person-card.tsx:75` + điều kiện mới.
- **R-D7.9** `[r3·sửa]` (Đ13, Đ28) **Gợi ý theo ai đăng ký trước** khi tủ không đủ cho mọi người chờ một món: thứ tự ưu tiên của các dòng còn nợ của món đó = kỳ cũ trước (`period_ym` tăng) → `requests.created_at` (lần lưu đầu của phiếu) → `request_lines.created_at` → `id`. Số đề xuất cho dòng L = `min(còn nợ L, max(0, tủ − tổng còn nợ của các dòng đứng trước L))`. HC sửa được tới `min(còn nợ, tủ)` (vượt phần "giữ cho người trước"). Dưới dòng có gợi ý: "Giữ {{k}} cho {{m}} người đăng ký trước". `[r3·sửa]` Phần không giao của tháng đang giao là **"Chưa nhận"** và thành **"Còn nợ"** khi tháng sau được khóa sổ và trở thành tháng đang giao (Đ28; Đ13 "thành nợ" hiểu theo mốc này).
- **R-D7.10** `[r2·mới]` Thứ tự gửi: dòng nợ trước theo `byPeriod` (cùng thứ tự `allocateLines`), rồi dòng kỳ này, rồi các lệnh hủy ADM hết hàng (R-D11.12). Gặp 403 `CSRF_INVALID` hoặc 401 → dừng, các dòng chưa gửi đánh "Chưa gửi", một thông báo "Phiên đăng nhập đã hết — tải lại trang rồi giao tiếp".
- **R-D7.11** `[r2·mới]` Ghi chú cố định trong hộp: "Bấm Xác nhận là không sửa được. Nếu lỡ nhầm, vào Tủ / Kho để chỉnh số, ghi lý do."
- **R-D7.12** `[r3·sửa]` Người đã nghỉ (`user_status ≠ active`): hộp vẫn cho giao (có thể có người nhận thay); số đề xuất = **0** cho mọi dòng, nhãn "Người đã nghỉ — giao chỉ khi có người nhận thay"; HC tự nâng stepper. Muốn đóng phần chưa nhận thì giảm ở D6 với lý do "Người đã nghỉ" (Đ26); nợ tháng trước thì Hủy nợ (D14).
- **R-D7.13** `[r3·mới]` (rà soát #6, Vừa) Thẻ người ghi số: **"{{n}} món · {{u}} đơn vị"** (phần chưa nhận + nợ còn giao được); dòng trong panel và trong hộp: **"Cần {{need}} · Tủ {{stock}} · {{k}} người khác còn chờ {{q}}"** (từ `waitingIndex`, Q12). Nút "Giao…" của panel **dính đáy panel** (luôn thấy ở 1280×800). 390: ô tìm dính đầu trang khi cuộn.

### Trạng thái & biên
| Tình huống | Hành vi |
|---|---|
| Tồn 7, cần 10 (một người) | Giao 7, còn nợ 3 |
| Tồn 6; A (đăng ký trước) nợ 5, B nợ 3; mở hộp B | Đề xuất B = 1, "Giữ 5 cho 1 người đăng ký trước"; B sửa tới 3 |
| Tồn 5 / 6 / 7 với hai dòng cùng món 3 + 3 của một người | Dòng nợ 3 dòng kỳ 2 / 3+3 / 3+3 (trần 6) |
| Stepper: còn nợ 4, tủ 9 → gõ 4 / 5 | 4 / kẹp 4 + "Tối đa 4" |
| Stepper: tủ 3, còn nợ 9 → gõ 3 / 4 | 3 / kẹp 3 |
| Tổng giao 0, không dòng ADM hết hàng | Xác nhận vô hiệu |
| Có dòng ngoài DM chờ xem | "Không giao lần này"; dòng khác vẫn giao |
| Hai admin cùng mở hộp cùng người | Người sau nhận lỗi theo dòng trong hộp |
| Dòng bị giảm trong lúc hộp mở | `DELIVER_EXCEEDS_QTY` dòng đó; dòng khác vẫn giao |
| Mất mạng giữa chừng | ✓ giữ; ✗ "Lỗi mạng" |
| Enter giữ từ nút mở | Hộp mở, focus tiêu đề, không gửi |

### Dữ liệu/API
| Endpoint | Thay đổi |
|---|---|
| `GET /admin/periods/:ym/delivery-people` | Mỗi dòng thêm `ahead_qty` (tổng còn nợ của các dòng cùng món đứng trước theo R-D7.9, tính bằng window function) và `adm_out: boolean` (R-D11.11) |
| `POST /admin/lines/:id/deliver` | Không đổi; dòng của món đã đánh ADM hết hàng trong kỳ của dòng vẫn giao được (từ tủ) |
| Hủy ADM hết hàng | Xem R-D11.12 |
Không dùng `deliver-all` từ hộp (mọi dòng cần `expected_delivered_qty` và số chính xác). Không làm endpoint gộp (xem mục R).

### Giao diện
| Khóa | vi | en |
|---|---|---|
| `delivery.confirm.title` | Giao cho {{name}}? | Deliver to {{name}}? |
| `delivery.confirm.cols` | Món · Cần giao · Giao lần này · Còn lại sau lần này | Item · To deliver · Deliver now · Left after this |
| `delivery.confirm.leftTag` | Chưa nhận {{n}} | Not yet received {{n}} |
| `delivery.confirm.debtTag` | Nợ tháng {{month}} | Owed from {{month}} |
| `delivery.confirm.oweTag` | Nợ {{n}} | Owes {{n}} |
| `delivery.confirm.skipped` | Không giao lần này | Not delivered this time |
| `delivery.confirm.admOut` | ADM hết hàng — hủy, không thành nợ | Out of stock at ADM — cancelled, not owed |
| `delivery.confirm.sumAll` | Giao đủ {{give}} | Deliver all {{give}} |
| `delivery.confirm.sumOwe` | Giao {{give}} · còn {{left}} chưa nhận | Deliver {{give}} · {{left}} not yet received |
| `delivery.confirm.sumDebt` | · nợ tháng trước {{debt}} | · {{debt}} owed from earlier months |
| `delivery.card.action` | Giao… | Deliver… |
| `delivery.card.summary` | {{n}} món · {{u}} đơn vị | {{n}} items · {{u}} units |
| `delivery.panel.lineInfo` | Cần {{need}} · Tủ {{stock}} · {{k}} người khác còn chờ {{q}} | Need {{need}} · Stock {{stock}} · {{k}} others waiting for {{q}} |
| `delivery.confirm.sumCancel` | Hủy {{n}} món ADM hết hàng | Cancel {{n}} out-of-stock items |
| `delivery.confirm.noStock` | Tủ chưa có hàng cho món nào — ghi Hàng về trước. | Nothing in stock for these items — record arrivals first. |
| `delivery.confirm.reserved` | Giữ {{k}} cho {{m}} người đăng ký trước | {{k}} kept for {{m}} earlier requests |
| `delivery.confirm.leftUser` | Người đã nghỉ — giao chỉ khi có người nhận thay | No longer with the company — deliver only if someone collects |
| `delivery.confirm.noUndo` | Bấm Xác nhận là không sửa được. Nếu lỡ nhầm, vào Tủ / Kho để chỉnh số, ghi lý do. | Confirming can't be undone. If it's wrong, fix the count in Stock with a reason. |
| `delivery.confirm.ok` / `sending` | Xác nhận giao / Đang giao… | Confirm delivery / Delivering… |
| `delivery.confirm.cancel` (sửa, R-D4.8) / `close` / `openPerson` | Quay lại / Đóng / Mở chi tiết người | Back / Close / Open person |
| `delivery.confirm.max` | Tối đa {{n}} | Max {{n}} |
| `delivery.confirm.notSent` / `sessionExpired` | Chưa gửi / Phiên đăng nhập đã hết — tải lại trang rồi giao tiếp. | Not sent / Your session expired — reload and continue. |
| `delivery.confirm.cancelledAdm` | Đã hủy (ADM hết hàng) | Cancelled (out of stock at ADM) |

### Tiêu chí nghiệm thu
| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 1 | R-D7.1 | Bấm nút chính trên thẻ (trường hợp trước đây "Giao đủ" giao thẳng) → hộp mở, 0 request `deliver`/`deliver-all` trước Xác nhận; URL không đổi; quét mã: `useQuickDeliver` không import API ghi | Vitest |
| 1b | R-D7.1 | 390: chạm nút chính thẻ → hộp tấm đáy, 0 request; nút chữ "Giao…"; khoảng cách tới "Xem" ≥ 8 px | PW |
| 2 | R-D7.1, R-D7.3 | Thẻ thiếu hàng → hộp (không drawer), đề xuất = tủ còn | Vitest |
| 3 | R-D7.2 | Xem, đổi tab, chỉnh stepper → 0 request ghi, không hộp | Vitest |
| 4 | R-D7.3 | Trần stepper: còn nợ 4 tủ 9 → 4 bật / 5 kẹp; tủ 3 nợ 9 → 3 bật / 4 kẹp; gõ "-1", "1.5", "", "e" → số hợp lệ; hai dòng cùng món tồn 5/6/7 | Vitest |
| 5 | R-D7.3 | Tổng 0 không dòng ADM → Xác nhận vô hiệu; tổng 0 có 1 dòng ADM → bật; tủ 0 mọi món → câu "Tủ chưa có hàng…" | Vitest |
| 6 | R-D7.4 | Đổi tồn ở server sau khi mở hộp → Xác nhận gửi đúng số đang hiện, server trả `STOCK_INSUFFICIENT` (tồn + 1) cho dòng đó; tồn đúng → 200 | API + Vitest |
| 7 | R-D7.4 | `POST deliver` qty = còn nợ → 200; còn nợ + 1 → `DELIVER_EXCEEDS_QTY`; qty = tủ → 200; tủ + 1 → `STOCK_INSUFFICIENT` | API |
| 8 | R-D7.5 | Bấm Xác nhận 2 lần nhanh / Enter lặp → mỗi dòng đúng 1 request; Esc khi đang gửi không đóng | Vitest |
| 9 | R-D7.6 | Một dòng `STOCK_INSUFFICIENT` → hộp ở lại, ✗ dòng đó, ✓ dòng khác; hết thành công → hộp đóng, toast có "Người tiếp theo", focus ở ô tìm tên với chữ đã chọn | Vitest |
| 9b | R-D7.3 | Cột "Còn lại sau lần này": dòng tháng đang giao 5, giao 3 → "Chưa nhận 2"; dòng tháng trước 4, giao 4 → 0, không nhãn; giao 3 → "Nợ 1" | Vitest |
| 9c | R-D7.13 | Thẻ "4 món · 18 đơn vị" đúng tổng; panel dòng "Cần 2 · Tủ 20 · 4 người khác còn chờ 18"; 1280×800: nút Giao của panel nằm trong khung nhìn khi panel có 15 dòng | Vitest + PW |
| 10 | R-D7.7 | Mở hộp → focus tiêu đề; Enter trong stepper không gửi request; `keydown` Enter `repeat:true` trên Xác nhận không gửi; Tab vòng; đóng → focus về nút mở | Vitest |
| 11 | R-D7.7 | PW chỉ bàn phím: Tab tới thẻ, Enter (giữ) → hộp mở, 0 request; Tab tới Xác nhận, Enter → giao | PW |
| 12 | R-D7.8 | Thẻ đã nhận / tồn 0 → nút vô hiệu; tồn 0 nhưng có dòng ADM hết hàng → nút bật | Vitest |
| 13 | R-D7.9 | API `ahead_qty`: A (phiếu lưu 08:00) nợ 5, B (09:00) nợ 3 → B `ahead_qty` 5, A 0; hai phiếu cùng `created_at` → theo `request_lines.created_at` rồi `id`; dòng nợ kỳ trước luôn đứng trước | API |
| 14 | R-D7.9 | Tủ 6: hộp B đề xuất 1, hiện "Giữ 5 cho 1 người…", sửa được tới 3, không tới 4; tủ 8: đề xuất 3, không có câu giữ | Vitest |
| 15 | R-D7.10 | Thứ tự request: nợ trước, kỳ này, rồi hủy; 403 ở request 2 → request 3+ không gửi, "Chưa gửi" + 1 thông báo | Vitest |
| 16 | R-D7.11 | Ghi chú cố định đúng chữ vi/en | Vitest |
| 17 | R-D7.12 | Người đã nghỉ: đề xuất 0 mọi dòng, nhãn hiện; nâng stepper lên 1 → giao 200 | Vitest + API |
| 18 | R-D7.1–R-D7.6 | Kịch bản quyết định 2026-11-05 (A 3, B 10, hàng về 10, tồn gieo bằng fixture) chạy hết qua hộp; kho cuối 0, B nợ 3 | PW |
| 19 | R-D7.7 | 390: tấm đáy, nút ≥ 44 px, không cuộn ngang; axe 0 lỗi; bản en | PW |

**Tiêu chí bổ sung (vòng 4)**

| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 13 | R-D7.2 | Mở `/admin/delivery/classic?ym=2026-12` → URL `/admin/delivery?ym=2026-12`, Back không quay lại; menu không có "Giao hàng (bản cũ)"; quét mã không còn import trang cũ | Vitest |

---

## D8. Hành chính chỉ làm việc trên kỳ đã khóa sổ (Đ1, Đ6, Đ8, Đ17)

Khi kỳ đăng ký còn mở, Hành chính **không thấy và không sửa nội dung phiếu** của kỳ đó (mọi dòng, không riêng món ngoài DM); chỉ thấy **tiến độ đăng ký** (Đ8).

### Hiện trạng
- Ranh giới đã có cho giao hàng: `DeliveryService.assertPeriodLocked` (`delivery.service.ts:141` → 409 `PERIOD_NOT_LOCKED`), dùng ở giao một dòng, `deliver-all.service.ts:38`, `cancel-remaining.service.ts:41`; `delivery-people.service.ts:34` và `backlog.service.ts:69` lọc `deadline <= now` (now từ ClockService).
- Chỗ **đọc/ghi phiếu kỳ đang mở**: Tổng hợp mặc định kỳ mở (`use-summary-params.ts:15`); API tổng hợp/danh sách/chi tiết/điều chỉnh không xét kỳ (`summary.service.ts:126-137`, `summary-lists.service.ts`, `admin-summary.controller.ts:17-38`, `admin-request.service.ts:36-64`); Món ngoài DM (`review.service.ts:82-140`); Báo cáo nhận `ym ≤ kỳ mở` (`reports.service.ts:38-39`), bản chốt `ensurePeriod` + `ym ≤ kỳ mở` (`snapshots.service.ts:44-46`); Hàng về không kiểm `ym` (`stock-receipt.service.ts:27-95`); lịch sử giao một dòng không xét kỳ (`backlog.service.ts:76-81`); ảnh dòng ngoài DM đọc được bởi mọi vai đặc quyền (`file-access.policy.ts:53`); chuông `custom_line_new` lúc nhân viên lưu (`writer.ts:116-122`); Nhật ký có `request.*` kỳ mở (`writer.ts:101-115`).
- Writer xét kỳ bằng `now` lấy **đầu request** (`writer.ts:182`): tx chờ khóa có thể commit sau 00:00.
- `PeriodsService.openPeriod(now)` và `latestLocked(now)` đã có (`periods.service.ts:50,89-106`).
- Xóa món đang dùng báo "Món đã có trong phiếu — chỉ ngừng được." (`locales/vi/catalog.ts:203`, `ITEM_IN_USE`).

### Quy tắc mới
- **R-D8.1** `[r2·sửa]` **Một định nghĩa khóa**: `isLocked(ym, now) ⇔ ym < openPeriod(now).ym`, `now = ClockService.now()` đọc **một lần** mỗi request. Vị từ SQL dùng chung `lockedPeriod(openYm)` (hàm nhận tham số, trong `line-predicates.ts`): `r.period_ym < ${openYm}::date` — **không** `sql.raw` hằng, **không** `now()` của Postgres (để khớp `CLOCK_OFFSET_MS`). Guard dùng chung `PeriodsService.assertLocked(ym, now)` (chuyển từ `DeliveryService`): `ym = kỳ mở` → 409 `PERIOD_NOT_LOCKED {ym, deadline}`; `ym > kỳ mở` → 400 `INVALID_PERIOD`; `ym < kỳ mở` → khóa, **không cần** dòng `periods`. Endpoint theo id (dòng/phiếu): xác định kỳ **sau** `SELECT … FOR UPDATE`, trong cùng tx. Biên kỳ 2026-11: `2026-11-10T16:59:59.999Z` = mở; `2026-11-10T17:00:00.000Z` = khóa.
- **R-D8.2** Mọi endpoint `/admin/*` **trả nội dung phiếu** (dòng, món, số lượng, người–món, tổng theo món, dòng ngoài DM, ảnh dòng, bản chốt) chỉ trả kỳ khóa: theo `ym` → R-D8.1; nhiều kỳ → lọc `lockedPeriod` ở SQL **trước** phân trang. Web không tự lọc.
- **R-D8.3** Mọi endpoint `/admin/*` **ghi** vào phiếu/dòng/kỳ (điều chỉnh, review, giao, hủy nợ, hàng về, bản chốt, ADM hết hàng) → 409 `PERIOD_NOT_LOCKED` nếu kỳ chưa khóa.
- **R-D8.4** `[r2·sửa]` (Đ8) Tiến độ đăng ký kỳ mở **vẫn hiện**: (a) `x/N` đã đăng ký (khung kỳ cuối sidebar, dải bước + thẻ Tháng này); (b) tên + phòng ban người chưa đăng ký (`GET /admin/periods/:ym/unregistered`, trả đúng `{sub, full_name, email, department}`); (c) nút "Chép DS chưa đăng ký". **Không** hiện món, số lượng, số dòng, số món ngoài DM. Vì Tổng hợp chỉ xem kỳ khóa (R-D8.10), **nơi duy nhất** thấy tên người chưa đăng ký của kỳ mở là **Tháng này** (+ số đếm ở sidebar).
- **R-D8.5** `[r2·sửa]` Bảng kiểm từng bề mặt (cột *Lớp* = lớp của R-D8.9):

| # | Bề mặt (web → API) | Hiện tại | Quy tắc mới | Lớp |
|---|---|---|---|---|
| 1 | Khung kỳ sidebar → `GET /admin/periods/:ym/summary` kỳ mở | Số đăng ký | Giữ; kỳ mở trả **chỉ** `registered, headcount, unregistered, deadline, is_open` (trường dòng = `null`) | `open-progress` |
| 2 | Badge Giao hàng | `lockedYm` + server lọc | Giữ | `sql-filter` |
| 3 | Badge Món ngoài DM | Đếm cả kỳ mở | Server lọc | `sql-filter` |
| 4 | Badge Tủ/Kho | Không đọc phiếu | Giữ | `none` |
| 5 | Tháng này — dải bước | Bước Đăng ký đọc số kỳ mở | Giữ (số đếm) | `open-progress` |
| 6 | Tháng này — thẻ | Thẻ món ngoài DM gồm kỳ mở | Thẻ chưa đăng ký giữ; thẻ ngoài DM theo server lọc | `open-progress` / `sql-filter` |
| 7 | Món ngoài DM `GET /admin/review`, `POST /admin/lines/:id/review` | Không xét kỳ | Lọc (mọi `status`); review dòng kỳ mở → 409 | `sql-filter` / `by-id` |
| 8 | Tổng hợp `GET periods/:ym/requests`, `GET periods/:ym/summary` (trường dòng) | Mặc định kỳ mở | Kỳ mở → 409 / chỉ số đếm; trang mặc định `lockedYm` + R-D8.10 | `by-ym` |
| 9 | Điều chỉnh `GET/PUT /admin/requests/:id[/lines]` | Mọi kỳ | Phiếu kỳ mở → 409 | `by-id` |
| 10 | Tạo phiếu hộ | Chỉ kỳ mở | **Gỡ hẳn** (D10), route không còn | — |
| 11 | Báo cáo `GET /admin/reports/:ym` | Cho kỳ mở | R-D8.1 | `by-ym` |
| 12 | Tạo bản chốt `POST /admin/reports/:ym/snapshots` | Cho kỳ mở | R-D8.1 | `by-ym` |
| 13 | Gửi ADM (`lockedYm` + `PeriodLockGate`) | Đã chỉ kỳ khóa | Giữ; server bảo đảm qua #11–#12 | — |
| 14 | Hàng về `POST` hàng về | Server không kiểm `ym` | R-D8.1 | `by-ym` |
| 15 | Giao hàng, Giao theo phiếu, Còn nợ, Hủy nợ | Đã kiểm | Giữ; chuyển sang guard chung | `by-ym` / `by-id` / `sql-filter` |
| 16 | Chuông `custom_line_new` | Gửi lúc nhân viên lưu | Không gửi cho dòng kỳ mở; topic giữ để đọc chuông cũ | — |
| 17 | Chuông `period_locked` (`notification-scheduler.ts:119-139`) | `registered/headcount` | Thêm `custom_pending`; > 0 thì link `/admin/review?ym=`; kỳ 0 phiếu vẫn gửi (`0/N`) | — |
| 18 | Nhật ký `GET /admin/audit` | Thấy `request.*` kỳ mở | Vai `admin`: ẩn `request.*` và `line.review` có `detail.ym` chưa khóa, lọc **trong SQL trước phân trang** (tổng đếm đúng); vai `sa` thấy hết | `sql-filter` |
| 19 | Xóa món đã dùng (`item-usage.hook.ts`) | "Món đã có trong phiếu" | Chữ trung tính mọi kỳ (R-D8.15) | `none` |
| 20 | Nhân viên (trừ #29), Tủ/Kho (trừ #27), Nhóm & đơn vị (D12), Cấu hình | Không đọc phiếu | Không đổi | `none` |
| 21 | `GET /admin/lines/:id/deliveries` (`backlog.service.ts:76-81`) | Mọi kỳ | Dòng kỳ mở → 409 | `by-id` |
| 22 | `GET /admin/reports/:ym/snapshots`, `GET /admin/reports/snapshots/:id`, `GET …/snapshots/:id/export.xlsx` | Trả cả bản chốt kỳ mở tạo trước khi triển khai | Kỳ của bản chốt chưa khóa → 409 | `by-ym` / `by-id` |
| 23 | `GET /files/:id` loại `line_image` (`file-access.policy.ts:53`) | Vai đặc quyền đọc mọi ảnh | Ảnh của dòng kỳ mở: admin/sa → 404 `FILE_NOT_FOUND`; chủ dòng → 200 | `by-id` |
| 24 | `GET /admin/periods/:ym/unregistered` | Mọi kỳ | Giữ cho kỳ mở (R-D8.4) | `open-progress` |
| 25 | Hàng về kế hoạch / ADM hết hàng (D11) | — (mới) | R-D8.1 | `by-ym` |
| 26 | Lịch sử nhân viên `/me/*` | — | Ngoài phạm vi D8 (nhân viên thấy phiếu mình) | `none` |
| 27 | Tủ/Kho cột "Đang giữ cho người chờ" (D15) `[r3·mới]` | — | Chỉ tính dòng kỳ khóa | `sql-filter` |
| 28 | `GET /admin/reports/:ym/sent` (D5) `[r3·mới]` | — | R-D8.1 | `by-ym` |
| 29 | Nhân viên: cột đăng ký kỳ mở (R-D8.18) `[r3·mới]` | — | Chỉ đã/chưa đăng ký | `open-progress` |

- **R-D8.6** `[r2·sửa]` Nhân viên trong lúc kỳ mở: thêm/sửa/xóa mọi dòng như cũ (BR-4). Dòng ngoài DM hiện "Hành chính xem từ {{lockPhrase}}"; sau khóa sổ về "Chờ Hành chính xem".
- **R-D8.7** Sau khóa sổ: nhân viên chỉ đọc (BR-4); Hành chính xem/duyệt/giảm theo D6, giao theo D7.
- **R-D8.8** Dữ liệu cũ: phiếu kỳ mở đã bị Hành chính sửa trước khi triển khai giữ nguyên; không bản ghi điều chỉnh hồi tố.
- **R-D8.9** `[r2·mới]` **Điểm chặn duy nhất = bảng phân loại route.** File `api/modules/periods/admin-route-classes.ts` khai báo **mọi** route `/admin/*` (method + path) vào đúng một lớp: `by-ym` (guard R-D8.1 theo tham số `ym`), `by-id` (guard theo kỳ của dòng/phiếu/bản chốt/ảnh), `sql-filter` (vị từ `lockedPeriod`), `open-progress` (chỉ số đếm/tên chưa đăng ký), `none` (không phải nội dung phiếu). Test e2e duyệt mọi route Nest đã đăng ký (`app.getHttpAdapter().getInstance()._router.stack`): route `/admin/*` **chưa phân loại → fail**; với lớp `by-ym`/`by-id`, gọi route trên fixture kỳ mở → phải 409 `PERIOD_NOT_LOCKED` (hoặc 404 với ảnh, R-D8.5 #23); với `sql-filter` → kết quả không chứa id dòng kỳ mở của fixture.
- **R-D8.10** `[r2·mới]` (Đ17) Trang chỉ-kỳ-khóa (Tổng hợp, Báo cáo, Giao hàng, Món ngoài DM, Còn nợ, Hàng về, Gửi ADM):
  - mặc định = `latestLocked(now)`; bộ chọn tháng hiện kỳ mở ở trạng thái **vô hiệu** kèm nhãn "Đang mở", trần = kỳ khóa mới nhất;
  - khi có kỳ mở: dải nhắc đầu trang "Kỳ tháng {{month}} đang mở, xem được từ {{lockPhrase}}." + liên kết "Xem tiến độ đăng ký" → Tháng này;
  - `?ym=<kỳ mở>` hoặc `?ym=<tương lai>` → thay bằng `latestLocked` (`replace`) **và** hiện dải nhắc (không đổi âm thầm); `?ym=` sai dạng → `latestLocked`;
  - **chưa có kỳ nào khóa** (cài mới, tháng đầu) → khung trống chung (D3 R-D3.2) thay nội dung trang: tiêu đề "Chưa có kỳ nào chốt sổ", phụ "Kỳ tháng {{month}} đang nhận đăng ký ({{registered}}/{{headcount}} người). Hành chính làm việc từ {{lockPhrase}}.", nút "Xem tiến độ đăng ký".
- **R-D8.11** `[r2·mới]` **Một câu khóa sổ**: hàm `lockPhrase(deadline)` (`web/lib/period-text.ts`) → vi "00:00 ngày {{dd/mm}}", en "00:00 on {{dd/mm}}", `dd/mm` = ngày của `deadline` theo `Asia/Ho_Chi_Minh` (kỳ 2026-11 → "00:00 ngày 11/11"). Mọi chữ nói về giờ khóa dùng hàm này: sidebar, D3, R-D8.6, R-D8.10, `PERIOD_NOT_LOCKED`, `period_lockedCustom`. Không còn cụm "sau khi khóa sổ ({{date}})" với ngày cuối đăng ký.
- **R-D8.12** `[r2·mới]` Web qua giờ khóa: hẹn giờ `invalidateQueries(['periods','current'])` tại `deadline + 1 s` (tính từ `deadline` server trả, không từ giờ máy); React Query **không retry** lỗi 409 `PERIOD_NOT_LOCKED`; hiện lỗi bằng chữ R-D8.11 trong trang (không toast chung).
- **R-D8.13** `[r2·mới]` Nhân viên lưu sát giờ khóa: writer **đọc lại** `ClockService.now()` sau khi khóa phiếu (`FOR UPDATE`), ngay trước khi ghi; `now ≥ deadline` → 409 `PERIOD_LOCKED`, rollback. Dòng không bao giờ xuất hiện trong kỳ sau khi HC đã bắt đầu làm.
- **R-D8.14** `[r2·mới]` Nhật ký (#18): lọc bằng điều kiện SQL trong cùng truy vấn trang (`WHERE NOT (action LIKE 'request.%' OR action = 'line.review') OR (detail->>'ym')::date < $openYm`) để `total` và con trỏ đúng.
- **R-D8.15** `[r2·mới]` `ITEM_IN_USE` đổi chữ ở **mọi** kỳ: "Món này đã được dùng — chỉ ngừng được, không xóa." (không nói tới phiếu, không lộ việc kỳ mở có người đăng ký).
- **R-D8.16** `[r2·mới]` Kỳ khóa có **0 phiếu**: Tổng hợp hiện khung trống "Kỳ tháng {{month}} không có phiếu nào (0/{{headcount}})" kèm danh sách chưa đăng ký; Báo cáo bảng rỗng; Gửi ADM In/Excel vô hiệu (R-D5.11); Hàng về "Không có món nào cần nhập"; Giao hàng/Còn nợ trống; chuông `period_locked` vẫn gửi.
- **R-D8.17** `[r3·mới]` (rà soát #1, Cao — "10/8 người đã đăng ký") **Nguyên nhân**: tử số `registered = count(DISTINCT r.id)` lấy **mọi** phiếu của kỳ (`summary.service.ts:126-140`: kể cả SA cục bộ, người ngoài nhóm được cấp, người đã nghỉ, phiếu chèn sau khi khóa — trên dev là phiếu test `PW …`), còn mẫu số `headcount` là **số đóng băng lúc khóa** (`periods.headcount`, cron `notification-scheduler.ts:124-126` ghi từ `liveCounts`) và `unregistered` lại tính **sống** (`summary.service.ts:141-163`). Ba số đếm ba tập khác nhau ở ba thời điểm. **Quy tắc**: một tập người duy nhất **S(kỳ)**:
  - lúc khóa, cron ghi cả **danh sách** `periods.headcount_subs text[]` (migration `0116_periods_headcount_subs.sql`, cùng giao dịch với `headcount`, ghi một lần như hiện nay) = người đủ điều kiện ∪ chủ phiếu, trừ SA cục bộ;
  - kỳ đang mở, hoặc kỳ cũ chưa có danh sách: S = tập sống (cùng công thức), `headcount_source = 'live'`;
  - `headcount = |S|`; `registered = |chủ phiếu ∩ S|` (phiếu 0 dòng Đ18 vẫn tính); `unregistered = |S \ chủ phiếu|` (danh sách lấy từ S, người đã nghỉ có nhãn "Đã nghỉ"); `outside = |chủ phiếu \ S|`;
  - **bất biến**: `registered + unregistered = headcount` và `registered ≤ headcount`;
  - hiển thị ở mọi nơi (Tháng này, khung sidebar, Tổng hợp, chuông `period_locked`): **"{{registered}}/{{headcount}} người đã đăng ký"**; nếu `outside > 0` thêm dòng nhỏ chỉ ở Tổng hợp: "+{{outside}} phiếu của người ngoài danh sách".
  - `GET /admin/periods/:ym/summary` thêm `outside`.
- **R-D8.18** `[r3·mới]` (rà soát #12, Vừa) Trang Nhân viên: ô số "Chưa đăng nhập lần nào" thay bằng **"Chưa đăng ký kỳ {{month}}: {{n}} người"** (kỳ đang mở, S của R-D8.17); thêm cột **"Kỳ tháng {{month}}"** (Đã đăng ký / Chưa) và bộ lọc tương ứng (`?reg=yes|no`). Chỉ đã/chưa đăng ký (Đ8), không món/số lượng. Dữ liệu từ `GET /admin/periods/:ym/unregistered` (không endpoint mới).
- **R-D8.19** `[r4·mới]` (GAP-14) **Cấu hình ngày hạn nói rõ kỳ áp dụng.** Dưới ô "Ngày cuối đăng ký" có dòng sống: "Kỳ tháng {{open}} (đang mở) vẫn khóa {{lockPhrase(hạn hiện tại)}}. Áp dụng từ kỳ tháng {{open+1}}: khóa {{lockPhrase(hạn mới)}}." (giữ BR-2); hộp xác nhận lặp lại đúng câu này; audit `config.updated` thêm `detail.effective_from_ym`.
- **R-D8.20** `[r4·mới]` (GAP-15) **Hạ "tối đa/tháng" khi kỳ đang mở.** Giỏ NV: dòng đã lưu có `qty > max_qty` mới hiện "Tối đa mới {{max}} — giữ được {{qty}}, không tăng được" (nút + vô hiệu; lưu không đổi số vẫn được). Tổng hợp kỳ khóa: dòng `qty > max_qty` hiện nhãn "Vượt tối đa hiện tại ({{max}})" + bộ lọc "Vượt tối đa"; trong panel giảm, dòng đó có lý do **chọn sẵn** "Vượt định mức" (đổi được). Không lộ gì ở kỳ mở (Đ6).
- **R-D8.21** `[r4·mới]` (GAP-16) **NV thấy mọi phần còn chờ nhận.** `GET /me/periods/current` trả `owed: [{ym, items, units, lines: [{name, unit, qty}]}]` cho **mọi** kỳ khóa còn phần chưa giao (không chỉ tháng liền trước; bỏ phần đã hủy). Dải cam ở trang Đăng ký: "Bạn còn chờ nhận {{list}}. Không cần đăng ký lại." với `list` = "Tháng 11: Bút bi 2 · Tháng 12: 2 món" (≤ 2 món thì ghi tên). Với NV **không** dùng chữ "nợ" (chỉ "còn chờ nhận").

### Trạng thái & biên
- Nhân viên lưu lúc 23:59:59.999 → vào kỳ, HC chưa thấy; lúc 00:00:00.000 → `PERIOD_LOCKED` (R-D8.13). Cron 00:05 gửi `period_locked`.
- Badge/thẻ tải trước nửa đêm: cập nhật ở `deadline + 1 s` (R-D8.12).
- Kỳ 2026-12 → 2027-01 (qua năm), `registration_last_day = 5`: cùng luật, `lockPhrase` = "00:00 ngày 06/01".
- SA cục bộ: như admin về nội dung phiếu; khác ở Nhật ký.

### Dữ liệu/API
`[r3·sửa]` Migration `0116_periods_headcount_subs.sql` (`ALTER TABLE periods ADD COLUMN headcount_subs text[]`, forward-only, R-D8.17). `PERIOD_NOT_LOCKED` (409) có `ym`, `deadline`. Truy vấn đổi: `review.service`, `summary.service`, `summary-lists.service`, `admin-summary.controller`, `admin-request.service`, `request-lines.writer`, `reports.service`, `snapshots.service`, `stock-receipt.service`, `backlog.service` (deliveries), `file-access.policy`, `line-notifier.customLinesAdded`, `notification-scheduler.locked`, `audit-query.service`, `item-usage.hook`.

### Giao diện
| Khóa | vi | en |
|---|---|---|
| `common.period.lockAt` | 00:00 ngày {{date}} | 00:00 on {{date}} |
| `common.period.openBanner` | Kỳ tháng {{month}} đang mở, xem được từ {{lockPhrase}}. | {{month}} registration is open; available from {{lockPhrase}}. |
| `common.period.seeProgress` | Xem tiến độ đăng ký | See registration progress |
| `common.period.openTag` | Đang mở | Open |
| `common.period.noneLockedTitle` | Chưa có kỳ nào chốt sổ | No closed period yet |
| `common.period.noneLockedHint` | Kỳ tháng {{month}} đang nhận đăng ký ({{registered}}/{{headcount}} người). Hành chính làm việc từ {{lockPhrase}}. | {{month}} is taking requests ({{registered}}/{{headcount}}). Admin work starts {{lockPhrase}}. |
| `common.errors.PERIOD_NOT_LOCKED` | Kỳ tháng {{month}} chưa chốt sổ. Hành chính làm việc từ {{lockPhrase}}. | {{month}} is not closed yet. Admin work starts {{lockPhrase}}. |
| `request.cart.status.pendingOpen` | Hành chính xem từ {{lockPhrase}} | Admin reviews from {{lockPhrase}} |
| `notifications.topics.period_lockedCustom` | Kỳ {{month}} đã khóa: {{registered}}/{{headcount}} người đã đăng ký · {{custom}} món ngoài danh mục chờ xem. | {{month}} is closed: {{registered}}/{{headcount}} registered · {{custom}} off-catalogue items to review. |
| `summary.emptyPeriod` | Kỳ tháng {{month}} không có phiếu nào (0/{{headcount}}) | No requests for {{month}} (0/{{headcount}}) |
| `catalog.errors.ITEM_IN_USE` | Món này đã được dùng — chỉ ngừng được, không xóa. | This item has been used — you can discontinue it but not delete it. |
| `common.period.registered` | {{registered}}/{{headcount}} người đã đăng ký | {{registered}}/{{headcount}} people registered |
| `summary.outside` | +{{n}} phiếu của người ngoài danh sách | +{{n}} requests from people outside the list |
| `users.stats.unregistered` | Chưa đăng ký kỳ {{month}}: {{n}} người | Not registered for {{month}}: {{n}} |
| `users.cols.period` / `registered` / `notRegistered` | Kỳ tháng {{month}} / Đã đăng ký / Chưa | {{month}} / Registered / Not yet |

### Tiêu chí nghiệm thu
| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 1 | R-D8.1–R-D8.3 | Tham số hóa mọi endpoint lớp `by-ym`/`by-id` (gồm #7–#9, #11, #12, #14, #21, #22, #25): `CLOCK_OFFSET_MS` → `2026-11-10T16:59:59.999Z` → 409 `PERIOD_NOT_LOCKED`; `17:00:00.000Z` → 2xx | API |
| 2 | R-D8.1 | `ym` = kỳ mở + 1 → 400 `INVALID_PERIOD`; `ym` khóa không có dòng `periods` → không 409 | API |
| 3 | R-D8.1 | Kỳ 2026-12 (`registration_last_day = 5`): 2026-12-05T16:59:59.999Z mở, 17:00:00.000Z khóa; kỳ 2027-01 qua năm cùng luật | API |
| 4 | R-D8.2 | Ở .999: `GET /admin/review` (không `ym`) không chứa dòng kỳ mở; ở .000 có | API |
| 5 | R-D8.4 | Kỳ mở: `GET periods/:ym/summary` trả **đúng** tập khóa `{registered, headcount, unregistered, deadline, is_open}` + trường dòng `null`; `unregistered` 200 với đúng 4 trường mỗi người | API |
| 6 | R-D8.5 #17 | Cron khóa kỳ có 2 dòng chờ → `custom_pending: 2` + link; 0 dòng → `custom_pending: 0`, link Tổng hợp; kỳ 0 phiếu → vẫn 1 chuông `0/N` | API |
| 7 | R-D8.5 #18, R-D8.14 | Vai admin: `request.updated` và `line.review` kỳ mở không có, `total` không đếm chúng, trang 2 không lặp; sau khóa → có; vai sa → luôn có | API |
| 8 | R-D8.5 #16 | Nhân viên lưu dòng ngoài DM kỳ mở → 0 chuông `custom_line_new` | API |
| 9 | R-D8.5 #23 | Ảnh dòng ngoài DM kỳ mở: admin → 404, chủ dòng → 200; sau khóa admin → 200 | API |
| 10 | R-D8.6 | Nhãn dòng ngoài DM của nhân viên: trước khóa "Hành chính xem từ 00:00 ngày 11/11", sau khóa "Chờ Hành chính xem" | Vitest |
| 11 | R-D8.7 | Sau khóa: `PUT /me/request/lines` → 409 `PERIOD_LOCKED`; admin `PUT` → 200 | API |
| 12 | R-D8.8 | Migration/deploy không chèn bản ghi điều chỉnh nào (`count = 0` sau khi chạy trên DB có phiếu đã sửa) | DB |
| 13 | R-D8.9 | Test phân loại: mọi route `/admin/*` có lớp; thêm route giả chưa phân loại vào module test → fail; route `by-ym` thiếu guard (mock) → fail | API |
| 14 | R-D8.10 | Kỳ mở 11, khóa 10: Tổng hợp/Báo cáo/Giao hàng mở tháng 10 + dải nhắc có "00:00 ngày 11/11"; `?ym=2026-11` → URL thành `2026-10` + dải nhắc; bộ chọn có 11 vô hiệu "Đang mở" | Vitest |
| 15 | R-D8.10 | Không có kỳ khóa nào: 7 trang hiện "Chưa có kỳ nào chốt sổ" + nút về Tháng này; có 1 kỳ khóa → nội dung trang | Vitest |
| 16 | R-D8.11 | `lockPhrase('2026-11-10T17:00:00.000Z')` = "00:00 ngày 11/11" (en "00:00 on 11/11") dưới `TZ=America/Los_Angeles` và `TZ=Pacific/Kiritimati`; quét `web/src/locales`: không còn cụm "sau khi khóa sổ ({{date}})" | Vitest |
| 17 | R-D8.12 | Đồng hồ giả: tới `deadline + 999 ms` chưa refetch; `deadline + 1 s` refetch; 409 `PERIOD_NOT_LOCKED` → 1 lần gọi (không retry) và chữ lỗi R-D8.11 | Vitest |
| 18 | R-D8.13 | Nhân viên lưu, tx giữ khóa phiếu bằng tx khác tới qua `deadline` (đồng hồ dịch giữa chừng) → 409 `PERIOD_LOCKED`, 0 dòng mới; trước `deadline` → 200 | DB |
| 19 | R-D8.15 | Xóa món đã có dòng (mọi kỳ) → 409 `ITEM_IN_USE`, chữ vi/en mới, không chứa "phiếu" | Vitest + API |
| 20 | R-D8.16 | Kỳ khóa 0 phiếu: Tổng hợp khung trống + danh sách chưa đăng ký; Gửi ADM nút vô hiệu; kỳ 1 phiếu → bảng | Vitest |
| 21 | R-D8.5 #3 | Sidebar không có badge Món ngoài DM khi chỉ có dòng kỳ mở; có dòng kỳ khóa → có | PW |
| 22 | R-D8.17 | Tái hiện: S lúc khóa 8 người (6 có phiếu), sau khóa chèn 2 phiếu của người ngoài S + 1 phiếu SA cục bộ → `registered 6`, `headcount 8`, `unregistered 2`, `outside 2` (trước sửa: 9 hoặc 10/8); bất biến `registered + unregistered = headcount` đúng với mọi fixture (kiểm bằng vòng lặp trên 5 fixture) | API |
| 23 | R-D8.17 | Cron khóa kỳ ghi `headcount_subs` cùng `headcount` (độ dài = `headcount`); chạy lại không ghi đè; kỳ cũ không có danh sách → `headcount_source 'live'` | DB |
| 24 | R-D8.17 | Tháng này, sidebar, Tổng hợp cùng hiện "6/8 người đã đăng ký"; Tổng hợp có "+2 phiếu của người ngoài danh sách"; `outside 0` → không có dòng đó | Vitest |
| 25 | R-D8.18 | Nhân viên: ô "Chưa đăng ký kỳ 11: 2 người"; lọc `reg=no` ra đúng 2 người; cột không có số món | Vitest |

**Tiêu chí bổ sung (vòng 4)**

| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 26 | R-D8.19 | Kỳ mở 01, hạn 10 → đổi 8: dòng "Kỳ tháng 01 (đang mở) vẫn khóa 00:00 ngày 11/01. Áp dụng từ kỳ tháng 02: khóa 00:00 ngày 09/02."; hộp xác nhận cùng câu; audit có `effective_from_ym: 2027-02` | Vitest + API |
| 27 | R-D8.20 | Hạ tối đa 5 → 4 khi NV đã lưu 5: giỏ hiện câu W12b, + vô hiệu, lưu lại 5 → 200; kỳ khóa: nhãn + lọc "Vượt tối đa" đúng 1 dòng; panel giảm chọn sẵn "Vượt định mức" | Vitest + API |
| 28 | R-D8.21 | A còn 2 Bút bi tháng 11 và 2 món tháng 12 → `owed` có 2 kỳ; dải "Bạn còn chờ nhận Tháng 11: Bút bi 2 · Tháng 12: 2 món. Không cần đăng ký lại."; quét `locales/vi/{request,history,home-member}.ts` không có "nợ" | API + Vitest |

---

## D9. Dữ liệu dev

- **R-D9.1** (Đ0a) Không thay đổi mã. Danh mục dev đã đặt lại: **50 món `active`, 50/50 có ảnh, 5 nhóm**. Nhóm, ĐVT, "tối đa/tháng" do suy đoán; chủ dự án sửa sau. Trước khi dùng thật cần soát `max_qty` (BR-5) và ĐVT.
- **R-D9.2** `[r2·sửa]` Ảnh chụp chuẩn PW (D3 #7, D4) chụp trên **dữ liệu fixture tự gieo** (không phải dữ liệu dev), trong container Playwright cố định (phông, OS), `maxDiffPixelRatio: 0.01`; đổi giao diện thì cập nhật ảnh chuẩn trong cùng PR. Nơi khác chỉ assert DOM.
- **R-D9.3** (Đ10) Tồn tủ dev = **0 mọi món**; lịch sử nhập/xuất đã xóa. Hệ quả trên dev: mọi món "Hết"; Xuất lẻ bị chặn; hộp giao hiện câu "Tủ chưa có hàng…" (R-D7.3) tới khi ghi Hàng về.
- **R-D9.4** `[r2·mới]` (Đ20) Dữ liệu mẫu kỳ 2026-10 trên dev (đã tạo, `live-real/v2c/demo-seed.md`): nhân viên tên có "(demo)", `sub` dạng `demo-d10-%`, mỗi người 3–5 món trong 50 món + 1 món ngoài DM. Chỉ để chủ dự án đi thử luồng HC; xóa bằng `sub LIKE 'demo-d10-%'` (phiếu, dòng, người). Không chạy ở môi trường thật.
- **R-D9.5** `[r3·sửa]` Test (api e2e, PW) **không dựa** vào dữ liệu dev có sẵn (50 món, B23, tồn 0, demo kỳ 10, kỳ/bản chốt hiện có): mỗi test tự tạo dữ liệu của mình — món/nhóm/ĐVT tên **"PW …"**, người `sub` **"pw-…"** — tự gieo tồn và tự dọn trong `finally`. PW (Đ35, DB dev chung, `workers: 1`) **chỉ ghi lên dữ liệu "PW …"/"pw-…"**: Hàng về, giao, giảm, hủy nợ, ADM hết hàng, bản chốt chỉ trên món PW và phiếu của người `pw-…` — không bao giờ trên món thật hay phiếu người thật, kể cả ở kỳ đang khóa (lượt chạy 06/11 đã ghi Hàng về thật kỳ 2026-10 dưới admin dev vì dùng món thật).
- **R-D9.6** *(bỏ, Đ35 — PW giữ DB dev chung; không dùng lại số này)*
- **R-D9.7** `[r3·mới]` (Đ35) **Đường dọn dữ liệu dev** `web/playwright/cleanup-dev-data.sql` (cách chạy ở `README.md:164`, cần `-v dev_ok=1`, DB khác `vpp` → dừng) được **giữ chạy được** và **cập nhật cùng mỗi migration** đụng tới dữ liệu PW. Chủ dự án chạy khi dữ liệu dev bẩn; chạy lại bao nhiêu lần cũng được. Đối chiếu với migration v2-D:
  - `0113_request_line_adjustments` (không FK): script **phải thêm** `DELETE FROM request_line_adjustments WHERE line_id IN (SELECT id FROM pw_lines) OR user_sub LIKE 'pw-%'` **trước** khi xóa phiếu — không có thì để lại bản ghi mồ côi (không lỗi, nhưng Lịch sử/R-X.1 đọc thừa);
  - `0114_period_adm_out` (FK `period_ym` cascade): **phải thêm** xóa dòng có `item_id IN pw_items` trước `DELETE FROM items` (không thì 23503 nếu có FK món, hoặc mồ côi nếu không);
  - `0115` `stock_movements.receipt_ym`: không cần đổi (dòng PW đã xóa theo `item_id`/`ref_line_id`);
  - `0116` `periods.headcount_subs`: **phải thêm** bỏ `sub LIKE 'pw-%'` khỏi mảng và đặt lại `headcount = cardinality(headcount_subs)` cho kỳ có mảng (giữ bất biến R-D8.17), trước khi xóa người `pw-…`;
  - bản ghi do PW tạo trên dữ liệu **thật** (vd Hàng về kỳ 2026-10 của admin dev hôm 06/11) script **không** tự nhận diện được — dọn tay một lần (ghi lệnh trong `live-real/v2c/demo-seed.md`); R-D9.5 ngăn tái diễn.
  Mỗi PR thêm migration có bảng/cột tham chiếu phiếu, món, người hoặc kỳ phải cập nhật script (mục kiểm trong mô tả PR).
### Tiêu chí nghiệm thu
| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 1 | R-D9.1 | Truy vấn kiểm dev: `count(*) FILTER (WHERE active) = 50`, `count(image_file_id) = 50`, 5 nhóm | Ops (truy vấn một lần) |
| 2 | R-D9.2 | Cấu hình PW có `maxDiffPixelRatio 0.01`; test ảnh chuẩn gieo fixture riêng (grep không có mã món dev) | Vitest (quét file) |
| 3 | R-D9.3 | Truy vấn kiểm dev: `max(stock_qty) = 0` | Ops |
| 4 | R-D9.4 | Truy vấn xóa demo trả về đúng số người/phiếu/dòng của `demo-seed.md`; chạy lại → 0 | Ops |
| 5 | R-D9.5 | Quét `api/test`, `web/playwright`: không có mã món dev (`B23`, `K05`…) và không có `demo-d10` | Vitest (quét file) |
| 6 | R-D9.7 | Trên DB dev sau migration 0113–0116, gieo một người `pw-x` có phiếu kỳ khóa, 1 dòng giảm có bản ghi điều chỉnh, 1 món PW đánh ADM hết hàng, `pw-x` trong `headcount_subs` → chạy script: 0 lỗi; 0 dòng `request_line_adjustments`/`period_adm_out` mồ côi; `headcount_subs` không còn `pw-%` và `headcount` = độ dài mảng; chạy lần 2: 0 lỗi, không đổi gì; dữ liệu người thật/món thật không đổi (đếm trước/sau) | Ops |
| 7 | R-D9.5 | Quét `web/playwright/*.spec.ts`: mọi lời gọi ghi (Hàng về, giao, điều chỉnh, hủy nợ, adm-out, snapshot) dùng món/người do chính spec tạo (helper `seedPwItem`/`seedActiveUser` trả tên "PW …"/sub "pw-…"); không tra món theo tên/mã thật | Vitest (quét file) |

---

## D10. Gỡ bỏ hoàn toàn "Tạo phiếu hộ" (Đ9)

Đ9: bỏ nút, API không còn, xóa sạch phần còn sót. Nhân viên quên đăng ký: chờ tháng sau; cần gấp thì Hành chính **Xuất lẻ từ tủ** nếu tủ còn món đó (FR-54).

### Hiện trạng (kiểm kê đầy đủ; architect đã đối chiếu grep, không sót)
| Tầng | Phần tử | Vị trí |
|---|---|---|
| API route | `@Post() create(...)` + import `CreateOnBehalfBody` | `api/modules/requests/admin-requests.controller.ts:7,23-29` |
| Service | `create()`, `insertOnBehalf()` | `admin-request.service.ts:66-82,84-112`; import `:6,7,9,11-16,21`; tiêm `:30-31` `users`, `config` |
| DTO | `CreateOnBehalfBody` | `request.dto.ts:68-70` |
| Writer | `SaveArgs.on_behalf?`; nhánh `REQUEST_EXISTS`; `lineMode()`; import `requestExists`; chú thích | `request-lines.writer.ts:48-49,143,269-271,19,79` |
| Mã lỗi | `requestExists`, `userInactive`, `userIsAdmin` | `request-errors.ts:79-96` (`USER_INACTIVE` của Xuất lẻ là bản riêng `catalog/stock.service.ts:281` — giữ) |
| Lọc danh bạ | `exclude_admin` (chỉ hộp tạo hộ dùng) | `users-admin.controller.ts:25,52-53`, `users.service.ts:26,88-90`, `api/test/admin-users-exclude-admin.e2e-spec.ts`; web `directory.api.ts:22-28`, `user-picker.tsx:20,33,45`, `user-picker.test.tsx:35-47` |
| Test api | file tạo hộ; ca chuông | `api/test/admin-requests-create.e2e-spec.ts`; `custom-line-notify.e2e-spec.ts:177-206` |
| Web | hộp, dòng, test | `features/summary/create-request-dialog.tsx`, `create-request-lines.tsx`, `create-request-dialog.test.tsx` |
| Web trang | import, state, `canCreate`, nút đầu trang, prop, render hộp | `summary-page.tsx:16,57,71,86-91,110,133-140` |
| Web bảng | `canCreate/onCreate`, cột nút, ghi chú kỳ khóa | `unregistered-table.tsx:14-15,21,40-55,62-65` |
| Web API/lỗi | `createOnBehalf`; `CreateErrors`, `USER_CODES`, `createFailure` | `summary.api.ts:128-136`; `summary-errors.ts:11,30,58-66` |
| Test web | ca tạo hộ | `unregistered-table.test.tsx:6-23`, `summary-page.test.tsx:191`, `summary-toolbar.test.tsx:41`; PW `web/playwright/adjust.spec.ts:171-217` |
| i18n | `summary.unregistered.createLabel`, `.lockedNote`; khối `summary.create` | vi `locales/vi/summary.ts:87-88,171-201`; en `locales/en/summary.ts:90-91,174-…` |
| Docs | FR-32, quyết định 2026-10-30 | `docs/prd.md:90,92,196` |
| Docs | API, `exclude_admin`, mã lỗi, BR-7 e2e | `docs/architecture.md:214,219,223,290` |
| Docs | requests, directory, summary | `docs/map.md:31,48,53` |
| Docs | E3-S4 | `docs/backlog/epic-3-tong-hop-dieu-chinh.md:15-17` |
| Chú thích | "tạo hộ" | `summary.service.ts:140`, `user-picker.tsx:77`, `api/test/summary-headcount.db-spec.ts:124`, `api/test/reminders.e2e-spec.ts:28` |

**DB:** không có cột nào chỉ tính năng này dùng (không có `created_by_admin`); `requests.created_by_sub` (0102:16) ghi cho mọi phiếu → giữ. Không migration.

### Quy tắc mới
- **R-D10.1** `[r2·sửa]` Route `POST /api/admin/requests` **không còn**: xóa handler (giữ `GET /admin/requests/:id`, `PUT …/lines`). Gọi route → **404** `{statusCode: 404, code: 'NOT_FOUND'}` (router Nest + `global-exception.filter.ts:80-81`). Vì route không khớp thì không chạy `APP_GUARD` (Identity, CSRF, Roles — `auth.module.ts:30-35`), 404 đúng với **mọi vai, có hay không CSRF, kể cả ẩn danh**. **404 chứ không 409**: 409 là thao tác tồn tại nhưng xung đột trạng thái; tạo hộ sai ở mọi trạng thái, và một stub trả 409 nghĩa là route vẫn tồn tại, trái Đ9 (architect đồng ý).
- **R-D10.2** Xóa `create()`, `insertOnBehalf()`, import và phụ thuộc chỉ chúng dùng; xóa `CreateOnBehalfBody`.
- **R-D10.3** Writer: xóa `on_behalf`, nhánh `REQUEST_EXISTS` (`:143`), `lineMode()`; giữ chặn `local:sa` (`:80`), `LINES_EMPTY` (`:148`), `userNotFound`. Xóa `requestExists`, `userInactive`, `userIsAdmin`.
- **R-D10.4** `[r3·sửa]` Web: xóa hộp, dòng, test; `createOnBehalf`, `CreateErrors/USER_CODES/createFailure`; `UnregisteredTable` còn 2 cột (Người, Phòng ban). Nút chính đầu Tổng hợp (rà soát #2, Vừa) thành **"Sang Gửi ADM →"** (Tổng hợp chỉ xem kỳ khóa, R-D8.10); "Chép DS chưa đăng ký" giữ ở nút phụ (dùng cho kỳ khóa: người đã bỏ lỡ).
- **R-D10.5** `[r2·sửa]` Xóa `exclude_admin` (API DTO + `useUserSearch` + prop `UserPicker.excludeAdmin`) và test của nó. Client cũ gửi `?exclude_admin=true` → bị `whitelist` lột, **200** danh sách đầy đủ (không lỗi).
- **R-D10.6** i18n: xóa `summary.unregistered.createLabel`, `.lockedNote`, khối `summary.create` (vi, en).
- **R-D10.7** Test: xóa `admin-requests-create.e2e-spec.ts`, `admin-users-exclude-admin.e2e-spec.ts`, ca `custom-line-notify.e2e-spec.ts:177-206`, PW `adjust.spec.ts:171-217`, ca vitest tạo hộ; test mẫu số (`summary-headcount.db-spec.ts:124`, `reminders.e2e-spec.ts:28`) **giữ**, chỉ đổi chữ "tạo hộ" → "chủ phiếu ngoài tập".
- **R-D10.8** `[r2·sửa]` Docs: FR-32 "Hành chính không tạo phiếu thay nhân viên (gỡ 2026-11-06, Đ9). Quên đăng ký: chờ tháng sau; cần gấp: Xuất lẻ từ tủ nếu còn hàng"; thêm dòng nhật ký quyết định vào `prd.md`; gỡ `POST admin/requests`, `exclude_admin`, `REQUEST_EXISTS`, `USER_IS_ADMIN` khỏi `architecture.md` (giữ `USER_INACTIVE` cho Xuất lẻ); BR-7 e2e thành "kỳ khóa không có đường tạo phiếu mới"; cập nhật `map.md`; E3-S4 "Đã gỡ (Đ9)". Plan/spec cũ có ngày giữ nguyên.
- **R-D10.9** Dữ liệu cũ: phiếu đã tạo hộ hiện như mọi phiếu; Nhật ký giữ `request.created` cũ (actor = Hành chính). Không xóa, không sửa hàng nào.

### Tiêu chí nghiệm thu
| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 1 | R-D10.1 | Ma trận {admin, member, sa, ẩn danh} × {CSRF đúng, CSRF thiếu}: `POST /api/admin/requests` body hợp lệ cũ → 404 `NOT_FOUND` cả 8 ô; 0 phiếu mới | API |
| 2 | R-D10.1 | `GET /admin/requests/:id`, `PUT /admin/requests/:id/lines` (kỳ khóa, admin) vẫn 2xx; member → 403 như cũ | API |
| 3 | R-D10.9 | Phiếu gieo trực tiếp có `created_by_sub ≠ user_sub` hiện trong `GET periods/:ym/requests` (kỳ khóa) và Lịch sử chủ phiếu | API |
| 4 | R-D10.4 | Tổng hợp mọi kỳ: không nút "Tạo phiếu hộ"; nút chính "Sang Gửi ADM →" dẫn `/admin/send-adm?ym=`; bảng Chưa đăng ký đúng 2 cột | Vitest |
| 5 | R-D10.2, R-D10.3, R-D10.4, R-D10.6 | Test quét mã: `on_behalf|OnBehalf|REQUEST_EXISTS|USER_IS_ADMIN|createOnBehalf|summary.create|Tạo phiếu hộ` không có trong `api/src`, `web/src`, `web/playwright` | Vitest (quét file) |
| 6 | R-D10.5 | `GET /admin/users?exclude_admin=true` → 200, có cả người thuộc `admin_group` | API |
| 7 | R-D10.7 | Hai file test đã xóa không tồn tại; `summary-headcount.db-spec.ts` vẫn chạy | Vitest (quét file) |
| 8 | R-D10.8 | Quét `docs/prd.md`, `architecture.md`, `map.md`: không còn `POST admin/requests` và `exclude_admin` | Vitest (quét file) |

---

## D11. Hàng về: nhập nhanh, "Đủ hàng" theo bản in, "ADM hết hàng" (Đ11, Đ16, Đ19, Đ23, Đ24) `[r2·mới]`

### Hiện trạng
- `/admin/arrivals` chỉ cho kỳ khóa mới nhất (`arrivals-page.tsx:205-210`, `PeriodLockGate`). Hàng = `report.byItem` có `need > 0` và món còn dùng (`arrival-rows.ts:23-38`); số điền sẵn = **Cần mua** (`need`). Cột: Món · Còn chờ · Tủ hiện có · Về lần này · Tình trạng · Tủ sau khi lưu (`arrival-table.tsx:25-30`, `locales/vi/arrivals.ts` khối `table`). Không lọc, không tìm, không gom nhóm.
- "Thêm món khác" là `<select>` phẳng không tìm (`arrivals-page.tsx:27-71`).
- Lưu: `POST` hàng về **tất cả hoặc không** — mỗi dòng có `expected_stock_qty` (sai → 409 `STALE_UPDATE`), món ngừng → 404 `ITEM_NOT_FOUND`, `note = "Hàng về kỳ <ym>"` (`stock-receipt.service.ts:27-95`). Số về luôn cộng vào tủ, không chặn khi vượt nhu cầu.
- `stock_movements` **không có cột kỳ** (`0100_vpp_catalog.sql:41-57`); kỳ chỉ nằm trong `note`.
- Món ngoài DM: không qua tủ, giao thẳng (`arrival-rows.ts:44-46`).
- Bản chốt: `report_snapshots(period_ym, kind ∈ {print, xlsx}, data jsonb, created_by_sub, created_at)`; `data: SnapshotData` = `MonthReport` + `order_qty: Record<key, number>` (`report.types.ts:80-87`). Hàng món: `key = item_id` (`reports.service.ts:60`); hàng ngoài DM: `key = 'custom:' || [lower(name), lower(unit)]`, không `item_id` (`line-predicates.ts:13`). Số **Đề nghị** in ra = `order_qty[key] ?? need` (`xlsx-request-form.ts:53-54`).
- Thanh lọc nhân viên: `item-filters.ts` (`parseFilter`, `applyFilters`, `groupCounts`, `filterPatch`), `filter-bar.tsx` (ô tìm `useUrlSearchBox`, chip nhóm có số `aria-pressed`, chip "Đã chọn"); tìm không dấu `matchesSearch` (`request-format.ts:51-55`).
- Tháng này có bước Hàng về với giá trị "Đủ hàng" (`locales/vi/home.ts:35`, `month-steps-list.tsx:21`).

### Quy tắc mới
**Thành phần dùng chung (Đ23)**
- **R-D11.1** `[r2·mới]` Tách từ màn nhân viên, không đổi hành vi màn nhân viên:
  - `web/lib/search.ts`: `foldVi()` + `matchesSearch()` (chuyển từ `request-format.ts:51-55`, giữ re-export);
  - `web/lib/group-counts.ts`: `groupCounts<T extends {category_id: string | null}>()` tổng quát từ `item-filters.ts:64-70` (chip "Chưa xếp nhóm" cuối);
  - `web/ui/filter/search-box.tsx` `<SearchBox>` (ô tìm + `useUrlSearchBox` + `IconSearch`, từ `filter-bar.tsx:44-54`);
  - `web/ui/filter/group-chips.tsx` `<GroupChips>` (nhóm chip `role="group"`, `aria-pressed`, số đếm, từ `filter-bar.tsx:35-40,73-76`);
  - `web/ui/filter/grouped-combobox.tsx` `<GroupedCombobox>` mới (ARIA combobox: ô nhập `role="combobox"` + `role="listbox"` có `role="group"` theo nhóm, lọc bằng `matchesSearch`).
  - `FilterBar` nhân viên dựng lại từ `SearchBox` + `GroupChips`.

**Bảng Hàng về**
- **R-D11.2** `[r2·mới]` (Đ23) Thanh lọc: `SearchBox` (không dấu; khớp tên vi, tên en, mã món) · `GroupChips` "Tất cả n" + mỗi nhóm có số **hàng đang có ở Hàng về** · công tắc "Chỉ món chưa về đủ (n)". Trạng thái lọc trên URL `?q=&g=&short=1` (`replace`). Dòng đếm "Đang hiện x/y món". Không khớp → "Không có món khớp" + "Xóa lọc". Lọc chỉ ẩn hàng, **không** xóa số đã gõ; Lưu gửi cả hàng đang ẩn có số > 0.
- **R-D11.3** `[r2·mới]` Hàng **gom theo nhóm món** theo thứ tự chung (R-D2.3); đầu nhóm dính khi cuộn: tên nhóm · "đã về đủ a/b". Cột: Món · **Đề nghị** (theo bản in) · **Đã về các đợt trước** · Tủ hiện có · **Về đợt này** (đổi tên từ "Về lần này") · nút ADM hết hàng · Tình trạng · Tủ sau khi lưu. < 768 px: thẻ xếp dọc (`stackOnMobile`).
- **R-D11.4** `[r2·mới]` Đầu nhóm có nút **"Về đủ cả nhóm"**: điền "Về đợt này" = phần còn lại (R-D11.7) cho mọi hàng của nhóm (bỏ qua hàng ADM hết hàng, món đã ngừng); chỉ đổi nháp ở trình duyệt, chưa ghi; bấm lại ("Bỏ điền cả nhóm") trả các ô về số trước đó. **Không** có "ADM hết hàng cả nhóm" (lý do ở mục R).
- **R-D11.5** `[r2·mới]` "Chỉ món chưa về đủ": giữ hàng có `received < ordered` và không đánh ADM hết hàng, không phải món đã ngừng.

**Nguồn số theo bản in (Đ24)**
- **R-D11.6** `[r3·sửa]` **Bản in dùng làm nguồn** = dòng `report_snapshots` của kỳ có `kind IN ('print','xlsx')` **và có hàng** (R-D5.16, Đ30), mới nhất theo `created_at DESC, id DESC` — cùng nguồn `GET …/sent` với chế độ Đã gửi (R-D5.13). Bản rỗng **không bao giờ** là nguồn. Nhiều bản chốt → luôn lấy bản mới nhất (bản gần nhất đã gửi ADM). Vì R-D5.9 (Đ15) dùng lại bản cũ khi số liệu không đổi, in lại sau khi Hủy **không** sinh bản mới → nguồn không nhảy; chỉ khi số liệu đổi mới có bản mới, và bản mới thay nguồn. Thanh công cụ hiện "Theo bản in {{hh:mm dd/mm}}" (liên kết trang in riêng).
- **R-D11.7** `[r2·mới]` Với mỗi hàng món `r ∈ data.byItem` của bản đó: `ordered = data.order_qty[r.key] ?? wantOf(r)` (đúng số Đề nghị đã in; bản chốt luôn lưu đủ `order_qty` cho mọi hàng — `order-qty.ts:24-26` — nên vế sau chỉ là lưới an toàn); `received` = tổng `stock_movements.delta` có `reason = 'purchase'`, `receipt_ym = kỳ`, `item_id = r.item_id` (mọi đợt, kể cả trước khi chốt); `remaining = max(0, ordered − received)`. Hàng hiện = các hàng món của bản có `ordered > 0` + hàng thêm bằng "Thêm món khác". **Số điền sẵn** "Về đợt này" = `remaining` (thay cho Cần mua — giải quyết M6). Chưa có bản chốt → hàng có `wantOf > 0`, `ordered = wantOf` (số gộp, Đ25 / R-D13.1), điền sẵn `remaining`, và hiện ghi chú "Chưa in trình ký gửi ADM — số điền sẵn theo tổng đăng ký + nợ tháng trước".
- **R-D11.8** `[r2·mới]` Migration `0115_stock_movements_receipt_ym.sql`: `ALTER TABLE stock_movements ADD COLUMN receipt_ym date`, `CHECK (receipt_ym IS NULL OR reason = 'purchase')`, index `(receipt_ym, item_id)`; backfill các dòng `reason='purchase'` có `note ~ '^Hàng về kỳ \d{4}-\d{2}'` → `receipt_ym = to_date(substring(note …), 'YYYY-MM')`. `StockReceiptService` ghi `receipt_ym = body.ym`. Forward-only.

**Giảm sau khi gửi ADM (Đ11)**
- **R-D11.9** `[r2·mới]` Hàng có bản ghi điều chỉnh "sau khi gửi ADM" (R-D6.17) của món đó: nhãn "Đã giảm {{n}} sau khi gửi ADM — phần dư vào tủ" (`n` = tổng `before − after`). `ordered` **vẫn theo bản in** (ADM giao theo bản in), nên số về lớn hơn nhu cầu sống; phần dư vào tủ như mọi lần nhập (không đổi luật nhập). Đầu trang: "{{x}} món đã giảm sau khi gửi ADM — phần dư sẽ vào tủ".

**Món đã ngừng, món ngoài danh mục**
- **R-D11.10** `[r4·sửa]` Hàng của bản in mà món nay đã ngừng (`usable = false`, gồm ngừng theo nhóm — D12): hiện mờ, ô "Về đợt này" vô hiệu = 0, nhãn "Đã ngừng — bật lại ở Nhóm món để nhập"; không gửi khi Lưu, bỏ qua ở "Đủ hàng" (API nhập trả 404 `ITEM_NOT_FOUND` với món ngừng và nhập là tất-cả-hoặc-không). `[r4]` (Đ40, GAP-05) **Thay luật trên:** món đã ngừng **vẫn nhập được** nếu có trong bản in của kỳ với `ordered > 0` (đã đặt thì phải nhận): ô bình thường, nhãn xám "Ngừng dùng — đã đặt trong bản in". API nhập: món ngừng → cho phép khi `receipt_ym` có bản có hàng chứa món với `order_qty > 0`, ngược lại vẫn 404 `ITEM_NOT_FOUND`. Món ngừng không có trong bản in: không hiện, không thêm bằng "Thêm món khác".
- **R-D11.11** `[r2·mới]` Hàng ngoài DM của bản in (`key` bắt đầu `custom:`, không `item_id`): **không nhập tủ** (giao thẳng như hiện nay). Hiện ở khối thu gọn cuối trang "Món ngoài danh mục — giao thẳng, không vào tủ (n)" với Đề nghị, chỉ đọc; "Đủ hàng" đếm vào phần bỏ qua.

**ADM hết hàng (Đ19, Đ16)**
- **R-D11.12** `[r4·sửa]` Mỗi hàng có nút nhỏ **"ADM hết hàng"** cạnh ô "Về đợt này" (`aria-pressed`). Bật → `PUT /admin/periods/:ym/adm-out/:item_id` ghi ngay (không đợi Lưu); ô về **0 + khóa**, nhãn xám "ADM hết hàng"; số đang gõ ở ô đó bị thay bằng 0. Tắt → `DELETE …` ghi ngay; ô trở lại số điền sẵn. Theo **kỳ** (bảng `period_adm_out`), **không** đổi `items.active`. Điều kiện: `[r4]` (Đ38) "Tắt được tới khi giao xong **hoặc tới khi kỳ sau khóa sổ**" — lúc kỳ sau khóa, phần chưa giao bị tự hủy (R-D11.19) và nút thành "ADM hết hàng · đã xử lý xong". Khóa đánh dấu là `line_key` (món: `item_id`; ngoài DM: khóa `custom:` — R-D11.21).
  - kỳ phải khóa (R-D8.1);
  - bật khi món không còn dòng mở (còn nợ > 0) nào trong kỳ → 409 `ADM_OUT_NOTHING_OPEN`;
  - **tắt được tới khi giao xong**: còn ≥ 1 dòng của món trong kỳ có còn nợ > 0 → tắt được; không còn (mọi dòng đã giao đủ/hủy) → 409 `ADM_OUT_FINAL`, nút hiện khóa "ADM hết hàng · đã xử lý xong";
  - `PUT` lặp → 200 không đổi; `DELETE` khi chưa đánh → 204;
  - nhập hàng về có `qty > 0` cho món đang đánh dấu của kỳ đó → 409 `ITEM_ADM_OUT` (cả phiếu nhập bị từ chối);
  - audit `arrival.adm_out_marked` / `arrival.adm_out_unmarked`.
- **R-D11.13** `[r4·sửa]` (Đ16) Khi giao: dòng còn nợ thuộc **kỳ đã đánh dấu** của món đó nằm ở nhóm "ADM hết hàng — hủy, không thành nợ" trong hộp D7: stepper **mặc định 0** (sửa được tới `min(còn nợ, tủ)` nếu tủ còn hàng cũ); khi Xác nhận, sau các lệnh giao, phần còn nợ của dòng bị **hủy luôn** bằng `POST /admin/lines/:id/cancel-remaining {reason_code: 'adm_out_of_stock', expected_delivered_qty, expected_qty}`: `[r4]` **(Đ37, Đ37b — thay "mặc định 0")** Dòng thuộc kỳ đã đánh ADM hết hàng nằm ở nhóm "ADM hết hàng — giao từ tủ, hủy phần thiếu": số đề xuất = **phần tủ chia theo thứ tự đăng ký** như dòng thường (R-D7.9); HC sửa tự do tới `min(còn lại, tủ)`; nhãn dòng: "ADM hết hàng — tủ còn {{s}}: giao từ tủ, hủy phần thiếu {{n}}". Xác nhận → giao phần đã chọn rồi **hủy luôn** phần còn lại (`adm_out_of_stock`). Chuông: **gộp theo Đ14** vào chuông ngày R-D6.8 (cùng `event_id line_adjusted:<sub>:<ym>:<ngày>`), dòng chuông "{{name}} ({{qty}} {{unit}}) không giao được: ADM hết hàng. Tháng sau cần thì đăng ký lại."; không còn chuông `line_cancelled` riêng cho đường này; người đã nghỉ → không chuông. Người không đến lấy: R-D11.19.
  - server: có `reason_code = 'adm_out_of_stock'` thì không cần `reason` chữ, nhưng **bắt buộc** món của dòng đang được đánh dấu cho kỳ của dòng → nếu không: 409 `ITEM_NOT_ADM_OUT`; `cancel_note = "ADM hết hàng"`;
  - chuông `line_cancelled` hiện "… ADM hết hàng — tháng sau cần thì đăng ký lại"; chủ phiếu đã nghỉ → không chuông (cùng luật R-D6.8);
  - dòng nợ của **kỳ khác** cùng món: không bị ảnh hưởng (đánh dấu theo kỳ); dòng ngoài DM: không áp dụng;
  - Hủy nợ ở Còn nợ giữ nguyên.

**Nút "Đủ hàng" (Đ24)**
- **R-D11.14** `[r2·mới]` Nút chính lớn **"Đủ hàng"** trên thanh công cụ Hàng về. Bấm → hộp xác nhận tóm tắt rồi mới ghi:
  - lô nhập = mọi hàng món có `remaining > 0`, **trừ**: đánh ADM hết hàng, món đã ngừng, ngoài DM; mỗi dòng `qty = remaining`, `expected_stock_qty` = tồn đang hiện;
  - hộp: "Nhập {{x}} món, {{y}} đơn vị vào tủ theo bản in {{time}}." + các dòng bỏ qua có số ("{{n}} món ADM hết hàng", "{{n}} món đã ngừng", "{{n}} món ngoài danh mục (giao thẳng)", "{{n}} món đã về đủ") + cảnh báo R-D11.9 nếu có + "Các số đang gõ ở bảng sẽ được thay." nếu bảng đang có nháp khác điền sẵn;
  - Xác nhận → `POST` hàng về hiện có (tất cả hoặc không, `ym` = kỳ) → toast "Đã nhập {{x}} món vào tủ", tải lại kế hoạch;
  - **vô hiệu** kèm lý do: chưa có bản chốt → "Chưa in trình ký gửi ADM"; mọi `remaining = 0` (trừ phần bỏ qua) → "Đã về đủ theo bản in"; đang gửi → "Đang nhập…".
- **R-D11.15** `[r2·mới]` Chống bấm đúp: `useSingleFlight` + nút Xác nhận vô hiệu khi gửi; server: lần gửi thứ hai cùng `expected_stock_qty` → 409 `STALE_UPDATE`, **0 dòng ghi** (tất cả hoặc không), web báo "Hàng về vừa được ghi ở nơi khác — tải lại" và tải lại kế hoạch (khi đó `remaining = 0`, nút thành "Đã về đủ theo bản in"). Hai tab cùng bấm: một thành công, một 409.
- **R-D11.16** `[r2·mới]` "Thêm món khác" (món ngoài danh sách gửi ADM) dùng `GroupedCombobox`: tìm không dấu, gom theo nhóm, ứng viên = món còn dùng chưa có trong bảng; ↑/↓ chọn, Enter thêm, Esc đóng; không khớp → "Không có món khớp". Hàng thêm có `ordered = 0`, `received` theo R-D11.7, điền sẵn 0.
- **R-D11.17** `[r3·sửa]` Bước Hàng về ở Tháng này hiện "Đủ hàng" ⇔ có bản chốt **có hàng** và mọi hàng món của kế hoạch có `remaining = 0` hoặc thuộc phần bỏ qua (ADM hết hàng, đã ngừng).
- **R-D11.18** `[r3·mới]` (rà soát #5, Vừa) **Trạng thái "đã về đủ"**: khi mọi hàng món có `remaining = 0` hoặc bị bỏ qua, trang **không** hiện bảng số 0 và nút Lưu mờ, mà hiện khối xong: "Hàng kỳ tháng {{month}} đã về đủ — {{x}} món, {{y}} đơn vị (nhập lần cuối {{hh:mm dd/mm}})." + nút chính **"Sang Giao hàng →"**; bên dưới là **danh sách các đợt đã nhập** (thời gian, người nhập, số món, số đơn vị, ghi chú) từ `stock_movements` có `receipt_ym` (R-D11.8). "Thêm món khác" vẫn dùng được. Ô "Ghi chú cho đợt này (không bắt buộc)" chuyển xuống cạnh nút Lưu.
- **R-D11.19** `[r4·mới]` (Đ38, GAP-03) **Tự hủy lúc khóa sổ kỳ sau.** Trong giao dịch khóa sổ kỳ P+1 (cron cùng chỗ ghi `headcount_subs`, R-D8.17), với mọi `(P, line_key)` trong `period_adm_out` loại `out` của kỳ P: mọi dòng kỳ P của khóa đó còn `remaining > 0` bị **hủy phần còn lại** với `reason_code = adm_out_of_stock`, `cancel_note = "ADM hết hàng"` — **không** thành nợ, không vào đề nghị kỳ P+1 (Đ25). Audit `arrival.adm_out_settled {period_ym, line_key, lines, units}`; chuông gộp R-D11.13 (người đã nghỉ không chuông); Lịch sử NV ghi "ADM hết hàng". Idempotent: chạy lại không hủy thêm. Hàng còn trong tủ (nếu có) thành phần trống.
- **R-D11.20** `[r4·mới]` (Đ39, GAP-04) **"Về bù kỳ trước".** Hàng về kỳ K\* có khối thu gọn thứ hai **"Về bù kỳ trước"** liệt kê, cho mỗi kỳ khóa P < K\*, các hàng có `adm_owed(P, key) > 0` (R-D13.9): Tháng · Món · Đặt (bản in P) · Đã về · ADM còn nợ · ô "Về bù đợt này" + nút **"ADM không giao nữa"**. Lưu → nhập tủ với `receipt_ym = P` (không dính bản in K\*), ghi chú tự động "Về bù kỳ {{P}}"; hàng vào tủ rồi giao cho người còn nợ như thường (Còn nợ / Giao hàng). "ADM không giao nữa" → `PUT /admin/periods/:P/adm-owed-closed/:line_key` (ghi `period_adm_out` loại `owed_closed`, audit `arrival.adm_owed_closed`); `DELETE` hoàn tác. Đóng rồi thì phần đó **không còn** bị trừ khỏi đề nghị kỳ sau (R-D13.9) — người chờ vẫn ở Còn nợ, chưa bị hủy. Khối chỉ hiện khi có hàng; không có bản in P (P "không cần đề nghị" hoặc chưa gửi) → không có hàng nào của P.
- **R-D11.21** `[r4·mới]` (GAP-12) **Món ngoài DM ở Hàng về.** Khối ngoài DM (R-D11.11) có ô **"Đã về"** cho mỗi khóa `custom:` có trong bản in: ghi vào bảng `custom_receipts` (migration `0117_custom_receipts.sql`: `id uuid PK, period_ym date FK periods, line_key text, qty int CHECK > 0, note text, created_by text, created_at timestamptz`; không vào tủ, audit `arrival.custom_received`) và nút "ADM hết hàng" theo khóa (cùng R-D11.12/13/19). Trần giao của dòng ngoài DM có khóa trong bản in = `Σ custom_receipts − Σ đã giao` của khóa đó trong kỳ, chia theo thứ tự đăng ký (R-D7.9); khóa **không** có trong bản in (chấp nhận sau khi gửi, tự mua riêng) → trần = còn lại như hiện nay + chữ "Món tự mua riêng — không theo dõi hàng về". "Đủ hàng" ghi cả khóa ngoài DM có `remaining > 0` (không còn "bỏ qua" chúng).

### Trạng thái & biên
| Tình huống | Kết quả |
|---|---|
| Không bản chốt | Điền sẵn theo số gộp (Đ25); "Đủ hàng" vô hiệu "Chưa in trình ký gửi ADM" |
| 1 bản `print` 10:00, 1 bản `xlsx` 10:05 | Nguồn = `xlsx` 10:05 |
| In, Hủy hộp in, in lại không đổi gì | Vẫn 1 bản (R-D5.9); nguồn không đổi |
| In 10:00 (B23 = 10), giảm B23 3 lúc 10:30, in lại 10:40 | Nguồn = 10:40 (B23 = 7) |
| In 10:00 (B23 = 10), giảm 3 lúc 10:30, **không** in lại | `ordered` 10, nhãn "Đã giảm 3 sau khi gửi ADM"; về 10 → tủ dư 3 |
| Đề nghị sửa tay `order_qty` = 12 (need 10) | `ordered` 12 |
| Đã về 4 đợt trước, `ordered` 10 | `remaining` 6; về 6 → về đủ; đợt sau `remaining` 0 |
| Đã về 11 > `ordered` 10 | `remaining` 0 (không âm) |
| Món ngừng sau khi in | Hàng mờ, bỏ qua |
| Hàng ngoài DM trong bản in | Khối "giao thẳng", không nhập |
| Đánh ADM hết hàng rồi giao xong mọi dòng | Không tắt được (`ADM_OUT_FINAL`) |
| Đánh ADM hết hàng, tủ còn 2 hàng cũ | Hộp giao mặc định 0; HC nâng 2 → giao 2, phần còn lại hủy |
| Bấm "Đủ hàng" hai lần nhanh | 1 request; nếu lọt request thứ hai → 409, 0 ghi |

### Dữ liệu/API
**Migration `0114_period_adm_out.sql`** (bảng sửa được, không trigger chỉ-thêm):
```sql
CREATE TABLE period_adm_out (
  period_ym date NOT NULL REFERENCES periods(ym) ON DELETE CASCADE,
  line_key  text NOT NULL,                 -- [r4·sửa] item_id::text hoặc khóa 'custom:[…]' (R-D11.21)
  kind      text NOT NULL DEFAULT 'out' CHECK (kind IN ('out','owed_closed')),  -- [r4·sửa] Đ38 / Đ39
  marked_by text NOT NULL,
  marked_at timestamptz NOT NULL,          -- = ClockService.now()
  PRIMARY KEY (period_ym, line_key, kind)
);
```
`[r4·sửa]` Bỏ FK món (khóa có thể là `custom:`); xóa món dọn bằng `DELETE … WHERE line_key = id::text` trong `catalog.service` và script dọn R-D9.7. Đường dẫn `…/adm-out/:item_id` thành `…/adm-out/:line_key` (URL-encode). **Migration `0117_custom_receipts.sql`**, **`0118_periods_no_order.sql`** (`no_order_at timestamptz`, `no_order_by text`): R-D11.21, R-D5.21.
(`ON DELETE CASCADE` để dọn fixture và xóa món không vướng; bảng không chỉ-thêm nên cascade được. Lịch sử bật/tắt nằm ở audit.)
**Migration `0115`**: R-D11.8.

| Endpoint | Hợp đồng |
|---|---|
| `GET /admin/periods/:ym/arrivals-plan` (mới, `by-ym`) | `{snapshot: {id, kind, created_at} \| null (chỉ bản có hàng), batches: [{at, actor_name, items, units, note}], rows: [{item_id, key, code, name, name_en, unit, category_id, image_file_id, ordered, received, remaining, stock_qty, usable, adm_out, adm_out_final, reduced_after_snapshot}], custom: [{key, name, unit, ordered}]}`; `snapshot = null` → `rows` theo số gộp (`ordered = requested + backlog_prev`), `received` vẫn tính |
| `PUT /admin/periods/:ym/adm-out/:item_id` (mới, `by-ym`) | 200 `{item_id, adm_out: true}`; 409 `ADM_OUT_NOTHING_OPEN`, `PERIOD_NOT_LOCKED`; 404 `ITEM_NOT_FOUND` |
| `DELETE /admin/periods/:ym/adm-out/:item_id` (mới, `by-ym`) | 204; 409 `ADM_OUT_FINAL` |
| `POST` hàng về (hiện có) | Ghi `receipt_ym`; 409 `ITEM_ADM_OUT {item_id}`; khóa kỳ R-D8.1 |
| `POST /admin/lines/:id/cancel-remaining` | `CancelBody` thêm `reason_code?: 'adm_out_of_stock'`; khi có thì `reason` tùy chọn; 409 `ITEM_NOT_ADM_OUT` |
| `GET /admin/periods/:ym/delivery-people` | Dòng thêm `adm_out` (món của dòng được đánh dấu cho kỳ của dòng) |

### Giao diện
| Khóa | vi | en |
|---|---|---|
| `arrivals.table.ordered` | Đề nghị | Ordered |
| `arrivals.table.received` | Đã về các đợt trước | Received earlier |
| `arrivals.table.qty` (sửa) | Về đợt này | This delivery |
| `arrivals.filter.search` | Tìm món (không cần dấu) | Search items |
| `arrivals.filter.short` | Chỉ món chưa về đủ ({{n}}) | Only items not fully received ({{n}}) |
| `arrivals.filter.count` | Đang hiện {{x}}/{{y}} món | Showing {{x}}/{{y}} items |
| `arrivals.group.done` | đã về đủ {{a}}/{{b}} | {{a}}/{{b}} received |
| `arrivals.group.fill` / `unfill` | Về đủ cả nhóm / Bỏ điền cả nhóm | Fill whole group / Undo fill |
| `arrivals.source` | Theo bản in {{time}} | From print {{time}} |
| `arrivals.noSnapshot` | Chưa in trình ký gửi ADM — số điền sẵn theo tổng đăng ký + nợ tháng trước | Not sent to ADM yet — prefilled from requested + carried over |
| `arrivals.admOut.button` | ADM hết hàng | Out at ADM |
| `arrivals.admOut.tag` / `final` | ADM hết hàng / ADM hết hàng · đã xử lý xong | Out at ADM / Out at ADM · settled |
| `arrivals.reducedAfter` | Đã giảm {{n}} sau khi gửi ADM — phần dư vào tủ | Reduced by {{n}} after sending to ADM — surplus goes to stock |
| `arrivals.reducedAfterTop` | {{x}} món đã giảm sau khi gửi ADM — phần dư sẽ vào tủ | {{x}} items were reduced after sending to ADM — surplus goes to stock |
| `arrivals.inactiveRow` | Đã ngừng — bật lại ở Nhóm món để nhập | Discontinued — re-enable in Categories to receive |
| `arrivals.custom.title` | Món ngoài danh mục — giao thẳng, không vào tủ ({{n}}) | Off-catalogue — delivered directly, not stocked ({{n}}) |
| `arrivals.full.button` | Đủ hàng | All arrived |
| `arrivals.full.summary` | Nhập {{x}} món, {{y}} đơn vị vào tủ theo bản in {{time}}. | Add {{x}} items, {{y}} units to stock from the print of {{time}}. |
| `arrivals.full.skipAdm` / `skipInactive` / `skipCustom` / `skipDone` | {{n}} món ADM hết hàng / {{n}} món đã ngừng / {{n}} món ngoài danh mục (giao thẳng) / {{n}} món đã về đủ | {{n}} out at ADM / {{n}} discontinued / {{n}} off-catalogue (direct) / {{n}} already received |
| `arrivals.full.replaceDraft` | Các số đang gõ ở bảng sẽ được thay. | Numbers typed in the table will be replaced. |
| `arrivals.full.noSnapshot` / `allDone` / `sending` | Chưa in trình ký gửi ADM / Đã về đủ theo bản in / Đang nhập… | Not sent to ADM yet / Everything on the print has arrived / Saving… |
| `arrivals.full.done` | Đã nhập {{x}} món vào tủ | Added {{x}} items to stock |
| `arrivals.stale` | Hàng về vừa được ghi ở nơi khác — tải lại. | Arrivals were just recorded elsewhere — reloading. |
| `arrivals.done.title` | Hàng kỳ tháng {{month}} đã về đủ — {{x}} món, {{y}} đơn vị (nhập lần cuối {{time}}). | {{month}} has fully arrived — {{x}} items, {{y}} units (last recorded {{time}}). |
| `arrivals.done.next` | Sang Giao hàng → | Go to Delivery → |
| `arrivals.batches.title` | Các đợt đã nhập | Recorded deliveries |
| `arrivals.note` (sửa) | Ghi chú cho đợt này (không bắt buộc) | Note for this delivery (optional) |
| `arrivals.add.search` / `noMatch` | Tìm món để thêm / Không có món khớp | Find an item to add / No matching items |
| `common.errors.ITEM_ADM_OUT` | Món này đang đánh "ADM hết hàng" — bỏ đánh dấu trước khi nhập. | This item is marked out at ADM — unmark it first. |
| `common.errors.ADM_OUT_FINAL` | Các dòng của món này đã giao/hủy xong — không bỏ đánh dấu được nữa. | All lines for this item are settled — can't unmark. |
| `common.errors.ADM_OUT_NOTHING_OPEN` | Không còn ai chờ món này trong kỳ. | Nobody is waiting for this item this period. |
| `notifications.topics.line_cancelled.admOut` | {{name}} ({{qty}} {{unit}}) không giao được: ADM hết hàng. Tháng sau cần thì đăng ký lại. | {{name}} ({{qty}} {{unit}}) can't be delivered: out of stock at ADM. Request it again next month if needed. |

### Tiêu chí nghiệm thu
| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 1 | R-D11.1 | Test cũ của `FilterBar` nhân viên xanh không sửa; `matchesSearch('Bút bi', 'but bi')` true, `('Đồ bấm','do bam')` true, `('Bút','bat')` false; `groupCounts` tổng quát cho kiểu hàng Hàng về | Vitest |
| 2 | R-D11.2 | Tìm "but" ra hàng "Bút…"; chip nhóm có số = số hàng của nhóm đó trên trang; `?q=&g=&short=1` khôi phục sau F5; lọc ẩn hàng có số 5 → Lưu vẫn gửi hàng đó; không khớp → "Xóa lọc" | Vitest |
| 3 | R-D11.3 | Hàng gom nhóm theo R-D2.3, đầu nhóm có "đã về đủ a/b"; cột "Về đợt này"; 390 xếp dọc không cuộn ngang | Vitest + PW |
| 4 | R-D11.4 | "Về đủ cả nhóm" điền `remaining` cho 3 hàng, bỏ qua hàng ADM hết hàng và hàng ngừng, 0 request; "Bỏ điền cả nhóm" trả số cũ; không có nút "ADM hết hàng cả nhóm" | Vitest |
| 5 | R-D11.5 | `received` 9 / `ordered` 10 → hiện khi bật công tắc; 10/10 → ẩn; 11/10 → ẩn; hàng ADM hết hàng → ẩn | Vitest |
| 6 | R-D11.6 | Có `print` 10:00 và `xlsx` 10:05 → nguồn 10:05; thêm `print` 10:10 → nguồn 10:10; bản 10:05 với `id` lớn hơn cùng `created_at` → chọn theo `id` | API |
| 7 | R-D11.6, R-D5.9 | In → Hủy → in lại không đổi → `arrivals-plan.snapshot.id` không đổi; giảm 1 dòng rồi in lại → `id` đổi | API |
| 8 | R-D11.7 | `order_qty` 12 (need 10) → `ordered` 12; không có khóa → `wantOf`; về 4 trước → `remaining` 8; về 13 → `remaining` 0; chưa có bản chốt, đăng ký 8 + nợ 2, tủ 5 → `snapshot null`, `ordered = 10` (không trừ tủ) | API |
| 9 | R-D11.7 | Điền sẵn "Về đợt này" = `remaining` khi có bản chốt và khi không (theo `ordered` gộp); không bao giờ = `need` net | Vitest |
| 10 | R-D11.8 | Migration: dòng `purchase` note "Hàng về kỳ 2026-10 · x" → `receipt_ym = 2026-10-01`; note khác → NULL; `issue` có `receipt_ym` → CHECK lỗi; nhập mới ghi `receipt_ym` | DB |
| 11 | R-D11.9 | Bản chốt T; giảm B23 3 lúc T+1s → `reduced_after_snapshot: 3`, nhãn hiện; giảm lúc T−1s → 0, không nhãn; nhập 10 khi nhu cầu sống 7 → tủ +10 | API + Vitest |
| 12 | R-D11.10 | Món của bản in nay ngừng (riêng / theo nhóm) → `usable false`, ô vô hiệu, không gửi; bật lại → nhập được | API + Vitest |
| 13 | R-D11.11 | Bản in có 1 hàng `custom:` → `custom` 1 phần tử, không vào `rows`; "Đủ hàng" đếm "1 món ngoài danh mục" | API + Vitest |
| 14 | R-D11.12 | `PUT` khi còn 1 dòng mở → 200; lặp → 200; khi 0 dòng mở → 409 `ADM_OUT_NOTHING_OPEN`; `DELETE` khi còn 1 dòng mở → 204; khi 0 → 409 `ADM_OUT_FINAL`; `DELETE` chưa đánh → 204; kỳ mở → 409 `PERIOD_NOT_LOCKED`; `items.active` không đổi | API |
| 15 | R-D11.12 | Nhập `qty 1` cho món đánh dấu → 409 `ITEM_ADM_OUT`, 0 dòng ghi; `qty 0`/không gửi món đó → 2xx | API |
| 16 | R-D11.12 | Bấm nút: ô thành 0 + vô hiệu + nhãn xám, 1 `PUT`; bấm lại: 1 `DELETE`, ô về số điền sẵn; lỗi `ADM_OUT_FINAL` → nút khóa | Vitest |
| 17 | R-D11.13 | Hộp giao: dòng kỳ đánh dấu ở nhóm ADM, stepper 0; Xác nhận → `cancel-remaining` với `reason_code`; dòng nợ kỳ trước cùng món vẫn ở bảng giao thường | Vitest |
| 18 | R-D11.13 | `cancel-remaining` `reason_code` khi món được đánh dấu cho kỳ dòng → 200, `cancel_note` "ADM hết hàng", chuông `admOut`; món không đánh dấu → 409 `ITEM_NOT_ADM_OUT`; đánh dấu kỳ khác → 409; chủ phiếu đã nghỉ → 200, 0 chuông | API |
| 19 | R-D11.13 | Tủ còn 2, HC nâng stepper 2 → giao 2 rồi hủy phần còn lại; tủ 0 → chỉ hủy | Vitest |
| 20 | R-D11.14 | Kế hoạch 3 hàng `remaining` 6/0/4 + 1 ADM + 1 ngừng + 1 custom → hộp "Nhập 2 món, 10 đơn vị", bỏ qua 1/1/1/1; Xác nhận → 1 `POST` 2 dòng đúng `expected_stock_qty` | Vitest |
| 21 | R-D11.14 | Không bản chốt → nút vô hiệu, chữ "Chưa in trình ký gửi ADM"; có bản, mọi `remaining` 0 → "Đã về đủ theo bản in"; có 1 `remaining` > 0 → bật | Vitest |
| 22 | R-D11.15 | Gửi cùng body hai lần tuần tự → lần 1 201, lần 2 409 `STALE_UPDATE`, tồn chỉ cộng một lần; `Promise.all` hai lần → đúng một thành công | API |
| 23 | R-D11.15 | Bấm Xác nhận hai lần nhanh → 1 request; 409 → thông báo + tải lại kế hoạch | Vitest |
| 24 | R-D11.16 | Gõ "kep" → nhóm "Kẹp & dán" có "Kẹp giấy"; ↑/↓/Enter thêm hàng; Esc đóng; món đã có trong bảng không là ứng viên | Vitest |
| 25 | R-D11.17 | Mọi `remaining` 0 (1 hàng ADM) → bước "Đủ hàng"; 1 hàng `remaining` 1 → không; chỉ có bản rỗng → không | Vitest |
| 25b | R-D11.6 | Bản rỗng 09:23 mới hơn bản có hàng 22:12 → `arrivals-plan.snapshot.id` = 22:12; chỉ bản rỗng → `snapshot null`, "Đủ hàng" vô hiệu "Chưa in trình ký gửi ADM" | API + Vitest |
| 25c | R-D11.18 | Mọi `remaining` 0 → khối "đã về đủ" + "Sang Giao hàng →" + danh sách 2 đợt; còn 1 hàng `remaining` 1 → bảng thường | Vitest |
| 26 | R-D11.2–R-D11.14 | Luồng PW 1280 + 390 (tồn gieo fixture): lọc nhóm, đánh ADM hết hàng 1 món, "Đủ hàng", giao một người có món ADM → dòng hủy, không nợ; axe 390 | PW |

**Tiêu chí bổ sung (vòng 4)**

| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 26 | R-D11.10 | Băng keo ngừng, bản in đặt 3 → nhập 3 → 201, nhãn "Ngừng dùng — đã đặt trong bản in"; món ngừng không trong bản in → 404 `ITEM_NOT_FOUND`; "Thêm món khác" không liệt kê món ngừng | API + Vitest |
| 27 | R-D11.13 | ADM hết BK, tủ 2, B (đăng ký trước) cần 1, A cần 2: hộp của B đề xuất 1, của A đề xuất 1 (sau B) + nhãn "tủ còn 1: giao từ tủ, hủy phần thiếu 1"; HC sửa A lên tối đa `min(2, tủ)`; Xác nhận → giao + hủy phần còn lại; 1 chuông ngày gộp với dòng giảm cùng ngày; người đã nghỉ 0 chuông | API + Vitest |
| 28 | R-D11.19 | Kỳ 12 đánh BK hết, C chưa đến lấy 2 → 16:59:59.999Z ngày khóa kỳ 01: còn 2; 17:00:00.000Z (cron): hủy 2, `reason_code adm_out_of_stock`, không có ở Còn nợ, không vào đề nghị kỳ 01, audit `arrival.adm_out_settled`; chạy cron lại → không đổi | API + DB |
| 29 | R-D11.20 | Kỳ 12 đặt BB 7, về 3, kỳ 01 khóa → Hàng về kỳ 01 có "Về bù kỳ trước" BB còn nợ 4; nhập 4 → `receipt_ym 2026-12`, không đổi `received` kỳ 01; "ADM không giao nữa" → hàng biến mất, đề nghị kỳ 01 cộng lại 4; hoàn tác → trừ lại | API + Vitest |
| 30 | R-D11.21 | Khóa ngoài DM "Kéo cắt giấy" trong bản in 2: nhập "Đã về" 1 → hộp giao trần 1 cho người đăng ký trước; khóa ngoài DM không trong bản in → trần = còn lại + chữ "Món tự mua riêng"; ADM hết hàng theo khóa `custom:` hoạt động như món | API + Vitest |

---

## D12. Nhóm & đơn vị: ngừng từng món trong nhóm; ngừng nhóm thì ngừng mọi món; gộp trang (Đ21, Đ22, Đ34) `[r2·mới]`

### Hiện trạng
- `/admin/categories` (`web/features/catalog/categories-page.tsx`, `category-table.tsx`): mỗi nhóm chỉ có "Ngừng nhóm"/"Bật lại" (`category-table.tsx:16,64`) → `PATCH /admin/item-categories/:id {active}` (`categories.controller.ts:43`); không xem/ngừng được từng món.
- `item_categories.active` và `items.active` **độc lập** (`0100_vpp_catalog.sql:7,31`); món dùng được ⇔ `items.active AND nhóm active` (`ITEM_USABLE_SQL`, `catalog-sql.ts:8-10`). Nghĩa là ngừng nhóm **đã** ẩn mọi món mà không ghi `items.active`.
- Ngừng/bật một món: `PATCH /admin/items/:id {active}` (`items-admin.controller.ts:35`); Danh mục có ngừng hàng loạt ("Ngừng {{n}} món?", `locales/vi/catalog.ts:89-90`).

### Quy tắc mới
- **R-D12.1** `[r2·mới]` Bấm một nhóm (tên nhóm hoặc "Món trong nhóm (n)") → **panel phủ** R-D1.4 (`?group=<id>`): đầu panel là công tắc nhóm (Đang dùng/Ngừng); thân là danh sách **mọi** món của nhóm (kể cả đã ngừng) theo R-D2.3: ảnh 40 · tên · ĐVT · công tắc món (`role="switch"`, `aria-checked`, nhãn "Đang dùng"/"Ngừng"). Ô tìm không dấu (`SearchBox`) khi nhóm > 12 món.
- **R-D12.2** `[r2·mới]` Công tắc món → `PATCH /admin/items/:id {active}` ghi ngay, cập nhật lạc quan, lỗi thì trả lại + báo lỗi tại dòng; một request đang chạy mỗi món (bấm nhanh lần hai bị bỏ). Không hộp xác nhận; toast "Đã ngừng {{name}}" kèm "Hoàn tác" 5 s (gọi lại `PATCH`).
- **R-D12.3** `[r2·mới]` (Đ22) **Ngừng nhóm ⇒ mọi món trong nhóm ngừng**, hiện thực bằng trạng thái dẫn xuất sẵn có (`ITEM_USABLE_SQL`), **không ghi** `items.active`. Trong panel khi nhóm ngừng: mọi công tắc món hiện "Ngừng", **vô hiệu**, nhãn "Ngừng theo nhóm"; món đã ngừng riêng trước đó hiện "Ngừng riêng". **Bật lại nhóm** ⇒ chỉ các món **ngừng do nhóm** (có `items.active = true`) dùng lại được; món **ngừng riêng** giữ ngừng (đúng đề xuất trong Đ22). Đổi từng món khi nhóm đang ngừng: không được (công tắc vô hiệu, gợi ý "Bật lại nhóm để đổi từng món").
- **R-D12.4** `[r2·mới]` Công tắc nhóm (trong panel và trong menu bảng) giữ hộp xác nhận hiện có "Ngừng nhóm “{{name}}”? {{n}} món sẽ ẩn với nhân viên" (`n` = số món đang dùng được); bật lại không cần xác nhận, toast "{{k}} món dùng lại; {{m}} món vẫn ngừng riêng".
- **R-D12.5** `[r2·mới]` `GET /admin/items` (và hàng trong panel) thêm `inactive_reason: 'item' | 'group' | null` (`'item'` nếu `items.active = false`, ngược lại `'group'` nếu nhóm ngừng). Danh mục, Hàng về (R-D11.10), Tủ/Kho dùng trường này để hiện "Ngừng riêng"/"Ngừng theo nhóm".
- **R-D12.6** `[r2·mới]` Ảnh hưởng của ngừng (món hoặc nhóm): nhân viên không chọn được món ở kỳ mở (BR-5 giữ nguyên); dòng đã có ở kỳ khóa vẫn giảm/giao được (R-D6.21); Hàng về không nhập được (R-D11.10). Audit: `item.updated` (món) và `category.updated` có `detail.affected_items` (nhóm).
- **R-D12.7** `[r3·mới]` (Đ34) **Gộp hai trang** Nhóm món + Đơn vị tính thành **một trang "Nhóm & đơn vị"** có 2 tab, một mục menu:
  - route: tab Nhóm món = `/admin/categories`; tab Đơn vị tính = `/admin/categories/units`; tab là link (`role="tablist"`, mỗi tab `aria-selected`), đổi tab đổi URL (`push`); panel nhóm `?group=` chỉ có ở tab Nhóm (R-D12.1);
  - URL cũ: `/admin/units` (và `/admin/units?…`) → **chuyển hướng `replace`** sang `/admin/categories/units` giữ query; liên kết cũ trong app (`admin-nav`, Danh mục "Quản lý đơn vị", ô chọn ĐVT trong panel món) đổi sang URL mới;
  - menu: một mục "Nhóm & đơn vị" thay hai mục, sáng khi đang ở cả hai tab; tiêu đề trang = "Nhóm & đơn vị", tiêu đề phụ = tên tab;
  - nội dung từng tab giữ nguyên chức năng (Đơn vị: thêm/sửa/xóa như `units-page.tsx`; bỏ chặn 960 px theo R-D1.2).

### Trạng thái & biên
| Tình huống | Kết quả |
|---|---|
| Nhóm 5 món, A ngừng riêng; ngừng nhóm | 5 món không dùng được; panel: A "Ngừng riêng", 4 "Ngừng theo nhóm" |
| Bật lại nhóm | 4 dùng lại; A vẫn ngừng |
| Nhóm ngừng, bấm công tắc món | Vô hiệu, không request |
| Bật món A khi nhóm đang dùng | A dùng lại |
| Hai người cùng bật/tắt một món | Lần sau thắng (PATCH idempotent theo giá trị) |
| Nhóm rỗng | Panel "Nhóm chưa có món" + liên kết Danh mục |

### Dữ liệu/API
Không migration. `GET /admin/items` thêm `inactive_reason`; `PATCH /admin/item-categories/:id` trả thêm `affected_items: {reactivated, still_inactive}` khi bật lại.

### Giao diện
| Khóa | vi | en |
|---|---|---|
| `catalog.categories.itemsCount` | Món trong nhóm ({{n}}) | Items in group ({{n}}) |
| `catalog.categories.panelTitle` | Nhóm {{name}} | Group {{name}} |
| `catalog.categories.itemActive` / `itemInactive` | Đang dùng / Ngừng | In use / Discontinued |
| `catalog.categories.byGroup` / `byItem` | Ngừng theo nhóm / Ngừng riêng | Off with group / Off individually |
| `catalog.categories.enableGroupFirst` | Bật lại nhóm để đổi từng món | Turn the group back on to change single items |
| `catalog.categories.reactivated` | {{k}} món dùng lại; {{m}} món vẫn ngừng riêng | {{k}} items back in use; {{m}} still off individually |
| `catalog.categories.itemOff` / `undo` | Đã ngừng {{name}} / Hoàn tác | {{name}} discontinued / Undo |
| `catalog.categories.empty` | Nhóm chưa có món | No items in this group |
| `nav.categoriesUnits` / `catalog.setup.title` | Nhóm & đơn vị | Groups & units |
| `catalog.setup.tabGroups` / `tabUnits` | Nhóm món / Đơn vị tính | Item groups / Units |

### Tiêu chí nghiệm thu
| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 1 | R-D12.1 | Bấm nhóm → panel `?group=`, liệt kê đủ món kể cả ngừng, đúng thứ tự R-D2.3; nhóm 12 món không có ô tìm, 13 món có | Vitest |
| 2 | R-D12.2 | Tắt món → 1 `PATCH {active:false}`; lỗi 500 → công tắc trả lại; bấm nhanh 2 lần → 1 request; "Hoàn tác" → `PATCH {active:true}` | Vitest |
| 3 | R-D12.3 | API: A ngừng riêng, ngừng nhóm → `GET /items` (nhân viên) không có 5 món; bật nhóm → có 4, không có A; `items.active` của 4 món không đổi trong suốt quá trình | API |
| 4 | R-D12.3 | Panel nhóm ngừng: 4 công tắc "Ngừng theo nhóm" vô hiệu, A "Ngừng riêng"; nhóm dùng → công tắc bật được | Vitest |
| 5 | R-D12.4 | Ngừng nhóm hỏi xác nhận với số món đúng; bật lại → toast "4 món dùng lại; 1 món vẫn ngừng riêng" | Vitest |
| 6 | R-D12.5 | `inactive_reason`: món ngừng riêng trong nhóm ngừng → `'item'`; món dùng trong nhóm ngừng → `'group'`; dùng → `null` | API |
| 7 | R-D12.6 | Ngừng nhóm sau khóa: dòng kỳ khóa của món đó giảm → 200, giao → 200; nhân viên kỳ mở thêm món → 400 như BR-5 | API |
| 8 | R-D12.1–R-D12.4 | PW 1280 + 390: mở nhóm, tắt một món, ngừng nhóm, bật lại; axe 390 panel mở | PW |
| 9 | R-D12.7 | Mở `/admin/units?x=1` → URL thành `/admin/categories/units?x=1`, Back không quay lại `/admin/units`; bấm tab Nhóm → `/admin/categories`; menu có đúng 1 mục "Nhóm & đơn vị", sáng ở cả hai URL; `?group=` trên tab Đơn vị bị bỏ qua | Vitest |
| 10 | R-D12.7 | Quét mã: không còn `to="/admin/units"` ngoài khai báo chuyển hướng | Vitest (quét file) |

---

## D13. Số đề nghị gửi ADM = tổng đăng ký + nợ tháng trước, không trừ tủ (Đ25) `[r2·mới]`

### Hiện trạng
- Server tính `need = max(0, requested + backlog_prev − stock)` (BR-15) bằng `needOf` (`api/modules/reports/report-need.ts:2-8`), gán cho hàng món (`reports.service.ts:62`) và hàng ngoài DM với `stock = null` (`reports.service.ts:70`).
- **Số đề nghị mặc định** = `need`: `resolveOrderQty` lấy `input[key] ?? r.need` (`order-qty.ts:24-26`) — bản chốt lưu đủ `order_qty` cho **mọi** hàng; web Báo cáo dùng `need` làm số gốc của ô Đặt mua (`web/features/reports/use-order-qty.ts:19-20,31,46`), nút "Về Cần mua (n)" (`report-order-cell.tsx:11,37-40`), lọc "chỉ hàng cần mua" `need > 0` (`report-part1.tsx:95`), cột "Cần mua" (`report-part1.tsx:49-59`), chữ công thức "Cần mua = … − Tồn" (`locales/vi/reports.ts:43-45,51,57,62-63,127`).
- Gửi ADM: `OrderRow` có `want` (gộp) và `need` (net) (`web/features/send-adm/send-adm-rows.ts:12-14,32-33,38`); cột "Cần" hiện `want` (`send-adm-orders.tsx:51,68`) nhưng số trên phiếu mặc định là `need` (`send-adm-rows.ts:43` `orderOf … ?? row.need`).
- Bản in/Excel: `?? r.need` làm vế dự phòng (`xlsx-request-form.ts:53-54`, `xlsx-report.ts:50`, web `print-format.ts:19,23`); Excel báo cáo có cột Tồn + Cần mua (`xlsx-report.ts:55-85`, nhãn `xlsx-labels.ts:34,55`); phụ lục in có Tồn + Cần (`print-appendix-tables.tsx:31-32`).
- Tháng này: bước "Gửi ADM" chỉ đếm số bản chốt (`month-steps.ts:34`) — không dùng `need`; bước "Hàng về" `needTotal` = tổng số điền sẵn Hàng về (= `need`) (`home-page.tsx:71`, `month-steps.ts:17,35`), xong ⇔ `needTotal = 0 || receipts > 0`.
- Hàng về: điền sẵn `need`, lọc `need > 0`, nhãn thiếu/dư theo `waiting − stock` (`arrival-rows.ts:21,26,37,40-48,63`; `arrivals-page.tsx:103`).
- Badge sidebar không dùng `need` (`shell/use-admin-badges.ts:21-26` chỉ đếm món sắp hết của tủ). Tổng hợp (`summary.service.ts`) không có trường cần mua.

### Quy tắc mới
- **R-D13.1** `[r4·sửa]` Định nghĩa **số gộp** `wantOf(r) = r.requested + r.backlog_prev` (hàm dùng chung `api/modules/reports/report-need.ts` và `web/lib/report-qty.ts`). Tính được cho mọi bản chốt cũ (hai trường đã có trong JSON), nên **không thêm trường** vào `MonthReport`. `[r4]` **Số đề nghị mặc định đầy đủ** (Đ39, Đ40, Đ41): `default(r) = 0` nếu món ngừng (R-D13.10); ngược lại `default(r) = max(0, requested_active(r) + debt_active(r) − adm_owed(r))` với `_active` = chỉ dòng của người `status = 'active'` (R-D13.11) và `adm_owed` theo R-D13.9. `wantOf` cũ = trường hợp không có người nghỉ, không ADM nợ. Bản chốt lưu thêm `data.order_basis[key] = {requested, debt, adm_owed, left_excluded, discontinued}` để dòng xám (R-D5.14) và cảnh báo (D17) đọc lại đúng lúc chốt; bản cũ thiếu trường → tính như `wantOf`.
- **R-D13.2** `[r3·sửa]` **Số đề nghị mặc định = `wantOf`**, không trừ tủ (HC tự quản tủ qua Xuất lẻ, Kiểm kê; muốn bớt thì sửa số). Đổi sang gộp ở: `order-qty.ts:24-26` (`?? wantOf(r)`), `use-order-qty.ts:19-20,31,46` (số gốc, "đã sửa" = khác `wantOf`), `send-adm-rows.ts:43` (`orderOf … ?? row.want`; bỏ trường `need` khỏi `OrderRow`), `report-part1.tsx:95` (lọc `wantOf > 0`), `[r3·sửa]` (Đ32) `report-order-cell.tsx` và việc dùng `use-order-qty` ở Báo cáo **bị xóa** — sửa số chỉ ở Gửi ADM (R-D5.14, R-D5.15), vế dự phòng `xlsx-request-form.ts:54`, `xlsx-report.ts:50`, `print-format.ts:19` (`?? wantOf(row)`), và kiểm "mọi ô để mặc định" `print-format.ts:23` (so với `wantOf`).
- **R-D13.3** `[r2·mới]` Trường `need` (net) **giữ trong API và JSON bản chốt** chỉ để tương thích (bản chốt cũ, client cũ), **không còn hiển thị** và không tham gia số mặc định nào. Lý do giữ: bản chốt là JSON đóng băng; đổi nghĩa `need` sẽ làm bản cũ hiện sai. Ghi chú `@deprecated` ở `report.types.ts:22,32`.
- **R-D13.4** `[r2·mới]` Cột **Tủ** (Báo cáo phần 1 `report-part1.tsx:47`, Gửi ADM, Excel báo cáo, phụ lục in) **giữ, chỉ để tham khảo**: nhãn "Tủ hiện có (tham khảo)", không tham gia công thức. Cột "Cần mua" (net) ở Báo cáo (`report-part1.tsx:49-59`), Excel báo cáo (`xlsx-report.ts:58,69,82`) và phụ lục (`print-appendix-tables.tsx:32`) **đổi thành "Tổng cần"** = `wantOf`. Cột "Cần" ở Gửi ADM (`send-adm-orders.tsx:51,68`) đã là `want` → đổi nhãn "Tổng cần". Mẫu phòng gửi ADM (`xlsx-request-form.ts`, `PrintRequestForm`) chỉ in số Đề nghị — không đổi bố cục.
- **R-D13.5** `[r3·sửa]` Chữ công thức (`reports.ts:43-45,127` và en): "Đề nghị mặc định = Chưa giao kỳ này + Nợ kỳ trước. Tủ chỉ để tham khảo, không trừ. Muốn bớt thì sửa ô Đề nghị." `[r3·sửa]` Chữ này chỉ ở Gửi ADM (Báo cáo chỉ đọc, R-D5.15) và thay câu cũ `send-adm.ts:20` ("…trừ tủ còn…"); nút đưa về mặc định là "Về số gợi ý" (R-D5.14).
- **R-D13.6** `[r3·sửa]` Tháng này: bước "Gửi ADM" theo R-D5.18 (bản có hàng mới nhất). Bước "Hàng về" bỏ `needTotal` net; dùng kế hoạch D11 (R-D11.17): giá trị = tổng `remaining` của kế hoạch (theo bản in, hoặc theo số gộp khi chưa in), xong ⇔ mọi hàng `remaining = 0` hoặc bị bỏ qua. Bỏ vế "`receipts > 0` là xong" (đã về một đợt chưa có nghĩa là đủ).
- **R-D13.7** `[r2·mới]` Hàng về: điền sẵn và lọc theo D11 (gộp/bản in); nhãn thiếu/dư (`arrival-rows.ts:40-43`) so `qty` với `remaining`, không với `waiting − stock`. Giao hàng **không đổi**: vẫn lấy từ tủ (Đ25).
- **R-D13.8** `[r2·mới]` Bản chốt cũ (đã lưu `order_qty` net) **không đổi** khi xem/in lại/xuất lại: luôn đọc `order_qty` đã lưu. Chỉ bản chốt mới (sau triển khai) dùng mặc định gộp.
- **R-D13.9** `[r4·mới]` (Đ39) **ADM còn nợ giao không đặt lại.** Với kỳ khóa P < K và khóa `key`: `adm_owed(P, key) = min( max(0, ordered_P − received_P), Σ remaining của dòng kỳ P (người active) cho key )` với `ordered_P`, `received_P` theo kế hoạch Hàng về của P (R-D11.7, bản mới nhất của P), bằng 0 nếu P không có bản có hàng hoặc `period_adm_out(P, key)` có loại `out` hoặc `owed_closed`. `adm_owed(key)` ở kỳ K = Σ theo mọi P < K. Dùng ở số mặc định (R-D13.1), dòng xám, W5 và Tủ/Kho "Chờ hàng về" (R-D15.3).
- **R-D13.10** `[r4·mới]` (Đ40, GAP-05) Hàng có món ngừng (`usable = false`, gồm ngừng theo nhóm) mà kỳ khóa còn người đăng ký: Gửi ADM vẫn hiện hàng, nhãn **"Ngừng dùng"**, Đề nghị mặc định **0**, HC vẫn "Sửa số" được; đã đặt thì Hàng về nhận (R-D11.10).
- **R-D13.11** `[r4·mới]` (Đ41, GAP-06) **Người đã nghỉ không tính vào đề nghị.** Phần chưa nhận và nợ của người `status ≠ 'active'` không vào `requested_active`/`debt_active`; dòng xám ghi "không tính {{e}} của người đã nghỉ" (W4). Tháng này có dòng nhắc W25 "{{n}} người đã nghỉ còn phần chưa nhận: {{names}}" với nút "Xử lý" → Tổng hợp kỳ K\* lọc `?left=1`, panel giảm chọn sẵn lý do "Người đã nghỉ" (Đ26); nợ tháng trước của họ → Còn nợ lọc `?left=1`, Hủy nợ chọn sẵn "Đã nghỉ việc" (R-D14.5).

### Trạng thái & biên
| Tình huống | Số đề nghị mặc định |
|---|---|
| Đăng ký 8, nợ 2, tủ 0 | 10 (trước đây 10) |
| Đăng ký 8, nợ 2, tủ 3 | **10** (trước đây 7) |
| Đăng ký 8, nợ 2, tủ 15 | **10** (trước đây 0, và hàng bị lọc khỏi "chỉ hàng cần mua") |
| Đăng ký 0, nợ 0 | 0, không vào phiếu (R-D5.11) |
| HC sửa ô thành 7 | 7 (ô "đã sửa"); "Về số gộp (10)" trả về 10 |
| Ngoài DM: đăng ký 2 | 2 (tủ vốn `null`) |

### Dữ liệu/API
Không migration, không đổi kiểu `MonthReport`. Đổi giá trị mặc định của `order_qty` khi tạo bản chốt (R-D13.2).

### Giao diện
| Khóa | vi | en |
|---|---|---|
| `reports.part1.colNeed` (sửa) | Tổng cần | Total requested |
| `reports.part1.colStock` (sửa) | Tủ hiện có (tham khảo) | In stock (reference) |
| `reports.part1.resetNeed` / `resetNeedLabel` / `resetAll` (sửa) | Về số gộp ({{need}}) / Về số gộp ({{need}}) {{name}} / Về số gộp tất cả ({{count}}) | Reset to total ({{need}}) / … / Reset all to totals ({{count}}) |
| `reports.part1.tip.formula` (sửa) | Đề nghị mặc định = Chưa giao kỳ này + Nợ kỳ trước. Tủ chỉ để tham khảo, không trừ. Muốn bớt thì sửa ô Đề nghị. | Default order = undelivered this period + carried over. Stock is for reference only. Edit the order cell to reduce. |
| `sendAdm.orders.need` (sửa) | Tổng cần | Total requested |
| `xlsx` nhãn `need` (sửa, `xlsx-labels.ts:34,55`) | Tổng cần | Total requested |

### Tiêu chí nghiệm thu
| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 1 | R-D13.1, R-D13.2 | Tạo bản chốt không sửa ô: đăng ký 8 + nợ 2, tủ 3 → `order_qty` 10; tủ 0 → 10; tủ 15 → 10; ngoài DM 2 → 2 | API |
| 2 | R-D13.2 | Web Gửi ADM (Báo cáo không có ô sửa): ô Đề nghị mặc định 10 với tủ 3; sửa 7 → "đã sửa", gửi `order_qty: {key: 7}`; sửa lại 10 → không "đã sửa", không gửi khóa | Vitest |
| 3 | R-D13.2 | Lọc "chỉ hàng cần": hàng tủ 15 gộp 10 → **hiện**; hàng gộp 0 → ẩn | Vitest |
| 4 | R-D13.3 | `GET /admin/reports/:ym` vẫn có `need` (net) đúng BR-15; không component nào render `row.need` (quét TSX) | API + Vitest |
| 5 | R-D13.4 | Báo cáo: cột "Tổng cần" = 10 và cột Tủ có chữ "(tham khảo)"; Excel báo cáo đọc lại: cột Tổng cần = 10 | Vitest + API |
| 6 | R-D13.5 | Chữ công thức vi/en mới; không còn "− Tồn"/"trừ tủ" trong `locales/*/reports.ts`, `send-adm.ts` | Vitest |
| 7 | R-D13.6 | Bước Hàng về: có 1 đợt về nhưng còn `remaining` 2 → **chưa** xong (trước đây xong); mọi `remaining` 0 → xong; giá trị = tổng `remaining` | Vitest |
| 8 | R-D13.7 | Hàng về nhãn: `qty` = `remaining` → "đủ", `remaining − 1` → "thiếu", `+1` → "dư" | Vitest |
| 9 | R-D13.8 | Bản chốt gieo kiểu cũ (`order_qty` net 7) → in/xuất lại vẫn 7; bản mới → 10 | API |

**Tiêu chí bổ sung (vòng 4)**

| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 10 | R-D13.1, R-D13.9 | Đăng ký 8 + nợ 4 (kỳ 12), ADM còn nợ giao 4 → mặc định 8; "ADM không giao nữa" → 12; kỳ 12 có BB đánh `out` → `adm_owed` 0; `order_basis` lưu đúng | API |
| 11 | R-D13.10 | Món ngừng có 3 đăng ký → mặc định 0, nhãn "Ngừng dùng", sửa 3 → bản lưu 3 | API + Vitest |
| 12 | R-D13.11 | C (đã nghỉ) chờ 2 → mặc định không tính 2, dòng xám có "không tính 2 của người đã nghỉ"; Tháng này "1 người đã nghỉ còn phần chưa nhận: C"; "Xử lý" mở Tổng hợp lọc đúng, lý do chọn sẵn | API + Vitest |

---

## D14. "Còn nợ" chỉ là nợ tháng trước; tháng đang giao là "Chưa nhận" (Đ28) `[r3·mới]`

### Hiện trạng
- **Tháng đang giao** K\* = kỳ khóa mới nhất (`latestLocked`). Giao hàng đọc dòng của mọi kỳ khóa, `is_debt = r.period_ym < K*` (`delivery-people.service.ts`).
- `statusOf` (`delivery-people.service.ts:101-107`, quy tắc R15 của Plan B): người đã được giao **một phần** mọi dòng tháng K\* bị xếp **"Còn nợ"** dù vẫn là phần chưa nhận của tháng đang giao.
- Trang Còn nợ (`backlog.service.ts:55-73`): `UNDELIVERED_LINE AND p.deadline <= now` → gồm **cả tháng đang giao**. Rà soát (#7, Cao): tab "Còn nợ 0" ở Giao hàng trong khi trang Còn nợ 78 — hai nơi hai định nghĩa.
- Hủy nợ (`cancel-remaining.service.ts:30-60`, `POST /admin/delivery/lines/:id/cancel-remaining`) nhận mọi dòng kỳ khóa, lý do chữ tự do ≥ 3 ký tự; nút "Hủy nợ" đỏ đứng ngay cạnh "Giao bổ sung" trên từng dòng (rà soát #7, Vừa).
- Badge: Giao hàng = số người `status 'pending'` (`use-admin-badges.ts`); không có badge Còn nợ.
- Chữ "nợ" cho phần chưa nhận của tháng đang giao: `home.ts:20`, `delivery.ts:26,29,65,66,108,194,232`, `stock.ts:17,54,94`, `notifications.ts:19-20` (chuông hủy — đúng nếu chỉ áp cho nợ thật).

### Quy tắc
- **R-D14.1** `[r3·mới]` **Định nghĩa.** Với dòng L thuộc kỳ khóa P và `remaining(L) > 0`: P = K\* → phần còn lại là **"Chưa nhận"**; P < K\* → **"Còn nợ"** (nợ tháng P). Phần chưa nhận của K\* **chỉ thành nợ** khi kỳ K\*+1 được khóa sổ và trở thành tháng đang giao (Đ13 "thành nợ" hiểu theo mốc này). Không có job chuyển — định nghĩa tính theo K\* tại lúc đọc.
- **R-D14.2** `[r3·mới]` **Thay `statusOf`** (đảo R15 Plan B): mỗi người có `has_pending = open_lines > 0` (dòng K\* còn lại > 0, đã giao một phần hay chưa) và `has_debt = owed_lines > 0` (dòng kỳ < K\* còn lại > 0). `status` (một giá trị, cho thẻ) = `pending` nếu `has_pending`, ngược lại `debt` nếu `has_debt`, ngược lại `done`. API trả thêm hai cờ. Tab lọc theo **vị từ**, không theo `status`: Chưa nhận = `has_pending`; Còn nợ = `has_debt`; Đã nhận = không cờ nào; Tất cả. Một người có thể ở cả hai tab (đếm tab có thể chồng; ghi chú nhỏ dưới tab khi chồng: "{{n}} người có cả hai").
- **R-D14.3** `[r3·mới]` **Trang Còn nợ** chỉ gồm dòng kỳ **< K\*** (`backlog.service.ts`: thêm `r.period_ym < $latestLocked`; không có kỳ khóa nào hoặc chỉ một kỳ → trống). Mô tả trang: "Phần chưa giao của các tháng trước tháng {{K*}} — giao bổ sung khi có hàng, hoặc hủy nợ." Tổng ở trang Còn nợ = số đơn vị của tab Còn nợ ở Giao hàng (cùng vị từ, cùng SQL dùng chung `DEBT_LINE_SQL`).
- **R-D14.4** `[r3·mới]` **Hủy nợ chỉ cho nợ.** `cancel-remaining` trên dòng kỳ K\* → 409 `NOT_DEBT_YET` ("Đây là phần chưa nhận của tháng đang giao — giảm ở Tổng hợp nếu không giao nữa."), trừ khi `reason_code = 'adm_out_of_stock'` và món đang đánh ADM hết hàng của K\* (đường R-D11.13 trong hộp giao). Phần chưa nhận của K\* muốn đóng → giảm ở D6 (Tổng hợp) với lý do.
- **R-D14.5** `[r3·mới]` **Lý do Hủy nợ có sẵn.** DTO thêm `reason_code` bắt buộc ∈ `adm_out_of_stock` (ADM hết hàng) · `not_needed` (Người nhận không cần nữa) · `user_left` (Đã nghỉ việc) · `other` (Khác); `reason` (ghi chú) bắt buộc ≥ 3 ký tự chỉ khi `other`, tùy chọn với mã khác, ≤ 200 (như R-D6.1). Chữ lưu ở `cancel_reason` = nhãn tiếng Việt + (": " + ghi chú nếu có) để Lịch sử/chuông cũ đọc như hiện nay; audit thêm `reason_code`. Thiếu mã → 400 `REASON_REQUIRED`; mã lạ → 400 `VALIDATION`. Chuông `line_cancelled` giữ; `user_left` **không** chuông (đồng nhất Đ26).
- **R-D14.6** `[r3·mới]` **Giao diện Hủy nợ.** Mỗi dòng trang Còn nợ: nút chính "Giao bổ sung" + menu **⋯** chứa "Hủy nợ" (đỏ trong menu). Hộp: tiêu đề "Hủy nợ {{qty}} {{unit}} {{name}} của {{person}}?", nhóm nút chọn 4 lý do (R-D14.5), ô ghi chú (bắt buộc khi Khác), dòng "Nhân viên sẽ thấy lý do trong Lịch sử."; nút [Quay lại] [Hủy nợ] (R-D4.8). Cột "Tồn" → "Tủ còn".
- **R-D14.7** `[r4·sửa]` **Badge.** Badge Giao hàng = số người `has_pending` (nay gồm cả người đã giao một phần tháng K\* — đúng ý "chưa nhận đủ"). Không thêm badge Còn nợ. Thẻ người: nhãn trạng thái theo `status`; nếu `has_debt` thêm nhãn phụ "Nợ tháng {{months}}" (đã có `delivery.ts:214`). `[r4]` (GAP-17) **Thay vế đầu:** badge Giao hàng = số người có **ít nhất một dòng giao được ngay** (theo `allocateLines` + R-D7.9 có phần > 0 từ tủ hiện tại, hoặc dòng ngoài DM có trần > 0); ngay sau khóa sổ khi tủ trống → 0. Tab Chưa nhận vẫn theo `has_pending`.
- **R-D14.8** `[r3·mới]` **Chữ.** Mọi câu nói phần thiếu của tháng đang giao "thành nợ"/"vào Còn nợ" đổi thành "còn chưa nhận": `home.ts:20` → "Hàng đã về. Giao cho từng người; phần chưa đủ hàng còn ở Chưa nhận."; `delivery.ts:26` → "{{n}} món thiếu kho — phần thiếu còn ở Chưa nhận"; `:29` → "…Phần thiếu kho còn ở tab Chưa nhận."; `:30` → "Xem Chưa nhận"; `:65` → "Hết hàng — chưa nhận {{n}}"; `:66` → "…phần còn lại chờ hàng về."; `:108` → R-D14.3; `:194` → "…bấm Giao."; `:232` → R-D7.3. Tủ/Kho cột "Còn nợ" → R-D15.2.

### Trạng thái & biên
| Tình huống | Kết quả |
|---|---|
| Chỉ một kỳ khóa (K\*) | Còn nợ trống; tab Còn nợ 0; mọi phần chưa giao ở Chưa nhận |
| Người có nợ tháng 9 và chưa nhận tháng 10 | Ở cả hai tab; thẻ "Chưa nhận" + "Nợ tháng 9" |
| Giao một phần tháng K\* | Vẫn Chưa nhận (trước: Còn nợ) |
| 00:00 khóa kỳ K\*+1 | Phần chưa nhận của K\* thành nợ ngay ở lần đọc kế; Hủy nợ dòng đó cho phép |
| Hộp Hủy nợ mở, kỳ mới khóa | Không ảnh hưởng (dòng vẫn là nợ) |
| Hủy nợ đang mở thì kỳ K\* đổi? (không thể lùi) | — |

### API
| Endpoint | Thay đổi |
|---|---|
| `GET /admin/delivery/people` | Mỗi người thêm `has_pending`, `has_debt`; `status` theo R-D14.2 |
| `GET /admin/delivery/backlog` | Chỉ dòng kỳ < K\* |
| `POST /admin/delivery/lines/:id/cancel-remaining` | Body thêm `reason_code` bắt buộc; `reason` bắt buộc chỉ khi `other`; lỗi mới 409 `NOT_DEBT_YET` |

### i18n
| Khóa | vi | en |
|---|---|---|
| `delivery.backlog.description` | Phần chưa giao của các tháng trước tháng {{month}} — giao bổ sung khi có hàng, hoặc hủy nợ. | Undelivered items from months before {{month}} — deliver when stock arrives, or write off. |
| `delivery.cancel.reasons.*` | ADM hết hàng / Người nhận không cần nữa / Đã nghỉ việc / Khác | ADM out of stock / No longer needed / Left the company / Other |
| `delivery.cancel.hint` | Nhân viên sẽ thấy lý do trong Lịch sử. | The employee will see the reason in History. |
| `delivery.cancel.title` | Hủy nợ {{qty}} {{unit}} {{name}} của {{person}}? | Write off {{qty}} {{unit}} {{name}} for {{person}}? |
| `delivery.backlog.cols.stock` (sửa) | Tủ còn | In stock |
| `delivery.people.overlap` | {{n}} người có cả hai | {{n}} in both |
| `common.errors.NOT_DEBT_YET` | Đây là phần chưa nhận của tháng đang giao — giảm ở Tổng hợp nếu không giao nữa. | This is still pending for the current month — reduce it in Summary instead. |

### Tiêu chí chấp nhận
| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 1 | R-D14.1, R-D14.2 | Kỳ 9, 10 khóa (K\*=10): A giao một phần tháng 10 → `has_pending` true, `status pending` (trước: debt); B chỉ còn nợ tháng 9 → `debt`; C cả hai → hai cờ, `pending`; D đủ → `done` | API |
| 2 | R-D14.1 | Đồng hồ 16:59:59.999Z ngày khóa kỳ 11 → dòng tháng 10 còn lại là chưa nhận; 17:00:00.000Z → là nợ (tab Còn nợ, trang Còn nợ) | API |
| 3 | R-D14.2 | Tab Chưa nhận có A, C; Còn nợ có B, C; Đã nhận có D; ghi chú "1 người có cả hai" | Vitest |
| 4 | R-D14.3 | Trang Còn nợ không có dòng tháng 10; tổng trang = tổng đơn vị tab Còn nợ ở Giao hàng (cùng fixture) | API + Vitest |
| 5 | R-D14.4 | Hủy nợ dòng tháng 10 → 409 `NOT_DEBT_YET`, dòng không đổi; dòng tháng 9 → 200; dòng tháng 10 với `adm_out_of_stock` khi món đánh ADM hết hàng → 200, không đánh → 409 | API |
| 6 | R-D14.5 | Thiếu `reason_code` → 400 `REASON_REQUIRED`; `other` ghi chú 2 ký tự → 400, 3 → 200; `not_needed` không ghi chú → 200, `cancel_reason` = "Người nhận không cần nữa"; `user_left` → 0 chuông; `not_needed` → 1 chuông | API |
| 7 | R-D14.6 | Dòng Còn nợ: không có nút "Hủy nợ" trực tiếp, có trong menu ⋯; hộp có 4 lựa chọn, [Quay lại][Hủy nợ], Hủy nợ vô hiệu tới khi chọn lý do (và ghi chú nếu Khác); cột "Tủ còn" | Vitest |
| 8 | R-D14.7 | Badge Giao hàng = số người `has_pending` (A, C → 2) | Vitest |
| 9 | R-D14.8 | Quét `locales/vi/{home,delivery}.ts`: không còn "thành nợ", "vào Còn nợ", "chuyển sang Còn nợ" | Vitest (quét file) |
| 10 | R-D14.2–R-D14.6 | PW 1280 + 390: giao một phần → người vẫn ở Chưa nhận; trang Còn nợ không có dòng tháng đang giao; Hủy nợ qua ⋯ | PW |

**Tiêu chí bổ sung (vòng 4)**

| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 11 | R-D14.7 | Ngay sau khóa, tủ trống cho mọi món của 3 người → badge 0 (trước: 3); Hàng về 1 món của A → badge 1; dòng ngoài DM đã có "Đã về" của B → badge 2 | Vitest + API |

---

## D15. Tủ/Kho và thẻ Danh mục: trạng thái theo người đang chờ (Đ31, Đ33) `[r3·mới]`

### Hiện trạng
- `catalog-sql.ts:12-18`: `stock_state` chỉ theo `stock_qty` và `restock_level` (`out` khi 0, `low` khi ≤ mức, `ok`), **không xét người đang chờ**. Tủ/Kho (`stock-table.tsx:16-17`, `stock-stats.tsx:20-21`) và thẻ Danh mục hiện "Hết hàng" đỏ cho 39 món không ai cần, và "Đủ dùng" cho món mà toàn bộ tồn đã được giữ cho người chờ (rà soát #8, Cao).
- Cột "Còn nợ" ở Tủ/Kho (`stock.ts:17`) = tổng còn lại của mọi dòng kỳ khóa (cả tháng đang giao) — trùng chữ với D14.
- Nút "Nhập mua" trên từng dòng (Đ31: dễ nhầm với Hàng về). Badge Tủ/Kho = độ dài `lowStockQuery`.
- Danh mục: tab "Sắp hết/hết" (`catalog.ts:54`) và nhãn đỏ/cam tồn trên thẻ (Đ33).

### Quy tắc
- **R-D15.1** `[r3·mới]` **Số "đang giữ"**: `held(item) = Σ remaining` của mọi dòng kỳ khóa (Chưa nhận + Còn nợ, sau giảm/hủy) của món; `free = max(0, stock_qty − held)`; `short = max(0, held − stock_qty)`. Tính ở server (`stock-query.service.ts`, cùng `UNDELIVERED_LINE` SQL), lớp `sql-filter` (D8 #27).
- **R-D15.2** `[r3·mới]` Tủ/Kho bảng: cột **Trong tủ** (`stock_qty`) · **Đang giữ cho người chờ** (`held`) · **Còn trống** (`free`) · Trạng thái. Bỏ cột "Còn nợ".
- **R-D15.3** `[r4·sửa]` **Trạng thái mới** (`stock_state` thay thế, theo thứ tự): `short > 0` → đỏ **"Thiếu {{short}} cho người chờ"**; `stock_qty = 0` và `held = 0` → xám **"Không có"** (không đỏ); `restock_level ≠ NULL` và `free ≤ restock_level` → cam **"Sắp hết"** (tính trên phần còn trống, không trên tồn); `restock_level = NULL` → xám "Không theo dõi"; còn lại → xanh **"Còn {{free}}"** (bỏ chữ "Đủ dùng"). Ô thống kê: "Thiếu cho người chờ" (đỏ), "Sắp hết" (cam), "Không có" (xám, không tô). **Đỏ chỉ khi có người đang cần** (Đ33). `[r4]` (GAP-17) `short = max(0, held − stock_qty − incoming)` với `incoming` = Σ `remaining` của kế hoạch Hàng về kỳ K\* + Σ `adm_owed` (R-D13.9) của món; khi `held > stock_qty` mà `incoming` bù được → xám **"Chờ hàng về {{n}}"** (`n = min(incoming, held − stock_qty)`), đứng trước luật "Không có". Đỏ chỉ khi đã tính cả hàng đang về mà vẫn thiếu.
- **R-D15.4** `[r4·sửa]` **Badge Tủ/Kho** = số món có `short > 0` (không đếm "Không có", không đếm "Sắp hết"). Lọc nhanh: Thiếu cho người chờ / Sắp hết / Không có / Tất cả. `[r4]` Badge dùng `short` mới (đã trừ hàng đang về) — ngay sau khóa sổ, khi mọi món đã đặt đủ, badge = 0. Lọc thêm "Chờ hàng về".
- **R-D15.5** `[r3·mới]` (Đ31) Bỏ nút "Nhập mua" trên từng dòng; menu ⋯ của dòng có **"Nhập ngoài kỳ (tự mua lẻ)"** (mở hộp nhập mua hiện có, tiêu đề cùng chữ). Đầu trang: liên kết "Hàng ADM về? → Hàng về". Tab Xuất lẻ có nút chính "Xuất lẻ một món". Tiêu đề trang "Tủ / Kho" (khớp menu).
- **R-D15.6** `[r3·mới]` (Đ33) Thẻ và bảng **Danh mục**: chữ xám nhỏ **"Tủ: {{n}}"** (tham khảo), không nhãn đỏ/cam, không "Hết hàng"/"Sắp hết"; bỏ tab "Sắp hết/hết" (URL cũ `?tab=low` → tab Đang dùng, `replace`). Panel món: thông tin tồn chỉ đọc + liên kết "Xem ở Tủ / Kho".
- **R-D15.7** `[r3·mới]` `GET /admin/stock` (danh sách Tủ/Kho) thêm `held`, `free`, `short`; `stock_state` đổi tập giá trị thành `short | none | low | untracked | ok`. API Danh mục không còn trả `stock_state` cho UI (giữ trường, `@deprecated`).
- **R-D15.8** `[r4·mới]` (Đ43, GAP-09) **Xuất lẻ và Kiểm kê xét phần đang giữ.** Hộp Xuất lẻ tính `free` (R-D15.1); `qty > free` → khối cam "Phần này đang giữ cho {{k}} người chờ nhận." + dòng nhỏ "Xuất {{q}} sẽ lấy {{x}} {{unit}} đang giữ."; nút chính đổi thành **"Vẫn xuất"** (không chặn; server không lỗi mới, audit `stock.issue` thêm `detail.took_held = x`). `qty > stock_qty` vẫn chặn như FR-54. Hộp Kiểm kê: số đếm `c < held` → khối cam "Sau kiểm kê tủ còn {{c}}, thiếu {{n}} cho người đang chờ." (không chặn).

### Trạng thái & biên
| Tồn | Đang giữ | Mức | Trạng thái |
|---|---|---|---|
| 0 | 0 | 5 | Không có (xám) |
| 0 | 3 | 5 | Thiếu 3 cho người chờ (đỏ) |
| 10 | 10 | 2 | Sắp hết (còn trống 0 ≤ 2) — trước: "Đủ dùng" |
| 10 | 12 | — | Thiếu 2 (đỏ) |
| 20 | 2 | 5 | Còn 18 |
| 4 | 0 | NULL | Không theo dõi |

### i18n
| Khóa | vi | en |
|---|---|---|
| `stock.page.title` | Tủ / Kho | Stock |
| `stock.page.colStock` / `colHeld` / `colFree` | Trong tủ / Đang giữ cho người chờ / Còn trống | In stock / Held for waiting staff / Free |
| `stock.state.short` | Thiếu {{n}} cho người chờ | {{n}} short for waiting staff |
| `stock.state.none` / `ok` | Không có / Còn {{n}} | None / {{n}} free |
| `stock.actions.buyOutside` | Nhập ngoài kỳ (tự mua lẻ) | Off-cycle purchase |
| `stock.page.toArrivals` | Hàng ADM về? → Hàng về | ADM delivery? → Arrivals |
| `stock.issue.primary` | Xuất lẻ một món | Issue one item |
| `catalog.card.stock` | Tủ: {{n}} | Stock: {{n}} |

### Tiêu chí chấp nhận
| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 1 | R-D15.1, R-D15.3, R-D15.7 | 6 hàng của bảng biên → đúng `held/free/short/stock_state`; dòng kỳ mở không vào `held`; dòng đã giảm/hủy tính theo `remaining` | API |
| 2 | R-D15.2, R-D15.3 | Bảng có 3 cột số mới, không cột "Còn nợ"; không chữ "Đủ dùng"; đỏ chỉ ở hàng `short > 0` | Vitest |
| 3 | R-D15.4 | Badge = 2 với fixture (2 món thiếu, 3 "Không có", 1 sắp hết) | Vitest |
| 4 | R-D15.5 | Dòng không có nút "Nhập mua"; ⋯ có "Nhập ngoài kỳ (tự mua lẻ)" mở đúng hộp; liên kết Hàng về; tab Xuất lẻ có nút chính | Vitest |
| 5 | R-D15.6 | Danh mục: không `.tag--danger`/`.tag--warn` về tồn; có "Tủ: 0"; không tab "Sắp hết/hết"; `?tab=low` → Đang dùng | Vitest |
| 6 | R-D15.1–R-D15.6 | PW 1280 + 390 Tủ/Kho và Danh mục; axe 390 | PW |

**Tiêu chí bổ sung (vòng 4)**

| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 7 | R-D15.3, R-D15.4 | Ngay sau khóa: tủ 0, giữ 5, bản in đặt 5 → "Chờ hàng về 5", badge 0; về 3, giữ 5 → tủ 3, incoming 2 → "Chờ hàng về 2"; đánh ADM hết hàng (incoming 0) → "Thiếu 2 cho người chờ", badge 1 | API + Vitest |
| 8 | R-D15.8 | Tủ 5, giữ 4: xuất 1 → không cảnh báo, nút "Xuất"; xuất 3 → khối "Phần này đang giữ cho 2 người chờ nhận." + "Xuất 3 sẽ lấy 2 cái đang giữ.", nút "Vẫn xuất" → 201, audit `took_held 2`; xuất 6 → chặn; Kiểm kê đếm 3 → khối "Sau kiểm kê tủ còn 3, thiếu 1 cho người đang chờ." | API + Vitest |

---

## D16. Các mục rà soát còn lại (Danh mục, Cấu hình, Nhật ký) `[r3·mới]`

- **R-D16.1** `[r3·mới]` (rà soát #9, Vừa) Danh mục: chế độ lưới và bảng dùng **cùng một thanh lọc** (ô tìm không dấu, chip nhóm có đếm, tab trạng thái) từ thành phần chung D11 (`web/ui/filter/*`); đổi chế độ giữ bộ lọc (query `q`, `group`, `tab`). Chế độ bảng mở **mọi nhóm** mặc định.
- **R-D16.2** `[r3·mới]` (rà soát #11, Vừa) Cấu hình: cảnh báo cam "Bạn không thuộc nhóm này…" (`config.ts:54-55`) **chỉ hiện sau khi ô ID nhóm quản trị bị đổi** so với giá trị đã lưu (không hiện khi mở trang với giá trị đang dùng).
- **R-D16.3** `[r3·mới]` (rà soát #14, Vừa) Nhật ký: các bản ghi `stock.receipt` của **một lần Lưu hàng về** (cùng actor, cùng `receipt_ym`, cùng giao dịch — `detail.batch_id` mới = id bản ghi đầu) gộp thành **một dòng** "Nhập hàng về kỳ tháng {{month}} — {{n}} món, {{u}} đơn vị" mở ra xem từng món. Cột đối tượng ghi **tên cụ thể** (tên món / tên người / "Kỳ tháng 10"), không ghi loại chung ("request_line", "item").

| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 1 | R-D16.1 | Lọc "giấy" + nhóm B ở lưới → đổi sang bảng giữ nguyên kết quả; bảng mọi nhóm mở | Vitest |
| 2 | R-D16.2 | Mở Cấu hình: không cảnh báo; sửa ID sang nhóm người dùng không thuộc → hiện; sửa về giá trị cũ → ẩn | Vitest |
| 3 | R-D16.3 | Một lần Lưu 5 món → Nhật ký 1 dòng gộp (mở ra 5); hai lần Lưu → 2 dòng; cột đối tượng không có chuỗi `request_line`/`item` thô | API + Vitest |

---

## D17. Cảnh báo lệch số ở mọi bước (Đ36, GAP-01) `[r4·mới]`

### Hiện trạng
Spec vòng 3 chỉ có câu chung R-X.1 và nhãn rời ở Hàng về (R-D11.9). Kịch bản chuẩn (mục 6) liệt kê 40 chỗ app phải báo lệch; mục này gộp lại thành **một danh mục duy nhất W1–W26** (bỏ trùng: #1–#4 → W1; #9 + #36 → W6; #17 + #18 → W13; #19 + #20 → W14; #25 + #27 → W19; #29 + #30 → W20; #16 + #40 → W12). Chữ ở bảng là **chữ bắt buộc** (vi); en ở i18n.

### Quy tắc
- **R-D17.1** `[r4·mới]` **Một công thức.** Cho món/khóa `r` của kỳ K: `cần(r) = requested_active + debt_active` (R-D13.1); `có(r) = tủ + đề nghị + adm_owed` (`tủ` = `stock_qty` lúc tính; món ngoài DM: `tủ = 0`); `d(r) = có − cần` — đúng công thức Đ36 "tủ + đề nghị − (đăng ký + nợ)" với phần ADM còn nợ giao (Đ39) tính là hàng sẽ có và phần người đã nghỉ (Đ41) không tính là cần. Hàm dùng chung `api/modules/reports/report-need.ts` `diffOf()` và bản sao `web/lib/report-qty.ts` (test chéo cùng bảng ca). Server trả `d` sẵn ở báo cáo/Gửi ADM; web tính lại khi HC đang sửa số.
- **R-D17.2** `[r4·mới]` **Một thành phần** `web/ui/feedback/diff-note.tsx`: tông **xanh** khi đủ (`d = 0`), **cam** khi thiếu (`d < 0`), **xám** khi dư (`d > 0`); luôn có chữ (không chỉ màu), `role="status"` cho dòng trong bảng, khối trong hộp dùng `role="alert"` chỉ khi là lý do chặn/hỏi lại. Tương phản ≥ 4.5 (D4).
- **R-D17.3** `[r4·mới]` **Danh mục cảnh báo** (ràng buộc nơi, điều kiện, chữ):

| W | Nơi | Điều kiện | Chữ (vi) | Nguồn (kịch bản #) |
|---|---|---|---|---|
| W1a | Gửi ADM · Lập phiếu · dưới số Đề nghị | `d = 0` | Đủ cho người đăng ký | Đ36 (#1) |
| W1b | 〃 | `d < 0` | Thiếu {{n}} — {{n}} {{unit}} sẽ không có để giao | Đ36 (#2) |
| W1c | 〃 | `d > 0`, đề nghị > 0 | Dư {{n}} vào kho | Đ36 (#3) |
| W1d | 〃 | `d > 0`, đề nghị = 0 | Tủ đã đủ — vẫn dư {{n}} vào kho | Đ36 (#4) |
| W2 | Gửi ADM · Lập phiếu · đầu bảng | ≥ 1 hàng thiếu hoặc dư | {{a}} món thiếu · {{b}} món dư vào kho · {{c}} món đủ | #5 |
| W3 | Gửi ADM · hàng món ngừng | `usable = false` | Nhãn "Ngừng dùng" + Món đã ngừng — đề nghị mặc định 0; muốn mua thì sửa số | Đ40 (#6) |
| W4 | Gửi ADM · dòng xám | phần của người nghỉ > 0 | Không tính {{n}} {{unit}} của người đã nghỉ | Đ41 (#7) |
| W5 | Gửi ADM · dòng xám | `adm_owed > 0` | Không tính {{n}} {{unit}} nợ tháng {{m}} — ADM còn nợ giao | Đ39 (#8) |
| W6 | Gửi ADM · Đã gửi · băng; Tháng này · bước Gửi ADM | có thay đổi sau bản (R-X.1) | Băng: Có thay đổi sau bản chốt {{hh:mm dd/mm}} — in lại nếu cần · Bước: Đã gửi {{hh:mm dd/mm}} · có thay đổi sau đó | R-X.1 (#9, #36) |
| W7 | Gửi ADM · Đã gửi · hàng có nhu cầu đổi | `cần` nay ≠ `cần` lúc chốt (`order_basis`) | Bản gửi {{x}} · nay cần {{y}} → dư {{n}} vào kho / → thiếu {{n}} | Đ36 (#10) |
| W8 | Gửi ADM · hộp In trình ký | còn dòng ngoài DM chờ xem | Còn {{n}} món ngoài danh mục chưa xem; chốt vẫn thiếu các món này. | FR-62 (#11) |
| W9 | Gửi ADM · nút In / Excel | tổng = 0 | Chưa có món nào để đề nghị | Đ30 (#12), R-D5.11 |
| W10a | Món ngoài DM · hộp "Không mua" | khóa có trong bản (Đề nghị > 0) | Phiếu gửi ADM lúc {{hh:mm dd/mm}} đã có món này ({{n}} {{unit}}) — hàng về sẽ không có người nhận. | GAP-07 (#13) |
| W10b | Món ngoài DM · hộp "Mua lần này" / "Mua và thêm vào danh mục" | khóa không có trong bản | Phiếu gửi ADM lúc {{hh:mm dd/mm}} chưa có món này. Sau khi chấp nhận, vào Gửi ADM để làm bản mới và in lại, hoặc tự mua riêng. | R-D3.6 (#14) |
| W11 | Tổng hợp · panel giảm · dưới dòng, trước Lưu | giảm khi kỳ đã có bản | Phiếu gửi ADM lúc {{hh:mm dd/mm}} đã tính số cũ — giảm bây giờ thì hàng về dư {{n}} {{unit}} vào kho. | Đ11, Đ36 (#15) |
| W12a | Tổng hợp · dòng (kỳ khóa) | `qty > max_qty` | Vượt tối đa hiện tại ({{max}}) | GAP-15 (#16) |
| W12b | Đăng ký NV · dòng giỏ (kỳ mở) | `qty > max_qty` mới | Tối đa mới {{max}} — giữ được {{qty}}, không tăng được | GAP-15 (#40) |
| W13 | Hàng về · cột Tình trạng | về đợt này ≠ còn lại | Thiếu {{n}} so với bản in · Dư {{n}} so với bản in — vào kho | Đ36 (#17, #18) |
| W14 | Hàng về · nhãn hàng + đầu trang | giảm sau khi gửi | Đã giảm {{n}} sau khi gửi ADM — phần dư vào tủ · {{x}} món đã giảm sau khi gửi ADM — phần dư sẽ vào tủ | R-D11.9 (#19, #20) |
| W15 | Hàng về · hộp xác nhận Lưu (mới) | ≥ 1 hàng khác còn lại | Đợt này khác bản in ở {{n}} món: {{list}}. Phần thiếu chờ đợt sau. | Đ36 (#21) |
| W16 | Hàng về · hàng thêm bằng "Thêm món khác" | `ordered = 0` | Món này không có trong bản in gửi ADM — nhập thẳng vào tủ | Đ36 (#22) |
| W17 | Hàng về · hàng ADM hết hàng có tủ | `adm_out` và tủ > 0 | ADM hết hàng — tủ còn {{s}}: khi giao chia từ tủ theo thứ tự đăng ký, phần thiếu {{n}} hủy | Đ37 (#23) |
| W18 | Hàng về · hộp "Đủ hàng" | như R-D11.14 | Nhập {{x}} món, {{y}} đơn vị vào tủ theo bản in {{time}}. + các dòng bỏ qua | R-D11.14 (#24) |
| W19 | Giao hàng · dưới dòng (hộp giao, panel) + đầu trang | tủ < tổng còn chờ của món | Dòng: Tủ {{s}} không đủ cho {{k}} người đang chờ {{q}} — thiếu {{q−s}} · Đầu trang: {{n}} món chưa đủ tủ cho người đang chờ — chờ đợt hàng sau | Đ36 (#25, #27) |
| W20 | Tủ / Kho · Trạng thái | R-D15.3 | Thiếu {{short}} cho người chờ · Chờ hàng về {{n}} | R-D15.3 (#29, #30) |
| W21 | Tủ / Kho · hộp Xuất lẻ | `qty > free` | Phần này đang giữ cho {{k}} người chờ nhận. (+ "Xuất {{q}} sẽ lấy {{x}} {{unit}} đang giữ.", nút "Vẫn xuất") | Đ43 (#31 — chữ chủ dự án thay chữ kịch bản) |
| W22 | Tủ / Kho · hộp Kiểm kê | số đếm < đang giữ | Sau kiểm kê tủ còn {{c}}, thiếu {{n}} cho người đang chờ. | GAP-09 (#32) |
| W23 | Còn nợ · hộp Hủy nợ | dòng nằm trong `debt` của `order_basis` bản mới nhất kỳ K\* | Phiếu gửi ADM tháng {{m}} đã tính {{n}} {{unit}} này — hủy thì hàng về dư vào kho. | GAP-07 (#33) |
| W24 | Danh mục / Nhóm & đơn vị · hộp ngừng | món (hoặc món trong nhóm) có `remaining > 0` theo bản in kỳ khóa | Món này đang chờ ADM giao {{n}} {{unit}} (bản in {{time}}) — ngừng thì vẫn nhập được hàng đã đặt. | Đ40 (#34) |
| W25 | Tháng này · dòng nhắc | có người `status ≠ active` còn dòng chưa giao ở kỳ khóa | {{n}} người đã nghỉ còn phần chưa nhận: {{names}} | Đ41 (#35 — chữ chủ dự án) |
| W26 | Nhân viên | (đã có quy tắc) | Lịch sử "Hành chính giảm …" R-D6.11 (#37); chuông ADM hết hàng R-D11.13 (#38); "Bạn còn chờ nhận …" R-D8.21 (#39) | #37–#39 |

  Đã có quy tắc riêng, chỉ liệt kê để đủ: #26 "Giữ {{k}} cho {{m}} người đăng ký trước" (R-D7.9), #28 "Người đã nghỉ — giao chỉ khi có người nhận thay" (R-D7.12).
- **R-D17.4** `[r4·mới]` **Gửi ADM Lập phiếu (W1–W5, W8, W9):** mỗi hàng có đúng một dòng W1 dưới số Đề nghị, đổi ngay khi HC sửa số (không đợi lưu); W2 ở đầu bảng; lọc nhanh "Thiếu" / "Dư" / "Đủ". W8 là khối trong hộp xác nhận In (không chặn; có liên kết "Xem món ngoài danh mục").
- **R-D17.5** `[r4·mới]` **Gửi ADM Đã gửi (W6, W7):** băng W6 khi R-X.1; mỗi hàng có `cần` sống khác `order_basis` lúc chốt hiện W7 dưới số đã gửi; không có W1 ở chế độ này (số đã gửi là cố định).
- **R-D17.6** `[r4·mới]` **Tổng hợp (W11, W12a):** W11 hiện **trong panel giảm, ngay dưới dòng đang giảm, trước khi Lưu** (không chỉ cảnh báo sau ở trang khác), `n` = số giảm của dòng; không chặn Lưu.
- **R-D17.7** `[r4·mới]` **Hàng về (W13–W18):** Lưu một đợt có ≥ 1 hàng "Về đợt này" ≠ `remaining` → **hộp xác nhận mới** W15 (liệt kê tối đa 8 món "tên: về x / còn y" + "và n món khác") [Quay lại] [Lưu hàng về]; khớp hết → lưu thẳng như nay. W16, W17 là nhãn hàng; W18 giữ R-D11.14.
- **R-D17.8** `[r4·mới]` **Giao hàng (W19):** dòng W19 dưới mỗi dòng có tủ < tổng còn chờ (trong hộp giao và panel người, cạnh R-D7.13); đầu trang Giao hàng một dòng W19 đếm món; liên kết "Xem ở Tủ / Kho".
- **R-D17.9** `[r4·mới]` **Hộp hoàn tác số đã tính vào đơn (W10a, W23, W24):** hộp "Không mua", Hủy nợ, ngừng món/nhóm hiện khối cam tương ứng khi điều kiện đúng; không chặn; nút chính giữ chữ (Không mua / Hủy nợ / Ngừng). Dữ liệu: `GET /admin/review` thêm `in_sent_snapshot_qty`; dòng Còn nợ thêm `counted_in_snapshot_qty`; `GET /admin/items/:id/pending-arrival` (mới, `by-id`) trả `{remaining, unit, snapshot_at}` cho hộp ngừng (nhóm: tổng theo món).
- **R-D17.10** `[r4·mới]` **Tháng này (W6, W25):** bước Gửi ADM ghi vế W6 khi có thay đổi sau bản; dòng nhắc W25 có nút "Xử lý" (R-D13.11). Không có W nào hiện ở kỳ đang mở (Đ6).

### i18n
Mọi chữ W1–W25 vào `locales/{vi,en}/warnings.ts` (khóa `warn.<W>`), en dịch tương đương; không chữ cứng (lint `check-hardcoded-text`).

### Tiêu chí chấp nhận
| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| 1 | R-D17.1 | Bảng 12 ca `diffOf` chạy chung ở api và web cho cùng kết quả (gồm người nghỉ, ADM còn nợ, ngoài DM, ngừng); `d` server = `d` web | Vitest |
| 2 | R-D17.2 | Thành phần: 3 tông đúng điều kiện, luôn có chữ, axe 0 lỗi tương phản ở 390 | Vitest + PW |
| 3 | R-D17.3 | Quét `locales/vi/warnings.ts`: có đủ khóa W1a–W25 với **đúng chữ** của bảng (so chuỗi sau khi thay biến) | Vitest (quét file) |
| 4 | R-D17.4 | BK: tủ 2, cần 3, đề nghị 1 → "Đủ cho người đăng ký"; sửa 0 → "Thiếu 1 — 1 cuộn sẽ không có để giao"; sửa 3 → "Dư 2 vào kho"; tủ 5 cần 3 đề nghị 0 → "Tủ đã đủ — vẫn dư 2 vào kho"; đầu bảng đếm đúng; lọc "Thiếu" ra 1 hàng; hộp In có W8 khi còn 1 món chờ xem | Vitest |
| 5 | R-D17.5 | Sau bản 09:02, giảm phiếu B 2 → băng W6 "Có thay đổi sau bản chốt 09:02 12/12 — in lại nếu cần"; hàng đó "Bản gửi 7 · nay cần 5 → dư 2 vào kho"; Hủy nợ sau bản → cũng W6 | API + Vitest |
| 6 | R-D17.6 | Panel giảm khi có bản: hạ 5 → 3 → W11 với `n` 2 hiện ngay dưới dòng trước khi Lưu; kỳ chưa có bản → không; dòng vượt tối đa có W12a | Vitest |
| 7 | R-D17.7 | Lưu đợt về 3/7 BB và 2/2 GA → hộp W15 "Đợt này khác bản in ở 1 món: Bút bi: về 3 / còn 7. Phần thiếu chờ đợt sau."; Quay lại → 0 request; khớp hết → 0 hộp, 1 request | Vitest |
| 8 | R-D17.8 | Tủ BB 3, 2 người chờ 5 → dòng "Tủ 3 không đủ cho 2 người đang chờ 5 — thiếu 2"; đầu trang "1 món chưa đủ tủ cho người đang chờ — chờ đợt hàng sau" | Vitest |
| 9 | R-D17.9 | "Không mua" khóa có trong bản → W10a; Hủy nợ dòng nằm trong `debt` của bản → W23; ngừng món đang chờ ADM giao 3 → W24; điều kiện sai → không khối; cả 3 không chặn | API + Vitest |
| 10 | R-D17.10 | Tháng này kỳ mở: 0 cảnh báo W; kỳ khóa có C nghỉ → W25 "1 người đã nghỉ còn phần chưa nhận: C" | Vitest |
| 11 | R-D17.3–R-D17.10 | PW kịch bản rút gọn B15 → B17 → B21 → B23 ở 1280 + 390: thấy đúng W1, W11, W15, W19 tại chỗ | PW |

---

## K. Kịch bản chuẩn: quy tắc cho từng bước `[r4·mới]`

Kịch bản `docs/specs/2026-11-06-v2d-kich-ban-chuan.md` là bản đi thử tham chiếu (không ràng buộc chữ; chữ theo spec). Mỗi bước đi qua các quy tắc sau:

| Bước | Việc | Quy tắc |
|---|---|---|
| B1 | Chuông mở kỳ | R-D8.11 (`lockPhrase`), L (GAP-22) |
| B2 | Tháng này | R-D8.10, R-D8.17, R-D5.18, R-D17.10 |
| B3–B5 | NV đăng ký | R-D8.4, R-D8.5 (HC không thấy kỳ mở), R-D8.20 (W12b), R-D8.21 |
| B6 | Panel món Bút bi | R-D1.4–R-D1.8, R-D2.3, R-D15.6, R-D8.20 |
| B7 | Panel nhóm "Kẹp & dán" | R-D12.1–R-D12.7, R-D17.9 (W24), L (GAP-21) |
| B8 | Chuông nhắc, Tháng này | R-D8.11, R-D8.17, R-D8.18 |
| B9 | Lưu sát giờ khóa | R-D8.13, R-X.1 |
| B10 | Khóa sổ kỳ 12 | R-D8.17 (`headcount_subs`), R-D11.19, R-D14.1, R-D14.7, R-D15.3, R-D8.21 |
| B11 | Món ngoài DM | R-D3.1–R-D3.7, R-D17.9 (W10a/b) |
| B12 | Tổng hợp theo món | R-D1.11, R-D8.10, R-D8.20 (W12a) |
| B13 | Điều chỉnh phiếu B | R-D6.1–R-D6.14, R-D6.17, R-D17.6 |
| B14 | Tab Đơn vị tính | R-D12.7 |
| B15 | Gửi ADM Lập phiếu | R-D5.14, R-D5.22, R-D13.1–R-D13.11, R-D17.4, R-D1.11 |
| B16 | In trình ký | R-D5.1–R-D5.12, R-D5.19, L (GAP-23) |
| B17 | Giảm sau khi gửi ADM | R-D6.17, R-D17.6, R-D17.5, R-X.1 |
| B18 | C nghỉ việc | R-D13.11, R-D17.10, R-D8.18 |
| B19 | Panel phiếu C, "Người đã nghỉ" | R-D6.1, R-D6.8 (Đ26), R-D6.16 (Đ18) |
| B20 | Cấu hình ngày hạn | R-D8.19, R-D16.2 |
| B21 | Hàng về đợt 1, ADM hết Băng keo | R-D11.1–R-D11.12, R-D11.21, R-D17.7 |
| B22 | Xuất lẻ | R-D15.5, R-D15.8, L (GAP-20) |
| B23 | Giao B | R-D7.1–R-D7.13, R-D11.13, R-D17.8 |
| B24 | Ngừng Băng keo | R-D12.6, R-D17.9 (W24), R-D13.10, R-D11.10 |
| B25 | Giao A | R-D7.9, R-D14.2, R-D17.8 |
| B26 | Đủ hàng | R-D11.14–R-D11.18 |
| B27 | Kiểm kê | R-D15.8, L (GAP-19) |
| B28 | Còn nợ | R-D1.11, R-D14.3–R-D14.6 |
| B29 | Kỳ 01 đăng ký | R-D8.21, L (GAP-21) |
| B30 | Khóa kỳ 01 | R-D8.17, R-D11.19, R-D11.20, R-D13.9, R-D14.1 |
| B31 | Gửi ADM kỳ 01 | R-D13.9–R-D13.11, R-D5.19, R-D5.21, R-D17.4 |
| B32 | Hủy nợ BB của B | R-D14.4–R-D14.6, R-D17.9 (W23) |
| B33 | Báo cáo & in kỳ 12 | R-D5.6, R-D5.15, R-D5.20, R-D5.22 |
| B34 | Nhật ký | R-D16.3, R-D5.21 (`period.no_order`), L |

| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| K1 | (mục K) | Quét: mọi mã R-… trong bảng trên tồn tại trong spec; mọi bước B1–B34 có ≥ 1 quy tắc | Quy trình (script kiểm tài liệu) |

---

## X. Tương tác giữa các mục

| Cặp | Tình huống | Quy tắc |
|---|---|---|
| 6 × 7 | Dòng bị giảm rồi mới giao | Hộp D7 đọc còn nợ sau giảm; giảm khi hộp đang mở → `DELIVER_EXCEEDS_QTY` dòng đó |
| 7 × 6 | Đã giao một phần rồi giảm | Sàn `delivered + cancelled` (R-D6.6); giảm về đúng số đã giao → không chuông "giao đủ" (R-D6.10) |
| 6 × 5 × 11 | Giảm sau khi gửi ADM (Đ11) | Cho phép (R-D6.17); Gửi ADM cảnh báo (R-X.1); Hàng về theo bản in, phần dư vào tủ + nhãn (R-D11.9) |
| 5 × 11 | In lại sau khi Hủy hộp in | Dùng lại bản chốt (R-D5.9) ⇒ nguồn Hàng về không nhảy (R-D11.6) |
| 8 × 6 | Điều chỉnh và kỳ khóa | Chỉ kỳ khóa (R-D6.15); dòng ngoài DM sau khóa giảm như dòng thường, kể cả đã "Chấp nhận" (R-D6.5) |
| 8 × 7 | Dòng ngoài DM chờ xem của kỳ khóa | Hộp giao liệt kê ở "Không giao lần này" |
| 8 × 3 | Chờ xem rỗng khi kỳ mở | Dòng phụ R-D3.3 với `lockPhrase` |
| 8 × 5 | In/Excel kỳ chưa khóa | Server 409 (R-D8.5 #12) |
| 2 × 5/11 | Thứ tự dòng bản in, Hàng về | Thứ tự chung (R-D2.3); bản chốt cũ giữ thứ tự lúc chốt |
| 2 × 6/7 | Thứ tự trong ngăn Điều chỉnh, hộp giao | Dòng nợ trước theo kỳ, trong kỳ theo R-D2.3 |
| 1 × 7 | Hộp giao mở từ panel người | Hộp trên panel (R-D1.9); thành công hết → đóng cả hai (R-D1.8) |
| 1 × 5 | In khi panel mở | Vùng in portal ngoài shell, `#root` ẩn (R-D5.4) |
| 1 × 6 | Ngăn Điều chỉnh là panel phủ | Lưới không co; Lưu xong panel ở lại phiếu |
| 11 × 7 | ADM hết hàng | Đánh dấu ở Hàng về (R-D11.12) → giao: mặc định 0 + hủy (R-D11.13) |
| 12 × 11 × 6 | Món/nhóm ngừng sau khóa | Hàng về không nhập (R-D11.10); giảm/giao vẫn được (R-D6.21) |
| 13 × 5 × 11 | Số đề nghị gộp (Đ25) | Bản chốt mới lưu `order_qty` gộp (R-D13.2) → Hàng về `ordered` gộp (R-D11.7); bản chốt cũ giữ số đã lưu |
| 4 × mọi mục | Nút mới (hộp giao, panel, chip lọc, công tắc, "Đủ hàng") | Nằm trong ma trận nút (D4 #1) |
| 5 × 11 × 3 `[r3·mới]` | Bản rỗng, Làm bản mới, món ngoài DM chấp nhận sau khi gửi | Chỉ bản có hàng là nguồn (R-D5.16); Làm bản mới có xác nhận, bản mới thay nguồn Hàng về khi in (R-D5.13); hộp chấp nhận cảnh báo (R-D3.6) |
| 14 × 7 × 6 `[r3·mới]` | Phần chưa nhận tháng đang giao | Không Hủy nợ được (R-D14.4) → giảm ở D6 hoặc ADM hết hàng; thành nợ khi kỳ sau khóa (R-D14.1) |
| 14 × 15 `[r3·mới]` | "Đang giữ" ở Tủ/Kho | Gồm cả Chưa nhận và Còn nợ (R-D15.1) |
| 8 × 10 `[r3·mới]` | Đếm đăng ký | Một tập S (R-D8.17) ở mọi bề mặt |
| 5 × 13 × 11 `[r4·mới]` | Đ15 / Đ29 / Đ30 / Đ42 / Đ44 | Một bảng vòng đời R-D5.19: dùng lại chỉ khi số trùng (không dòng thay thế); bản khác số là bản thay thế toàn bộ; tổng 0 không tạo bản; nút Đ42 chỉ khi chưa có bản |
| 11 × 7 × 13 `[r4·mới]` | ADM hết hàng | Giao từ tủ theo đăng ký trước, hủy phần thiếu (Đ37/37b) → người không đến: tự hủy lúc khóa kỳ sau (Đ38) → không vào đề nghị kỳ sau |
| 11 × 13 × 14 `[r4·mới]` | ADM giao thiếu, hứa bù | Phần ADM còn nợ không đặt lại (R-D13.9); về bù ghi vào kỳ cũ (R-D11.20); người chờ ở Còn nợ, giao khi hàng về |
| 17 × mọi mục `[r4·mới]` | Lệch số | Một công thức `d` và một thành phần (R-D17.1–R-D17.2) |

- **R-X.1** `[r4·sửa]` Gửi ADM hiện cảnh báo "Có thay đổi sau bản chốt {{hh:mm}} — in lại nếu cần" khi, với kỳ đang xem, tồn tại bản ghi điều chỉnh có `created_at` > `created_at` bản chốt mới nhất, **hoặc** phiếu có `requests.updated_at` > bản chốt đó (phủ trường hợp nhân viên lưu sát giờ khóa, R-D8.13). Bằng đúng thời điểm → không cảnh báo. `[r4]` (GAP-07) Nguồn "thay đổi sau bản chốt" mở rộng thành **mọi bản ghi `audit_log`** của kỳ đang xem có `created_at` > bản có hàng mới nhất và `action` ∈ {`request.updated` (điều chỉnh), `line.cancel_remaining` (Hủy nợ, hủy ADM hết hàng), `line.review` (Mua lần này / Mua và thêm / Không mua), `arrival.adm_out_marked`, `arrival.adm_owed_closed`} + `requests.updated_at` như cũ. Chữ: W6 (D17). Tháng này hiện cùng điều kiện ở bước Gửi ADM.
- **R-X.2** `[r4·sửa]` Thứ tự triển khai (mỗi bước app vẫn chạy): D4 → D2 → D3 → D1 → D12 → D16 → D13 → **D17 (công thức + thành phần)** → D5 → D8 → D10 → D6 → D14 → D7 → D15 → D11. Lý do: D8 trước D6/D11 để guard và lớp route có sẵn; D10 ngay sau D8 (D8 #10); D6 trước D7 để hộp giao chịu lỗi từ dòng bị giảm; D11 sau D7 vì hủy ADM hết hàng chạy trong hộp giao; D12 độc lập, làm sớm vì dùng panel D1; D13 trước D5/D11 vì đổi số mặc định mà bản chốt và Hàng về đọc. D14 trước D7 vì hộp giao dùng chữ Chưa nhận/Nợ và vị từ mới; D15 sau D14 vì `held` dùng cùng SQL. Script dọn R-D9.7 cập nhật trong cùng PR với migration 0113, 0114, 0116, 0117, 0118. D17 trước D5 vì Gửi ADM, Hàng về, Giao hàng đều đặt cảnh báo bằng thành phần chung; từng W thêm vào cùng PR của mục chứa nó.
- **R-X.3** `[r4·sửa]` Một bảng đường đi cho "ADM không có / giao thiếu" (trả lời PM B3):

| Lúc | Tình huống | Đường duy nhất |
|---|---|---|
| Sau khóa, trước/sau gửi ADM | HC thấy một người xin quá/không hợp lý | Giảm ở Tổng hợp (D6), lý do theo dòng |
| Sau gửi ADM, ADM báo **không có** món X cả kỳ | Mọi người chờ X | Đánh "ADM hết hàng" ở Hàng về (R-D11.12) → giao từ tủ theo đăng ký trước, hủy phần thiếu (R-D11.13, Đ37) → ai chưa đến: tự hủy lúc khóa kỳ sau (R-D11.19) |
| ADM giao thiếu, hứa giao bù | Người chờ phần thiếu | Không đặt lại (R-D13.9); hàng bù nhập ở "Về bù kỳ trước" (R-D11.20); ADM thôi giao → "ADM không giao nữa" |
| Người nghỉ còn phần chờ | — | Không vào đề nghị (R-D13.11); Tháng này nhắc; giảm "Người đã nghỉ" / Hủy nợ "Đã nghỉ việc" |
| Hàng về **thiếu** | ADM giao ít hơn bản in | Nhập số thật; giao chia theo đăng ký trước (R-D7.9); phần thiếu ở **Chưa nhận**, thành nợ khi kỳ sau khóa (R-D14.1) |
| Chưa nhận tháng đang giao, không giao nữa | — | Giảm ở Tổng hợp (D6) với lý do; **không** Hủy nợ (R-D14.4) |
| Nợ tháng trước, không mua nữa | Còn nợ | Hủy nợ qua ⋯ với lý do có sẵn (R-D14.5, R-D14.6) |
| Dòng ngoài DM đã chấp nhận, ADM không mua được | — | Giảm về 0, lý do "ADM không còn hàng" (D6; R-D6.5 cho mọi trạng thái duyệt) |

| # | Quy tắc | Tiêu chí | Tầng |
|---|---|---|---|
| X1 | R-X.1 | Bản chốt T: bản ghi điều chỉnh lúc T+1 ms → cảnh báo; lúc T → không; lúc T−1 ms → không; `requests.updated_at` T+1 ms → cảnh báo | API + Vitest |
| X2 | R-X.2 | Mỗi PR của plan theo thứ tự này chạy đủ test xanh (ghi trong plan) | Quy trình |
| X3 | R-X.3 | Bảng có trong `docs/prd.md` (FR-35 mục ghi chú) sau khi triển khai | Vitest (quét file) |

## Q. Vai trò và quyền

| Hành động | Member | Admin | SA cục bộ |
|---|---|---|---|
| Sửa món, ngừng món/nhóm (D1, D2, D12) | — | ✓ | ✓ |
| Thấy nội dung phiếu kỳ đang mở (D8) | Của mình | ✗ (409/lọc) | ✗; Nhật ký thấy hết |
| Xem tiến độ đăng ký kỳ mở (x/N, tên chưa đăng ký, Chép DS) | — | ✓ (Tháng này, sidebar) | ✓ |
| Xem/duyệt dòng ngoài DM sau khóa | — | ✓ | ✓ |
| Giảm/bỏ dòng có lý do (D6) | — (tự sửa phiếu mình khi kỳ mở, không lý do, không bản ghi) | ✓ chỉ kỳ khóa | ✓ chỉ kỳ khóa |
| Tăng số / thêm món vào phiếu người khác sau khóa | — | ✗ (Đ12) | ✗ |
| Tạo phiếu hộ | — | ✗ (D10) | ✗ |
| Nhận chuông `line_adjusted` | Chủ phiếu (đang làm việc) | ✗ | ✗ |
| Đọc bản ghi điều chỉnh | Của mình | Mọi phiếu kỳ khóa | Như admin |
| Đánh/bỏ "ADM hết hàng", "Đủ hàng" (D11) | — | ✓ | ✓ |
| Giao qua hộp, hủy ADM hết hàng (D7, D11) | — | ✓ | ✓ |
| In trình ký, Làm bản mới (D5) | — | ✓ | ✓ |
| Hủy nợ (chỉ nợ tháng trước, D14) | — | ✓ | ✓ |
| "Tháng này không cần đề nghị ADM" và bỏ cờ (R-D5.21) | — | ✓ | ✓ |
| Về bù kỳ trước, "ADM không giao nữa", "Đã về" món ngoài DM (R-D11.20–11.21) | — | ✓ | ✓ |
| Tự hủy ADM hết hàng lúc khóa sổ (R-D11.19) | — | — (hệ thống) | — |
| Xem bản đã gửi `GET …/sent` (D5) | — | ✓ | ✓ |
| Xem tiến độ đăng ký ở trang Nhân viên (R-D8.18) | — | ✓ | ✓ |

Mọi endpoint mới/đổi giữ `@Roles('admin','sa')` cho `/admin/*`, CSRF cho mọi ghi, throttle hiện có. Member gọi `/admin/*` → 403.

| # | Tiêu chí | Tầng |
|---|---|---|
| Q1 | Member gọi mọi endpoint mới (`arrivals-plan`, `adm-out` PUT/DELETE, `reports/:ym/sent`, `no-order`, `adm-owed-closed`, `items/:id/pending-arrival`, nhập `custom_receipts`) → 403; thiếu CSRF ở mọi POST/PUT/DELETE mới và `cancel-remaining` → 403 | API |

---

## R. Mục review bị bác (kèm lý do)

| Nguồn | Mục | Lý do bác |
|---|---|---|
| PM, chữ | Đổi "Trùng với phiếu khác" → "Trùng với đề nghị khác", "ADM" → "Công ty (ADM)" | Nhãn lý do do chủ dự án chốt nguyên văn ở Đ2 |
| UX P4 | Rút "Trùng với phiếu khác" thành "Trùng phiếu khác" | Như trên (Đ2) |
| PM, chữ | Đổi hàng loạt thuật ngữ "Kỳ", "bản chốt", "In trình ký", "Giao bổ sung", "Hủy nợ" | Thuật ngữ đã dùng khắp app và tài liệu; đổi diện rộng ngoài phạm vi v2-D. Nhận phần câu khóa sổ (R-D8.11) và câu "không hoàn tác" (R-D7.11) |
| PM | Chuông "giao một phần" cho nhân viên | Tính năng mới, chủ dự án không yêu cầu; để vòng sau |
| PM | Chuông nhắc HC ngày 12 nếu chưa có bản chốt | Tính năng mới, ngoài phạm vi |
| PM | Cho HC có phiếu riêng | Đã quyết 2026-10-30 (HC không đăng ký VPP) |
| PM | Gộp chuông theo 30 phút | Đ14 chốt gộp theo ngày |
| PM | Mã lý do "Món ngừng cung cấp" | ADM không có hàng đã có đường riêng (R-D11.12) và mã `adm_out_of_stock`; Đ2 cố định danh sách, Đ26 chỉ thêm "Người đã nghỉ" theo yêu cầu |
| Architect S8 | Endpoint giao gộp một round-trip | Tùy chọn; giao từng dòng có `expected_delivered_qty` đã an toàn, chế độ kết quả ✓/✗ đủ; thêm endpoint làm tăng phạm vi |
| Architect S6 / QA | Khóa nhóm khi gán `sort_order` để không trùng | Trùng số vô hại (tên rồi `id` phân hòa); nhóm NULL không có dòng để khóa |
| Architect B1 (phương án giữ FK) | FK + map lỗi + item-usage xét bảng điều chỉnh | Chọn phương án không FK (giống `audit_log`) — đơn giản hơn và đủ |
| UX | Danh mục: chặn thẻ 260 px | Nhận (R-D1.3); không bác |
| QA | AC "kỳ 2026-12 deadline 11/01 năm sau" | Theo cấu hình hiện tại kỳ M khóa trong tháng M; thay bằng ca qua năm 2027-01 và `registration_last_day = 5` (D8 #3) |
| QA | Đếm ghi chú theo UTF-16 | Chọn mã điểm Unicode sau NFC, khớp `char_length` của Postgres (R-D6.1) |
| Architect, câu hỏi | Bỏ hết dòng thì xóa phiếu (BR-12) | Đ18 chốt giữ phiếu rỗng |
| QA, câu hỏi 3 | Chặn giao món đã ngừng | Quyết định kỹ thuật: vẫn giảm/giao được (R-D6.21, R-D12.6); chặn sẽ để nợ treo vô thời hạn |
| Đ23 (tùy chọn spec) | "ADM hết hàng cả nhóm" | Hiếm (ADM hiếm khi hết cả nhóm), là thao tác ghi server dẫn tới hủy hàng loạt dòng khi giao — bấm nhầm khó gỡ; từng món chỉ vài cú bấm. Giữ "Về đủ cả nhóm" vì chỉ đổi nháp, gỡ được trước khi Lưu |

| Rà soát C5 (Thấp) | Chữ hạn "Hạn đăng ký: hết ngày 10/11 (23:59)" | Giữ `lockPhrase` "00:00 ngày 11/11" (R-D8.11): khớp đúng mốc máy khóa, tránh hiểu nhầm 23:59–00:00; một cách nói duy nhất ở mọi nơi |
| Rà soát (luồng một chạm) | Enter trong hộp giao = Xác nhận ngay khi mở | Giữ R-D7.7 (focus tiêu đề, Enter trong stepper không gửi): Đ3 cần một bước kiểm có chủ ý; bù lại sau giao focus về ô tìm (R-D7.6) để luồng vẫn nhanh |
| Rà soát (Tủ/Kho) | Gom "Nhập mua" vào Hàng về | Đ31 chốt giữ ở ⋯ với tên "Nhập ngoài kỳ (tự mua lẻ)" — hàng tự mua không thuộc bản in |
| Rà soát #8 | Ẩn hẳn món tồn 0 không ai cần khỏi Tủ/Kho | Vẫn cần thấy để Kiểm kê; xám "Không có" và lọc riêng là đủ (R-D15.3–R-D15.4) |
| Hạ tầng | DB riêng `vpp_e2e` cho PW (đề xuất vòng 3) | Đ35: giữ DB dev chung; thay bằng dữ liệu "PW …" tự tạo (R-D9.5) và đường dọn R-D9.7 |
| Kịch bản #31, #35 | Chữ cảnh báo Xuất lẻ và người nghỉ của kịch bản | Thay bằng chữ nguyên văn của chủ dự án Đ43 ("Phần này đang giữ cho n người chờ nhận" + "Vẫn xuất") và Đ41 ("n người đã nghỉ còn phần chưa nhận"); ý giữ nguyên |
| GAP-10 | Còn nợ thành tab của Giao hàng | Chọn đưa Còn nợ vào nhóm "Hằng tháng" ngay sau Giao hàng (R-D1.11): giữ route `/admin/backlog` và mọi liên kết, cùng hiệu quả "không bị giấu" |
| GAP-06 | Còn nợ "gợi ý" Hủy nợ người nghỉ bằng nút riêng | Đủ bằng lọc `?left=1` + lý do chọn sẵn (R-D13.11); thêm nút riêng là trùng đường |
| Rà soát #10 (Vừa) | "Nhóm món bấm không có gì" | Không bác — đã là R-D12.1 (Đ22); ghi lại để đủ danh sách |

---

## T. Ma trận test tổng

| Quy tắc | Tầng | Ca chính (cả hai phía mốc) |
|---|---|---|
| D1.1–1.4, 1.9, 1.10 | PW + Vitest | 1280/390/1920 × mọi route; 767 vs 768; nền mờ phủ sidebar; reduced-motion; thứ tự lớp; tiêu đề dính |
| D1.5–1.8 | Vitest + PW | F5/Back `?item=`; id lạ/rác; ↑/↓ đầu/cuối; bẩn + ↑/↓/Esc/nền/Back; focus trả; giao thành công đóng panel |
| D2.3/2.5 | API + Vitest | Cùng dãy ở 6 bề mặt + comparator; nhóm rỗng/NULL/đổi nhóm; trùng số → tên → id |
| D2.4 | DB | 50 / 49 / 51 dòng; audit 1 dòng có `before` |
| D3 | Vitest + PW | rỗng/lỗi/tải; có/không kỳ mở; TZ LA/Kiritimati; vi/en; ảnh chuẩn |
| D4 | PW + Vitest | ma trận biến thể × 5 trạng thái × shell × nền; ngưỡng 4.5/3/1.15; axe 390 |
| D5.1–5.5, 5.10 | PW + Vitest | 1 print, 0 tab; `thead` lặp; dọn khi không `afterprint`; ảnh treo 3 s; bị chặn 1 s |
| D5.6–5.9, 5.11 | Vitest + API | `from` hợp lệ/thiếu/rác; dùng lại khi không đổi / mới khi đổi / khác `kind`; `ORDER_EMPTY` tổng 0 vs 1 |
| D5.13–5.18 | API + Vitest + PW | Đã gửi/Lập phiếu; Làm bản mới xác nhận; số chỉ đọc + Sửa số; Báo cáo chỉ đọc; bản rỗng cũ không thành mới nhất; trang in bản rỗng tắt In; Tháng này "Đã gửi …" |
| D6.1 | API + DB | mã thiếu/lạ; `other` 0/"   "/2/3; 200/201 mã điểm; trim; CHECK NULL |
| D6.3–6.6, 6.20 | API | 5→4/5/6; dòng mới; vắng dòng; `lines: []`; sàn 2 vs 1; thứ tự kiểm |
| D6.7–6.10 | API + DB | batch = audit id; chỉ-thêm; 1 chuông/ngày; .999 vs .000 VN; đã nghỉ 0 chuông; 5 vs 6 dòng; giảm về đã giao |
| D6.11/6.14 | Vitest | Lịch sử 3 dạng + bỏ toàn bộ; `<script>`; chuông × vi/en; khối lý do hiện/ẩn giữ nháp; "Dùng cho…" |
| D6.15–6.19 | API | kỳ mở 409 .999 / 200 .000; phiếu rỗng vẫn đã đăng ký; giảm T±1s so với bản chốt; `Promise.all` 2 HC; DTO lồng |
| D7.3–7.4, 7.9 | Vitest + API | tủ/+1, nợ/+1, 2 dòng cùng món 5/6/7, tổng 0; `ahead_qty` theo `created_at`; giữ cho người trước |
| D7.5–7.7, 7.10–7.12 | Vitest + PW | gửi đúp; lỗi từng dòng; CSRF hết giữa chừng; chỉ bàn phím, Enter giữ, Enter trong stepper; người đã nghỉ; 390 tấm đáy |
| D8.1–8.3, 8.9 | API | mọi route `by-ym`/`by-id` × {16:59:59.999Z, 17:00:00.000Z}; kỳ +1 → 400; qua năm; `registration_last_day` 5; route chưa phân loại → fail |
| D8.4/8.5, 8.14–8.16 | API + Vitest | summary kỳ mở đúng tập khóa; ảnh dòng; audit lọc trước phân trang; `ITEM_IN_USE` chữ mới; kỳ 0 phiếu |
| D8.10–8.13 | Vitest + DB | dải nhắc; không kỳ khóa; `lockPhrase` TZ; hẹn giờ deadline+1s; không retry 409; lưu sát giờ khóa |
| D9.1–9.5 | Ops + Vitest | 50 món; tồn 0; xóa demo; test không dùng dữ liệu dev |
| D10 | API + Vitest | 404 × {4 vai} × {CSRF có/không}; GET/PUT còn; phiếu cũ hiện; `exclude_admin` bị lột 200; quét mã |
| D11.1–11.5, 11.16 | Vitest + PW | tìm không dấu; chip đếm; "chưa về đủ" 9/10/11; gom nhóm; về đủ cả nhóm/bỏ; combobox |
| D11.6–11.11 | API + DB + Vitest | nguồn bản mới nhất/`kind`/`id`; dùng lại khi Hủy in; `order_qty` sửa tay; `received` nhiều đợt; backfill `receipt_ym`; giảm T±1s; món ngừng; hàng `custom:` |
| D11.12–11.15, 11.17 | API + Vitest + PW | đánh/bỏ: còn 1 dòng mở vs 0; nhập món đánh dấu 1 vs 0; hủy khi giao có/không đánh dấu, kỳ khác; "Đủ hàng" vô hiệu/không bản/đủ; bấm đúp 409 0 ghi |
| D12 | API + Vitest + PW | ngừng riêng × ngừng nhóm × bật lại; `inactive_reason`; công tắc vô hiệu khi nhóm ngừng; hoàn tác |
| D13 | API + Vitest | mặc định = gộp với tủ 0 / tủ > gộp; bản chốt cũ không đổi; Excel/in; chữ công thức; bước Tháng này |
| D3.6–3.7 | API + Vitest | `in_sent_snapshot` true/false/null; chữ 3 nút |
| D4.7–4.8 | PW + Vitest | giữ sắc hover/active; `.hm-cta` #C4EEF6; quét CSS; nút đóng "Quay lại" |
| D8.17–8.18 | API + DB + Vitest | 10/8 tái hiện → 6/8 + outside 2; bất biến; `headcount_subs`; trang Nhân viên |
| D9.5, D9.7 | Ops + Vitest | script dọn sau 0113–0116: không mồ côi, `headcount_subs` sạch, chạy lại 0 lỗi; spec chỉ ghi lên dữ liệu PW |
| D12.7 | Vitest | `/admin/units?x=1` → `/admin/categories/units?x=1` replace; một mục menu |
| D14 | API + Vitest + PW | statusOf A/B/C/D; mốc khóa .999/.000; Còn nợ chỉ < K\*; `NOT_DEBT_YET`; lý do có sẵn; ⋯; badge; quét chữ |
| D15 | API + Vitest + PW | 6 hàng biên trạng thái; badge chỉ thiếu; ⋯ Nhập ngoài kỳ; Danh mục "Tủ: n" |
| D16 | API + Vitest | thanh lọc chung; cảnh báo Cấu hình sau khi đổi; Nhật ký gộp đợt |
| D5.19–5.22 | API + Vitest | 13 chuyển trạng thái; bản thay thế có/không; cờ không đề nghị; cột Đăng ký/Đã giao |
| D8.19–8.21 | API + Vitest | câu kỳ áp dụng; tối đa hạ khi kỳ mở; NV chờ nhận mọi kỳ |
| D11.19–11.21 | API + DB + Vitest | tự hủy ở .999/.000 và chạy lại; về bù vào kỳ cũ + đóng/hoàn tác; ngoài DM đã về + trần giao |
| D13.9–13.11 | API + Vitest | `adm_owed` có/không/đóng; món ngừng mặc định 0; người nghỉ không tính |
| D15.8 | API + Vitest | xuất ≤ trống / > trống "Vẫn xuất" / > tủ chặn; kiểm kê < giữ |
| D17 | Vitest + API + PW | `diffOf` chung 12 ca; W1–W25 đúng chữ; mỗi bề mặt hai phía điều kiện |
| K | Quy trình | mọi bước B1–B34 có quy tắc tồn tại |
| R-X.1 | API + Vitest | T−1 ms / T / T+1 ms; `updated_at`; Hủy nợ / duyệt ngoài DM / ADM hết hàng sau bản |

---

## L. Làm khi tiện (mục Thấp của rà soát UX — không chặn v2-D)

1. (C3) Tiêu đề trang = đúng chữ mục menu ở mọi trang (vd "Tủ / Kho" đã làm ở R-D15.5).
2. (C4) Badge đếm trên menu và tab màu xám trung tính; chỉ đỏ khi là việc trễ.
3. (C6) Sidebar ở 1024 px: thu thành biểu tượng + tooltip, không đè nội dung.
4. Tháng này: tiêu đề "Tháng {{month}} — việc của Hành chính"; ở 390 thứ tự bước theo việc cần làm trước.
5. Hàng về: (ô ghi chú đã chuyển ở R-D11.18) — thêm placeholder ví dụ "Phiếu giao số …".
6. Còn nợ: "Tồn" → "Tủ còn" (đã làm ở R-D14.6).
7. Panel món: mã món chỉ đọc (không ô nhập), nút "Chép mã".
8. Nhóm & đơn vị: ẩn cột tên tiếng Anh khi mọi dòng trống; chú giải màu trạng thái.
9. Đơn vị tính: dòng không món nào dùng ghi "Chưa món nào dùng — xóa được"; cảnh báo thiếu tên tiếng Anh dạng chữ nhỏ thay vì đỏ.
10. Nhân viên: cột "Nhóm PMH ID" → "Quyền" (Quản trị / Nhân viên).
11. In/Báo cáo: tùy chọn "In kèm danh sách từng người" thành ô đánh dấu rõ ràng trong hộp in lại.
12. Cấu hình: chữ lịch "Khóa sổ 00:00 ngày {{d}} hằng tháng"; thanh Lưu dính đáy khi có thay đổi.
13. Nhật ký: bộ lọc áp ngay (không nút "Lọc"); chip "Việc của Hành chính".
14. Giao hàng 390: thẻ gọn một dòng tên + số món (ô tìm dính đã làm ở R-D7.13).
15. (GAP-19) Kiểm kê: nút "Xác nhận khớp" ghi audit `stock.count_ok` (không đổi tủ); sổ cái hiện "Đã kiểm, khớp".
16. (GAP-20) Chuông `issue_received` cho người nhận Xuất lẻ: "Hành chính xuất lẻ cho bạn {{qty}} {{unit}} {{name}}: {{reason}}" (người đã nghỉ không chuông).
17. (GAP-21) Giỏ kỳ mở: dòng món/nhóm đã ngừng có nhãn "Món đã ngừng — Hành chính có thể không mua. Bỏ khỏi phiếu?" (không chuông).
18. (GAP-22) Chuông `period_open`/`reminder` và hero trang NV dùng `lockPhrase` (R-D8.11) thay "23:59 ngày 10".
19. (GAP-23) Băng "Đã gửi ADM" chỉ bật sau `afterprint` hoặc tải Excel; trước đó ghi "Đã chốt bản {{hh:mm}}" (giữ Đ5: bấm là chốt).
20. (GAP-24) Tờ ADM và Excel mẫu phòng không in hàng Đề nghị 0; phụ lục vẫn có, ghi "0 — tủ đủ" (hiện tại hàng 0 vẫn in — xem biên D5).

---

## Câu hỏi cho chủ dự án

Đã chốt, không hỏi lại: Đ0a–Đ44 và "Luồng chuẩn" (Đ37–Đ44 trả lời CH1–CH8 của kịch bản chuẩn). Còn **một** câu:

1. **Khi Hành chính bấm "ADM không giao nữa" cho phần ADM còn nợ của tháng trước, người đang chờ phần đó thì sao?** Đ39 chỉ nói không đặt lại trong lúc ADM còn nợ. Spec đang làm: phần đó được **tính lại vào số đề nghị tháng sau** (người vẫn ở Còn nợ, chờ hàng của đơn mới) — R-D11.20, R-D13.9. Cách khác: hủy luôn như "ADM hết hàng" (không thành nợ, tháng sau ai cần thì đăng ký lại). **Khuyến nghị: tính lại vào đề nghị tháng sau**, vì ADM chỉ thôi giao bù chứ không hết hàng, và người chờ không phải đăng ký lại.
