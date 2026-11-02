# Tinh chỉnh UX phần Hành chính (2026-11-02)

Nguồn: rà UX của chuyên gia trên ảnh live 1280 + 390 (ảnh "trước" ở scratchpad `live-real/ux/`). Chủ dự án chốt: **xử lý hết đề xuất**; cột "Thứ tự" làm theo kiểu **nút "Sắp xếp" riêng**, mũi tên ▲▼ **xếp dọc trong một cột** (không tách hai cột trái/phải). Chỉ đổi giao diện và câu chữ, không đổi luật nghiệp vụ/API. Trang Nhân viên để dành cho đợt "Mẫu 1".

Nhánh: tiếp tục `feat/giao-dien-hanh-chinh`. Mỗi task: TDD cho mọi hành vi người dùng thấy (vitest + Testing Library), i18n vi + en cùng commit, file ≤ 400 dòng, component ≤ 250 dòng, `git add <path>` cụ thể (không `git add -A`, không `git stash`), commit tiếng Việt. Mỗi task tự chụp ảnh 1280 + 390 các trang mình chạm qua dev proxy và NHÌN trước khi báo xong.

## Luật bố cục chung (áp cho mọi trang Hành chính)

1. Đầu trang (`PageHeader`): đường dẫn · tiêu đề · mô tả **một dòng** bên trái; bên phải tối đa 1 nút chính + 1 nút phụ. Không đặt bộ chọn kỳ hay nút chuyển chế độ xem ở đây.
2. Hàng ô số liệu (nếu có): mỗi ô một số chính khớp tiêu đề; màu cảnh báo chỉ khi số đó > 0; không đặt cài đặt (vd "Đồng bộ tự động 60 phút") thành ô số liệu. 390 px: lưới 2×2 cố định, chữ phụ một dòng (cắt bằng dấu …), không cuộn ngang.
3. Thanh công cụ `.toolbar`: tìm · lọc · chuyển chế độ xem · **bộ chọn kỳ** (luôn ở đây, cùng một component `MonthSwitcher`). Mọi điều khiển cao 40 px, cùng bo góc; ô chọn dùng `ui/select` mới thay `<select>` trần.
4. Nội dung. Khoảng hở: 24 px giữa các khối lớn, 16 px trong một khối, 12 px giữa các ô lưới; đệm thẻ 16 px (form 20 px).
5. `.shell__main` giới hạn `max-width: 1280px; margin-inline: auto`; bảng danh sách ngắn (Đơn vị tính, Nhóm món) tối đa 960 px; cột số co theo nội dung, không xuống dòng.
6. Chữ chỉ dùng thang token `--t-*` (5 cỡ: 12/13/14/18/28 — map lại token nếu cần), khoảng cách chỉ `--s-*`. Thêm script kiểm (`web/scripts/check-css-scale.mjs`, chạy trong `npm run lint`) chặn `font-size` px lẻ `.5` và `gap/padding/margin` px ngoài thang trong `web/src/css/**`.
7. Nút đang tắt: nhìn rõ là tắt (opacity .5, không đổ bóng) và có `title`/chữ phụ nói lý do; nút Lưu chưa có thay đổi ghi "Chưa có thay đổi".
8. 390 px: thanh trên không lặp tiêu đề trang (hiện tên app hoặc ngữ cảnh kỳ); nút chính rộng hết hàng; nút phụ ít dùng vào menu ⋯; ô tìm + chuyển chế độ xem chung một hàng.

## Task

### T1 — Nền: thang chữ/khoảng cách, bề ngang, nút tắt, script kiểm
`web/src/css/**`, `tokens-m1.css`, `web/scripts/check-css-scale.mjs` (+ test), `package.json` lint. Luật 4–7. RED: test script kiểm bắt được `font-size: 12.5px` và `gap: 10px`; GREEN khi CSS sạch.

### T2 — Khung trang: PageHeader, `.toolbar`, `ui/select`, ô số liệu, thanh trên 390
`ui/page-header.tsx`, `ui/select.tsx` (mới, + test), `ui/stat-card.tsx`/`stat-row.tsx`, `css/m1/base.css`, `css/m1/shell.css`, shell topbar. Luật 1–3, 8. Chưa sửa từng trang (T4–T6 áp dụng).

### T3 — Chế độ "Sắp xếp" dùng chung
Component `ui/reorder-*` (không thêm dependency): bình thường bảng **không có cột Thứ tự**; nút "Sắp xếp" ở thanh công cụ bật chế độ sắp xếp: mỗi dòng có tay nắm ⋮⋮ (kéo thả HTML5 trên desktop) + **một cột ▲▼ xếp dọc** (bàn phím/điện thoại, có aria-label "Đưa {{name}} lên/xuống"), thanh dưới "Hủy" / "Lưu thứ tự" (giữ cơ chế lưu lô + `dirty` hiện có). Áp cho Đơn vị tính và Nhóm món; rà mọi chỗ còn "Thứ tự" (danh mục, form món `sortOrder`) cho nhất quán, báo lại chỗ nào giữ và vì sao. Test: chưa bật → không có nút ▲▼; bật → có; ▲ dòng đầu và ▼ dòng cuối bị tắt (biên); Hủy trả thứ tự cũ; Lưu gửi đúng thứ tự.

### T4 — Trang Hằng tháng
- **Tổng hợp kỳ**: ẩn đầu bảng khi trống; "Sao chép danh sách chưa đăng ký (1)" → "Chép DS chưa đăng ký (1)" (390: vào ⋯); ô 1 chữ phụ "còn N người chưa đăng ký"; ô "Món sắp hết" mâu thuẫn → số chính khớp tiêu đề (vd "Hết hàng 169" khi có, cảnh báo chỉ khi > 0); 390: "Tạo phiếu hộ" rộng hết hàng.
- **Món ngoài danh mục**: kỳ bằng `MonthSwitcher` (giữ lựa chọn "Mọi kỳ" dạng nút/segmented trong toolbar); ghi chú dưới tab → "Chấp nhận: mua riêng lần này · Thêm vào danh mục: ai cũng đặt được từ kỳ sau".
- **Giao hàng**: trạng thái kỳ chỉ hiện một lần (bỏ chip trong banner, banner còn "0/2 phiếu đã giao đủ · 4 món thiếu kho"); cột Món `min-width` đủ để "Bút bi xanh" không gãy, cột Thực giao co lại; thẻ "Kỳ tháng 11 đang mở" ở sidebar không gây nhầm khi đang xem tháng 10 (ghi rõ "kỳ đăng ký hiện tại").
- **Còn nợ**: nút "Theo món/Theo người" xuống toolbar; nút "Giao bổ sung" tắt nhìn rõ; 390 "Còn nợ còn 2 cuộn" → "Còn 2 cuộn / đặt 2".

### T5 — Báo cáo, Kho, Danh mục, Nhóm món
- **Báo cáo & in**: mô tả → "Số cần mua trong tháng, xuất Excel và in giấy trình ký."; câu về bản chốt chuyển xuống mục "Bản chốt"; kỳ vào toolbar; các phần cách đều 32 px; "Cách tính Cần mua" thành nút (i) ở đầu cột Cần mua (popover, bấm được trên điện thoại — không chỉ hover); bản in giữ nguyên.
- **Kho**: ô tìm rộng bằng 2 ô số liệu, thẳng lưới; "Nhập mua" mỗi dòng gọn lại (nút ghost nhỏ ở 1280, vào menu ⋯ ở 390 — không ẩn chỉ-khi-hover).
- **Danh mục**: đầu bảng chỉ hiện khi có nhóm mở; "+ Thêm món vào nhóm" lặp mỗi nhóm → gọn (icon + có aria-label/tooltip, hoặc một nút đầu trang chọn nhóm); dải màu nhóm nhạt hơn (nền `--gN-bg` nhạt, chữ `--gN-ink`), giữ tương phản axe.
- **Nhóm món**: bỏ nút "Về Danh mục" (trùng đường dẫn); ghi chú → "Màu đi theo thứ tự nhóm; từ nhóm thứ 8 thì lặp lại."; áp chế độ Sắp xếp T3.

### T6 — Đơn vị tính, Danh bạ, Cấu hình, Nhật ký
- **Đơn vị tính**: nút "Thêm đơn vị tính" lên góc phải đầu trang; bảng ≤ 960 px; chip chỉ cho đơn vị "Đã ngừng" (bỏ chip "Đang dùng" lặp); mô tả → "Danh sách đơn vị để chọn khi thêm món hoặc ghi Món khác."; 390 thẻ dòng: tên + tên tiếng Anh → số món → ⋯.
- **Danh bạ**: bỏ ô số liệu "Đồng bộ tự động" → dòng chữ nhỏ cạnh "Đồng bộ ngay": "Tự động mỗi 60 phút"; ô phòng ban dùng `ui/select`; 390 thẻ dòng lưới 2 cột nhãn/giá trị 12 px.
- **Cấu hình**: nhãn ngắn "Hạn đăng ký (ngày)", "Nhắc trước (ngày)", "Tối đa mỗi món", gợi ý một dòng; bỏ khối "Lưu thế nào", thay một dòng dưới mỗi nút Lưu; nút Lưu chưa sửa ghi "Chưa có thay đổi"; tận dụng bề ngang (2 cột ở ≥ 1100 px nếu hợp).
- **Nhật ký**: ô ngày hiển thị dd/mm/yyyy (component ngày riêng, không phụ thuộc locale trình duyệt); mã kỹ thuật (`auth.login`) và mã định danh chỉ trong ngăn chi tiết, bảng hiện nhãn tiếng Việt; cả dòng bấm được (bàn phím Enter/Space, role phù hợp), bỏ nút "Xem".

### T7 — Tài liệu, kiểm cuối
`design-preview/_SPEC.md` thêm mục "Thay đổi sau review UX (2026-11-02)" ghi luật bố cục + chế độ Sắp xếp; `docs/map.md` cho component mới; cập nhật Playwright bị đổi nhãn/nút. Sau đó: api không đổi nên chỉ chạy web `npm test`/`lint`/`build`, madge; dựng lại dev; Playwright cả bộ 1280 + 390 + axe; review toàn đợt (Opus) + một đợt sửa + re-review (Sonnet); chụp ảnh "sau" cùng bộ trang với "trước" để chủ dự án so.
