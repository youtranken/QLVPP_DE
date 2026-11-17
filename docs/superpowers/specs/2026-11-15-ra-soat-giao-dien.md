# Rà soát giao diện QLVPP — báo cáo gộp (15/11/2026)

Đo trên https://dev-vpp.pmh.com.vn:8443 (bản build `5807cd1`), hai vai Nhân viên + Adm D&E, bề rộng 1280/1024/768/390/320.
Chỉ đọc: mọi request ghi bị chặn trong trình duyệt đo. Tiêu chí: phần áp được của taste-skill (một hệ thống, lề đều,
vùng chạm 44px, tương phản, focus, câu chữ) + ra-soat-ui (đo cột nhảy, FOUC, lộ dữ liệu theo vai). Luật dự án thắng gu.

- Lượt 1 (dev gần rỗng): 4 nhóm, ~25 route, ~170 trạng thái, ~400 ảnh. Lượt 2 (sau seed dữ liệu mẫu): 2 nhóm, ~70 trạng thái, ~180 ảnh.
- Thô: 92 lỗi lượt 1 (A 22 · B 21 · C 24 · D 25) + 37 lỗi mới lượt 2 (E 23 · F 14) → gộp còn **13 Hỏng, 13 nhóm Lệch dùng chung gốc, ~45 Lệch riêng màn, ~40 Gu** (mục 1–4 lượt 1, mục 7 lượt 2).
- **Đạt**: không trang nào cuộn ngang (kể cả 320); không lộ dữ liệu người khác qua API cho Nhân viên; Esc đóng mọi lớp nổi
  và trả focus; vòng focus thấy rõ; tương phản chữ đạt AA (đo điểm ảnh thật; probe báo trượt do nền gradient — đã loại);
  không còn "PMH ID / Hành chính / ADM"; FOUC trang chính CLS ≈ 0.
- Ảnh: `rasoat/<A|B|C|D>/shots/…` (đường dẫn dưới đây tính từ thư mục `rasoat/`).

## 1. Hỏng (người dùng không làm được / thấy sai rõ)

| # | Màn · bề rộng | Thấy gì | Ảnh | Sửa ở gốc |
|---|---|---|---|---|
| H1 | Báo cáo & gửi NCC · cột Đề nghị · 1024–1440 | Cụm −/+ tràn khỏi cột 19px, nút "+" đè link "N người" mọi dòng | C/shots/reports-1280-stepper-zoom.png | `report-item-table.tsx:109` cột 8.5rem < `.bc-order__box` 136px + padding |
| H2 | Báo cáo · ô Đề nghị nhập 2.5 | Báo "Tối đa 1.000" (sai lý do); dòng cao 61→72px, −/+ co lại | C/shots/reports-1280-input-edge.png | thông báo "Nhập số nguyên"; chỗ lỗi chừa sẵn |
| H3 | Đăng ký (Nhân viên) · 320–335 | Ô số lượng 17px, số "10" cắt thành "1(" | A/shots/member-req-card-qty10-320.png | ô số min-width theo số chữ số; thẻ 1 cột ở < 340 |
| H4 | Đăng ký · 320 | "Thêm vào phiếu" tràn khỏi nút 6px | A/shots/member-req-card-320.png | nút xuống dòng / chữ ngắn ở < 340 |
| H5 | Lịch sử chi tiết `/history/<ym>` rỗng · 1280 / ≤900 | 1280: hai trạng thái rỗng cạnh nhau; ≤900: không có H1, không có nút | A/shots/member-histdetail-2026-12-1280.png, -390.png | một EmptyFrame; giữ PageHeader ở mọi bề rộng |
| H6 | Giao hàng · bảng · 768 | Tên người bẻ 4 dòng, chữ vượt ô 7–14px chen cột Phòng | B/shots/delivery-table-crop-768.png | xem L1 |
| H7 | Tủ/Kho · hộp Xuất lẻ · tủ trống | Nút "Xuất lẻ một món" vẫn bật; ô chọn món mở listbox rỗng cao 10px đè nhãn, không câu giải thích | C/shots/stock-1280-xuatle-dlg-combo.png | tồn = 0 → khóa nút + lý do; listbox rỗng có câu "Tủ đang trống" |
| H8 | (dữ liệu dev) Xem tổng kết / Cấu hình ô ký | "PW Chủ quản mwdd6kdqm" — rác Playwright còn trong `signature_boxes` | C/shots/reports-1280-preview-bottom.png | test PW dọn config ở afterAll; dọn dev |

## 2. Lệch dùng chung gốc (sửa một chỗ, hết ở nhiều màn)

| # | Gốc | Màn bị | Bằng chứng | Sửa ở gốc |
|---|---|---|---|---|
| L1 | **Bảng ở 768 rộng hơn khung**: cuộn ngang không dấu, mất cột việc chính, không ghim cột đầu; tên bẻ nhiều dòng | Kỳ tháng (798/608), Giao (816/608), Báo cáo (864/608 — mất Đề nghị + Ai đăng ký), Danh mục (Tạm ngưng bị cắt), Danh bạ (864/608), Tủ/Kho (tên 2 dòng ×50) | B/shots/month12-table-actions-offscreen-768.png, C/shots/admin_reports-768.png, D/shots/shell-users-768.png | `css/m1/table.css .table-stack`: dạng thẻ theo @container ~820px hoặc ghim cột đầu + cột thao tác |
| L2 | **Control thanh công cụ không một hệ**: chip 4 cỡ (32/36/40/44), 3 kiểu; ô tìm/select hai họ (viên thuốc #eef5f7 h40 vs ô trắng viền r14 h44); spec bảo cao 40 | Kỳ, Giao, Món ngoài DM, Còn nợ, Sản phẩm, Tủ/Kho, Danh bạ, Nhật ký | B/shots/backlog-combo-1280.png, D/shots/compare-pageheader-1280.png | một component chip + một biến thể ô tìm/select (`ui/select`, `ui/toolbar`); 40px desktop, 44 điện thoại |
| L3 | **Trạng thái rỗng 4 kiểu**; Giao tìm không ra: chữ trơn, không "Xóa lọc", đầu bảng mất, số tab không đổi | Kỳ, Món ngoài DM, Còn nợ, Giao, Lịch sử | B/shots/delivery-search-miss-1280.png | `ui/empty-frame` mọi nơi; tách câu "tab rỗng" vs "không khớp" + Xóa lọc |
| L4 | **PageHeader lệch**: Kỳ tháng/Báo cáo không breadcrumb → h1 nhảy 19px khi đổi trang; 404 admin h1 20px canh giữa; member h1 x=24 (Đăng ký/Lịch sử) vs 94 (Tôi/404), cách thanh trên 4–8px | mọi trang | D/shots/compare-pageheader-1280.png, D/shots/compare-member-frame-1280.png | `ui/page-header` luôn có crumbs; NotFound bọc PageHeader; `member-page.tsx` một bề rộng |
| L5 | **Dòng đếm kết quả** mỗi trang một chỗ, nhiều trang không có; hàng "Đang lọc"/chip làm bảng tụt 23–52px | Danh bạ, Danh mục, Nhật ký, Tủ/Kho | D/shots/users-base-1280.png | `ui/list-meta` vị trí cố định, chừa chỗ sẵn |
| L6 | **Cùng việc nhiều kiểu hộp**: xem chi tiết người = hộp giữa / ngăn phải ˄˅ / ngăn phải + Quay lại; nút đóng "Quay lại"/"Hủy"/"Đóng"/"← Đóng" | Kỳ, Giao, Điều chỉnh, hộp thoại Danh mục/Tủ | B/shots/month12-xem-dialog-1280.png, delivery-xem-drawer-1280.png | một khung `.ovp`; chốt một chữ cho nút đóng (thêm luật vào wording.test.ts) |
| L7 | **Nút vô hiệu không nói vì sao** | "Lưu điều chỉnh" (spec đòi "Chưa có thay đổi"), "Giao…" (tủ 0), "Xuất lẻ" ở ngăn Lịch sử | B/shots/month12-adjust-drawer-1280.png | quy ước: vô hiệu luôn kèm lý do nhìn thấy |
| L8 | **Kiểm ô số không đúng biên** | Báo cáo 2.5 (H2); Sản phẩm sửa nhanh Tối đa = 0 không báo, −/+ đè cột Tồn; Cấu hình Hạn = 2/29/109/rỗng không báo, Lưu vẫn bật (lỗi chỉ sau khi bấm) | C/shots/catalog-1280-inline-max-0.png, D/shots/config-invalid-29-1280.png | kiểm khi đổi giá trị, lỗi gắn đúng ô, tắt Lưu |
| L9 | **Vùng chạm < 44px ở 390** | Nút trước/sau (hộp Xem phiếu, chọn năm-tháng) 36; nút ngôn ngữ trong menu trượt 36; chip Nhanh Nhật ký 36; tên người Danh bạ 18; tên món Tủ/Kho 143×18 | B/shots/month12-xem-dialog-390.png | `pointer:coarse` → 44 cho mọi nút ngoài đoạn văn |
| L10 | **Câu chữ lệch** | Nút lưu phiếu 3 nhãn (giỏ/sheet/thanh dưới); hộp xác nhận "Quay lại" thay "Quay lại sửa" (spec); `?login=failed` bảo "bấm đăng nhập" nhưng nút là "Tiếp tục"; giờ lưu 3 cách viết; "Tổng" vs "Đơn vị", "8" vs "7 món"; "phòng" vs "phòng ban" | A/shots/member-req-sheet-390.png, A/shots/login-failed-390.png | locales/vi; một formatter giờ `lib/format-time.ts` |
| L11 | **Bản tiếng Anh** | 5 nhóm `name_en = null` hiện tiếng Việt; "ống/month"; "1 people" (thiếu `who_one`); "Reports & send to suppl…" bị cắt ở sidebar | A/shots/member-req-en-390.png, D/shots/00-admin-landing-1280.png | điền name_en; en-plurals test bắt buộc `_one`; rút nhãn en/nav |
| L12 | **Tên app hai cách** | Đăng nhập/tab "QLVPP"; thanh trên, menu, khung member "VPP Công trình"; sidebar admin không có tên | D/shots/users-top-390.png | **cần chủ dự án chốt** một tên; cập nhật _SPEC |
| L13 | **Chớp khi tải** | /admin: nền trắng → xám → kem màn chờ → teal; mạng chậm chữ màn chờ là Times ~5,2s; Báo cáo CLS 0.063 | D/shots/fouc-admin-1280-fast-frames.png | nền html trong index.html = nền màn chờ = nền shell; preload font tự host |

## 3. Lệch riêng từng màn

- **Menu trượt admin 390/320**: Nhật ký/Cấu hình nằm dưới chân menu, phải cuộn riêng, Danh bạ bị cắt, không dấu còn mục (D/shots/shell-sheet-390.png).
- **Kỳ tháng**: cột nhảy tới 20px khi tìm (bảng không `table--fixed`) (B/shots/jump-month-searchHoang-1280.png); kỳ mở: ô Gửi NCC/Nhận hàng/Giao mờ opacity .65 → 2.94:1 (B/shots/admin_month_ym_2027-01-1280.png); bộ chọn kỳ cạnh h1 thay vì thanh công cụ như spec.
- **Ngăn Điều chỉnh / Xem người ở 390**: nền trắng 86% + blur trông bạc màu (B/shots/month12-adjust-drawer-3s-390.png); ngăn Xem người nói "tủ 0" ba lần, "còn chờ 5" thiếu đơn vị.
- **Hộp chọn năm-tháng 320**: rộng 314 tại x=8 → tràn 2px (B/shots/month12-period-picker-320.png); mũi tên không đi giữa tháng.
- **Đăng ký (Nhân viên)**: bật "Đã chọn 0" báo "Thử từ khóa khác" dù không gõ gì (A/shots/member-req-dachon-0-1280.png); kỳ 1/2027 ghi "tháng này", không ghi năm (A/shots/member-req-1280.png); ô mật khẩu SA không có nhãn nhìn thấy.
- **Sản phẩm**: mã bẻ giữa ("BUT-KIM-/JELLITTO-/04"), tiêu đề "Tối / đa/tháng" vỡ (C/shots/catalog-1280-table-top.png); 390 ba hàng lọc, món đầu ở y≈520 (C/shots/admin_catalog-390.png); chế độ Sắp xếp vẫn cho Sửa/Tạm ngưng.
- **Đơn vị tính**: nút "Sửa" nhảy x≈1013/1080 tùy dòng có "Xóa" (C/shots/unit-1280-base.png).
- **Báo cáo 390**: mất ⓘ "Cách tính Tổng cần"; bản xem tổng kết chữ ~5px (C/shots/reports-390-preview.png).
- **Danh bạ**: cột Mã NV 88px cắt "KIEM-Q…" mọi bề rộng; 768 mô tả đầu trang ép 150px, 5 dòng.
- **Nhật ký**: cột Người gãy "Hệ thống (tự / động)" (4 dòng ở 768); Hệ thống có avatar "H" giống người tên Hoàng (D/shots/shell-audit-768.png).
- **Nút chính**: member navy #0e2a33, admin teal #0e6a7b (D/shots/compare-member-frame-1280.png).
- **Trang Nhân viên** tự gửi `POST /api/me/request/copy-previous` khi mở; 404 để lại 4 dòng lỗi console.

## 4. Gu (đẹp hơn, không chặn việc)

Thẻ kỳ sidebar "khóa / 00:00 ngày 11/01" xuống dòng xấu; thanh dọc 1024 chỉ còn chấm "•"; thẻ "Đang dùng" bấm lại không tắt;
panel người dùng hai nút đóng; select Hành động lộ nhãn kỹ thuật (Webhook, dev); lọc ở 390 chiếm 350–420px trước dòng đầu
(nên gom vào nút Lọc mở sheet); Cấu hình hai cột lệch chiều cao; nhãn nhóm lặp trên mọi thẻ chế độ Lưới; thẻ mobile cặp
nhãn–số chảy nối đuôi; "10 / đơn vị" bẻ dòng giữa số và đơn vị (cần nbsp); thanh lọc cuộn ẩn tab ở 320 (Món ngoài DM, Giao);
Nhận hàng bỏ qua `?ym=` không báo; trang in id sai rơi vào 404 chung; ngăn Sửa món ghi "Kỳ 12" không rõ năm.

## 5. Chưa đo được (không tính là đạt)

Thiếu dữ liệu trên dev (tài khoản kiểm chưa có phiếu, tủ 0, không có món ngoài DM, không có nợ, không có bản chốt, chuông
rỗng): chi tiết Lịch sử có dữ liệu; hộp Chấp nhận/Thêm vào DM/Từ chối; bảng Nhận hàng; hộp Giao; bảng Còn nợ; trang in bản
chốt thật; Xuất lẻ có món; chuông có thông báo; Danh bạ "Tải thêm". Thao tác ghi bị cấm: Lưu phiếu, Đồng bộ ngay, Lưu cấu
hình, Xuất Excel, In trình ký. Không có command palette; "Tạo phiếu hộ" không thấy trên màn nào; hộp kiểm kê không có.
Cách phủ: seed dữ liệu mẫu cho một kỳ đủ trạng thái (như `web/playwright/p3-seed.ts`) rồi chạy lại nhóm B/C.

## 6. Chặn tái phát (đề xuất test)

- L1/H6: Playwright 768 trên Kỳ/Giao/Báo cáo/Danh bạ: bảng không rộng hơn khung hoặc cột thao tác trong viewport; chữ trong td không vượt td.
- H1: Playwright 1280: nút "+" nằm trong ô Đề nghị, không giao link "N người".
- H2/L8: vitest biên hai phía: Đề nghị 1000 được / 1001 lỗi / 2.5 "Nhập số nguyên"; Tối đa 0 lỗi / 1 được; Cấu hình hạn 3 và 28 được, 2 và 29 lỗi, Lưu tắt.
- H3/H4: Playwright 320: ô số hiện đủ "10"; nút "Thêm vào phiếu" scrollWidth ≤ clientWidth.
- H5: vitest history-detail rỗng: một trạng thái rỗng, có h1 ở mọi bề rộng.
- H7/L7: vitest: tồn 0 → nút Xuất lẻ khóa + lý do; nút vô hiệu luôn có lý do nhìn thấy.
- H8: test PW ghi config dọn ở afterAll; kiểm dev không có tiền tố "PW ".
- L2/L4/L5: một spec "nhất quán hệ" lướt mọi route admin ở 1280/390: chip cùng cao, ô tìm/select cùng radius/height, h1 cùng top ±2px, ListMeta cùng vị trí.
- L3: vitest people-table: không khớp → câu riêng + "Xóa lọc".
- L9: Playwright 390: mọi button trong dialog/menu trượt ≥ 44×44.
- L10/L11: wording.test.ts thêm "Quay lại sửa", một nhãn nút lưu; en-plurals bắt buộc `_one`; test name_en không null cho nhóm đang dùng.
- L13: fouc.mjs trong CI: nền khung đầu = nền shell; font không phải Times.
- Kỳ tháng: thead th lệch ≤ 2px giữa không tìm và có tìm.

## 7. Lượt 2 — đo lại khi có dữ liệu mẫu (E: Nhân viên + kỳ/giao/nhận/nợ/duyệt; F: báo cáo/in/tủ/sản phẩm)

Dữ liệu mẫu: 8 người `mau-*`; kỳ 11 khóa, giao gần hết, còn nợ, 2 món ngoài DM chờ duyệt; kỳ 12 đã gửi NCC (bản Excel 18:30 + bản in 18:31), nhận một phần, giao một phần; kỳ 1/2027 mở, có phiếu đã lưu (cả tài khoản NV kiểm); tủ ~25 món có hàng; chuông có thông báo. Gỡ: `scratchpad/seed/cleanup.sql`.
Xác nhận lại nặng hơn khi có dữ liệu: **L1** (bảng tràn khung không chỉ ở 768 — Kỳ tháng 11 tràn cả 1280/1024, nút "Điều chỉnh" cắt còn "Điều chỉ"), **H1**, **L5**, **L9**; cột Kỳ tháng nhảy tới 99px (1280) khi đổi kỳ, 65px khi bấm chip.

### Hỏng mới
| # | Màn | Thấy gì | Ảnh | Sửa ở gốc |
|---|---|---|---|---|
| H9 | Trang in bản chốt + (có thể) Excel A1 | Tờ in kỳ 12 ghi "Thay thế bản in lúc 18:30 15/11" nhưng 18:30 là bản **Excel**, không có bản in nào trước — câu sai trên giấy gửi NCC (đã tự xem ảnh xác nhận) | F/shots/print-1280-top.png, print-A4-page-1.png | lấy "bản trước" theo cùng `kind`; kiểm thêm ô A1 Excel |
| H10 | Nhận hàng | "Nhận đủ hàng (N nhóm)", "Nhận đủ hàng" từng nhóm, "NCC hết hàng" ghi kho **ngay khi bấm**, không hộp xác nhận, không hoàn tác; vẫn ghi "đủ" khi đã gõ số thiếu (Giao hàng thì có hộp xác nhận) | E/shots/admin-arrivals-checkgroup-1280.png | hộp xác nhận hoặc nút Hoàn tác như Giao; nút đổi nhãn theo số đã gõ |
| H11 | Kỳ tháng → hộp Xem phiếu | Món ngoài DM **đã chấp nhận** vẫn hiện "chờ phê duyệt" | E/shots/admin-month12-xem-Huỳnh-1280.png | `features/summary/registration-dialog.tsx:37` bỏ qua `review_status` |
| H12 | Tủ/Kho · hộp Xuất lẻ (từ dòng và "Xuất lẻ một món") | Gõ 21 khi tồn 20, 0 hay 2.5: không báo lỗi, dòng "Tồn sau khi lưu" biến mất, nút Xuất vẫn bật | F/shots/stock-1280-xl-ghidia-qty21.png | kiểm biên tại ô, khóa nút; e2e chứng minh server chặn |
| H13 | Tủ/Kho · hộp Nhập ngoài kỳ | Nhận 0, 2.5, 100000 không báo; "Lưu nhập mua" vẫn bật (DTO tối đa 99.999) | F/shots/stock-1280-nhap-ghidia.png | như H12 — gộp vào L8 |

### Lệch mới (gộp)
- **Trạng thái một phiếu có 4 tên** (NV): "Còn chờ 3 món" / "Đang giao · đã nhận 0/3 món" / "đã chốt" / admin "Chưa nhận" — "0/3 món" trong khi đã nhận 4/9 đơn vị. Bảng Giao: cùng dòng "Chưa nhận" và "Đã giao 4/9"; cột "Đơn vị" thật ra là số còn phải giao. (E/shots/member-history_2026-12-1280.png, admin-admin_delivery_ym_2026-12-1280.png) → một bộ nhãn trạng thái chung + một cách đếm (đơn vị).
- **Đăng ký khi đã lưu phiếu**: giỏ bảo "Bấm Sửa phiếu để thêm, bớt" nhưng stepper trên thẻ vẫn sửa được; 390 thanh dưới "Lưu phiếu" vô hiệu không lý do, 1280 là "Sửa phiếu"; đang sửa thì hero "Đã lưu 18:32" mà giỏ "Chưa lưu"; 320 cắt "Chưa lưu". (E/shots/member-saved-plus-card-1280.png, member-edited-bar-320.png)
- **Giao hàng khi chọn dòng**: ô tìm co 420→235px, tab nhảy 185px (1280); bảng tụt 52px (1024) / 80px (390). (E/shots/admin-delivery-select1-1280.png) — cùng gốc L5.
- **Nhận hàng**: cột "Còn thiếu" luôn "—" trong khi Tình trạng ghi "Thiếu 6"; 1024 tràn 40px; 390 trang dài 10.143px.
- **Báo cáo kỳ chưa gửi**: Xuất Excel / Xem tổng kết khóa, cột Đề nghị mất −/+, không câu lý do (L7); link món chờ chỉ chữ "Xem" 29×19px ở 390. Kỳ đã gửi: "có 5 món đổi sau bản này" là chữ xám không bấm lọc được, 5 nhãn "Đổi sau bản in" không nói đổi gì; ở 1024 nút xuống hàng làm bảng tụt 56px; "15/11 ·có" dính chữ.
- **Bảng "Các bản đã in / xuất" ở 390/320** rộng 500px trong khung 310px: "In lại"/"Tải lại" ngoài màn (L1).
- **Mức đặt lại** có trong API nhưng không màn nào hiện; bảng Sản phẩm hiện tồn 4 (dưới mức 6), 0 và 20 giống hệt nhau.
- **Ô chọn món "Xuất lẻ một món"**: danh sách 33 món không có ô tìm, không hiện tồn; gõ "Băng" nhảy tới "Bút bi"; chọn xong ô tụt 32px.
- **Câu chữ**: số tồn có 4–5 tên (Trong tủ / Tồn kho / Tủ: / Tủ hiện có / Tồn hiện tại); nút Món ngoài DM "Mua lần này / Mua và thêm vào danh mục / Không mua" khác tên tab và _SPEC ("Chấp nhận / Thêm vào danh mục / Từ chối"); thông báo ghi "bị xóa" trong khi mọi màn ghi "Người đã nghỉ"; sidebar cắt "Món ngoài danh m…" khi đang chọn.
- **Chuông admin** chỉ chấm đỏ, không số; "Đánh dấu đã đọc tất cả" cao 27px ở 390 (L9).
- **Kỳ tháng 12 thẻ "Đăng ký" 4/9** khác bảng (12 người) và chuông (12/13) — một phần do seed thêm người sau khi khóa; cần xác nhận số lúc khóa có phải ý đồ spec không.

### Lưu ý đo lượt 2
- Bộ đo nhóm E chặn được "Nhận đủ hàng" nhưng **một lệnh "NCC hết hàng" lọt tới server** (11:46, kỳ 12, một món). Đã gỡ bằng `DELETE /api/admin/periods/2026-12/adm-out/<key>` (nhật ký `arrival.adm_out_unmarked`), không có thông báo nào phát ra. Chính H10 là lý do: một chạm là ghi.
- Trang Đăng ký tự gửi `POST /api/me/request/copy-previous` mỗi lần mở (khi 404 để lại lỗi console).
- Vài chỗ trông sai do seed của tôi, đã sửa sau khi đo: giờ giao kỳ 11 nằm ở tương lai; hai thông báo dựng tay không khớp dữ liệu (đã xóa). "Kỳ 11 chưa gửi NCC mà đã giao" là do seed, không phải lỗi app.
- Vẫn chưa đo: bảng Xuất lẻ có dòng, món bị hủy phần còn chờ trong Lịch sử, "Chép lại danh sách", "Giao N phiếu" hàng loạt, hộp Giao bổ sung / Hủy nợ, món ngoài DM có ảnh, và mọi lỗi chỉ hiện sau khi bấm Lưu/Xuất.

### Chặn tái phát (thêm)
- H9: e2e snapshots — tạo xlsx rồi print: bản in không ghi "Thay thế bản in"; tạo print hai lần: bản sau ghi đúng giờ bản in trước.
- H10: Playwright arrivals — bấm "Nhận đủ hàng" mở hộp xác nhận, Hủy thì không có POST receipts.
- H11: vitest registration-dialog — dòng custom `accepted` không hiện "chờ phê duyệt".
- H12/H13: vitest biên hai phía (tồn 20: 20 được / 21 lỗi; 0 lỗi; 2.5 lỗi; 99.999 được / 100.000 lỗi) + e2e mã lỗi server cùng biên.
- L1 mở rộng: Playwright mọi bảng admin ở 1280/1024/768 — `scrollWidth ≤ clientWidth` hoặc cột thao tác trong khung.
- Nhãn trạng thái: unit test một hàm `requestStatusLabel` dùng chung cho NV, Kỳ tháng, Giao.

## 8. Sau khi sửa (17/11/2026, nhánh feat/giao-dien-a)

Đo lại trên bản build (`vite preview`, dev-identity, mọi request ghi bị chặn) bằng 5 phép đo ra-soat-ui, hai nhóm song song: Nhân viên + đăng nhập (7 route + 4 trạng thái × 5 bề rộng, 8 trạng thái lọc, 9 lớp nổi), Adm D&E (21 route × 5 bề rộng, 72 trạng thái, 24 lớp nổi).

**Lộ dữ liệu theo vai:** sạch — 18 họ tên + mọi email người khác, 0 trúng trên 46 phản hồi API của Nhân viên; endpoint admin trả 403.

| Nhóm | Lỗi cũ đã hết | Hết một phần | Còn | Không đo được |
|---|---|---|---|---|
| Nhân viên + đăng nhập (28) | 15 | — | 12 | 1 |
| Adm D&E (62) | 25 | 10 | 21 | 6 |

- Đã hết đáng kể: H1, H2, H3, H4, H5, H10, H11, H12; L4 (tiêu đề cùng chỗ mọi route); "Quay lại sửa"; tên app thống nhất QLVPP; năm trên tiêu đề; trạng thái đã lưu/đang sửa.
- Còn: H9 (bản in ghi "Thay thế bản in lúc …" trỏ nhầm bản Excel); L1 bảng rộng hơn khung ở 768 (12 trang) / 1024 (5 trang); L5 dòng đếm kết quả mỗi trang một chỗ; L13 chớp nền khi tải (kem → teal, CLS `/admin` ≈ 0.06); bản EN tên nhóm/đơn vị tiếng Việt; 3 kiểu viết giờ; "món" / "loại món"; POST copy-previous tự gửi khi mở Đăng ký; menu trượt 390/320 che Nhật ký/Cấu hình; vùng chạm < 44 ở vài nút (L9).
- Lỗi mới do nhánh, **đã sửa** (5aabf81): menu ⋯ Giao hàng bị dòng dưới đè (1280/1024); Tủ/Kho 768 cuộn ngang cả trang 32px. Chặn tái phát: `table-fit.spec.ts`.
- Lỗi mới chưa sửa (Lệch): Giao hàng ô chọn bị khóa ghi lý do "tủ chưa có hàng" cho người đã nghỉ và chỉ ở tooltip; Sửa món ô "Tối đa mỗi tháng" nhận 0/1000/2.5 không báo; Nhập ngoài kỳ nhận 100000; header ngăn phải không đệm trên; Sản phẩm/Bảng "Thu tất cả" che chip, "Tạm ngưng" bị cột dính cắt ở 1024; Tủ/Kho "Còn N" cạnh "Trong tủ" không giải thích; Kỳ tháng 390 dòng người đầu dưới đáy màn; Đăng ký 1024 chọn "Hay dùng trước" làm lưới tụt 52px; nút 32–40px ở sheet "Tôi"/hộp "Rời trang" (390).
- Không đo được: bản EN (đổi ngôn ngữ phải ghi server), xem tổng kết (POST), Tủ trống, chuông có thông báo, duyệt món ngoài DM (thiếu dữ liệu), nhãn ô mật khẩu SA (đọc code: `login-screen.tsx` chỉ có `aria-label`).
- Dữ liệu dev còn rác Playwright ("PW kho …", "PW Nhân viên …") hiện ở danh mục Nhân viên và Danh bạ.
