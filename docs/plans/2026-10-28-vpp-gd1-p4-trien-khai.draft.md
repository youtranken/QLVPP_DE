# VPP GĐ1 — Plan 4 (BẢN NHÁP): Triển khai prod và nghiệm thu

> Bản nháp phạm vi. Plan chi tiết viết sau khi Plan 3 gộp `main` (dựa vào compose, env và tính năng thật). Tách khỏi Plan 3 theo yêu cầu chủ dự án ngày 2026-10-28.

**Mục tiêu:** đưa VPP Công trình lên máy prod đang chạy QLTS + PMH_IDE + EDGE, đăng nhập bằng PMH ID thật, và nghiệm thu 10 tiêu chí `docs/prd.md` §10 với Hành chính.

**Spec:** `docs/architecture.md` §4 (PMH ID, webhook v2, BCL), §12 (triển khai, Phiếu 1), §13, §15; backlog E7; README mục "Trước khi deploy"; tài liệu tích hợp trong repo PMH_IDE (`docs/integration/*`, đọc bằng `gh api`).

## Quyết định đã chốt (2026-10-28)
- **Máy prod** là một máy khác, đang chạy QLTS + PMH_IDE + EDGE; **Claude không chạy lệnh trên đó**. Claude kiểm mọi thứ có thể trên máy dev và soạn runbook; chủ dự án chạy trên prod và gửi lại kết quả khi lỗi.
- **Tích hợp PMH ID:** Claude soạn sẵn hướng dẫn từng bước và mọi file/nội dung; **chủ dự án tự tạo trên PMH_IDE** (PR cấu hình EDGE, client, group, webhook, BCL, allowlist).

## Phạm vi dự kiến

| # | Task | Ai chạy | Làm | Review |
|---|---|---|---|---|
| 1 | Compose prod trên máy sạch (dev): `docker compose -f docker-compose.yml up -d --build` từ clone mới, `.env` prod mẫu (`NODE_ENV=production`, `AUTH_DEV_MODE=false`, `TRUST_PROXY_HOPS=2`), health qua nginx, không cổng nào publish ngoài `web` trên mạng `edge` | Claude (dev) | Opus | Opus |
| 2 | Backup/restore thật: chạy backup tay ra `.enc`, restore vào DB thử, kiểm ảnh + dữ liệu; runbook "restore không nguyên tử" | Claude (dev) | Opus | Opus |
| 3 | Bộ hồ sơ PMH ID `deploy/pmh-id/`: `vpp.conf` cho EDGE (mẫu `qlts.conf`: `listen 8443 ssl`, `server_name de-vpp.pmh.com.vn`, `proxy_pass http://vpp-web:80`, `X-Forwarded-For`, `X-Forwarded-Proto https`, `client_max_body_size 6m`), đoạn alias trong compose EDGE, `60-vpp-up.sh`, `vpp.env.example`, tài liệu `01-nguoi-dung.md`, `02-hanh-chinh.md`, Phiếu 1 điền sẵn (client `project-vpp`, redirect `…/api/auth/callback`, `app_url`, `post_logout_redirect_uri`, BCL `…/api/backchannel-logout`, webhook v2 `…/api/webhooks/pmh-id`, group được vào, Directory API, allowlist CIDR) | Claude soạn | Opus | Opus |
| 4 | Runbook triển khai từng lệnh (`docs/runbook-trien-khai.md`): chuẩn bị `.env` prod, tạo mật khẩu SA bằng `npm run -s sa:hash`, `docker compose -f docker-compose.yml up -d --build`, seed danh mục lần đầu, kiểm `/api/health` qua EDGE, kiểm `TRUST_PROXY_HOPS` bằng IP trong dòng nhật ký `auth.sa_login` đầu tiên, đồng bộ danh bạ, đặt `authorized_groups`, quay lại bản cũ khi lỗi, mở khóa SA (restart api) | Claude soạn | Opus | Opus |
| 5 | Chủ dự án làm trên PMH_IDE + prod theo bộ hồ sơ và runbook; gửi lại log/ảnh màn khi lỗi; Claude chẩn đoán từ kết quả gửi về | Chủ dự án | — | — |
| 6 | Kiểm sau triển khai (danh sách tick cho chủ dự án): đăng nhập thật từ máy ngoài LAN; tile VPP trên Dashboard PMH ID; khóa user → bị đá ≤ 10 s; IP trong nhật ký là IP máy người dùng; webhook chữ ký v2 nhận được | Chủ dự án | — | — |
| 7 | Nghiệm thu GĐ1 với Hành chính: biên bản tick 10 mục `prd.md` §10 (mẫu biên bản Claude soạn); lỗi còn lại chuyển GĐ2 | Chủ dự án + Hành chính | Claude soạn mẫu | — |

## Phụ thuộc
- Plan 3 xong và gộp `main` (giao hàng, báo cáo, chuông có trong bản deploy).
- Vá bảo mật còn mở tại thời điểm deploy (`npm audit` api/web = 0 high).
