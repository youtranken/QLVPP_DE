# E7 — Triển khai sau EDGE và tích hợp PMH ID

## E7-S1 Compose prod và env
`docker-compose.yml` prod, `.env.example`, `update-vpp.sh`, backup-cron.
**AC:** `docker compose -f docker-compose.yml up -d --build` trên máy sạch; `.env` có `TRUST_PROXY_HOPS=2`; backup chạy tay ra file `.enc`; restore được vào DB test.

## E7-S2 PR vào PMH_IDE
`deploy/edge/conf.d/vpp.conf`, alias `de-qlvpp.pmh.com.vn`, `deploy/prod-cluster/60-vpp-up.sh`, `env-templates/vpp.env.example`, `docs/projects/project-vpp/01-nguoi-dung.md`, `02-hanh-chinh.md`.
**AC:** `curl -H 'Host: de-qlvpp.pmh.com.vn' https://localhost:8443/api/health` → 200; `vpp.conf` set `X-Forwarded-For`; `curl -X POST …/api/backchannel-logout` → 400 (đúng route); tài liệu hiện ở cổng `/docs` PMH ID; xác nhận với admin PMH ID webhook đang gửi chữ ký v2.

## E7-S3 Đăng ký client PMH ID (Phiếu 1 → Phiếu 2)
Client dev + prod `project-vpp`, redirect, app_url, group, webhook, BCL, allowlist CIDR.
**AC:** đăng nhập thật từ máy ngoài LAN; tile VPP hiện trên Dashboard PMH ID; khóa user → bị đá trong ≤ 10 s; nhật ký đăng nhập ghi IP máy người dùng (không phải IP EDGE).

## E7-S4 Nghiệm thu GĐ1
Chạy toàn bộ tiêu chí §10 PRD với Hành chính.
**AC:** biên bản tick đủ 10 mục của `prd.md` §10; backlog lỗi còn lại chuyển GĐ2.
