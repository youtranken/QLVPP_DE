# E4 — Giao hàng và còn nợ

## E4-S1 Giao từng dòng
`POST /admin/lines/:id/deliver {qty}` atomic với kho.
**AC:** giao 3/5 với `expected_delivered_qty=0` → `delivered_qty=3`, movement −3; gửi lại cùng body → `STALE_UPDATE` (không giao đôi); giao 3 nữa → `DELIVER_EXCEEDS_QTY`; tồn 2 giao 3 → `STOCK_INSUFFICIENT {available: 2}`; dòng `pending` → `LINE_NOT_REVIEWED`; dòng `rejected` → `LINE_REJECTED`; `accepted` giao không trừ kho; db-spec 2 giao song song cùng dòng → một thành công; kho không âm.

## E4-S2 Giao tất cả theo phiếu
`POST /admin/requests/:id/deliver-all`.
**AC:** một transaction, SAVEPOINT từng dòng: dòng 3 thiếu kho không làm hỏng dòng 1–2; trả `{delivered[], failed[{line_id, code}]}`; hai admin bấm cùng lúc → chỉ một bộ movement; thông báo người nhận đúng 1 lần khi đủ (`event_id` tất định).

## E4-S3 Còn nợ
`GET /admin/backlog?by=item|person`, lịch sử đợt giao, trang Còn nợ với nút giao bổ sung.
**AC:** liệt kê dòng hiệu lực có `delivered_qty + cancelled_qty < qty` của mọi kỳ (không có dòng `rejected`/`pending`); giao bổ sung tới đủ → biến mất; lịch sử hiện 2 đợt (không có Hoàn tác — FR-44); **Hủy nợ** với lý do → `cancelled_qty` = phần còn lại, rời Còn nợ, lịch sử member hiện "đã hủy n"; thiếu lý do → `REASON_REQUIRED`.

## E4-S4 Trang Giao hàng
Danh sách phiếu kỳ, tick dòng / Giao tất cả, nhập số thực giao.
**AC:** Playwright: giao thiếu rồi kiểm Còn nợ; thanh tiến độ cập nhật ở Tổng hợp.
