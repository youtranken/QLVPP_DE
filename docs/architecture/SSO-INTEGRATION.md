# SSO Integration — DE-VPP × PMH ID

|                    |                                                                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phiên bản**      | v1.0                                                                                                                                                                          |
| **Ngày**           | 2026-08-06                                                                                                                                                                    |
| **Nguồn**          | `integration/README.md`, `onboarding-project-moi.md`, `edge-va-luong-hoat-dong.md`, `qlts-group-access-notes.md`, `directory-api.openapi.json` + quyết định của chủ nghiệp vụ |
| **Quyết định gốc** | DE-VPP **chuyển sang PMH ID SSO**, tích hợp **đầy đủ** (OIDC + Directory API + Webhook + Back-Channel Logout).                                                                |

> Tài liệu này là **nguồn sự thật cho phần XÁC THỰC & DANH TÍNH**. Nó **thay thế** phần "tài khoản riêng" trong PRD v1.1 / SDD v3. Phần **nghiệp vụ VPP** (đăng ký, duyệt, giao, báo cáo, thông báo, audit) **giữ nguyên** — chỉ đổi cách nhận diện người dùng.

---

## 1. Các quyết định đã chốt

| #   | Chủ đề                   | Quyết định                                                                                                                   |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | Mô hình xác thực         | **PMH ID SSO (OIDC)** — không tự quản user/mật khẩu.                                                                         |
| 2   | Mức tích hợp             | **Đầy đủ**: OIDC login + **Directory API** + **Webhook** + **Back-Channel Logout**.                                          |
| 3   | Ai được vào app          | **Mọi nhân viên** (`allow_all_groups = true`).                                                                               |
| 4   | Vai trò admin            | Là thành viên **một group quản trị riêng** — tạm đặt **`VPP-Admin`** (cấu hình qua env `VPP_ADMIN_GROUP`).                   |
| 5   | Phòng ban                | Lấy từ **`groups`** trong token (vd `Kế toán`, `Hành chính`…).                                                               |
| 6   | Host                     | **Chưa chốt** → demo Docker local trước (hosts + self-signed); chốt vị trí khi lên prod (M6).                                |
| 7   | Nguồn đăng nhập khi demo | **Mock OIDC IdP** dựng trong Docker; ghép PMH ID thật sau.                                                                   |
| 8   | Mẫu tích hợp             | **BFF (Backend-for-Frontend)** — backend NestJS là **confidential client**, giữ `client_secret`, cấp session cookie cho web. |

---

## 2. Vì sao chọn BFF (Backend-for-Frontend)

Có 2 cách gắn OIDC vào SPA:

- **Public client (PKCE ở trình duyệt):** SPA tự giữ token → token lộ trong JS, khó thu hồi.
- **BFF (chọn):** **backend** làm client bí mật; trình duyệt chỉ giữ **cookie phiên `httpOnly`**; token OIDC (access/refresh/id) **nằm ở server**. An toàn hơn, hợp với việc ta đã có backend NestJS + `client_secret`. `README.md` §4.2 cũng minh hoạ luồng server-side này.

```
Trình duyệt ─cookie phiên (httpOnly)─▶ api (NestJS = confidential OIDC client)
                                          │  ▲ giữ access/refresh/id_token ở server
                                          ▼  │
                                   PMH ID (thật) / Mock IdP (demo)  ── OIDC ──
```

---

## 3. Luồng đăng nhập (OIDC Authorization Code + PKCE, kịch bản B)

```mermaid
sequenceDiagram
    autonumber
    participant B as Trình duyệt (web)
    participant API as api (NestJS, BFF)
    participant IdP as PMH ID / Mock IdP
    B->>API: GET /api/auth/login
    API->>API: sinh state + PKCE (code_verifier) → lưu tạm (cookie ký/He store)
    API-->>B: 302 → IdP /authorize (code_challenge S256)
    B->>IdP: đăng nhập tại PMH ID
    IdP-->>B: 302 → /api/auth/callback?code&state
    B->>API: GET /api/auth/callback?code&state
    API->>IdP: POST /token (code + code_verifier + client_secret)
    IdP-->>API: access_token + refresh_token + id_token (JWT RS256)
    API->>IdP: (verify offline qua JWKS) claims: sub, email, groups...
    API->>API: upsert user theo sub; map group→vai trò+phòng ban; tạo app-session
    API-->>B: Set-Cookie vpp_sid (httpOnly); 302 → /
```

- **PKCE bắt buộc** (S256) — thư viện OIDC tự gửi.
- **Verify JWT offline** qua JWKS, cache ≤ 10 phút, chọn khoá theo `kid`.
- **Tham chiếu user bằng `sub`** (ID nội bộ PMH, ổn định) — KHÔNG dùng email.

---

## 4. Mô hình dữ liệu — thay đổi phần danh tính

**Bỏ** khỏi thiết kế cũ: cột `password_hash`, chính sách mật khẩu, màn đổi mật khẩu, tạo/import tài khoản thủ công.

**users** (khoá theo PMH `sub`)

| Cột                     | Kiểu                        | Ghi chú                                                     |
| ----------------------- | --------------------------- | ----------------------------------------------------------- |
| id                      | uuid PK                     | id nội bộ app                                               |
| **pmh_sub**             | text, unique, not null      | `sub` từ PMH ID — khoá tham chiếu                           |
| email                   | text                        | có thể đổi — KHÔNG dùng làm khoá                            |
| name                    | text                        | `full_name`                                                 |
| employee_code           | text                        | `employee_code`                                             |
| **groups**              | text[]                      | toàn bộ group từ token/directory                            |
| **department**          | text                        | suy ra từ groups (xem §5)                                   |
| **role**                | text (`admin`\|`member`)    | suy ra từ groups (§5)                                       |
| disabled                | bool                        | đồng bộ từ webhook `user.locked/deleted`                    |
| source                  | text (`login`\|`directory`) | `directory` = kéo từ Directory API, **chưa từng đăng nhập** |
| last_login_at           | timestamptz                 |                                                             |
| created_at / updated_at | timestamptz                 |                                                             |

**app_sessions** (BFF — thay `sessions` cũ; KHÔNG có mật khẩu)
| id (uuid, = giá trị cookie) · user_id → users · **id_token** (cho end_session) · **access_token** · **refresh_token** · access_expires_at · session_expires_at · created_at |

> Token OIDC nằm ở server. Khi access hết hạn → dùng refresh_token xin mới; refresh **thất bại** = tín hiệu đăng xuất (huỷ app-session).

Các bảng nghiệp vụ (`categories`, `items`, `requests`, `request_items`, `notifications`, `audit_log`) **giữ nguyên**; `requests.user_id`, `audit_log.actor_id`… tham chiếu `users.id` (nội bộ). Bảng `departments` chuyển thành **danh sách suy ra từ groups** (có thể vẫn giữ bảng để cache tên phòng ban phục vụ lọc/báo cáo).

---

## 5. Map group → vai trò & phòng ban

Cấu hình qua env:

```
VPP_ADMIN_GROUP=VPP-Admin
VPP_DEPARTMENT_GROUPS=Hành chính,Nhân sự,Kế toán,Kỹ thuật,Kinh doanh   # (tùy chọn) danh sách group được coi là phòng ban
```

Quy tắc khi đăng nhập / đồng bộ:

- **role** = `admin` nếu `groups` chứa `VPP_ADMIN_GROUP`, ngược lại `member`.
- **department** = group đầu tiên của user thuộc `VPP_DEPARTMENT_GROUPS` (nếu không khai danh sách → group đầu tiên **khác** `VPP_ADMIN_GROUP`).
  - Nếu user có **nhiều** group phòng ban → lấy cái đầu theo thứ tự `VPP_DEPARTMENT_GROUPS`, và **ghi audit** để admin biết (trường hợp hiếm).
  - Nếu user **chỉ** có group admin → `department = null`.
- **groups** (toàn bộ) vẫn lưu để tra cứu/đối soát.

> `allow_all_groups=true` ⇒ PMH ID **không gác cửa theo group**; app cho mọi user đã xác thực vào với vai trò `member`, `VPP-Admin` thì thành `admin`. (Nếu sau này tắt `allow_all_groups`, thêm gate group phía app như QLTS §10.2.)

---

## 6. API xác thực & danh tính

| Method | Path                           | Vai trò      | Mô tả                                                                                                       |
| ------ | ------------------------------ | ------------ | ----------------------------------------------------------------------------------------------------------- |
| GET    | `/api/auth/login`              | công khai    | Đẩy sang IdP `/authorize` (PKCE).                                                                           |
| GET    | `/api/auth/callback`           | công khai    | Đổi `code` lấy token, tạo app-session, set cookie. Bắt `error=access_denied` → trang "chưa được cấp quyền". |
| POST   | `/api/auth/logout`             | đã đăng nhập | **Logout local** (huỷ app-session), KHÔNG gọi IdP.                                                          |
| GET    | `/api/auth/logout-global`      | đã đăng nhập | **Logout toàn hệ**: `end_session` + `id_token_hint` → về app.                                               |
| POST   | `/api/auth/backchannel-logout` | IdP→app      | Nhận `logout_token`, verify JWKS, huỷ mọi app-session của `sub`.                                            |
| GET    | `/api/me`                      | đã đăng nhập | Trả `{ id, sub, email, name, role, department, groups }`.                                                   |

> **Bỏ**: `/auth/login {email,password}`, `/me/change-password`, tạo/sửa mật khẩu.

**Đăng xuất — chọn đúng phạm vi** (README §4.5): nút "Đăng xuất khỏi VPP" = **local**; nút "Đăng xuất khỏi PMH ID" = **global**. `post_logout_redirect_uri`/BCL URI phải **khớp hệt** `app_url` đã khai.

---

## 7. Directory API — đồng bộ danh bạ (M2M)

Mục đích: admin thấy **cả nhân viên chưa từng đăng nhập** (để tổng hợp/đối soát theo phòng ban).

- Xác thực **client_credentials** → Bearer token.
- Job `directory-sync` (định kỳ ~60', và nút "Đồng bộ ngay"): gọi `GET /api/v1/users?limit&offset` (phân trang) → **upsert** vào `users` với `source='directory'`; cập nhật `groups/department/disabled`.
- `GET /api/v1/groups` → biết scope group của client (dùng cho gate nếu sau này tắt allow_all).
- Đồng bộ tăng dần: `GET /api/v1/events?since=<cursor>`; cursor > 90 ngày → **410** → resync toàn bộ (`GET /users`).

> **Lưu ý** (qlts-notes): webhook **không** có sự kiện cấp-client (client được gán thêm/bớt group) → danh sách group-được-phép **bắt buộc lấy bằng fetch**, webhook không thay được.

---

## 8. Webhook + Back-Channel Logout

**Webhook** (`user.locked/unlocked/deleted/password_changed/groups_changed`):

- Endpoint `POST /api/webhooks/pmh-id`, body **raw**; verify **HMAC-SHA256 v2** (`X-PMH-Signature-V2` trên `${ts}.${body}`), kiểm `X-PMH-Timestamp` tươi ±5', dùng `timingSafeEqual`. **Ngừng chấp nhận v1** sau khi v2 chạy.
- **Idempotent** (có retry, sự kiện có thể tới >1 lần).
- Xử lý: `locked/deleted` → `disabled=true` + huỷ app-session của `sub`; `groups_changed` → cập nhật `groups/department/role`.

**Back-Channel Logout** (`POST /api/auth/backchannel-logout`):

- Nhận `logout_token` (form-urlencoded), verify JWKS, kiểm claim `events` backchannel-logout và **không có `nonce`** → huỷ mọi app-session của `sub`.
- Bảo mật bằng **chữ ký JWT của IdP** (không HMAC).
- Không làm BCL vẫn an toàn (user văng ≤5' khi refresh fail) — nhưng ta làm **đầy đủ**.

---

## 9. Mock OIDC IdP cho DEMO (thay PMH ID khi chưa có credential)

Một service Docker **`mock-idp`** giả lập đủ để luồng OIDC chạy end-to-end mà không cần PMH ID thật.

- **Công nghệ đề xuất:** thư viện `oidc-provider` (panva) — OIDC chuẩn, có sẵn discovery/jwks/authorize/token/end_session, hỗ trợ PKCE, refresh, **backchannel logout**, `client_credentials`.
- **Cấp:** Discovery, JWKS, `/authorize` (form đăng nhập giả chọn user), `/token`, `/userinfo`, `/session/end`, phát `backchannel_logout`.
- **Mô phỏng thêm (tối giản):** `GET /api/v1/users|groups|events` (Directory) trả dữ liệu mẫu; nút "phát webhook" thủ công để test khoá user.
- **User demo (claims có `groups`):**

| sub       | email            | full_name     | groups                    | ⇒ role / phòng ban  |
| --------- | ---------------- | ------------- | ------------------------- | ------------------- |
| usr_admin | admin@pmh.com.vn | Quản trị VPP  | `VPP-Admin`, `Hành chính` | admin / Hành chính  |
| usr_an    | an@pmh.com.vn    | Nguyễn Văn An | `Kinh doanh`              | member / Kinh doanh |
| usr_binh  | binh@pmh.com.vn  | Trần Thị Bình | `Kế toán`                 | member / Kế toán    |
| usr_chi   | chi@pmh.com.vn   | Lê Văn Chí    | `Kỹ thuật`                | member / Kỹ thuật   |
| usr_dung  | dung@pmh.com.vn  | Phạm Thị Dung | `Nhân sự`                 | member / Nhân sự    |
| usr_em    | em@pmh.com.vn    | Hoàng Văn Em  | `Kinh doanh`              | member / Kinh doanh |

- **URL:** demo dùng `http://mock-idp:8443` nội bộ Docker (hoặc `https://admin-de.pmh.com.vn:8443` qua hosts + self-signed nếu muốn giống prod). Issuer/endpoint đặt qua env để **đổi sang PMH ID thật chỉ bằng cấu hình**, không sửa code.

> **Ghép PMH ID thật sau:** đổi `OIDC_ISSUER`, `PMH_CLIENT_ID`, `PMH_CLIENT_SECRET`, `PMH_WEBHOOK_SECRET` sang giá trị admin PMH ID cấp; bỏ service `mock-idp`. Code không đổi.

---

## 10. Triển khai Docker (demo)

```
services:
  postgres      # DB
  mock-idp      # IdP giả (OIDC) — CHỈ dùng khi demo
  api           # NestJS (confidential OIDC client, BFF, webhook/BCL receiver)
  web           # React build sau nginx, proxy /api → api
```

Biến môi trường chính (api):

```
OIDC_ISSUER=http://mock-idp:8443            # prod: https://admin-de.pmh.com.vn:8443/oidc
OIDC_DISCOVERY=${OIDC_ISSUER}/.well-known/openid-configuration
PMH_CLIENT_ID=de-vpp-dev
PMH_CLIENT_SECRET=dev-secret                # prod: do admin PMH ID cấp
PMH_WEBHOOK_SECRET=dev-webhook-secret
APP_BASE_URL=http://localhost:8080          # redirect/app_url
VPP_ADMIN_GROUP=VPP-Admin
SESSION_TTL_DAYS=7
```

- **Prod (khi chốt host):** nếu chạy sau **EDGE** dưới `de-vpp.pmh.com.vn` → theo **LUẬT VÀNG mạng edge** (`edge-va-luong-hoat-dong.md` §5): chỉ `vpp-web` lên mạng `edge` với **alias riêng**; `api` **không** lên edge, gọi IdP qua `extra_hosts: ["de-admin.pmh.com.vn:host-gateway"]`; khai dải IP nội bộ vào `WEBHOOK_ALLOWLIST_CIDR` (cho webhook/BCL). Test BCL URI: `curl -X POST <uri>` → 400/200 = đúng route.

---

## 11. Bảo mật

- **PKCE S256** bắt buộc; `state` chống CSRF; nonce cho id_token.
- **Verify JWT offline** (JWKS, cache ≤10'); tham chiếu user bằng **`sub`**.
- **Xoay refresh token**: luôn lưu token MỚI sau refresh; **không** tái dùng token cũ (tránh bị thu hồi cả phiên). Dùng thư viện OIDC chuẩn.
- **Refresh fail = đăng xuất** (cơ chế luôn đúng, kể cả idle — nơi BCL không phủ).
- `client_secret`/`webhook_secret` chỉ trong env/secrets, **không commit**.
- Webhook HMAC v2 + timestamp; BCL verify chữ ký IdP; endpoint idempotent.
- Cookie phiên `httpOnly`/`sameSite=lax` (prod `secure`).

---

## 12. Ảnh hưởng tới PRD & SDD (đã/đang cập nhật)

| Tài liệu | Thay đổi                                                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **PRD**  | §2/§3 xác thực = SSO; **bỏ** FR tạo/import/đổi mật khẩu (FR-02…05) → thay bằng FR đăng nhập SSO + đồng bộ danh bạ; §11 bỏ "SSO ngoài phạm vi".                                             |
| **SDD**  | §5 users theo `sub` (bỏ password); `app_sessions` giữ token; §7 API auth = OIDC; §8 bỏ màn đổi mật khẩu/tạo tài khoản (thay bằng directory + gán vai trò theo group); §11 thêm `mock-idp`. |

---

## 13. Phiếu 1 — Onboarding PMH ID (điền theo quyết định; ô cần admin ở M6)

| #   | Mục                     | Giá trị                                                                                                                                |
| --- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tên app + môi trường    | **DE-VPP** — xin client **dev** (demo mock) và **prod** riêng                                                                          |
| 2   | `redirect_uris`         | Demo: `http://localhost:8080/api/auth/callback`. Prod: **[⏳ theo host chốt ở M6]** (vd `https://de-vpp.pmh.com.vn/api/auth/callback`) |
| 3   | `app_url`               | Demo: `http://localhost:8080`. Prod: **[⏳]**                                                                                          |
| 4   | **Nhóm được đăng nhập** | **`allow_all_groups = true`** (mọi nhân viên). Admin xác định qua group **`VPP-Admin`**.                                               |
| 5   | Directory API?          | **Có** — kéo danh bạ theo phòng ban (nhân viên chưa đăng nhập).                                                                        |
| 6   | Webhook?                | **Có** — `webhook_url` = **[⏳]** (vd `https://de-vpp.pmh.com.vn/api/webhooks/pmh-id`).                                                |
| 7   | Back-Channel Logout?    | **Có** — `backchannel_logout_uri` = **[⏳]** (vd `.../api/auth/backchannel-logout`).                                                   |
| 8   | Vị trí host             | **[⏳ chốt M6]** — sau EDGE (`de-vpp.pmh.com.vn`) hay hạ tầng riêng.                                                                   |
| 9   | IP host webhook/BCL     | **[⏳ nếu on-prem]** — khai dải IP vào `WEBHOOK_ALLOWLIST_CIDR`.                                                                       |
| 10  | Người phụ trách         | **[⏳ bạn cung cấp]** (đầu mối xoay secret).                                                                                           |

> Các ô **[⏳]** không chặn demo (mock IdP tự cấp), chỉ cần khi lên prod với PMH ID thật.
