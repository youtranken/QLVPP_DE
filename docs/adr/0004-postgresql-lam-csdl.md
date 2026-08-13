# ADR-0004 — PostgreSQL làm cơ sở dữ liệu chính

- **Trạng thái:** Accepted
- **Ngày:** 2026-08-06

## Bối cảnh

Dữ liệu DE-VPP có **quan hệ rõ** (departments–users–requests–request_items–items–categories) và cần **ràng buộc toàn vẹn mạnh**: mỗi người **1 đơn hiệu lực/kỳ**, vòng đời duyệt→giao cần **giao dịch ACID**, audit đầy đủ. Truy vấn chủ yếu là lọc + tổng hợp theo kỳ/phòng ban.

## Quyết định

Dùng **PostgreSQL 16** làm CSDL chính, truy cập qua **Drizzle ORM**. Dùng đặc trưng Postgres: **partial unique index** cho "1 đơn hiệu lực/kỳ" (`WHERE status IN ('submitted','approved','delivered')`), `text[]` cho `groups`, `jsonb` cho `audit_log.detail`, `FOR UPDATE SKIP LOCKED` cho hàng đợi nhẹ khi cần.

## Hệ quả

**Tích cực:** toàn vẹn dữ liệu bằng ràng buộc DB (không phụ thuộc logic app); truy vấn tổng hợp mạnh; một DB duy nhất, dễ backup (dump); miễn phí/mã nguồn mở, chạy tốt trong Docker/on-prem.
**Tiêu cực:** cần quản lý migration schema; mở rộng đọc cần read replica (chưa cần ở ≤500).

## Phương án đã cân nhắc

- **MongoDB/NoSQL:** mô hình quan hệ + ràng buộc 1-đơn/kỳ + giao dịch nhiều bảng sẽ **khó và dễ sai** trên document store. → loại (không chọn vì phổ biến).
- **SQLite:** đủ nhẹ nhưng kém khi nhiều ghi đồng thời (cao điểm 1–10) và thiếu tính năng (partial index/jsonb/array đầy đủ, đồng thời). → loại cho môi trường nhiều người.

## Liên kết

`../architecture/SDD.md` §5 (schema, index) · ADR-0001.
