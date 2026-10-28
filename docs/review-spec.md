# Review spec GĐ1 — kết quả 3 góc nhìn (2026-10-28)

Ba reviewer độc lập đọc `prd.md`, `architecture.md`, `backlog/*`, `design-preview/_SPEC.md` và mockup: **Nghiệp vụ** (vai Trưởng bộ phận Hành chính), **Kiến trúc & bảo mật** (đối chiếu mã QLTS_DE thật), **QA & người dùng mới** (kỹ sư công trường 45 tuổi dùng Android). Bảng dưới gom các phát hiện trùng nhau; cột *Quyết định* là cách spec đã được sửa (phiên bản 1.1).

Ký hiệu: **N** nhận và đã sửa spec · **GĐ2** hoãn sang giai đoạn 2 · **?** cần chủ dự án chốt (xem mục cuối).

## A. Nghiệp vụ và luật kỳ

| # | Phát hiện (ai nêu) | Quyết định |
|---|---|---|
| A1 | "Cần mua = tổng − tồn" sai sau đợt giao đầu và bỏ qua nợ kỳ trước; bản đã ký không được chốt, mở lại ra số khác (NV, QA) | **N** — `Cần mua = max(0, Σ(qty − delivered_qty) của mọi dòng chưa đủ thuộc kỳ ≤ kỳ báo cáo − tồn)`. Bấm In/Xuất tạo **bản chốt** (`report_snapshots`) ghi số liệu + giờ + người lập; xem lại được. Tên 3 người ký lấy từ Cấu hình. |
| A2 | Sau ngày 10 "kỳ hiện tại" là gì — ba tài liệu nói ba kiểu; `days_left` chưa định nghĩa; nhắc ngày 8 nói "còn 2 ngày" sai (QA, NV) | **N** — Chốt mô hình **liên tục**: từ 00:00 ngày 11 kỳ M+1 đã mở (đúng quyết định "tự động dồn sang tháng sau"). Trang chủ member luôn là phiếu kỳ đang mở; phiếu kỳ trước đang giao hiện dưới dạng thẻ "Tháng M đang giao". `days_left` = số ngày lịch còn lại tính cả hôm nay. Lời nhắc: "Hết hạn 23:59 ngày 10". |
| A3 | Phiếu "tự tạo khi vào" mâu thuẫn với "lưu lần đầu mới tạo" → KPI, nhắc, tạo hộ sai (QA) | **N** — Phiếu chỉ tồn tại khi có ≥ 1 dòng đã lưu. Lưu danh sách rỗng = xóa phiếu (chỉ khi chưa dòng nào được giao/duyệt). |
| A4 | Member lưu lại sẽ xóa dòng admin đã thêm (`admin_only`) trước hạn; không có `expected_updated_at` cho member (NV, QA, KT) | **N** — `PUT me/request/lines` chỉ thay **dòng member được chạm**; dòng `admin_only`/`converted`/đã giao giữ nguyên, hiện chỉ đọc với nhãn "Hành chính thêm". Member cũng gửi `expected_updated_at`. |
| A5 | Không hoàn tác được giao nhầm / thu hồi hàng hỏng (NV) | **N** — Thêm "Hoàn tác đợt giao" (lý do bắt buộc; movement `return` dương; trừ `delivered_qty`; ghi nhật ký). |
| A6 | Giảm số lượng dòng xuống dưới số đã giao bị CSDL chặn mà UI không nói gì (NV, QA, KT) | **N** — Mã lỗi `QTY_BELOW_DELIVERED {delivered}`; UI chặn trước. |
| A7 | Đổi ngày hạn "áp dụng ngay" là cửa hậu gia hạn; `periodFor`/`isOpen` dựa config sống (NV, KT) | **N** — Hạn **chụp vào `periods.deadline`** lúc tạo kỳ; đổi config chỉ ảnh hưởng kỳ tạo sau; `registration_last_day` ∈ [3, 28]. |
| A8 | Món ngoài danh mục không có ĐVT; ĐVT là chữ tự do (NV) | **N** — Dòng ngoài danh mục bắt buộc ĐVT; ĐVT món chọn từ danh sách chuẩn (cái, hộp, cây, ram, cuộn, lốc, bịch, chai, bộ) + quy cách tùy chọn hiển thị cạnh tên. Khi "Thêm vào danh mục" cảnh báo nếu ĐVT khác. |
| A9 | Dòng ngoài danh mục đã "chấp nhận" quay lại hàng chờ mỗi tháng; báo cáo in được khi còn món chưa xem; nhóm "Ngoài danh mục" chưa có Cần mua (NV) | **N** — Khi chép lại, dòng `accepted` kỳ trước chép thành `pending` kèm gợi ý "đã chấp nhận kỳ trước → nên Thêm vào danh mục". Báo cáo: nhóm Ngoài danh mục `Cần mua = tổng`; In/Xuất **cảnh báo chặn mềm** khi còn dòng `pending`. |
| A10 | Nhắc chỉ bằng chuông thì người quên không thấy; admin không có chuông "kỳ đã khóa" (NV) | **N** — Màn Tổng hợp có nút "Sao chép danh sách chưa đăng ký" (dán Zalo); chuông cho admin sáng ngày 11 "Kỳ M đã khóa: x/y phiếu". Email vẫn GĐ2. |
| A11 | "Tổ" xuất hiện khắp nơi nhưng không có dữ liệu tổ; nguồn `department` cho tổng hợp vs báo cáo chưa thống nhất (NV, QA) | **N** (chủ dự án chốt 2026-10-28) — Không có trường Tổ; nhóm theo **phòng ban PMH ID** chụp trên phiếu; tổng hợp và báo cáo cùng nguồn. Nếu phòng ban quá thô → GĐ2 (E8-S6). |
| A12 | Không có xuất kho ngoài phiếu (người mới, nhu cầu gấp, hàng dùng chung) → admin sẽ lạm dụng "điều chỉnh kiểm kê" (NV) | **N** (chủ dự án chốt 2026-10-28: "mua dư, người mới vào thì xuất kho phần còn lại, thiếu thì chờ tháng sau") — FR-54 Xuất lẻ (movement `issue`, người nhận hoặc dùng chung, lý do bắt buộc); báo cáo thêm cột "Đặt mua" sửa được để ghi phần mua dư. |
| A13 | Admin tự điều chỉnh phiếu của mình sau hạn — PRD không cấm (QA) | **N** — Cho phép (Hành chính chính là người điều chỉnh); nhật ký đánh dấu `self=true`, lọc được. |
| A14 | Người đã nghỉ còn dòng nợ treo mãi; mẫu số KPI "40 người" chưa định nghĩa (NV) | **N** — Thêm "Hủy nợ" (lý do bắt buộc). Mẫu số = user `active` thuộc group được cấp tại 00:00 ngày khóa kỳ (chụp vào `periods.headcount`). |
| A15 | Kiểm kê cuối năm phải gõ từng món; không có sổ cái toàn kho (NV) | **GĐ2** — Màn kiểm kê hàng loạt + xuất sổ cái toàn kho. |
| A16 | Giao theo tổ hàng loạt; bản in ký nhận tối thiểu; thông báo "hàng đã về" (NV) | **GĐ2** — Thuộc phiếu giao nhận (E8-S2). GĐ1 giữ "Giao tất cả" theo phiếu. |

## B. Kiến trúc, CSDL, bảo mật

| # | Phát hiện | Quyết định |
|---|---|---|
| B1 | `PUT …/lines` "toàn bộ dòng" chưa định nghĩa → DELETE+INSERT làm mất `delivered_qty`/review, FK `ref_line_id` nổ 500; `updated_at` không bump; đua INSERT phiếu lần đầu | **N** — Thuật toán diff theo `line.id`; chỉ DELETE dòng `delivered_qty = 0` và `review_status ∈ {n/a, pending}`; `ON DELETE RESTRICT`; bump `requests.updated_at` + `department` cùng tx; tạo phiếu bằng `INSERT … ON CONFLICT DO UPDATE … RETURNING id` rồi `FOR UPDATE`. |
| B2 | `GET /files/:id` "chủ sở hữu hoặc admin" chặn member xem ảnh món; module files QLTS là `admin/files`, `attachment`, audit mỗi lần tải (KT, QA) | **N** — Luật đọc tệp theo **tham chiếu**: admin/sa, hoặc người upload, hoặc tệp là ảnh món đang có, hoặc ảnh dòng trong phiếu của chính mình. Trả `inline` + mime thật + nosniff; không audit GET ảnh. Khi lưu dòng kiểm `files.uploaded_by = actor`. Cron dọn tệp mồ côi > 24 h. Module files **viết lại** (chỉ mượn kiểm magic bytes). |
| B3 | Webhook: spec nói HMAC v2 có timestamp, mã QLTS là v1 (`x-pmh-signature` trên body, không timestamp); bảng `processed_webhook_events` (0026) không nằm trong danh sách copy; thiếu 0006/0007/0015; schema `files` khác QLTS | **N** — Verify **v2** (`X-PMH-Signature-V2`, `X-PMH-Timestamp`, lệch ≤ `WEBHOOK_TS_SKEW_SEC=300`); test vector cụ thể trong E0-S6; danh sách migration copy sửa lại chính xác (§16). |
| B4 | Sau EDGE là 2 hop proxy nhưng `trust proxy 1` → `req.ip` = IP EDGE → khóa SA theo IP thành khóa toàn cục | **N** — `TRUST_PROXY_HOPS` (prod 2); lockout SA theo cặp (IP, username) + bộ đếm toàn cục 50/15′; e2e assert `req.ip` qua đúng số hop. |
| B5 | Vai `admin` tính lúc tạo phiên vs QLTS đọc `users.role` mỗi request → gỡ group không có hiệu lực ngay | **N** — `role` tính **mỗi request** từ `users.groups ∩ config.admin_group`; callback/webhook/sync chỉ cập nhật `users.groups`. |
| B6 | Giao hàng không idempotent; `deliver-all` chưa định nghĩa bán phần; thông báo "đủ" có race | **N** — `deliver {qty, expected_delivered_qty}` (lệch → `STALE_UPDATE`); `deliver-all` một tx + SAVEPOINT từng dòng; `FOR UPDATE` phiếu đầu tx; thứ tự khóa cố định; thông báo có `event_id` tất định + `ON CONFLICT DO NOTHING`. |
| B7 | Thông báo thiếu `event_id` tất định, trạng thái "sắp hết kho một lần", cron 00:05 trượt khi api đang recreate, không retention | **N** — Công thức `event_id` theo topic; `items.low_stock_notified_at`; cron **mỗi giờ** với logic "bảo đảm đã gửi hôm nay"; `timeZone` tường minh; xóa > 90 ngày; INSERT thông báo trong SAVEPOINT. |
| B8 | Dòng `rejected` lọt vào Còn nợ/báo cáo; CHECK lỏng; "gộp dòng khi convert" mất dữ liệu; copy-previous chép dòng `admin_only` | **N** — CHECK chặt theo cặp (`item_id`, `review_status`); mọi truy vấn nợ/báo cáo lọc `review_status ∈ {n/a, accepted, converted}`; **bỏ gộp**, partial unique chỉ áp cho `review_status='n/a'`; copy-previous bỏ dòng `admin_only`. |
| B9 | Thiếu endpoint/mã lỗi/phân trang; `export.xlsx` không có locale | **N** — Bảng endpoint × vai × mã lỗi; thêm `ITEM_IN_USE`, `LINE_REJECTED`, `USER_INACTIVE`, `USER_NOT_FOUND`, `INVALID_PERIOD`, `QTY_INVALID`, `QTY_BELOW_DELIVERED`, `CONFIG_INVALID`, `LINES_EMPTY`; `?limit=&cursor=`; `?lang=vi|en`. |
| B10 | E2E "giả lập đồng hồ" bằng Playwright không thể pass vì server quyết | **N** — `ClockService` inject được; env `CLOCK_OFFSET_MS` chỉ khi `NODE_ENV=test`; `isOpen` so với `periods.deadline` bằng đồng hồ app. |
| B11 | Log lộ `?code=&state=`, `login_hint`; audit nhiễu | **N** — Redact thêm `code, state, login_hint, logout_token`; không log body webhook/BCL. |
| B12 | Kiểm thử chưa chứng minh BR-1..BR-11; tên migration không nhất quán | **N** — Ma trận test theo BR (§14); tên migration thống nhất `0100_vpp_catalog`, `0101_vpp_requests`, `0102_vpp_reports`. |

## C. Trải nghiệm người dùng (mockup và `_SPEC.md`)

| # | Phát hiện | Quyết định |
|---|---|---|
| C1 | Điện thoại không có đường vào Lịch sử/Hồ sơ; nút "Thêm món ngoài danh mục" nằm cuối trang | **N** — Thanh dưới 3 mục (Đăng ký · Lịch sử · Tôi) ở ≤ 900 px; nút "Thêm món khác" đặt cạnh ô tìm và làm thẻ cuối lưới. |
| C2 | Không biết đã lưu hay chưa; không cảnh báo khi rời trang | **N** — Nhãn "Đã lưu 14:20 · sửa tiếp đến hết 10/11"; khi có thay đổi: "2 thay đổi chưa lưu · Lưu"; toast sau lưu; `beforeunload`. |
| C3 | Màn đăng nhập bắt gõ email; trang "Chưa được cấp quyền" chưa có mẫu | **N** — Nút chính "Đăng nhập bằng tài khoản công ty (PMH ID)" không cần email; dòng chuẩn bị "Bạn sẽ thấy trang đăng nhập chung của công ty"; SA thu thành liên kết nhỏ "Dành cho IT"; thêm mẫu trang từ chối. |
| C4 | Ngăn điều chỉnh trộn review (tức thì) với điều chỉnh (lưu sau); ô lý do dùng chung | **N** — 3 nút review mở hộp riêng, áp dụng ngay; hộp Từ chối có ô lý do riêng. |
| C5 | Câu chữ: "tối đa 20" mơ hồ, "Còn nhiều" không có trong PRD, "Tổng cộng 4 món", "Xem lại", "Lấy lại" nghe như hoàn tác, tên liên hệ viết cứng; tương phản `--ink-3` 2.9:1 | **N** — "tối đa 20/tháng"; bỏ "Còn nhiều"; "4 loại món"; "Quay lại sửa"; "Chép lại danh sách tháng 10"; tên liên hệ từ Cấu hình; `--ink-3` → `#667A70`, chữ phụ ≥ 14 px. |
| C6 | Ảnh Android 3–6 MB hay vượt 5 MB; EXIF xoay; tệp mồ côi | **N** — FE nén ≤ 1600 px / ≤ 1 MB và áp EXIF trước khi tải; AC tương ứng. |
| C7 | Dòng ngoài danh mục trong giỏ không sửa/xóa được; không có `max_qty` | **N** — Có −/+ và ×; áp `default_max_qty`. |

## D. Cần chủ dự án chốt

1. ~~Tổ (A11)~~ — đã chốt: dùng phòng ban PMH ID.
2. ~~Xuất lẻ (A12)~~ — đã chốt: có, từ tồn mua dư.
3. ~~Ảnh món ngoài danh mục~~ — đã chốt: bắt buộc (BR-10), FE nén trước khi tải.

Cả ba mục đã được chốt ngày 2026-10-28 và vá vào spec; không còn mục mở.
