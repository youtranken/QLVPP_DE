# mock-idp — IdP OIDC giả lập PMH ID

**CHỈ dùng cho demo/dev.** Đứng thay PMH ID để luồng OIDC chạy được end-to-end khi
chưa có credential thật. Xem `docs/architecture/SSO-INTEGRATION.md` §9.

```bash
pnpm --filter @vpp/mock-idp start     # http://localhost:9000
```

Đọc chung `.env` ở gốc repo với `@vpp/api`, nên `APP_BASE_URL`, `PMH_CLIENT_ID`,
`PMH_CLIENT_SECRET` luôn khớp nhau — lệch là `redirect_uri` không hợp lệ.

## Cung cấp

| Đường dẫn                                | Nội dung                                         |
| ---------------------------------------- | ------------------------------------------------ |
| `/oidc/.well-known/openid-configuration` | Discovery                                        |
| `/oidc/auth`, `/oidc/token`, `/oidc/me`  | Authorization Code + PKCE S256, refresh token    |
| `/oidc/jwks`                             | Khoá công khai                                   |
| `/oidc/session/end`                      | Đăng xuất + phát **back-channel logout**         |
| `/interaction/:uid`                      | Trang chọn user demo (thay màn đăng nhập)        |
| `/api/v1/users\|groups\|events`          | Directory API giả (cần token client_credentials) |

## User demo

Không có mật khẩu — bấm chọn người dùng trên trang đăng nhập.

| sub         | email            | groups                    | ⇒ vai trò / phòng ban |
| ----------- | ---------------- | ------------------------- | --------------------- |
| `usr_admin` | admin@pmh.com.vn | `VPP-Admin`, `Hành chính` | admin / Hành chính    |
| `usr_an`    | an@pmh.com.vn    | `Kinh doanh`              | member / Kinh doanh   |
| `usr_binh`  | binh@pmh.com.vn  | `Kế toán`                 | member / Kế toán      |
| `usr_chi`   | chi@pmh.com.vn   | `Kỹ thuật`                | member / Kỹ thuật     |
| `usr_dung`  | dung@pmh.com.vn  | `Nhân sự`                 | member / Nhân sự      |
| `usr_em`    | em@pmh.com.vn    | `Kinh doanh`              | member / Kinh doanh   |

## Khác biệt có chủ ý so với PMH ID thật

- **Khoá ký sinh mới mỗi lần khởi động** (không lưu private key vào repo) ⇒ restart
  là token cũ hết hiệu lực. `kid` là thumbprint của khoá nên client tự lấy khoá mới.
- **Lưu trạng thái trong RAM** ⇒ restart mất hết phiên/grant.
- **Consent tự động** cho client first-party.
- **Bỏ lớp chặn SSRF của oidc-provider** vì RP khi dev chính là `localhost` —
  không bỏ thì back-channel logout không bao giờ tới nơi.

Ghép PMH ID thật (M6): đổi `OIDC_ISSUER`, `PMH_CLIENT_ID`, `PMH_CLIENT_SECRET`,
`PMH_WEBHOOK_SECRET` và bỏ service này. **Code của api không phải sửa.**
