# ADR-0011 — Thông báo trong app (không email/bên thứ ba)

- **Trạng thái:** Accepted
- **Ngày:** 2026-08-06

## Bối cảnh

Cần báo cho **nhân viên** khi đơn được duyệt/từ chối/đã giao, và báo **admin** khi có đơn mới. Hệ thống **khép kín** (ngoài PMH ID), không tích hợp Email/Zalo/Teams.

## Quyết định

Làm **thông báo trong ứng dụng** (chuông): lưu bảng **`notifications`** (Postgres), FE hiển thị số chưa đọc và danh sách; cập nhật bằng **poll** định kỳ hoặc **SSE nhẹ**. Không gửi email/không dùng dịch vụ đẩy bên ngoài.

## Hệ quả

**Tích cực:** không phụ thuộc hạ tầng mail/SMTP; đơn giản; đủ cho nhu cầu; dữ liệu thông báo nằm chung DB (audit được).
**Tiêu cực:** người dùng phải mở app mới thấy (không có push ngoài giờ); poll tạo tải nhẹ (chấp nhận ở quy mô này); realtime tức thì cần SSE/WS (nâng ở Phương án B nếu cần).

## Phương án đã cân nhắc

- **Email/Zalo/Teams:** ngoài phạm vi (khép kín) và cần tích hợp/hạ tầng. → loại.
- **WebSocket realtime ngay từ MVP:** phức tạp hơn mức cần; poll/SSE đủ. → để dành khi cần.

## Liên kết

`../product/PRD.md` FR-50 · `../product/USER_STORIES.md` NOTIF-1/2 · `../architecture/SDD.md` §5.
