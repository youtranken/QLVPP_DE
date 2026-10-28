# E0 — Nền tảng

## E0-S1 Khởi tạo repo và compose
Tạo `api/`, `web/`, `ops/backup/`, `docker-compose.yml`, `docker-compose.override.yml`, `.env.example`, `update-vpp.sh`, `README.md` theo QLTS_DE (bỏ redis/worker).
**AC:** `cp .env.example .env` + `docker compose up --build` lên 3 service; `GET /api/health` → 200 qua `web`; `postgres` không publish cổng ở prod compose.

## E0-S2 Migration runner + schema nền
Copy `migration-runner.ts`; migrations 0001–0005, 0028, 0032, 0050, 0053 từ QLTS (users, config, audit append-only, sessions, notifications).
**AC:** boot chạy migrations một lần theo danh sách `architecture.md` §16 (0001–0013); sửa file đã áp → boot fail với thông báo checksum; `audit_log` từ chối UPDATE/DELETE/TRUNCATE; có bảng `processed_webhook_events`, `files(purpose)`.

## E0-S3 Xác thực SSO (copy module auth)
login/callback/me/logout/switch-account, session + refresh single-flight, CSRF, roles guard, cookie `vpp_sid`.
**AC:** e2e: callback với `?error=access_denied` → redirect `/?login=forbidden`; refresh `invalid_grant` → 401 + cookie xóa; POST không có CSRF → 403; `AUTH_DEV_MODE=true` ngoài development → app từ chối khởi động.

## E0-S4 SA cục bộ
`sa-login`, `sa-hash` script, lockout 5/IP/15′, idle 2 h, boot assert.
**AC:** thiếu `LOCAL_SA_PASSWORD_HASH` → không khởi động; 5 lần sai cùng (IP, username) → 429, IP khác cùng username vẫn thử được; 50 lần sai toàn cục → 429; đúng → phiên role `sa`; SA không xuất hiện ở `GET /admin/users`; e2e gửi `X-Forwarded-For: 10.0.0.9, 172.18.0.2` với `TRUST_PROXY_HOPS=2` → `req.ip = 10.0.0.9`.

## E0-S5 Vai trò theo group
Role `admin` khi `claims.groups` chứa `config.admin_group`; `member` mặc định; gate `authorized_groups` + self-heal.
**AC:** user có group `vpp-admin` → `me.role = admin`; role tính mỗi request từ `users.groups`: cập nhật `users.groups` bỏ group → request kế tiếp 403 không cần refresh; đổi `config.admin_group` → hiệu lực trong ≤ 30 s (cache config); `authorized_groups` rỗng → cảnh báo log, không chặn.

## E0-S6 BCL + webhook
`POST /api/backchannel-logout`, `POST /api/webhooks/pmh-id` (HMAC v2, idempotent).
**AC:** logout_token hợp lệ → mọi phiên của sub bị hủy; webhook: test vector v2 (secret, `ts`, body → hex) lấy từ `PMH_IDE/docs/integration` pass; chỉ có header v1 `x-pmh-signature` → 401; `ts` lệch 301 s → 401; cùng `event_id` gửi 2 lần → xử lý 1 lần; `user.locked` → `users.status = locked` + phiên bị hủy; `user.groups_changed` → `users.groups` đổi.

## E0-S7 Danh bạ
Directory client + sync (60′ + nút), màn Danh bạ.
**AC:** sync upsert theo `sub`, không đụng `role`; user `deleted` ẩn khỏi danh sách; nút "Đồng bộ ngay" báo số tạo/cập nhật.

## E0-S8 Nhật ký và cấu hình
`GET /admin/audit` lọc; `GET|PUT /admin/config` (registration_last_day, default_max_qty, admin_group); seed config.
**AC:** đổi `registration_last_day` → kỳ đã có giữ `deadline` cũ, kỳ tạo sau dùng giá trị mới; giá trị 2 hoặc 29 → `CONFIG_INVALID`; UI ghi "kỳ đang mở giữ hạn cũ"; `signers`, `admin_contact` lưu được; nhật ký ghi `config.updated` với cũ/mới.

## E0-S9 Khung web
Vite + React 19, i18n vi/en, `api-client`, `session-relogin`, màn vào (email → SSO, khác → SA), `MemberShell`, `AdminShell`, token CSS từ `design-preview/final`.
**AC:** vào `/` chưa đăng nhập → màn vào; sau SSO quay về đúng trang; chuyển ngôn ngữ đổi toàn bộ nhãn; admin thấy sidebar, member thấy thanh trên; Playwright mở được cả hai shell với dev-identity.
