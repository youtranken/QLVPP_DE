# E1 — Danh mục món và kho

## E1-S1 Bảng items, item_categories, stock_movements
Migration `0100_vpp_catalog.sql` với CHECK/UNIQUE theo architecture §5.
**AC:** db-spec: `stock_qty < 0` bị từ chối; `max_qty ≤ 0` bị từ chối; `unit` ngoài danh sách bị từ chối; code UNIQUE; tên nhóm trùng (khác hoa thường) bị từ chối; movement `purchase` âm / `adjust` không note bị từ chối.

## E1-S2 Upload ảnh (module files)
`POST /api/files` (≤ 5 MB, jpeg/png/webp theo magic bytes), `GET /api/files/:id` sau guard.
**AC:** module viết mới theo `architecture.md` §8; file `.exe` đổi đuôi `.png` → `FILE_TYPE_INVALID`; 6 MB → `FILE_TOO_LARGE`; GET không phiên → 401; member GET ảnh món (admin tải) → 200 `inline` đúng mime; member A GET ảnh dòng của B → 404; member GET ảnh mình tải → 200; GET không ghi audit; tệp 25 h tuổi không tham chiếu bị cron xóa.

## E1-S3 CRUD món và nhóm (admin)
API + trang Danh mục dạng lưới ảnh: tạo (ảnh bắt buộc), sửa, ngừng, sắp xếp, `admin_only`, `max_qty` (không có ô mức tồn tối thiểu — FR-50); nhãn "thiếu ảnh".
**AC:** tạo món không ảnh → `IMAGE_REQUIRED`; không unit → `UNIT_REQUIRED`; ngừng món → `GET /items` không trả nhưng `?include_inactive_ids=` vẫn trả để hiển thị dòng cũ; `DELETE` món từng có trong phiếu → `ITEM_IN_USE`; `pack_note` hiện cạnh tên.

## E1-S4 Kho: nhập, điều chỉnh, sổ cái, cảnh báo
`POST /admin/items/:id/stock`, `GET …/movements`, trang Kho với KPI "sắp hết".
**AC:** nhập +100 → tồn tăng, movement `purchase`, `low_stock_notified_at` về NULL; điều chỉnh thiếu lý do → `REASON_REQUIRED`; `reason=delivery/issue/return` qua API này bị từ chối; **xuất lẻ** `POST …/issue {qty, recipient_sub, reason}` trừ tồn, movement `issue` có người nhận; không `reason` → `REASON_REQUIRED`; tồn thiếu → `STOCK_INSUFFICIENT`; `recipient_sub` rỗng = dùng chung; người nhận thấy ở `GET me/issues`; đã dùng 80 % tồn sau lần nhập mua gần nhất (`0 < tồn ≤ ⌊20 % × restock_level⌋`) → xuất hiện ở bộ lọc "sắp hết" và KPI, tồn 0 sau nhập → "Hết hàng"; sổ cái hiện lý do và người thực hiện.

## E1-S5 Seed danh mục ban đầu
Script seed ~30 món phòng Công trình thường dùng (không ảnh), nhóm chuẩn.
**AC:** chạy idempotent; trang Danh mục hiện nhãn "thiếu ảnh" cho các món seed.
