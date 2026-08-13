# ADR-0001 — Kiến trúc tổng thể: Modular Monolith (Phương án A)

- **Trạng thái:** Accepted
- **Ngày:** 2026-08-06
- **Người quyết định:** Chủ nghiệp vụ + kiến trúc sư giải pháp

## Bối cảnh

DE-VPP phục vụ **≤ 500 người dùng**, một công ty, cao điểm dồn ngày 1–10 hằng tháng nhưng tổng lượng nhỏ. Ưu tiên **demo trên Docker** trước, môi trường thật (on-prem/EDGE) quyết định sau. Đội vận hành nội bộ. Yêu cầu tích hợp SSO đầy đủ (OIDC BFF + Directory + Webhook + BCL), dữ liệu quan hệ, xuất Excel, thông báo trong app.

## Quyết định

Chọn **Phương án A — Modular Monolith gọn**: **một** backend NestJS (API + BFF auth + nhận webhook/BCL + jobs định kỳ trong cùng tiến trình) · **một** PostgreSQL · SPA React/Antd sau nginx · ảnh trên **đĩa cục bộ** (volume). **Không** Redis, **không** object storage, **không** worker riêng ở MVP. Backend **module hoá** và **API stateless** (phiên ở DB) để có đường nâng lên "Phương án B" (tách worker + Redis + MinIO) khi có tín hiệu tải thật.

## Hệ quả

**Tích cực:** ít bộ phận → ít điểm hỏng; deploy/sao lưu đơn giản (dump Postgres + thư mục ảnh); demo nhanh (4 container); chi phí vận hành thấp (1 node); vẫn scale ngang `api` được (phiên ở DB).
**Tiêu cực:** jobs chạy chung tiến trình API (không đáng kể ở quy mô này); file cục bộ khó chia sẻ khi chạy **nhiều node** (phải đổi sang object storage lúc đó); chuông ở mức poll/SSE nhẹ, chưa realtime mạnh.

## Phương án đã cân nhắc

- **B — Tách dịch vụ + Redis + MinIO + Worker:** bền/mở rộng cao hơn nhưng **thừa** cho ≤500, 7 container, nhiều điểm hỏng, ra demo chậm. → để dành khi có tải thật.
- **Serverless/cloud-managed (Lambda/Cognito…):** lệch mô hình (auth là PMH ID tự-host, prod có thể on-prem), khoá nhà cung cấp, khó cho webhook/BCL/long-job. → loại.

## Liên kết

`../architecture/ARCHITECTURE-OPTIONS.md` (phân tích 16 chiều) · `../architecture/SDD.md` §4.
