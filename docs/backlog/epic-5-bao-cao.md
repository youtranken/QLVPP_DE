# E5 — Báo cáo tháng

## E5-S1 Dịch vụ báo cáo
`GET /admin/reports/:ym` → byItem (total, stock, need) + byPerson.
**AC:** BR-15: đăng ký 5, tồn 2, đã giao 2 → `need = 1`; nợ 2 kỳ trước + đăng ký 3 kỳ này, tồn 0 → `need = 5`; tồn 10, đăng ký 3 → `need = 0`; dòng đã hủy nợ không tính; món ngoài DM `accepted` nhóm riêng `stock=null`, `need = requested`; dòng `rejected`/`pending` không tính, `pending_custom_count` đúng; phần chi tiết nhóm theo `requests.department`.

## E5-S2 Xuất Excel
`GET /admin/reports/:ym/export.xlsx` (exceljs, 2 sheet, tiêu đề theo locale).
**AC:** `POST …/snapshots {kind: xlsx, order_qty}` tạo bản chốt (cột Đặt mua = giá trị admin sửa, mặc định Cần mua; bảng phụ Xuất lẻ trong kỳ) rồi `export.xlsx?lang=en` tải được, mở bằng LibreOffice đọc đúng 2 sheet, tiêu đề tiếng Anh; giao thêm hàng rồi tải lại cùng snapshot → số cũ; danh sách bản chốt của kỳ hiện giờ và người lập; còn dòng `pending` → FE hỏi trước khi chốt.

## E5-S3 Trang in
`/admin/reports/:ym/print` + `print.css`: A4, lặp đầu bảng, 3 ô ký (Người lập · Trưởng phòng · Duyệt), ngày lập.
**AC:** trang in đọc từ bản chốt; Playwright `page.pdf()` ra 1 file có đủ 2 phần, 3 ô ký kèm tên từ `config.signers`, dòng "Lập lúc … bởi …"; không cắt chữ.

## E5-S4 Trang Báo cáo
Chọn tháng, xem 2 bảng, nút Excel / In.
**AC:** Playwright chụp màn hình khớp mockup về cấu trúc.
