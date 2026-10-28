# E8 — Giai đoạn 2

## E8-S1 Email nhắc (SMTP)
Bảng `email_outbox`, worker trong process, cấu hình SMTP qua env; nhắc ngày 1 và ngày 9; mail "phiếu đã giao đủ".
**AC:** Mailpit nhận đúng mẫu; lỗi SMTP không chặn thao tác người dùng.

## E8-S2 Phiếu giao nhận
Khi phòng cung cấp mẫu: UI tạo đợt giao từ các dòng đã giao, điền `deliveries`, trang in phiếu có chữ ký người giao/người nhận.
**AC:** theo mẫu thực tế.

## E8-S3 Import danh mục từ Excel
Xem trước lỗi từng dòng, nạp, ảnh bổ sung sau.
**AC:** file 50 dòng có 3 lỗi → báo đúng dòng; nạp 47.

## E8-S4 Thống kê quý/năm
Tổng theo món và theo người qua nhiều kỳ; xuất Excel.
**AC:** số khớp tổng các bản chốt tháng.

## E8-S5 Kiểm kê hàng loạt và sổ cái toàn kho
In bảng Món · Tồn sổ · Thực đếm; nhập thực đếm một lượt, hệ thống tạo điều chỉnh với một lý do chung; xuất Excel sổ cái toàn kho theo khoảng ngày.
**AC:** 30 món nhập trong một màn; chênh lệch tạo đúng movement `adjust`; Excel có tồn đầu/cuối kỳ.

## E8-S6 Giao theo phòng ban/tổ và bản in ký nhận
Nếu phòng ban PMH ID quá thô → thêm trường "Tổ" do Hành chính gán. "Giao tất cả" cho mọi phiếu của một nhóm; bản in "Danh sách giao ngày … theo nhóm" có cột ký (tiền thân phiếu giao nhận E8-S2); thông báo tay "Hàng tháng N đã về, mời lên nhận".
**AC:** một thao tác giao n phiếu, trả danh sách dòng không giao được; bản in nhóm theo nhóm đã chọn.
