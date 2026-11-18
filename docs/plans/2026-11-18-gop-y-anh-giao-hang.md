# Góp ý 18/11 — tinh chỉnh giao diện, Hủy phiếu người đã nghỉ, ảnh món

Chủ dự án chốt 18/11/2026. Nhánh `feat/gop-y-1811` từ `main`. TDD theo CLAUDE.md, review cuối mỗi Phase.

## Phase A — tinh chỉnh giao diện

- **A1 Tủ/Kho — cột "Mức đặt lại"** → "Tồn kho lần nhập trước" (vi) / "Stock after last purchase" (en). Đầu cột có nút (i) (Radix Popover hoặc `title` + `aria-describedby`), nội dung: "Số trong tủ ngay sau lần nhập mua gần nhất. Còn trống ≤ 20 % số này thì món hiện Sắp hết." Test: nhãn cột, (i) mở được bằng bàn phím.
- **A2 Nhật ký** — bỏ nút lọc "Chỉ việc tự động" (`audit-filters.tsx`, key `admin.audit…systemOnly`). Lọc "Hệ thống (tự động)" trong danh sách người làm giữ nguyên. Bỏ param URL tương ứng; URL cũ có param thì bỏ qua, không lỗi.
- **A3 /admin/month** — `month-strip.tsx`: 4 bước giãn hết bề ngang (grid `repeat(4,1fr)`), 390 px vẫn không cuộn ngang.
- **A4 /admin/today** — 7 thẻ trên một hàng ở 1280 px (grid 7 cột, chữ phụ xuống dòng, không cắt). Ở 390 px giữ lưới 2 cột hiện tại.
- **A5 /admin/delivery (người)** — cột "Người" → "Nhân viên đặt phiếu". Người đã nghỉ: nhãn "Người đã nghỉ — giao chỉ khi có người nhận thay" hiện ngay dưới tên trong cột này, không cần bấm ô tick.
- **A6 Hộp Giao — "Từ chối / giảm dòng…"** → "Từ chối / giảm S/Lượng…". Trong chế độ này:
  - ô "Chọn tất cả" ở đầu danh sách (đủ 3 trạng thái: không / một phần / tất cả);
  - nút Từ chối dùng kiểu `danger` (token đỏ có sẵn, kiểm tương phản bằng axe);
  - mỗi ô số lượng có nút − / + (`ui/qty-stepper.tsx`, không biết nghiệp vụ; − vô hiệu ở min, + vô hiệu ở max; có `aria-label`);
  - lỗi: hiện câu "Nhập từ x đến y" → khi nhập vượt: "Điều chỉnh không đúng — vượt số đã đặt là {{max}}"; dưới 1 giữ "Nhập ít nhất 1".
  - Biên: unit validate max được / max+1 lỗi, 1 được / 0 lỗi; component: − vô hiệu ở 1, + vô hiệu ở max; e2e api vẫn từ chối max+1 (luật ở server, đã có — thêm test nếu thiếu).
- **A7 /admin/config — bỏ khối "Liên hệ Adm D&E và báo sắp hết hàng"** (`contact-block.tsx`):
  - Trang Tôi và "Chưa được cấp quyền": câu cố định "Liên hệ Adm D&E để được hỗ trợ." (i18n), bỏ đọc `admin_contact`.
  - Chuông sắp hết luôn bật: server bỏ kiểm `low_stock_notify` (coi như true), bỏ khỏi `config-validation.ts`, `config-admin.service.ts`, `public-config`/`auth-me`. Migration mới xóa 2 khóa config (không sửa migration cũ). PATCH config gửi 2 khóa này → `VALIDATION_FAILED` (khóa không còn).
  - Cập nhật `docs/prd.md`/`architecture.md` chỗ nhắc 2 khóa; ghi `review-spec.md`.

## Phase B — Hủy phiếu người đã nghỉ

- Đã có: `POST /api/admin/lines/:id/cancel-remaining` (lý do `user_left`), hủy phần còn nợ; phần giữ chỗ được trả lại nên Tủ có lại hàng.
- **B1 API** `POST /api/admin/requests/:id/cancel-remaining` body `{expected_lines: [{line_id, remaining}]}`:
  - chỉ khi chủ phiếu đã nghỉ (bị khóa / thu hồi quyền ở Tài khoản D&E), ngược lại `USER_NOT_LEFT` (mã mới, thêm §7);
  - một transaction, khóa theo thứ tự requests → request_lines → items; hủy mọi dòng còn nợ với `user_left`; số lệch `expected` → `STALE_DATA` (dùng mã sẵn có nếu đã có tên tương đương);
  - audit một bản ghi cha + before/after từng dòng; không gửi chuông; có undo như hủy từng dòng.
  - Test: db-spec hai request song song → một thành công, một `STALE`/0 dòng; e2e: người đang làm → `USER_NOT_LEFT`, người đã nghỉ → 200 và tồn trống tăng đúng; vai nhân viên → 403; phiếu không còn nợ → idempotent 200 `cancelled_now: 0`.
- **B2 Web** — hộp Giao của người đã nghỉ có nút "Hủy phiếu" (danger) cạnh "Giao". Bấm → hộp xác nhận liệt kê món + số sẽ trả về Tủ, nút "Hủy phiếu"; xong → toast có Hoàn tác. Người đang làm: không có nút (component test cả hai phía).
- Mockup hộp xác nhận cho chủ dự án duyệt trước khi code B2.
- Playwright `E2-… Hủy phiếu người đã nghỉ` ở 1280 + 390.

## Phase C — Ảnh món: dán Ctrl+V và cắt tự do

- Định dạng: JPG, PNG, WEBP (server đã chỉ nhận 3 loại này, magic bytes). Tệp khác → câu lỗi "Chỉ nhận ảnh JPG, PNG hoặc WEBP". Giới hạn 5 MB giữ nguyên.
- **C1 Dán ảnh** — `image-field.tsx`: khi drawer Thêm/Sửa món mở, sự kiện `paste` có `image/*` trong clipboard → đưa vào luồng cắt (C2). Gợi ý "Ctrl+V để dán ảnh" cạnh nút Chọn ảnh. Dán chữ thường vào ô nhập khác không bị chặn. Nút chọn tệp thủ công giữ nguyên, `accept="image/jpeg,image/png,image/webp"`.
- **C2 Cắt tự do** — `ui/image-cropper.tsx` (canvas tự viết, không thêm thư viện): khung cắt kéo được 4 cạnh + 4 góc, kéo cả khung để di chuyển; nút "Tự cắt viền trắng" (quét pixel gần trắng từ 4 phía, ngưỡng cố định); nút "Dùng ảnh" xuất WEBP (fallback JPEG nếu trình duyệt không xuất WEBP) rồi upload như cũ. Áp dụng cả lúc sửa ảnh đã có ("Cắt lại").
  - Biên: unit hàm cắt viền (ảnh toàn trắng → giữ nguyên, viền 1 px được cắt); khung tối thiểu 16×16 px không kéo nhỏ hơn; ảnh sau cắt ≤ 5 MB / server vẫn 413 với 5 MB + 1 byte (đã có test — xác nhận).
  - Bàn phím: mũi tên dịch khung, Shift+mũi tên đổi kích thước; dùng được ở 390 px (cảm ứng, pointer events).
- Mockup màn cắt cho chủ dự án duyệt trước khi code C2.
- Playwright: dán ảnh (clipboard qua `page.evaluate` dispatch `paste`), cắt, lưu, ảnh hiện ở danh mục.

## Cuối plan

Theo CLAUDE.md mục Review: đủ bộ test → Playwright 1280+390 → review toàn nhánh → `ra-soat-ui` → báo chủ dự án. Cập nhật `docs/map.md` từng task.
