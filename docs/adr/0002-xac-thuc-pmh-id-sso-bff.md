# ADR-0002 — Xác thực qua PMH ID SSO theo mẫu BFF

- **Trạng thái:** Accepted
- **Ngày:** 2026-08-06
- **Thay thế:** quyết định "tài khoản tự quản" ở PRD v1.1 (đã bị bãi bỏ)

## Bối cảnh

Ban đầu dự kiến app **tự quản tài khoản** (email + mật khẩu, admin tạo/import). Sau khi đọc thư mục `integration/`, phát hiện công ty đã có **PMH ID** — hệ thống đăng nhập tập trung chuẩn **OpenID Connect** cho mọi project nội bộ (QLTS, QLHS…). Quy tắc của PMH ID: project **không tự quản user/mật khẩu**, nhận `client_id/secret`, đăng nhập qua OIDC, nhận JWT chứa `sub`/`email`/`groups`.

## Quyết định

DE-VPP **đăng nhập qua PMH ID SSO** thay cho tài khoản tự quản. Dùng mẫu **BFF (Backend-for-Frontend)**: backend NestJS là **confidential client** giữ `client_secret`, thực hiện Authorization Code + **PKCE**, giữ token OIDC ở server, cấp **cookie phiên `httpOnly`** cho trình duyệt. Verify JWT **offline** qua JWKS. Tham chiếu user nội bộ bằng **`sub`** (không dùng email). Vai trò suy từ **`groups`** (`VPP-Admin` ⇒ admin), phòng ban từ `groups`. **Không lưu mật khẩu** trong app.

## Hệ quả

**Tích cực:** một danh tính chung toàn công ty; không phải quản mật khẩu/OTP/khoá tài khoản (PMH ID lo); token không lộ ra trình duyệt (BFF); bảo mật cao.
**Tiêu cực:** phụ thuộc PMH ID (cần `client_id/secret`; demo cần mock — xem ADR-0010); phải xử lý đúng luồng OIDC (PKCE, refresh rotation, logout local vs toàn hệ); map group→vai trò phụ thuộc cách PMH ID đặt tên group.

## Phương án đã cân nhắc

- **Tài khoản tự quản (email+mật khẩu, argon2):** đơn giản độc lập, nhưng **tạo silo danh tính**, lệch hệ sinh thái nội bộ, phải tự làm bảo mật/OTP. → loại khi biết có PMH ID.
- **SPA public client (PKCE ở trình duyệt):** token nằm trong JS, khó thu hồi, kém an toàn hơn BFF. → loại.

## Liên kết

`../architecture/SSO-INTEGRATION.md` (thiết kế chi tiết) · `../product/PRD.md` §6.1, §14 · `integration/README.md`.
