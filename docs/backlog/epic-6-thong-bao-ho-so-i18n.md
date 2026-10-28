# E6 — Chuông thông báo, hồ sơ, song ngữ

## E6-S1 Thông báo trong app
Ghi `in_app_notifications` tại các sự kiện (giao đủ, review, món ngoài DM mới cho admin, sắp hết kho); API đọc/đánh dấu đọc; chuông ở cả hai shell.
**AC:** mỗi sự kiện tạo đúng 1 bản ghi/người (`UNIQUE (event_id, user_sub)`, công thức `event_id` theo `architecture.md` §9); INSERT thông báo lỗi không làm hỏng giao dịch nghiệp vụ; chuông hiện số chưa đọc; `POST read {ids}` và `read {}` (tất cả); bấm → đã đọc + điều hướng `link`.

## E6-S2 Lịch nhắc
Cron 00:05 giờ VN: ngày 1 "kỳ mở"; ngày `lastDay−2` "còn 2 ngày" cho người chưa có phiếu.
**AC:** cron mỗi giờ, `timeZone` VN; chạy 5 lần cùng ngày không tạo trùng; api khởi động lại lúc 00:10 vẫn gửi "kỳ mở" của ngày 1; ngày 8 chỉ người chưa có phiếu nhận "chưa đăng ký — hết hạn 23:59 ngày 10"; ngày 11 admin nhận "kỳ đã khóa x/y" và `periods.headcount` được ghi; `low_stock` một lần cho tới khi nhập mua; thông báo > 90 ngày bị xóa; đổi `registration_last_day` đổi ngày nhắc cho kỳ sau.

## E6-S3 Hồ sơ
Tên, email, mã NV, phòng ban, vai; nút đổi ngôn ngữ; Đăng xuất (local); liên kết "Đăng xuất khỏi PMH ID".
**AC:** dữ liệu từ `me`; đăng xuất local xong vào lại không hỏi mật khẩu khi phiên SSO còn.

## E6-S4 Song ngữ hoàn chỉnh
Toàn bộ nhãn, lỗi, thông báo, cột Excel; `name_en` cho món.
**AC:** không còn chuỗi cứng trong component (lint rule hoặc grep); test snapshot en/vi cho các màn liệt kê ở `prd.md` §8; `export.xlsx?lang=` đổi tiêu đề cột.
