# E2 — Phiếu đăng ký của nhân viên

## E2-S1 Luật kỳ (`period.ts`) và `GET /periods/current`
**AC:** unit: 10/11 23:59:59 VN → kỳ 11; 11/11 00:00:00 → kỳ 12; `deadlineOf` với lastDay 28 tháng 2; `daysLeft` ngày 6 → 5, ngày 10 → 1; test với mốc UTC lệch ngày. E2E với `CLOCK_OFFSET_MS`: 15/11 10:00 → `{ym: 2026-12-01, is_open: true, days_left: 26, previous: {ym: 2026-11-01, delivering: true}}`; `CLOCK_OFFSET_MS` ngoài `NODE_ENV=test` → app từ chối khởi động. Kỳ tạo lần đầu chụp `deadline` từ config.

## E2-S2 Bảng periods, requests, request_lines
Migration `0102_vpp_requests.sql`.
**AC:** UNIQUE (period, user); CHECK qty/delivered/cancelled; CHECK cặp (`item_id`, `review_status`) từ chối `item_id NULL + 'n/a'` và dòng ngoài DM không ảnh và `item_id NOT NULL + 'pending'`; partial unique cho phép dòng `converted` trùng món với dòng `n/a`; `ref_line_id` RESTRICT: xóa dòng đã có movement bị từ chối; CASCADE dòng khi xóa phiếu (chỉ test).

## E2-S3 Phiếu của tôi: đọc và lưu
`GET /me/request?ym`, `PUT /me/request/lines` (transaction, FOR UPDATE, kiểm `isOpen` bằng giờ DB).
**AC:** chỉ vai `member`: admin/sa gọi `me/request*` → 403 `FORBIDDEN_ROLE` (E9-S0); mở trang (`GET me/request`) không tạo phiếu (404 `REQUEST_NOT_FOUND`); lưu lần đầu tạo phiếu + period; hai PUT song song lần đầu → một phiếu, cả hai 2xx hoặc một `STALE_UPDATE`, không 500; lưu lại là **diff theo id**: dòng `added_by_admin`/`converted`/đã giao vẫn còn sau khi member lưu; member gửi dòng đó với qty khác → `LINE_READONLY`; body rỗng → phiếu bị xóa (nếu chưa dòng nào giao) hoặc `LINES_EMPTY`; `expected_updated_at` lệch → `STALE_UPDATE`; sau hạn → `PERIOD_LOCKED {next_ym}`; qty 0 → `QTY_INVALID`; qty > max → `QTY_EXCEEDS_MAX`; dòng ngoài DM qty > `default_max_qty` → `QTY_EXCEEDS_MAX`; thiếu `custom_unit` → `UNIT_REQUIRED`; dòng ngoài DM không ảnh vẫn lưu được (ảnh tùy chọn, chốt 2026-10-30); `image_file_id` của người khác → `FILE_FORBIDDEN`; món `admin_only`/ngừng → lỗi tương ứng kèm `line_index`; dòng ngoài danh mục có `review_status='pending'`; `requests.updated_at` và `department` được cập nhật; audit ghi added/removed/changed.

## E2-S4 Chép lại danh sách tháng trước
`POST /me/request/copy-previous`.
**AC:** trả giỏ đề xuất (không ghi DB) từ kỳ gần nhất có phiếu kèm `from_ym`; bỏ món ngừng, món nay `admin_only`, dòng `added_by_admin`, dòng `rejected` → `skipped[{name, reason}]`; dòng `accepted`/`pending` → dòng ngoài DM mới giữ ảnh; dòng `converted` → dòng món; qty > max mới → hạ xuống max và báo; FE: giỏ đang có dòng → hỏi "Thay giỏ hiện tại?"; nút ghi đúng "Chép lại danh sách tháng X".

## E2-S5 Trang đăng ký (member, theo mockup `final/member.html`)
Hero kỳ + đếm ngược, chip nhóm, tìm, lưới thẻ ảnh với stepper, giỏ bên phải / thanh dính dưới, thêm món ngoài danh mục (ảnh từ camera), hộp xác nhận, trạng thái khóa với tiến độ giao.
**AC:** Playwright ở 1280 và 390 px: chọn 3 món + 1 món ngoài DM (ảnh 4 MB từ camera được nén, ảnh EXIF orientation 6 hiển thị đúng chiều), lưu → toast + nhãn "Đã lưu hh:mm", tải lại trang thấy đúng; sửa 1 món → nút đổi "1 thay đổi chưa lưu · Lưu", rời trang có cảnh báo; server với `CLOCK_OFFSET_MS` sau hạn → thông báo khóa và giỏ chuyển sang kỳ mới; dòng "Hành chính thêm" hiện chỉ đọc; 390 px: thanh dưới 3 mục, Lịch sử và Tôi trong ≤ 2 chạm, nút "Thêm món khác" thấy ngay cạnh ô tìm; axe không lỗi tương phản; vitest cho stepper không vượt max, về 0 = bỏ dòng.

## E2-S6 Lịch sử
`GET /me/requests` + trang Lịch sử.
**AC:** liệt kê kỳ, số món, trạng thái giao (đủ / còn nợ n), trạng thái món ngoài DM kèm lý do từ chối.
