# VPP Công trình — Văn phòng phẩm khối Công trình (PMH)

Monorepo: `api/` (NestJS 11, Node 24) + `web/` (React 19 / Vite 8, serve qua nginx) + PostgreSQL 18,
chạy bằng Docker Compose. Cùng stack và quy ước vận hành với QLTS_DE.

## Chạy bằng một lệnh

Yêu cầu: Docker có Compose v2, mạng ngoài `edge` (1 lần: `docker network create edge`).

```bash
cp .env.example .env   # đổi các giá trị CHANGE_ME, điền PMH_* và LOCAL_SA_PASSWORD_HASH

# DEV — tự nạp docker-compose.override.yml
docker compose up -d --build
curl -s localhost:$(docker compose port web 80 | cut -d: -f2)/api/health   # {"status":"ok"}

# PROD — BẮT BUỘC chỉ định file, KHÔNG nạp override
docker compose -f docker-compose.yml up -d --build
```

> `docker compose up` không kèm `-f` sẽ **tự động nạp `docker-compose.override.yml`** (dev):
> bật `AUTH_DEV_MODE=true`, `NODE_ENV=development`, publish web ra cổng ngẫu nhiên và Postgres
> ra `127.0.0.1:5492`. Trên prod phải dùng dạng `-f docker-compose.yml`.

- Prod: https://de-vpp.pmh.com.vn:8443 — TLS do EDGE (PMH_IDE `deploy/edge`) lo; `web` chỉ join
  mạng `edge` với alias `vpp-web`, không publish cổng.
- `api`/`postgres` chỉ ở mạng default; `postgres` không publish cổng ở prod.
- Cập nhật prod: `bash update-vpp.sh` (git pull ff-only → build → chờ `/api/health` 200 qua EDGE).
- Backup: service `backup-cron` (hằng ngày lúc `BACKUP_AT`); chạy tay
  `docker compose -f docker-compose.yml --profile backup run --rm backup`; phục hồi `bash ops/backup/restore.sh`.

## Cấu trúc

```
api/        # NestJS — prefix /api
web/        # React SPA + nginx (proxy /api → api:3000)
ops/backup/ # image backup (pg_dump + file ảnh), cron-loop, restore
docker-compose.yml, docker-compose.override.yml (dev), .env.example, update-vpp.sh
```

## Dev & test (ngoài Docker)

```bash
cd api && npm ci
npm run build
npm run test:e2e   # e2e (không cần DB)
npm run test:db    # integration DB thật — cần DATABASE_URL trỏ database *_test

cd web && npm ci && npm run build
```

## AUTH_DEV_MODE

`AUTH_DEV_MODE=true` chỉ hợp lệ khi `NODE_ENV ∈ {development, test}` — bật ở môi trường khác thì
app **từ chối khởi động**.
