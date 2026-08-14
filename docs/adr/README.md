# Architecture Decision Records (ADR) — DE-VPP

Thư mục này ghi lại **các quyết định kiến trúc quan trọng** của dự án, mỗi quyết định một file.
ADR giúp người vào sau hiểu **vì sao** chọn như vậy (không chỉ _chọn gì_), và bối cảnh lúc quyết định.

## Quy ước

- Tên file: `NNNN-tieu-de-kebab.md` (số tăng dần, không tái sử dụng số).
- **Trạng thái**: `Proposed` (đề xuất) · `Accepted` (đã chấp nhận) · `Superseded by ADR-XXXX` (bị thay thế) · `Deprecated`.
- ADR **không sửa nội dung quyết định cũ**; nếu đổi ý → viết ADR mới **thay thế** ADR cũ và cập nhật liên kết.
- Mẫu (MADR-lite): **Bối cảnh → Quyết định → Hệ quả (tích cực/tiêu cực) → Phương án đã cân nhắc → Liên kết**.

## Danh mục

| ADR                                                   | Tiêu đề                                              | Trạng thái                    |
| ----------------------------------------------------- | ---------------------------------------------------- | ----------------------------- |
| [0001](./0001-kien-truc-tong-the-modular-monolith.md) | Kiến trúc tổng thể: Modular Monolith (Phương án A)   | Accepted                      |
| [0002](./0002-xac-thuc-pmh-id-sso-bff.md)             | Xác thực qua PMH ID SSO theo mẫu BFF                 | Accepted                      |
| [0003](./0003-tich-hop-sso-day-du.md)                 | Tích hợp SSO đầy đủ: Directory + Webhook + BCL       | Accepted                      |
| [0004](./0004-postgresql-lam-csdl.md)                 | PostgreSQL làm cơ sở dữ liệu chính                   | Accepted                      |
| [0005](./0005-monorepo-typescript-shared.md)          | Monorepo pnpm + `packages/shared` (TypeScript FE+BE) | Accepted                      |
| [0006](./0006-frontend-spa-antd.md)                   | Frontend SPA React + Ant Design (không SSR)          | Accepted                      |
| [0007](./0007-luu-anh-dia-cuc-bo.md)                  | Lưu ảnh trên đĩa cục bộ (không object storage)       | Accepted                      |
| [0008](./0008-jobs-in-process-khong-redis.md)         | Background jobs in-process, không Redis/queue        | Accepted                      |
| [0009](./0009-mo-hinh-don-ky-va-cua-so-1-10.md)       | Mô hình đơn theo kỳ + cửa sổ ngày 1–10               | Một phần bị thay bởi ADR-0013 |
| [0010](./0010-mock-oidc-cho-demo.md)                  | Mock OIDC IdP cho môi trường demo                    | Accepted                      |
| [0011](./0011-thong-bao-trong-app.md)                 | Thông báo trong app (không email/bên thứ ba)         | Accepted                      |
| [0012](./0012-khong-thanh-toan.md)                    | Không có mô-đun thanh toán                           | Accepted                      |
| [0013](./0013-khung-ngay-dang-ky-admin-cau-hinh.md)   | Khung ngày đăng ký do admin cấu hình                 | Accepted                      |

_Liên quan:_ `../product/PRD.md` · `../architecture/SDD.md` · `../architecture/SSO-INTEGRATION.md` · `../architecture/ARCHITECTURE-OPTIONS.md`
