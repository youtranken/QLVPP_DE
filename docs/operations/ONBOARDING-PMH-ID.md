# Phiếu onboarding PMH ID — DE-VPP

> Gửi phiếu này cho **admin PMH ID** để xin credential. Phần **A** đã điền sẵn theo
> thiết kế đã chốt; phần **B** cần bạn quyết định host trước; phần **C** là thứ
> admin PMH ID trả lại cho bạn.
>
> Nguồn: `docs/architecture/SSO-INTEGRATION.md` §13 · `integration/onboarding-project-moi.md`

---

## A. Đã chốt — điền sẵn

| #   | Mục                      | Giá trị                                                                     |
| --- | ------------------------ | --------------------------------------------------------------------------- |
| 1   | Tên ứng dụng             | **DE-VPP** — Hệ thống Đăng ký Văn phòng phẩm                                |
| 2   | Môi trường cần cấp       | **prod** (và **dev** riêng nếu muốn có môi trường thử)                      |
| 3   | Mẫu tích hợp             | **BFF** — backend là confidential client, giữ `client_secret` ở server      |
| 4   | Luồng                    | Authorization Code + **PKCE S256**, `prompt=consent` để có `offline_access` |
| 5   | Scope cần                | `openid email profile groups offline_access`                                |
| 6   | Nhóm được đăng nhập      | **`allow_all_groups = true`** — mọi nhân viên đều vào được                  |
| 7   | Nhóm quyết định quản trị | **`VPP-Admin`** (app đọc từ claim `groups`)                                 |
| 8   | Directory API            | **Có** — để thấy cả nhân viên chưa từng đăng nhập                           |
| 9   | Webhook                  | **Có** — `user.locked/unlocked/deleted/groups_changed/password_changed`     |
| 10  | Back-Channel Logout      | **Có**                                                                      |
| 11  | Chữ ký webhook           | **HMAC-SHA256 v2** trên `${timestamp}.${body}` — app KHÔNG nhận v1          |

**Claim app cần có trong token:** `sub` (bắt buộc, là khoá tham chiếu người dùng),
`email`, `name`/`full_name`, `employee_code`, `groups`.

---

## B. Cần bạn quyết trước khi gửi phiếu

Điền `<HOST>` bằng tên miền thật của DE-VPP, ví dụ `de-vpp.pmh.com.vn`.

| #   | Mục                        | Giá trị cần khai                                     |
| --- | -------------------------- | ---------------------------------------------------- |
| 12  | `app_url`                  | `https://<HOST>`                                     |
| 13  | `redirect_uris`            | `https://<HOST>/api/auth/callback`                   |
| 14  | `post_logout_redirect_uri` | `https://<HOST>/`                                    |
| 15  | `webhook_url`              | `https://<HOST>/api/webhooks/pmh-id`                 |
| 16  | `backchannel_logout_uri`   | `https://<HOST>/api/auth/backchannel-logout`         |
| 17  | Vị trí host                | sau **EDGE** `de-vpp.pmh.com.vn`, hay hạ tầng riêng? |
| 18  | Dải IP gọi webhook/BCL     | chỉ cần khi on-prem và PMH ID lọc theo IP            |

> Bốn URI ở mục 13–16 **phải khớp từng ký tự** với `APP_BASE_URL` trong `.env.prod`.
> Sai một dấu `/` là PMH ID từ chối redirect.

---

## C. Admin PMH ID trả lại — điền vào `deploy/.env.prod`

| Nhận được           | Biến trong `.env.prod`  |
| ------------------- | ----------------------- |
| Issuer / discovery  | `OIDC_ISSUER`           |
| Client ID (app)     | `PMH_CLIENT_ID`         |
| Client secret (app) | `PMH_CLIENT_SECRET`     |
| Webhook secret      | `PMH_WEBHOOK_SECRET`    |
| Client ID (M2M)     | `PMH_M2M_CLIENT_ID`     |
| Client secret (M2M) | `PMH_M2M_CLIENT_SECRET` |

---

## D. Nghiệm thu sau khi ghép

Làm lần lượt, mỗi bước phải đạt mới sang bước sau:

1. **Discovery** — `curl -s $OIDC_ISSUER/.well-known/openid-configuration | head`
   Phải ra JSON có `authorization_endpoint`, `token_endpoint`, `jwks_uri`.
2. **Đăng nhập** — mở `https://<HOST>`, bấm _Đăng nhập bằng PMH ID_, đăng nhập bằng
   tài khoản thật. Quay về app, `GET /api/me` trả đúng `sub`, `email`, `groups`.
3. **Vai trò** — tài khoản thuộc `VPP-Admin` phải thấy menu **Quản trị**;
   tài khoản thường thì không.
4. **Phòng ban** — `department` trong `/api/me` khớp nhóm phòng ban của người đó.
   Nếu sai, kiểm lại `VPP_DEPARTMENT_GROUPS` có đúng **tên nhóm thật** ở PMH ID không.
5. **Refresh token** — `SELECT refresh_token IS NOT NULL FROM app_sessions;` phải là
   `t`. Nếu `f` thì PMH ID không cấp `offline_access` — báo admin PMH ID.
6. **Directory** — bấm _Đồng bộ ngay_ ở màn Danh bạ, phải kéo được danh sách nhân viên.
7. **Webhook** — nhờ admin PMH ID khoá thử một tài khoản; người đó phải bị đăng xuất
   khỏi DE-VPP ngay và hiện trạng thái _Bị khoá_ ở màn Danh bạ.
8. **Back-Channel Logout** — đăng nhập ở hai trình duyệt, đăng xuất toàn hệ ở một
   nơi; nơi còn lại phải mất phiên.

Kiểm tra nhanh route webhook/BCL có tới được không (400 hoặc 200 đều là **đúng route**;
404 mới là sai):

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://<HOST>/api/webhooks/pmh-id
curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://<HOST>/api/auth/backchannel-logout
```

---

## E. Những chỗ dễ sai (rút từ tài liệu tích hợp)

- **`redirect_uri` lệch** dù chỉ một dấu `/` ⇒ PMH ID trả `invalid_redirect_uri`.
- **Tên nhóm khác dự kiến** ⇒ mọi người thành `member`, không ai vào được quản trị.
  Sửa bằng `VPP_ADMIN_GROUP` / `VPP_DEPARTMENT_GROUPS`, **không phải sửa code**.
- **Webhook không có sự kiện cấp client**: PMH ID không bắn sự kiện khi client được
  gán thêm/bớt nhóm — danh sách nhóm phải lấy bằng `GET /api/v1/groups`, webhook
  không thay thế được việc này.
- **Cursor `events` quá 90 ngày** ⇒ trả **410**, phải đồng bộ lại toàn bộ.
- **Chạy sau EDGE**: chỉ `web` lên mạng edge (kèm alias riêng), `api` gọi PMH ID qua
  `host-gateway`. Xem `RUNBOOK.md` mục _Triển khai sau EDGE_.
