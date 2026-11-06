# E3 — Tổng hợp, điều chỉnh, món ngoài danh mục

## E3-S1 Tổng hợp kỳ
`GET /admin/periods/:ym/summary` (KPI), `GET …/requests?by=person|item&filter=`.
**AC:** KPI đúng số với dữ liệu seed; mẫu số = `periods.headcount` (kỳ khóa) hoặc đếm sống (kỳ mở), cả hai loại người thuộc `admin_group`; `registered` vẫn đếm mọi phiếu của kỳ (phiếu cũ của người nay là Hành chính); lọc "chờ giao" chỉ trả phiếu có dòng hiệu lực chưa đủ (dòng `rejected`/`pending`/đã hủy nợ không tính); nhóm theo `requests.department` ("Chưa có phòng ban" khi NULL); `GET …/unregistered` trả tên + phòng ban, FE có nút sao chép.

## E3-S2 Trang Tổng hợp kỳ (theo `final/admin.html`)
KPI bấm-để-lọc, chọn tháng, bảng theo người/món, nhãn trạng thái, nhãn "Người đã nghỉ".
**AC:** Playwright: bấm KPI đổi bảng; chọn tháng trước hiện dữ liệu cũ; user `locked` hiện nhãn.

## E3-S3 Điều chỉnh phiếu (admin)
`PUT /admin/requests/:id/lines {lines, reason, expected_updated_at}`; drawer theo mockup (dòng đổi tô màu, giá trị cũ).
**AC:** sau hạn không lý do → `REASON_REQUIRED`; `expected_updated_at` lệch → `STALE_UPDATE`; giảm qty dưới đã giao → `QTY_BELOW_DELIVERED {delivered}`; bớt dòng đã giao một phần bị từ chối; audit ghi `{added, removed, changed[{line, old, new}], reason, self}`; admin sửa phiếu của chính mình → `self=true`, lọc được ở Nhật ký; admin thêm được món `admin_only` → dòng có `added_by_admin=true`; UI: ô lý do riêng cho điều chỉnh, không dùng chung với Từ chối.

## E3-S4 Tạo phiếu hộ — Đã gỡ (Đ9)
> Đã gỡ 2026-11-06 (Đ9): Hành chính không tạo phiếu thay nhân viên; route trả 404. Phần dưới giữ làm lịch sử.

`POST /admin/requests {user_sub, ym}` từ danh bạ.
**AC:** kỳ khóa → `PERIOD_LOCKED`; đã có phiếu → `REQUEST_EXISTS`; người chỉ mở app chưa lưu → tạo hộ thành công; user `locked` → `USER_INACTIVE`; sub lạ → `USER_NOT_FOUND`; người thuộc `admin_group` → 400 `USER_IS_ADMIN` (lỗi hiện tại ô "Người đăng ký"); `created_by_sub` = admin.

## E3-S5 Món ngoài danh mục
`GET /admin/review`, `POST /admin/lines/:id/review {action, note, item}`; trang hàng chờ (ảnh, tên, người, số).
**AC:** ba nút mở hộp riêng và áp dụng ngay (bấm Chấp nhận rồi Hủy ngăn → tải lại vẫn `accepted`); `accept` → `accepted`; `convert` tạo món (ảnh và unit bắt buộc: dùng ảnh dòng nếu có, dòng không ảnh thì Hành chính tải ảnh món, thiếu → `IMAGE_REQUIRED`; cảnh báo nếu unit khác `custom_unit`) hoặc gắn vào món có sẵn + `review_status='converted'`, **không gộp** dòng trùng; hai admin convert cùng dòng → một `LINE_ALREADY_REVIEWED`; `reject` không `note` → `REASON_REQUIRED`, `review_note` ghi riêng không đụng `reason` điều chỉnh; dòng chép lại từ dòng `accepted` kỳ trước hiện gợi ý "Đã chấp nhận kỳ trước"; người đăng ký nhận đúng 1 thông báo `line_review:<id>`.
