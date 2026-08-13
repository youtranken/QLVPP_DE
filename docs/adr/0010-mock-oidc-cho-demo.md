# ADR-0010 — Mock OIDC IdP cho môi trường demo

- **Trạng thái:** Accepted
- **Ngày:** 2026-08-06

## Bối cảnh

Xác thực đi qua **PMH ID** (ADR-0002), nhưng khi làm demo **chưa có `client_id/secret`** và có thể chưa truy cập được PMH ID dev. Vẫn cần demo được **toàn bộ luồng đăng nhập + phân vai trò** trên Docker.

## Quyết định

Dựng một service Docker **`mock-idp`** — một **OIDC provider giả** (đề xuất thư viện `oidc-provider` của panva) cấp đủ Discovery/JWKS/authorize/token/userinfo/end_session + backchannel-logout, kèm vài **user mẫu có `groups`** (admin `VPP-Admin`, nhân viên theo phòng ban). Cấu hình issuer/endpoint qua **biến môi trường** để đổi sang **PMH ID thật chỉ bằng cấu hình**, không sửa code. Directory/webhook được mock ở mức tối giản để thử.

## Hệ quả

**Tích cực:** demo end-to-end (login, map group→vai trò/phòng ban, logout, BCL) mà không phụ thuộc PMH ID; đổi sang prod dễ (đổi env).
**Tiêu cực:** mock **không phản ánh 100%** PMH ID → khi ghép thật (M6) phải kiểm lại: tên group, `allow_all_groups`, route BCL/redirect khớp cách mount `/api`, allowlist IP nếu on-prem.

## Phương án đã cân nhắc

- **Bỏ auth khi demo (giả lập đăng nhập cứng):** nhanh nhưng **không kiểm chứng được luồng OIDC/BFF/BCL** — chính phần rủi ro nhất. → loại.
- **Trỏ thẳng PMH ID dev:** cần credential + mạng + cert self-signed; chưa sẵn sàng lúc demo. → dùng khi có (M6).

## Liên kết

`../architecture/SSO-INTEGRATION.md` §9, §10 · ADR-0002 · ADR-0003.
