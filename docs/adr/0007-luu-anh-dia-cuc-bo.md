# ADR-0007 — Lưu ảnh trên đĩa cục bộ (không object storage) cho MVP

- **Trạng thái:** Accepted
- **Ngày:** 2026-08-06

## Bối cảnh

Chỉ mục **"Khác"** cho phép đính kèm **ảnh** (`image/*`, ≤ 5MB). Lượng ảnh **ít** (mỗi kỳ mỗi người tối đa vài ảnh), quy mô ≤ 500 user. MVP chạy **một node** trên Docker.

## Quyết định

Lưu ảnh trên **đĩa cục bộ** qua **Docker volume**; upload bằng `multer` (kiểm mime + kích thước), phục vụ qua **endpoint có kiểm quyền** (chống path traversal). Lưu **đường dẫn/tên file** trong DB (`request_items.attachment_path`).

## Hệ quả

**Tích cực:** đơn giản, không thêm dịch vụ; sao lưu = backup thư mục; đủ cho lượng ảnh nhỏ; hợp on-prem.
**Tiêu cực:** khi chạy **nhiều node api** cần chia sẻ file (NFS) hoặc **đổi sang object storage** — đây là điểm phải nâng cấp lúc scale (thuộc Phương án B).

## Phương án đã cân nhắc

- **MinIO/S3 (object storage):** đúng khi đa node/cần URL ký/CDN — **thừa** cho MVP một node, thêm một dịch vụ phải vận hành. → để dành Phương án B.
- **Lưu ảnh trong DB (bytea):** phình DB, khó backup/serve. → loại.

## Liên kết

`../architecture/SDD.md` §4, §9 · `../product/USER_STORIES.md` CORE-3 · ADR-0001.
