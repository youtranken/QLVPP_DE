# ADR-0009 — Mô hình đơn theo kỳ + cửa sổ đăng ký ngày 1–10

- **Trạng thái:** Accepted
- **Ngày:** 2026-08-06

## Bối cảnh

Nghiệp vụ: nhân viên đăng ký VPP **hằng tháng**, chỉ trong **ngày 1–10** (từ ngày 11 tính sang tháng sau); **mỗi người một đơn hiệu lực/kỳ**, gửi một lần **không tự sửa**; đơn bị **từ chối/huỷ** vẫn giữ làm lịch sử và cho **gửi lại**.

## Quyết định

- **Kỳ** = chuỗi `YYYY-MM`, xác định bởi `periodForDate(now)` (ngày ≤10 → tháng này; ≥11 → tháng sau) trong `packages/shared`.
- **Cửa sổ 1–10 khoá cứng** cho nhân viên (`isRegistrationOpen`); **admin bỏ qua** để xử lý đặc biệt.
- **1 đơn hiệu lực/kỳ** enforce bằng **partial unique index** `(user_id, period) WHERE status IN ('submitted','approved','delivered')` — đơn `rejected`/`cancelled` không chiếm chỗ nên gửi lại được.
- Vòng đời: `submitted → approved → delivered` | `→ rejected` | `→ cancelled`; **chỉ giao sau khi duyệt**.
- Container đặt **`TZ=Asia/Ho_Chi_Minh`** để tính ngày/kỳ theo giờ VN.

## Hệ quả

**Tích cực:** ràng buộc "1 đơn/kỳ" do **DB đảm bảo** (không lệ thuộc logic app, an toàn với race/nhiều tab); quy tắc kỳ/cửa sổ **dùng chung FE+BE** nên không lệch; lịch sử gửi-lại rõ ràng.
**Tiêu cực:** khoá cứng 1–10 khiến thao tác ngoài ngày phải qua admin (chấp nhận theo yêu cầu); phụ thuộc TZ cấu hình đúng.

## Phương án đã cân nhắc

- **Cho sửa đơn nhiều lần trong cửa sổ:** linh hoạt hơn nhưng chủ nghiệp vụ chọn "gửi một lần, không sửa". → theo quyết định nghiệp vụ.
- **Kiểm "1 đơn/kỳ" bằng logic ứng dụng:** dễ hở khi đồng thời. → chọn ràng buộc DB.

## Liên kết

`../product/PRD.md` §8 (BR-01…BR-10) · `../architecture/SDD.md` §3, §5, §6 · `packages/shared`.
