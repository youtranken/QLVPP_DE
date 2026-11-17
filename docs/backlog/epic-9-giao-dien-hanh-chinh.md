# Epic 9 — Giao diện mới Hành chính (M1 · P3 "Navy & cát")

Nguồn: `docs/specs/2026-10-30-giao-dien-moi-hanh-chinh.md` (SPEC thắng nếu lệch). Mỗi lát một nhánh, TDD theo CLAUDE.md, Playwright 1280 + 390.

## E9-S0 Hành chính không có phiếu
Chốt chủ dự án 2026-10-30: Hành chính (`admin`, `sa`) chỉ quản lý VPP, không đăng ký cho bản thân. SPEC §1.4, §5.0.
**AC:**
1. admin/sa mở `/`, `/history`, `/history/:ym` hoặc `/me` → kết thúc ở `/admin/summary`; đăng nhập vào thẳng Tổng hợp; sidebar không có "Phiếu của tôi"; member vào `/` ở lại `/`.
2. `GET me/request`, `PUT me/request/lines`, `POST me/request/copy-previous`, `GET me/requests`, `GET me/issues` với admin/sa → 403 `FORBIDDEN_ROLE`; member như cũ.
3. Đổi `users.role` (từ `app_role`: webhook `role_changed`, refresh, sync) có hiệu lực từ request kế tiếp, không cần đăng nhập lại; `GET periods/current` của admin/sa trả `previous: null`.
4. Mẫu số Tổng hợp (`headcount`, `unregistered`), danh sách chưa đăng ký, chuông `period_open`/`reminder` và `periods.headcount` lúc khóa loại người `role = admin`; `registered` vẫn đếm mọi phiếu của kỳ.
5. `POST admin/requests` chọn người `role = admin` → 400 `USER_IS_ADMIN`, báo tại ô "Người đăng ký": "Người này là Hành chính — Hành chính không đăng ký VPP."; người thường → 201.
6. Dòng ngoài danh mục không cần ảnh (lưu không ảnh → 200; ảnh của người khác → `FILE_FORBIDDEN`); review `convert` sang món mới không có ảnh dòng và không ảnh món → 400 `IMAGE_REQUIRED`, có ảnh món → 200.
7. Phiếu cũ của người nay là Hành chính giữ nguyên (không migration, không xóa), vẫn ở Tổng hợp/Giao hàng/Còn nợ/Báo cáo; điều chỉnh, giao, hủy nợ, review vẫn làm được.
Playwright: `E9-S0 Hành chính không có phiếu: đăng nhập vào thẳng Tổng hợp, mở / bị đưa về /admin, sidebar không có Phiếu của tôi`.

## E9-S1 Token, shell, thành phần dùng chung
SPEC §5.1.
**AC:**
1. Ở `/admin/*`, `body[data-shell="admin"]`, font tính được của `h1` là Be Vietnam Pro, nền trang `rgb(239, 235, 228)`; ở `/` (member) nền vẫn `rgb(244, 247, 245)` và font Nunito (Playwright đọc `getComputedStyle`).
2. Sidebar có đúng 12 mục (11 mục bảng §4.1 + "Đơn vị tính" §11.1) trong 3 nhóm, mục đang chọn có `aria-current="page"`; không có "Phiếu của tôi".
3. Đếm: `GET admin/review?status=pending` trả 3 dòng → mục Món ngoài danh mục hiện "3"; trả 0 → không hiện đếm (biên 0/1).
4. Thẻ kỳ: `days_left = 1` → "Hôm nay là ngày cuối"; `days_left = 2` → "còn 2 ngày" (biên, vitest với dữ liệu giả).
5. Bộ thành phần §4.2 có test vitest cho mọi trạng thái ghi trong bảng.
6. 768 px sidebar 72 px chỉ icon, 767 px thành thanh trên + nút "Mở menu" (biên điểm gãy, Playwright `setViewportSize`); 1279/1280 tương tự cho 232 px.
7. `m1-scope.test.ts` xanh; `grep -rn "#[0-9A-Fa-f]\{3,6\}" web/src/css/m1 web/src/features/*/**.m1.css` chỉ khớp trong `tokens-m1.css`.
8. Playwright: mọi test admin hiện có (`admin`, `catalog`, `stock`, `summary`, `adjust`, `review`, `delivery`, `backlog`, `reports`, `print`, `notifications`, `i18n`) vẫn xanh (chỉ sửa selector nếu nhãn đổi theo spec này, không sửa assertion nghiệp vụ); mọi test member xanh không sửa.
Playwright: `E9-S1 shell Hành chính: sidebar 3 nhóm 12 mục, thẻ kỳ, chuông, đổi en đổi nhãn sidebar` · `E9-S1 điểm gãy 767/768 và 1279/1280` · `E9-S1 trang member giữ giao diện cũ`.

## E9-S2 Tổng hợp kỳ + Món ngoài danh mục
SPEC §5.2.
Trạng thái: AC 1–2 + Playwright "E9-S2 Tổng hợp…" xong (T10); AC 3–6 + Playwright "E9-S2 Điều chỉnh kỳ khóa…", "E9-S2 Tạo phiếu hộ…" (+ STALE khi nhân viên lưu trước) xong (T11); AC 7–8 + Playwright "E9-S2 Món ngoài danh mục…" xong (T12).
**AC:**
1. Bấm thẻ "Dòng chờ giao" (kỳ khóa) → URL có `filter=pending_delivery`, `aria-pressed="true"`, nhãn "Đang lọc: Còn dòng chờ giao · {n} người", bảng chỉ gồm phiếu còn dòng chờ giao; bấm lại → bỏ lọc. Kỳ mở: thẻ không có role button.
2. Bấm "Phiếu đã đăng ký" → bảng = danh sách chưa đăng ký, không chứa Hành chính (sau S0).
3. Ngăn kéo kỳ khóa: lý do 2 ký tự sau trim → lỗi tại ô `REASON_REQUIRED` (server trả, FE không chặn trước); 3 ký tự → lưu được. Lý do 500 ký tự gửi được, ô không cho gõ ký tự 501 (`maxLength`), e2e api đã có biên 500/501 ở `NOTE_MAX`.
4. Stepper: dòng `max_qty = 5`: ở 5 nút + vô hiệu; gõ 6 → server `QTY_EXCEEDS_MAX` hiện ở dòng; dòng đã giao 3: nút − vô hiệu ở 3, gõ 2 → `QTY_BELOW_DELIVERED` ở dòng.
5. `STALE_UPDATE` (Playwright: lưu phiếu ở tab member trước) → khối cảnh báo + nút tải bản mới.
6. Tạo hộ trùng → khối "đã có phiếu" + "Mở Điều chỉnh" mở đúng ngăn kéo; chọn Hành chính → lỗi tại ô người.
7. Review: từ chối với 2 ký tự → lỗi ô; 3 ký tự → thẻ đổi badge "Đã từ chối"; tên món mới 120 ký tự lưu được, 121 → lỗi ô `item.name`; tối đa 0 và 1000 → lỗi ô `item.max_qty`, 1 và 999 qua.
8. Tab đếm khớp số dòng từng trạng thái.
Playwright: `E9-S2 Tổng hợp: thẻ lọc dòng chờ giao, chưa đăng ký không có Hành chính, theo món nhóm có tồn` · `E9-S2 Điều chỉnh kỳ khóa: cận dưới đã giao, lý do 2/3 ký tự, lưu ra toast` · `E9-S2 Tạo phiếu hộ: trùng phiếu mở Điều chỉnh` · `E9-S2 Món ngoài danh mục: chấp nhận, từ chối có lý do, thêm vào danh mục món mới`.

## E9-S3 Giao hàng + Còn nợ
SPEC §5.3.
Trạng thái: AC 1–5 + Playwright "E9-S3 Giao hàng: thực giao kẹp…", "E4-S1 E9-S3 Giao hàng bấm đúp…", "E4-S4 E9-S3 Giao hàng giao thiếu…" xong (T13); AC 6–7 + Playwright "E4-S3 E9-S3 Còn nợ…" xong (T14).
**AC:**
1. Stepper Thực giao: dòng còn 5, tồn 3 → max 3, ở 3 nút + vô hiệu; Playwright giả tồn giảm còn 2 giữa chừng (nhập điều chỉnh qua API) → bấm Giao 3 → server `STOCK_INSUFFICIENT {available: 2}` → câu "Chỉ còn 2" ở dòng. Dòng còn 2, tồn 10 → max 2; e2e api đã có `DELIVER_EXCEEDS_QTY` ở remaining+1.
2. Bấm Giao hai lần nhanh → một movement (single-flight); request thứ hai lọt tới server → dòng hiện câu `STALE_UPDATE` (giữ E4-S1).
3. Giao dòng đã chọn 2 dòng, một dòng hết hàng → khối kết quả 1 giao, 1 không giao được, dòng còn lại vẫn giao.
4. Giao tất cả phiếu đủ kho → toast "Đã giao đủ phiếu của …", phiếu rời danh sách "Chưa giao đủ" sau 600 ms (Playwright chờ biến mất), chọn tự sang phiếu kế.
5. Kỳ chưa khóa (route giả 409 `PERIOD_NOT_LOCKED`) → khối đúng câu.
6. Giao bổ sung: còn 4, tồn 2 → max 2; số 1 và 2 gửi được, 3 không bấm được. Hủy nợ 2/3 ký tự; 500 ký tự gửi được, ký tự 501 không gõ được.
7. Thẻ "Của người đã nghỉ" lọc đúng dòng có nhãn.
Playwright: `E9-S3 Giao hàng: thực giao kẹp theo tồn và còn lại, giao dòng đã chọn, giao tất cả rời bộ lọc` · `E9-S3 Giao hàng bấm đúp: tồn trừ một lần` · `E9-S3 Còn nợ: thẻ lọc, giao bổ sung tối đa min(nợ, tồn), hủy nợ có lý do, lịch sử đợt giao`.

## E9-S4 Báo cáo + Bản in A4 + Excel
SPEC §5.4.
Trạng thái: xong. AC 1, 2, 3, 5 + Playwright "E5-S2 E9-S4 Báo cáo: Đặt mua biên…" (T15); AC 4 + Playwright "E5-S3 E9-S4 Bản in A4…" (T16); AC bổ sung §11.3 1–5 + Playwright "E9-S4 Phiếu đề xuất D&E…" (T16b).
**AC:**
1. Ô Đặt mua: 0 và 99999 hợp lệ; −1, 100000, 1.5, chữ → lỗi tại ô "Từ 0 đến 99 999.", nút chốt báo "Sửa {n} ô…" và không gửi; e2e api đã có biên `order_qty` 99999/100000 (giữ).
2. `pending_custom_count = 1` → hộp thoại trước khi chốt; "Xem món chờ" không tạo bản chốt; "Vẫn chốt" tạo một bản.
3. Xuất Excel → tệp `vpp-bao-cao-<ym>.xlsx` tải về, danh sách bản chốt thêm 1; "Tải lại" không thêm bản (đếm `GET …/snapshots` không đổi).
4. Trang in hiện đúng tên người ký từ bản chốt; giao thêm sau chốt → số trên trang in không đổi; "Bản chốt số 2 của kỳ" khi là bản thứ hai.
5. Đổi tháng khi có ô sửa → hỏi; "Tiếp tục sửa" giữ tháng và số.
AC bổ sung (SPEC §11.3, trang 1 Phiếu đề xuất D&E, phụ lục `?appendix=1`, Excel "Phiếu đề xuất"/"Phụ lục"):
6. Trang 1 chỉ có món `order_qty > 0` (0 không in, 1 in).
7. Mã và Item name đúng từ danh mục lúc chốt; đổi tên món sau khi chốt thì trang in không đổi.
8. Ô ký đúng số lượng và chức danh của config lúc chốt (1 ô / 3 ô).
9. `?appendix=1` thì có phụ lục, không có thì không.
10. Excel sheet 1 "Phiếu đề xuất", A1 "Phiếu đề xuất văn phòng phẩm", tiêu đề bảng 6 cột.
Playwright: `E9-S4 Báo cáo: Đặt mua biên 0/99999/100000, chốt hỏi món chưa xem, Excel tải về và tải lại không tạo bản mới` · `E9-S4 Bản in A4: ô ký, số chốt không đổi sau giao thêm, in lại không tạo bản mới` · `E9-S4 Phiếu đề xuất D&E: chỉ món đặt mua, ô ký theo cấu hình, bật phụ lục` (giữ E5-S2/E5-S3).

## E9-S5 Danh mục + Nhóm món + Kho
SPEC §5.5.
Trạng thái: xong (chờ mốc kiểm S5 của chủ dự án). AC 1–4 (vitest T17/T18; Playwright `E9-S5 Danh mục…`, `E9-S5 Nhóm món…`), AC 5–7 Kho (vitest T19 — `stock-*.test`, `*-dialog.test`, `movements-drawer.test`; Playwright `E9-S5 Kho…`).
**AC:**
1. Tối đa/tháng sửa tại chỗ: 1 và 999 lưu; 0 và 1000 → câu lỗi trong hàng từ `VALIDATION`; Esc trả giá trị cũ, không gọi API.
2. Tên món 120 ký tự lưu; 121 → lỗi ô `name`. Ảnh 5 MB sau nén vẫn qua (e2e api đã có 5 MB / 5 MB + 1 → 413 `FILE_TOO_LARGE`); thiếu ảnh → "Cần thêm: ảnh." và ô ảnh `aria-invalid`.
3. Hàng loạt đổi tối đa 2 món → 2 `PATCH`, bảng cập nhật, toast; một món lỗi → giữ chọn món đó.
4. Nhóm: đổi thứ tự rồi "Lưu thứ tự" → tải lại trang vẫn đúng thứ tự, chấm màu đổi theo vị trí; tạo nhóm trùng khác hoa thường → `CATEGORY_EXISTS` tại ô.
5. Xuất lẻ: tồn 3 → số 3 gửi được; 4 → `STOCK_INSUFFICIENT` "Chỉ còn 3" tại ô (server); điều chỉnh −3 với tồn 3 → tồn 0 badge "Hết hàng"; −4 → lỗi tại ô. Lý do rỗng (Điều chỉnh) → `REASON_REQUIRED` tại ô; 500 ký tự gửi được.
6. Sổ cái: sau nhập 10 rồi xuất 3 → 2 dòng, dòng mới "tồn 7", dòng cũ "tồn 10".
7. Thẻ Sắp hết lọc qua URL `?filter=low` (chuông `low_stock` mở đúng lọc — giữ).
8. (SPEC §12.1, api) Ngừng nhóm: món trong nhóm ẩn khỏi `GET items` của member, thêm/tăng → `ITEM_INACTIVE`, chép lại bỏ qua `INACTIVE`, convert vào món đó → `ITEM_INACTIVE`; `items.active` không đổi. Test: e2e `category-inactive.e2e-spec.ts` (gồm đua tx ngừng nhóm).
9. ~~(SPEC §12.2, api) Kiểm kê~~ — bỏ ở G6 (chủ dự án chốt 15/11/2026), endpoint trả 404 (`stock-count-removed.e2e-spec.ts`). Trước đây: `POST admin/items/:id/stock/count`: đếm 0 được / −1 `VALIDATION`; 1 000 000 được / 1 000 001 `VALIDATION`; `expected` lệch 1 → `STALE_UPDATE {stock_qty}`; đếm bằng tồn → `VALIDATION`. Test: unit `stock.dto.spec.ts`, `stock-count.spec.ts`; db-spec `stock-count.db-spec.ts`.
Playwright: `E9-S5 Danh mục: sửa tại chỗ tối đa 0/1/999/1000, thêm món có ảnh trong ngăn kéo, hàng loạt đổi tối đa` · `E9-S5 Nhóm món: đổi thứ tự, màu theo vị trí, trùng tên` · `E9-S5 Kho: nhập 10, xuất lẻ 3 rồi 4 bị chặn, sổ cái tồn sau từng dòng`.

## E9-S5b Đơn vị tính do Hành chính quản lý
SPEC §11.1.
Trạng thái: xong.
**AC:**
1. Tên 40 ký tự lưu được; 41 → lỗi ô. Test: db-spec `units.db-spec.ts` "name 40 ký tự được, 41 → 23514…"; e2e `units.e2e-spec.ts` "tên 40 ký tự → 201…; 41 → 400 VALIDATION {fields:[name]}…"; vitest `units-page.test.tsx` "tên ô sửa tại chỗ tối đa 40 ký tự…", "thêm ĐVT: Tên tối đa 40…".
2. Trùng khác hoa thường → `UNIT_EXISTS`. Test: db-spec "UNIQUE lower(name): "Bao" rồi "bao" → 23505"; e2e "trùng tên khác hoa thường → 409 UNIT_EXISTS…"; vitest "sửa tên tại chỗ: … UNIT_EXISTS hiện "Đã có đơn vị tính tên này." tại ô"; Playwright `E9-S5b Đơn vị tính: thêm, trùng tên…`.
3. Xóa ĐVT đang dùng → `UNIT_IN_USE`; ĐVT chưa dùng thì xóa được. Test: db-spec "DELETE ĐVT đang dùng … bị RESTRICT chặn…"; e2e "đang có món dùng → 409 UNIT_IN_USE; chưa dùng → 204…"; vitest "xóa mà server báo UNIT_IN_USE → toast danger…"; Playwright `E9-S5b …xóa đang dùng bị chặn`.
4. ĐVT ngừng không còn trong ô chọn của form món và "Món khác"; món cũ vẫn hiện tên. Test: vitest `units.test.tsx` "ĐVT đã ngừng (active=false) server vẫn trả nhưng không có trong ô chọn", "member vẫn thấy tên ĐVT đã ngừng…", `units-page.test.tsx` "ngừng ĐVT xong, mở Danh mục > Thêm món…"; e2e `units.e2e-spec.ts` "member thấy mọi ĐVT kể cả đã ngừng…"; Playwright `E9-S5b …ngừng thì mất khỏi ô chọn Món khác`.
5. Gửi ĐVT ngừng cho món mới → `UNIT_INACTIVE`. Test: e2e `units.e2e-spec.ts` "active:false rồi tạo món với mã đó → 400 UNIT_INACTIVE; mở lại → tạo được", "sửa món: đổi sang ĐVT ngừng → 400 UNIT_INACTIVE…", `units-lines.e2e-spec.ts` "dòng mới chọn ĐVT ngừng → 400 UNIT_INACTIVE…", "chép kỳ trước: dòng ngoài DM có ĐVT nay đã ngừng → … UNIT_INACTIVE…", đua `units-deactivate-race.e2e-spec.ts` (ngừng ĐVT đang mở tx → tạo món/lưu dòng chờ rồi `UNIT_INACTIVE`).
6. Đổi thứ tự → ô chọn đổi thứ tự theo. Test: vitest `units-page.test.tsx` ""Đưa {tên} lên" … "Lưu thứ tự" PATCH {sort_order: vị trí*10}…", `units.test.tsx` "chỉ hiện ĐVT server trả (đang dùng) theo đúng thứ tự API…"; e2e "member thấy mọi ĐVT … theo sort_order rồi tên…".
Playwright: `E9-S5b Đơn vị tính: thêm, trùng tên, ngừng thì mất khỏi ô chọn Món khác, xóa đang dùng bị chặn` · `E9-S5b Đơn vị tính: lỗi tải → "Không tải được dữ liệu — thử lại." và "Thử lại"`.

## E9-S6 Danh bạ + Nhật ký + Cấu hình
SPEC §5.6.
Trạng thái: xong — AC 5 + Playwright "E9-S6 Danh bạ…" (T20); AC 4 + Playwright "E9-S6 Nhật ký…" (T21); AC 1–3 + Playwright "E9-S6 Cấu hình…" + web §11.2 (ô nhắc trước hạn, khối "Ô ký trên phiếu đề xuất") (T22).
**AC:**
1. Ngày hạn 3 và 28 lưu được; 2 và 29 → lỗi tại ô từ `CONFIG_INVALID` (nút ± dừng ở 3/28 nhưng gõ tay vẫn gửi được để server quyết); tối đa mặc định 1/999 qua, 0/1000 lỗi.
2. Người ký 200 ký tự lưu; 201 → lỗi ô; liên hệ 500 lưu, ô không nhận ký tự 501, đếm "500/500".
3. Lưu `admin_contact` → trang "Chưa được cấp quyền" hiện đúng tên (giữ E0-S8); "Thay đổi gần đây" thêm một dòng.
4. Nhật ký: Đến ngày < Từ ngày → lỗi tại ô, không gọi API; chip "Hôm nay" gửi `from = to =` ngày VN hôm nay; "Xem thêm" xuất hiện khi trang trả `next_cursor` (51 dòng seed → 50 + nút; 50 dòng → không nút).
5. Danh bạ: "Đồng bộ ngay" khi PMH ID không liên lạc được → khối lỗi, bảng vẫn còn (giữ E0-S7); ô tìm 200 ký tự gửi được, 201 không gõ được.
**AC §11.2 (lát S6):**
6. Nhắc trước hạn `reminder_days_left` 1 và 7 qua, 0 và 8 lỗi; với `registration_last_day = 3` thì 2 qua, 3 lỗi. Test: unit `config-validation.spec.ts` "reminder_days_left=%p (biên trong [1,7]) → hợp lệ", "registration_last_day=3 trong bản vá + reminder 2 → hợp lệ; + reminder 3 → field reminder_days_left", "chỉ vá reminder…", "chỉ vá last_day…"; `schedule-days.spec.ts` "registration_last_day 3 + nhắc 2 ngày → nhắc ngày 2…"; e2e `config-admin.e2e-spec.ts` "PUT reminder_days_left %d (registration_last_day 10) → 200" (1, 7), "PUT %j → 400 CONFIG_INVALID field %s, không ghi" (0, 8), "registration_last_day 3: reminder 2 → 200; reminder 3 → 400…"; vitest `config-period.test.tsx` "nút ± ngày nhắc dừng ở 1 và 7", "CONFIG_INVALID {field: reminder_days_left} → lỗi tại ô ngày nhắc…", "lịch xem trước tháng kế: … ngày nhắc tô riêng…".
7. Ô ký `signature_boxes`: 1 ô và 3 ô qua, 0 và 4 lỗi; `title` 60 qua, 61 lỗi; `name` 200 qua, 201 lỗi; lỗi gắn đúng ô của đúng hàng. Test: unit `config-validation.spec.ts` "signature_boxes %d ô → hợp lệ…" (1, 3), "signature_boxes %d ô → field signature_boxes" (0, 4), "signature_boxes ô 2: %s dài %d → hợp lệ" / "→ field signature_boxes.1.<trường>"; e2e "PUT signature_boxes %d ô → 200, thay cả mảng…", "PUT title dài đúng 60 → 200", "PUT %j → 400 CONFIG_INVALID…" (0/4 ô, title 61, name 201); vitest `config-signers.test.tsx` ""Thêm ô ký" ẩn khi đủ 3 ô; "Xóa ô ký" ẩn khi chỉ còn 1 ô", "CONFIG_INVALID {field: signature_boxes.1.title} → lỗi tại ô Chức danh hàng 2…", "người ký 200 ký tự gửi đi nguyên vẹn", "xem trước như bản in…"; Playwright `E9-S6 Cấu hình: thêm/xóa ô ký 1–3 lưu cả mảng; đổi nhóm Hành chính hỏi xác nhận rồi hủy`.
8. Migration `0112`: `signers.head` → "Chủ quản đơn vị", `signers.preparer` → "Người yêu cầu", `approver` bỏ, `signers` bị xóa; `reminder_days_left` seed `LEAST(3, registration_last_day − 1)`. Test: db-spec `config-signature-boxes.db-spec.ts` (4 test).
9. (PMH ID v3) Khối Quyền truy cập chỉ đọc: liệt kê Hành chính hiện tại (`role = admin`), không có ô nhập nhóm/nút lưu; danh bạ chưa có admin → "Chưa thấy ai…". Test: vitest `config-page.test.tsx` "Cấu hình · khối Quyền truy cập (chỉ đọc)".
Playwright: `E9-S6 Danh bạ: thẻ lọc trạng thái, đồng bộ lỗi PMH ID bảng vẫn còn, ngăn kéo người` · `E9-S6 Nhật ký: lọc nhanh Hôm nay, khoảng ngày sai báo tại ô, mở Trước/Sau` · `E9-S6 Cấu hình: ngày hạn 2/3/28/29, liên hệ 500 ký tự, mỗi khối lưu riêng`.

## E9-S7 Hành chính ở 390 px
SPEC §5.7.

Trạng thái: xong. T23: AC 1–4 — Playwright `web/playwright/admin-mobile.spec.ts` (3 test tên story); vitest `shell/admin-topbar.test.tsx`, `features/delivery/delivery-phone.test.tsx`. T24: AC 4 trên 12 màn (thêm Đơn vị tính) + menu sheet + ngăn kéo Thêm món + hộp thoại Thêm đơn vị tính; AC 5 — `expectTouchTargets` đo mọi `button` hiển thị ở Giao hàng chi tiết và Danh mục ≥ 44×44 (< 768: `.btn--sm`, `.icon-btn`, stepper, chọn tháng, ô sửa tại chỗ, chip nhóm, thu/mở nhóm cao/rộng 44 thật).
**AC:**
1. Ở 390 px mọi route `/admin/*` không cuộn ngang trang (`document.documentElement.scrollWidth ≤ 390`), trừ vùng cuộn có chủ đích (hàng thẻ số liệu, chip).
2. Mọi trang Hành chính tới được trong ≤ 2 chạm từ bất kỳ trang Hành chính nào (Mở menu → mục).
3. Giao hàng 390: danh sách → chi tiết → Giao tất cả → về danh sách; nút Quay lại về đúng danh sách giữ bộ lọc.
4. axe `color-contrast` sạch ở 390 trên: Tổng hợp, Món ngoài danh mục, Giao hàng (danh sách + chi tiết), Còn nợ, Báo cáo, Kho, Danh mục, Nhóm món, Danh bạ, Nhật ký, Cấu hình, menu sheet mở, một ngăn kéo mở, một hộp thoại mở.
5. Vùng chạm mọi nút ≥ 44×44 (Playwright đo `boundingBox` các `button` hiển thị trên Giao hàng chi tiết và Danh mục).
Playwright: `E9-S7 Hành chính 390: menu sheet ≤ 2 chạm, không cuộn ngang mọi trang` · `E9-S7 Giao hàng 390: danh sách → chi tiết → giao tất cả → về danh sách` · `E9-S7 axe 390 các màn Hành chính`.
