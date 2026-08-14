# RUNBOOK — Vận hành DE-VPP ở production

> Dành cho người triển khai và trực hệ thống. Phần ghép PMH ID xem
> [`ONBOARDING-PMH-ID.md`](./ONBOARDING-PMH-ID.md).

---

## 1. Yêu cầu máy chủ

- Docker + Docker Compose v2
- ~2 GB RAM, ~10 GB đĩa (CSDL + ảnh đính kèm + bản sao lưu)
- TLS do lớp đứng trước lo (EDGE hoặc reverse proxy của bạn) — app nghe HTTP nội bộ

Quy mô thiết kế: **≤ 500 người dùng**, 1 API + 1 PostgreSQL là đủ (ADR-0001).

---

## 2. Triển khai lần đầu

```bash
git clone <repo> && cd DE-VPP

cp deploy/.env.prod.example deploy/.env.prod
# Điền: giá trị [PMH ID] lấy từ admin PMH ID, giá trị [TỰ SINH] tạo bằng lệnh dưới
openssl rand -base64 36    # chạy 2 lần: POSTGRES_PASSWORD và SESSION_SECRET

docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod ps
```

Migration và danh mục mặc định tự chạy trước khi api khởi động. **Không** có dữ liệu
demo ở production.

Kiểm tra:

```bash
curl -s https://<HOST>/api/health     # {"status":"ok","db":"up"}
```

### Triển khai sau EDGE

Chồng thêm overlay và khai ba biến `EDGE_ALIAS`, `EDGE_NETWORK`, `PMH_HOST`:

```bash
docker compose \
  -f deploy/docker-compose.prod.yml \
  -f deploy/docker-compose.edge.yml \
  --env-file deploy/.env.prod up -d
```

Overlay này thực thi **LUẬT VÀNG mạng edge**: chỉ `web` lên mạng `edge` với alias
riêng, `web` không publish cổng ra host nữa, và `api` gọi PMH ID qua `host-gateway`
(nhớ đặt `OIDC_INTERNAL_ISSUER` theo `PMH_HOST` nếu api không tới thẳng được issuer).

---

## 3. Nâng cấp phiên bản

```bash
git pull
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod up -d --build
```

- Service `migrate` chạy trước, api chỉ khởi động khi migration **thành công**.
- Migration của Drizzle chỉ thêm, không xoá dữ liệu.
- **Luôn sao lưu trước khi nâng cấp** (mục 4).

Quay lại phiên bản cũ: đặt `IMAGE_TAG` về tag đã chạy tốt rồi `up -d` lại. Nếu bản
mới có migration đổi schema thì phải khôi phục CSDL từ bản sao lưu tương ứng.

---

## 4. Sao lưu và khôi phục

Đơn và nhật ký **giữ vô thời hạn** (SDD §9) nên sao lưu là bắt buộc.

```bash
bash scripts/backup-db.sh                 # ghi vào deploy/backups/, giữ 14 bản
bash scripts/restore-db.sh deploy/backups/vpp-<stamp>.sql.gz
```

Đặt lịch hằng ngày (Linux):

```
0 2 * * * cd /opt/DE-VPP && bash scripts/backup-db.sh >> /var/log/vpp-backup.log 2>&1
```

**Sao lưu ảnh đính kèm** — ảnh nằm ở volume Docker, không nằm trong dump CSDL:

```bash
docker run --rm -v vpp-prod_uploads:/data -v "$PWD/deploy/backups:/out" alpine \
  tar czf /out/uploads-$(date +%Y%m%d).tar.gz -C /data .
```

Chép bản sao lưu ra **máy khác** — để cùng máy thì hỏng đĩa là mất cả hai.

---

## 4b. Dọn ảnh mồ côi

Ảnh trở thành **mồ côi** khi admin đổi/gỡ ảnh của món, hoặc khi người dùng tải ảnh
cho mục "Khác" rồi bỏ dở không gửi đơn. Job dọn chạy **trong tiến trình api**, mặc
định mỗi 24 giờ, và chỉ xoá ảnh đã quá **ân hạn 24 giờ** kể từ lúc ghi.

> Ân hạn là điểm mấu chốt: người dùng tải ảnh xong mới điền nốt form rồi mới gửi.
> Trong khoảng đó ảnh chưa được bản ghi nào tham chiếu nhưng **không phải rác**.

Chạy ngay để kiểm chứng, không cần chờ job (chỉ admin):

```bash
curl -sS -X POST https://<HOST>/api/admin/uploads/cleanup -b <cookie phiên>
# {"scanned":12,"removed":10,"keptInGrace":0,"failed":0}
```

Job chỉ đụng file **đúng khuôn server sinh** (`<uuid>.<jpg|png|webp|gif>`); mọi thứ
khác trong thư mục (kể cả `.gitkeep`) được để nguyên. Lần nào có xoá đều ghi
**nhật ký audit** với hành động `uploads.cleanup`.

| Biến                        | Mặc định | Ý nghĩa                     |
| --------------------------- | -------- | --------------------------- |
| `UPLOAD_CLEANUP_ENABLED`    | `true`   | Tắt hẳn việc dọn            |
| `UPLOAD_ORPHAN_GRACE_HOURS` | `24`     | Ân hạn trước khi coi là rác |
| `UPLOAD_CLEANUP_HOURS`      | `24`     | Chu kỳ chạy job             |

`failed > 0` nghĩa là có file xoá không được (quyền, đang mở) — xem log api để rõ.

---

## 5. Xoay bí mật

| Bí mật               | Cách làm                                           | Ảnh hưởng                          |
| -------------------- | -------------------------------------------------- | ---------------------------------- |
| `SESSION_SECRET`     | sinh mới, `up -d` lại api                          | **mọi người phải đăng nhập lại**   |
| `PMH_CLIENT_SECRET`  | xin admin PMH ID cấp mới, cập nhật rồi `up -d`     | đăng nhập mới lỗi tới khi cập nhật |
| `PMH_WEBHOOK_SECRET` | đổi ở PMH ID **và** app cùng lúc                   | webhook bị từ chối trong lúc lệch  |
| `POSTGRES_PASSWORD`  | đổi trong CSDL trước, rồi sửa `.env.prod`, `up -d` | api mất kết nối tới khi khớp lại   |

---

## 6. Nhật ký và theo dõi

```bash
docker compose -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod logs -f api
docker logs vpp-prod-api --since 1h | grep '"level":"error"'
```

Ở production api ghi **log JSON một dòng mỗi bản ghi** (`time`, `level`, `context`,
`message`) để gom vào hệ thống log tập trung. Docker giữ 5 file × 10 MB mỗi service.

Theo dõi tối thiểu nên có:

- `GET /api/health` trả `{"status":"ok","db":"up"}` — cắm vào uptime check
- Dung lượng đĩa của volume `pgdata` và `uploads`
- Log mức `error`, đặc biệt `logout_token không hợp lệ` và `Refresh token thất bại`

---

## 7. Gỡ lỗi thường gặp

### api không khởi động, log báo "Cấu hình production không an toàn"

Đúng như thiết kế: app **từ chối chạy** khi còn bí mật mặc định của dev, khi
`APP_BASE_URL`/`OIDC_ISSUER` không phải https, hoặc `ORG_NAME` còn là chỗ đặt sẵn.
Đọc danh sách trong log rồi sửa `.env.prod`. Staging nội bộ chạy http thì đặt
`ALLOW_INSECURE_PRODUCTION=1` — app vẫn chạy nhưng in cảnh báo mỗi lần khởi động.

### Đăng nhập xong quay lại vẫn thấy trang đăng nhập

Cookie phiên không được trình duyệt giữ. Kiểm theo thứ tự:

1. `APP_BASE_URL` có đúng **https** và đúng tên miền người dùng đang mở không?
2. Có đang chạy https thật ở lớp ngoài không? Cookie đặt `secure` nên http sẽ bị bỏ.
3. `redirect_uris` khai ở PMH ID có khớp từng ký tự `APP_BASE_URL + /api/auth/callback`?

### `invalid_redirect_uri` khi bấm đăng nhập

`redirect_uris` ở PMH ID lệch với `APP_BASE_URL`. Sửa một trong hai cho khớp tuyệt đối.

### Ai cũng là "nhân viên", không ai vào được quản trị

Tên nhóm ở PMH ID khác `VPP_ADMIN_GROUP`. Xem `groups` thật trong `GET /api/me`
rồi đặt lại `VPP_ADMIN_GROUP` (và `VPP_DEPARTMENT_GROUPS`) — **không phải sửa code**.

### Người dùng bị đăng xuất sau ~10 phút

Không có `refresh_token`: PMH ID chưa cấp `offline_access`. App đã gửi
`prompt=consent` cùng scope `offline_access`; nếu vẫn không có thì báo admin PMH ID
bật cho client. Kiểm nhanh:

```sql
SELECT (refresh_token IS NOT NULL) AS co_refresh FROM app_sessions LIMIT 5;
```

### Webhook bị từ chối (400)

- `PMH_WEBHOOK_SECRET` ở app và PMH ID phải giống nhau.
- App chỉ nhận **v2** (`X-PMH-Signature-V2`), không nhận v1.
- Lệch giờ máy chủ quá ±5 phút cũng bị từ chối — kiểm NTP.

### Đồng bộ danh bạ lỗi

App **giữ nguyên dữ liệu cũ** và báo lỗi, không xoá gì. Kiểm client M2M
(`PMH_M2M_CLIENT_ID`/`SECRET`) và xem api có tới được Directory API không — chạy
sau EDGE thì phải qua `host-gateway`.

---

## 8. Việc định kỳ

| Việc                                       | Tần suất     |
| ------------------------------------------ | ------------ |
| Kiểm tra bản sao lưu **khôi phục được**    | hằng quý     |
| Xem dung lượng đĩa                         | hằng tháng   |
| Cập nhật image nền (node, postgres, nginx) | hằng quý     |
| Rà nhật ký audit                           | theo nhu cầu |

> Khôi phục thử là việc duy nhất chứng minh bản sao lưu dùng được. Sao lưu chưa
> từng khôi phục thử thì chưa gọi là có sao lưu.
