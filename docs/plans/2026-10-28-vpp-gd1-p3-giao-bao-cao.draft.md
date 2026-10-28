# VPP GĐ1 — Plan 3 (BẢN NHÁP): Giao hàng · Báo cáo · Chuông

> **Tách 2026-10-28 (chủ dự án):** Plan 3 chỉ còn phần code của dự án. Triển khai prod (compose prod, runbook, hồ sơ PMH ID, nghiệm thu) chuyển sang **Plan 4** — `2026-10-28-vpp-gd1-p4-trien-khai.draft.md`.

> Bản nháp phạm vi và thứ tự, viết trong lúc Plan 2 chạy. **Chưa phải plan thực thi:** tên hàm/endpoint/kiểu dữ liệu sẽ chốt bằng `superpowers:writing-plans` sau khi Plan 2 gộp `main` (plan dựa vào mã thật của `requests`, `periods`, `RequestLinesWriter`, `RequestView`, trang Tổng hợp).

**Mục tiêu:** trọn vòng một tháng — Hành chính giao hàng (đủ / thiếu / hoàn tác / hủy nợ), theo dõi Còn nợ xuyên kỳ, lập báo cáo có bản chốt (Excel 2 sheet + trang in 3 ô ký), chuông thông báo + lịch nhắc; kết thúc bằng smoke trọn vòng tháng trên dev (triển khai thật ở Plan 4).

**Spec:** `docs/prd.md` FR-40…44, FR-35, FR-60…62, FR-70, BR-8/9/13/15; `docs/architecture.md` §6 (giao, hoàn tác, hủy nợ), §9 (thông báo), §10 (báo cáo), §12 (triển khai); backlog E4, E5, E6-S1/S2; `design-preview/_SPEC.md` (Admin · Giao hàng / Còn nợ / Báo cáo).

## Phạm vi dự kiến (17 task — sau khi agent soi bản nháp 2026-10-28)

| # | Task | Làm | Review |
|---|---|---|---|
| 1 | Migration `0103`: CHECK `periods.ym` ngày 1; `in_app_notifications.event_id` → `text NOT NULL` (0012 đang là uuid — công thức §9 là chuỗi); `report_snapshots`; `deliveries` (giữ chỗ GĐ2); **`line_deliveries(id, line_id, qty, movement_id NULL, actor_sub, created_at)`** (đợt giao — lịch sử giao cho cả dòng ngoài DM `accepted` không có biến động kho); bỏ `items.min_stock`; map SQLSTATE 23001; quét carry Task 9–17 của Plan 2 | Sonnet | Opus |
| 2 | `NotificationsService` (ghi trong SAVEPOINT, hàm `event_id` thuần, xác định admin nhận = user active có group admin, không gồm SA) + `GET me/notifications`, `POST me/notifications/read` | Opus | Opus |
| 3 | Giao một dòng: ghi đợt giao, dòng `accepted` không trừ kho, `expected_delivered_qty`, chuông "phiếu đã giao đủ" (định nghĩa: mọi dòng hiệu lực `delivered + cancelled = qty`, không còn dòng `pending`) | Opus | Opus |
| 4 | Giao tất cả theo phiếu (một tx + SAVEPOINT, gồm dòng `accepted`, `pending/rejected` vào `failed[]`, db-spec đồng thời) | Opus | Opus |
| 5 | Lịch sử đợt giao của dòng + Hủy nợ (lý do bắt buộc, chuông cho người đăng ký) + `GET admin/backlog?by=item\|person` — dùng **một định nghĩa SQL "phần còn lại hiệu lực"** chung cho Còn nợ, báo cáo, KPI | Opus | Sonnet |
| 7 | Móc thông báo vào code Plan 2: `line_review` (review), `custom_line_new` (writer) | Sonnet | Opus |
| 8 | Cron mỗi giờ (giờ VN, gọi thẳng `runHourly(now)` trong test): kỳ mở, nhắc (ngày tính từ `periods.deadline`), kỳ khóa + ghi `headcount` bằng **đúng hàm đếm sống của Tổng hợp**, sắp hết (một lần tới khi nhập mua), xóa > 90 ngày | Opus | Opus |
| 9 | `ReportsService.build` + `GET admin/reports/:ym` (BR-15, nhóm ngoài DM, chi tiết phòng ban, `issues`, `pending_custom_count`) | Opus | Opus |
| 10 | Bản chốt + Excel 2 sheet (exceljs thêm lại, `npm audit`), `?lang`, giữ cố định `signers`/`created_by`/`order_qty` (nguyên ≥ 0), dữ liệu trang in | Opus | Opus |
| 11 | Web: chuông ở hai shell (số chưa đọc — poll + khi focus, danh sách, đánh dấu đọc, link: member → `/history/:ym`, admin → `/admin/...`) | Sonnet | Opus |
| 12 | Web: trang Giao hàng + nút "Giao" từ bảng Tổng hợp, KPI/tiến độ cập nhật sau giao | Opus | Opus |
| 13 | Web: trang Còn nợ (theo món/người, giao bổ sung, lịch sử đợt, hủy nợ có lý do) | Opus | Opus |
| 14 | Web: trang Báo cáo (cột Đặt mua, bảng Xuất lẻ, cảnh báo dòng chờ xem, danh sách bản chốt) | Opus | Opus |
| 15 | Web: trang in từ bản chốt + `print.css` + Playwright `page.pdf()` | Sonnet | Opus |
| 16 | Web member: mục "Nhận lẻ" trong Lịch sử (`GET me/issues`), "đã hủy n", tiến độ giao từng dòng | Sonnet | Opus |
| 17 | Song ngữ hoàn chỉnh (E6-S4, PRD §10 mục 9): topic thông báo, nhãn hành động Nhật ký (đang hiện mã thô), cột Excel, snapshot vi/en màn mới, grep chuỗi cứng, axe 390 | Sonnet | Opus |
| 18 | Smoke trọn vòng tháng (Playwright tuần tự/khóa, hậu tố, dọn `finally`): gồm "bấm giao hai lần liên tiếp", "mở lại bản chốt sau khi giao thêm"; đối chiếu PRD §10 mục 5, 6, 9; map, README, architecture | Opus | Opus |

Carry thêm (từ sổ Plan 1/Plan 2): test `me/issues` loại người khác; chặn bấm đúp bằng `useRef` ở trang Kho; Playwright 2 project đua trên DB dev (nếu Plan 2 Task 17 chưa sửa); mốc sắp hết < 5 không bao giờ cảnh báo — cron kế thừa (đã báo chủ dự án).

## Kiểm thử (đã chốt 2026-10-28)
- Chuông: e2e dựng dữ liệu giả trong `vpp_test`, đồng hồ cố định / `CLOCK_OFFSET_MS` qua các mốc ngày 1 / 8 / 11 / mỗi giờ; mỗi `event_id` đúng 1 bản ghi mỗi người; chạy lặp không trùng; api khởi động lại không mất nhắc.
- Báo cáo: các ca BR-15 trong backlog E5-S1; bản chốt không đổi sau khi giao thêm; Excel đọc lại được bằng LibreOffice (2 sheet, tiêu đề theo `?lang`).
- Giao: 2 giao song song cùng dòng → một thành công; kho không âm; giao tất cả một phần thất bại không hỏng phần còn lại.

## Quyết định đã chốt liên quan Plan 3
- **Hủy nợ phải có lý do và báo cho người đăng ký:** chuông "Hành chính đã hủy n <món> trên phiếu tháng N — lý do …" (Plan 3); email cùng nội dung khi có module email (GĐ2, E8-S1). Chuông "đã giao đủ" chỉ gửi khi giao thật làm phiếu đủ.
- **Bỏ "Hoàn tác đợt giao" khỏi GĐ1** (chủ dự án: ghi giao nhầm thì Hành chính tự đưa bù bên ngoài). Vẫn giữ lịch sử từng đợt giao của dòng (FR-42).
- Mỗi lần bấm Xuất Excel / In trình ký từ số liệu sống tạo **một bản chốt mới** (giờ + người lập); tải lại/in lại từ danh sách bản chốt không tạo thêm.
- **Chỉ giao hàng sau khi kỳ đã khóa** (API từ chối giao cho phiếu của kỳ đang mở — mã lỗi mới, ví dụ `PERIOD_NOT_LOCKED`); nhu cầu gấp trước hạn dùng Xuất lẻ (trừ kho ngay, FR-54).
- Giao theo từng phiếu đã có (tick dòng / sửa số thực giao / "Giao tất cả" cho phiếu); giao theo phòng ban + bản in ký nhận để GĐ2.
- Tên 3 người ký và liên hệ Hành chính lấy từ trang Cấu hình.
- Quyết định về PMH ID và máy prod: xem Plan 4.
