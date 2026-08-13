# ADR-0012 — Không có mô-đun thanh toán

- **Trạng thái:** Accepted
- **Ngày:** 2026-08-06

## Bối cảnh

Quy trình VPP chỉ theo **số lượng** món; chủ nghiệp vụ xác nhận **không dùng giá tiền / thành tiền / ngân sách / định mức** (BR-11). Không có giao dịch tiền, không thu phí người dùng.

## Quyết định

**Không xây dựng bất kỳ chức năng thanh toán/giá tiền nào** ở phạm vi hiện tại: không cổng thanh toán, không đơn giá, không tính tiền trong báo cáo. Báo cáo Excel chỉ liệt kê **loại VPP + số lượng**.

## Hệ quả

**Tích cực:** giảm phạm vi, mô hình dữ liệu và báo cáo đơn giản; không rủi ro bảo mật/tuân thủ của xử lý thanh toán.
**Tiêu cực:** nếu sau này cần duyệt **ngân sách**, phải bổ sung (đơn giá theo món, thành tiền, có thể định mức/phòng ban) — mở lại PRD.

## Phương án đã cân nhắc

- **Thêm đơn giá + thành tiền ngay từ MVP:** chủ nghiệp vụ **không cần** cho mục tiêu hiện tại (đăng ký + giao + trình ký theo số lượng). → loại khỏi phạm vi (đánh dấu là hướng mở rộng tương lai).

## Liên kết

`../product/PRD.md` §11 (BR-11) · `../product/USER_STORIES.md` mục "Payment — Không áp dụng".
