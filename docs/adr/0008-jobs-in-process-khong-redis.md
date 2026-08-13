# ADR-0008 — Background jobs in-process, không Redis/queue

- **Trạng thái:** Accepted
- **Ngày:** 2026-08-06

## Bối cảnh

Có vài tác vụ nền: **đồng bộ Directory** (~60'), **dọn phiên hết hạn**, **xử lý webhook/BCL** (idempotent, có thể retry), **fan-out thông báo**. Tần suất thấp, khối lượng nhỏ ở quy mô ≤ 500.

## Quyết định

Chạy jobs **trong tiến trình `api`** bằng **`@nestjs/schedule`** (cron). Khi cần hàng đợi/đảm bảo xử-lý-một-lần, dùng **Postgres `SELECT … FOR UPDATE SKIP LOCKED`** làm hàng đợi nhẹ. **Không** dùng Redis/BullMQ/broker ở MVP.

## Hệ quả

**Tích cực:** không thêm dịch vụ (Redis) → ít điểm hỏng, ít vận hành; đủ cho tần suất thấp; hàng đợi và dữ liệu **cùng một giao dịch DB** (nhất quán).
**Tiêu cực:** job nặng chiếm tài nguyên tiến trình API (không đáng kể ở quy mô này); nếu chạy nhiều bản api phải chống chạy trùng cron (dùng khoá DB/advisory lock); thiếu dashboard hàng đợi.

## Phương án đã cân nhắc

- **Redis + BullMQ + Worker riêng:** retry/quan sát tốt, tách tải — nhưng **thừa** cho ≤500 và thêm 2 thành phần (Redis + worker). → để dành Phương án B (nâng khi webhook/job tăng mạnh).
- **Cron hệ điều hành/container riêng:** phân mảnh, khó chia sẻ code/kết nối DB. → loại.

## Liên kết

`../architecture/SDD.md` §4, §7 · `../architecture/ARCHITECTURE-OPTIONS.md` (tín hiệu nâng B) · ADR-0001.
