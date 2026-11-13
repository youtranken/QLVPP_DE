# VPP Công trình — Văn phòng phẩm khối Công trình (PMH)

Monorepo: `api/` (NestJS 12, Node 26) + `web/` (React 19 / Vite 8, serve qua nginx) + PostgreSQL 18,
chạy bằng Docker Compose. Đăng nhập bằng PMH ID (OIDC); tài khoản SA local chỉ để IT xử lý sự cố.
Cùng stack và quy ước vận hành với QLTS_DE.

## Tài liệu

- `docs/prd.md` — yêu cầu sản phẩm · `docs/architecture.md` — kiến trúc, API, mã lỗi (§7)
- `docs/backlog/` — epic/story + AC · `docs/plans/` — kế hoạch triển khai từng giai đoạn
- `docs/map.md` — bản đồ mã nguồn (module → file chính, endpoint, bảng) · `docs/review-spec.md` — chỗ spec đã sửa
- `design-preview/_SPEC.md` + `design-preview/final/` — thiết kế UI, câu chữ, token màu
- `CLAUDE.md` — quy ước làm việc (TDD, Playwright, Definition of Done)

## Cấu trúc

```
api/src/{main,app.setup,app.module}.ts   # boot, prefix /api, guard, filter
api/src/modules/<ten>/                   # auth, users, audit, config, files, catalog
api/src/migrations/NNNN_*.sql            # SQL thuần, checksum — không sửa file đã apply
api/test/                                # *.e2e-spec.ts (app thật + supertest), *.db-spec.ts (Postgres thật)
api/scripts/, api/seed/                  # sa-hash, seed-catalog
web/src/{lib,ui,shell,features/<ten>,locales/{vi,en}}
web/playwright/                          # smoke E2E 1280 px + 390 px
ops/backup/                              # image backup (pg_dump + ảnh), cron-loop, restore
docker-compose.yml                       # prod
docker-compose.override.yml              # dev (tự nạp khi không có -f)
.env.example, update-vpp.sh
```

## Chạy dev

Yêu cầu: Docker có Compose v2, Node 26 (máy dev chạy test được từ Node 24), mạng ngoài `edge` (1 lần: `docker network create edge`).

```bash
cp .env.example .env
# Sửa .env: các giá trị CHANGE_ME, PMH_* (client SA PMH ID cấp). GIỮ NODE_ENV=production, AUTH_DEV_MODE=false:
# override dev tự đặt development/true cho container api; .env dùng chung với prod.
# Dev không cần PMH ID thật: SA local và dev-identity đủ cho mọi màn đã có.

# Mật khẩu SA dev: in hash, dán vào LOCAL_SA_PASSWORD_HASH trong .env (không commit .env).
# sa:hash không nhận mật khẩu trên dòng lệnh (sẽ nằm trong lịch sử shell): chạy rồi gõ, chữ gõ không hiện
cd api && npm ci
npm run -s sa:hash
# hoặc qua pipe (bash):  IFS= read -rsp 'Mật khẩu SA: ' PW; echo; printf '%s' "$PW" | npm run -s sa:hash; unset PW
cd ..

docker compose up -d --build
curl -s localhost:$(docker compose port web 80 | cut -d: -f2)/api/health   # {"status":"ok"}
```

`docker-compose.override.yml` (chỉ dev) bật `AUTH_DEV_MODE=true`, `NODE_ENV=development`, publish web ra
cổng ngẫu nhiên `127.0.0.1`, api ra `127.0.0.1:3000` (cho Vite dev/Playwright) và Postgres ra `127.0.0.1:5492`.
Đổi hash SA hoặc biến env khác thì `docker compose up -d api` để api nạp lại.

**`AUTH_DEV_MODE`**: `=true` chỉ hợp lệ khi `NODE_ENV ∈ {development, test}` — bật ở môi trường khác thì app
**từ chối khởi động**. Khi bật, api nhận header dev-identity `x-dev-user-sub` + `x-dev-role` (`member|admin|sa`)
thay cho phiên; nginx của `web` xóa các header này, nên chỉ dùng được qua api trực tiếp (Vite dev, test).

Seed danh mục ban đầu (idempotent theo `code`: món đã có thì bỏ qua — không đè tên, tối đa, nhóm, tồn kho,
ảnh, trạng thái Hành chính đã sửa; sửa dữ liệu seed sau này phải sửa tay qua UI):

```bash
cd api && DATABASE_URL=postgres://<user>:<pass>@127.0.0.1:5492/<db> npm run seed:catalog   # dev
docker compose exec api node scripts/seed-catalog.mjs                                         # prod, lần deploy đầu
```

### Luồng tháng trên dev

1. Nhân viên mở `/` (Đăng ký): chọn món, "+ Thêm món khác" cho món ngoài danh mục (bắt buộc ảnh), **Lưu phiếu**.
   Sửa tiếp được đến 23:59 ngày hạn (mặc định ngày 10, giờ VN); sau đó kỳ khóa, phiếu mới vào tháng sau.
2. Hành chính mở `/admin/summary` (Tổng hợp kỳ): KPI "đã đăng ký x/y", lọc dòng chờ giao, sao chép danh sách
   chưa đăng ký để nhắc; **Điều chỉnh** mở ngăn sửa phiếu (sau hạn phải ghi lý do), **Tạo phiếu hộ** cho kỳ đang mở.
3. `/admin/review` (Món ngoài danh mục): Chấp nhận / Thêm vào danh mục… / Từ chối… (lý do hiện cho nhân viên).
4. Nhân viên xem lại ở **Lịch sử** (`/history`, kỳ cũ chỉ đọc, tiến độ giao theo dòng).
5. Sau hạn (kỳ đã khóa) Hành chính mở `/admin/delivery` (Giao hàng): giao từng dòng hoặc **Giao tất cả**; giao trừ kho
   ngay, thiếu kho thì báo "Không giao được: … — chỉ còn n trong kho"; không có hoàn tác đợt giao (GĐ1).
6. `/admin/backlog` (Còn nợ, theo món/theo người): **Giao bổ sung…** sau khi nhập mua ở Kho, **Hủy nợ…** có lý do.
7. `/admin/reports` (Báo cáo & in): Cần mua = phần chưa giao kỳ này + nợ kỳ trước − tồn; sửa Đặt mua, **Xuất Excel**
   (2 sheet) hoặc **In trình ký** (3 ô ký lấy từ Cấu hình) — mỗi lần tạo một bản chốt, "In lại"/"Tải lại" ra số cũ.
8. Chuông: giao đủ phiếu, hủy nợ, xử lý món ngoài danh mục báo cho nhân viên; kỳ mở (ngày 1), nhắc còn 3 ngày
   (`lastDay − 2`), kỳ khóa, sắp hết kho do cron mỗi giờ (`NotificationScheduler`, phút 5, giờ VN; chạy cả lúc boot).

Giả lập kỳ:
- api e2e: đặt `CLOCK_OFFSET_MS` (chỉ nhận khi `NODE_ENV=test`, api từ chối khởi động nếu đặt ở môi trường khác);
  cần mốc chính xác tới giây (ranh giới hạn) thì override `ClockService` trong `createTestApp`.
- dev UI: không chỉnh đồng hồ api dev; muốn có "kỳ trước" (Lịch sử, Chép lại, Điều chỉnh sau hạn) thì seed
  phiếu kỳ trước bằng SQL, ví dụ (đổi `2026-10`, `<sub>`, `<item_id>`):

```bash
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
INSERT INTO periods (ym, deadline) VALUES ('2026-10-01', '2026-10-10T17:00:00Z') ON CONFLICT DO NOTHING;
WITH r AS (INSERT INTO requests (period_ym, user_sub, created_by_sub)
           VALUES ('2026-10-01', '<sub>', '<sub>') RETURNING id)
INSERT INTO request_lines (request_id, item_id, qty) SELECT id, '<item_id>', 4 FROM r;
SQL
```

  Kỳ `2026-10` hạn đã qua nên là kỳ đã khóa: Giao hàng, Còn nợ, Báo cáo dùng được ngay. Đã giao phải đi qua
  Giao hàng (ghi `line_deliveries` + sổ kho), đừng đặt `delivered_qty` bằng SQL.
- Chuông trên dev: cron không chạy bù ngày đã qua, muốn xem bảng chuông thì seed thẳng bản ghi
  (`topic` theo `docs/architecture.md` §9, `params` khớp `notifications.topics.*`):

```bash
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
INSERT INTO in_app_notifications (user_sub, event_id, topic, params, link)
VALUES ('<sub>', 'dev:<sub>:1', 'request_delivered', '{"ym":"2026-10"}', '/history/2026-10');
SQL
```

- Cron trong api e2e: không đợi lịch, gọi thẳng `app.get(NotificationScheduler).runHourly(new Date('…Z'))` với mốc
  muốn thử (mẫu `api/test/reminders.fixture.ts`); cron tự chạy và chạy-lúc-boot đều tắt khi `NODE_ENV=test`.

## Test

### api

```bash
docker compose exec postgres createdb -U <POSTGRES_USER> vpp_test   # 1 lần

cd api
export NODE_ENV=test DATABASE_URL=postgres://<user>:<pass>@127.0.0.1:5492/vpp_test
npm test            # unit (luật thuần)
npm run test:e2e    # test/*.e2e-spec.ts — app thật + supertest, dev-identity
npm run test:db     # test/*.db-spec.ts — Postgres thật, chạy tuần tự
```

Không `source .env` vào shell để chạy test: `.env` đặt `NODE_ENV=production`. Spec cần DB (cả một số
e2e) reset schema và từ chối chạy nếu tên database không kết thúc `_test`.

### web

```bash
cd web && npm ci
npm run dev                          # http://localhost:5173, proxy /api → 127.0.0.1:3000 (VITE_API_TARGET)
npm test && npm run lint && npm run build
npm run typecheck:e2e
```

### Playwright

```bash
docker compose up -d                       # cần api dev ở 127.0.0.1:3000
cd web
npx playwright install chromium            # lần đầu (khớp @playwright/test)
PW_SA_PASSWORD='<mật-khẩu-dev>' npx playwright test
```

- Tự chạy Vite ở `:5174` (`PW_PORT`); 2 project `desktop-1280` và `mobile-390`; axe `color-contrast` ở 390 px.
- Chạy tuần tự (`workers: 1`): mọi spec ghi vào cùng DB dev (kỳ, cấu hình, danh mục), song song thì đua nhau.
- `p1-flow.spec.ts` (smoke Plan 1) đăng nhập SA thật qua form "Dành cho IT": cần `PW_SA_PASSWORD` khớp
  `LOCAL_SA_PASSWORD_HASH` (tên tài khoản `PW_SA_USERNAME`, mặc định `sa`); thiếu thì test bị skip.
  `p2-flow.spec.ts` (smoke Plan 2: đăng ký → Tổng hợp → Điều chỉnh → Thêm vào danh mục → Lịch sử) dùng SA thật
  khi có `PW_SA_PASSWORD`, không thì dev admin; `p3-flow.spec.ts` (smoke Plan 3: giao → Còn nợ → Báo cáo/Excel/in →
  nhập mua, giao bổ sung → bản chốt cũ → hủy nợ, chuông) cũng vậy. Mỗi lần chạy đủ bộ đăng nhập SA 6 lần (mỗi smoke × mỗi viewport) —
  `sa-login` giới hạn 10/phút/IP, đừng chạy dồn.
- Các spec còn lại dùng dev-identity: header `x-dev-*` gắn **chỉ cho `/api/**`** qua `page.route`
  (`playwright/helpers.ts`); gắn toàn cục làm request font Google bị chặn CORS.
- Spec ghi vào DB dev dùng chung: dữ liệu thử có tên `PW …` / sub `pw-…`, dọn trong `finally` (phiếu và người thử
  bị xóa kèm ảnh họ tải; món xóa được thì xóa kèm ảnh, đã có sổ kho thì ngừng; nhóm thử bị ngừng; đợt giao, bản chốt,
  chuông của dữ liệu thử bị xóa); cấu hình được trả lại giá trị gốc.
  Còn sót (test bị ngắt giữa chừng) thì dọn một lần — chỉ xóa dòng `PW`/`pw-` không bị dữ liệu thật tham chiếu
  (kể cả bản ghi điều chỉnh, đánh dấu ADM hết hàng và hàng về ngoài DM của món/khóa thử; bỏ `pw-…` khỏi
  `periods.headcount_subs` và đặt lại `headcount`), in số dòng trước/sau; chạy lại bao nhiêu lần cũng được:
  `docker compose exec -T postgres sh -c 'psql -v dev_ok=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < web/playwright/cleanup-dev-data.sql` — **chỉ trên DB dev, không bao giờ trên prod**
  Bảng điều chỉnh là chỉ-thêm: script tắt trigger chặn xóa trong chính giao dịch dọn rồi bật lại. Migration mới có
  bảng/cột trỏ tới phiếu, món, người hoặc kỳ phải cập nhật script cùng lúc. Test chỉ ghi lên dữ liệu tự gieo
  (`seedPwItem`, `seedActiveUser`; kiểm bằng `web/src/test/playwright-data-policy.test.ts`); dữ liệu PW lỡ ghi lên
  món/phiếu thật thì script không nhận ra, phải dọn tay một lần.
- Không mạng tải Chromium: đặt `PW_CHROMIUM_PATH=/đường/dẫn/chrome`.
- Ảnh chụp màn `web/test-results/screens/`, báo cáo `web/playwright-report/` — không commit.
- Fixture ảnh EXIF xoay 6: `python3 web/scripts/make-exif6-fixture.py web/src/test/fixtures/exif6.jpg` (Pillow).

## Triển khai plan giao diện Hành chính

Lần deploy đầu của nhánh giao diện Hành chính chạy hai migration không quay lui được: `0111_units` (bảng ĐVT,
FK từ `items.unit` và `request_lines.custom_unit`) và `0112_config_signature_boxes` (bỏ `config.signers`, thay
bằng `signature_boxes`). Làm theo thứ tự:

1. **Kiểm trước** trên prod (phải ra **0 dòng**):

   ```bash
   docker compose -f docker-compose.yml exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
   SELECT DISTINCT custom_unit FROM request_lines
   WHERE custom_unit IS NOT NULL
     AND custom_unit NOT IN ('cai','hop','cay','ram','cuon','loc','bich','chai','bo');
   SQL
   ```

   Có dòng → FK của `0111` sẽ hỏng, migration rollback và **api không khởi động**. Không deploy; báo dev để
   chọn mã đúng cho từng giá trị lạ rồi `UPDATE request_lines SET custom_unit = '<mã>' WHERE custom_unit = '<giá trị lạ>'`
   (có backup trước), kiểm lại ra 0 dòng rồi mới deploy. Nếu lỡ deploy và api không lên: sửa dữ liệu như trên
   rồi `docker compose -f docker-compose.yml restart api` (migration chạy lại lúc boot).
2. **Backup tay** ngay trước khi deploy:
   `docker compose -f docker-compose.yml --profile backup run --rm backup`, kiểm file backup mới xuất hiện.
3. Deploy (`bash update-vpp.sh`), chờ `/api/health` 200.
4. **Không hạ phiên bản** sau khi `0112` đã chạy: bản cũ đọc `config.signers` (đã xóa). Cần quay lui thì phục hồi
   backup ở bước 2 (`bash ops/backup/restore.sh`), không chỉ checkout code cũ.
5. Nạp danh mục Booking (mục dưới) chỉ **sau** `0111` và **trước** khi Hành chính đổi tên các ĐVT có sẵn — bộ nạp
   khớp ĐVT seed theo mã (`cai`, `hop`…), nhưng ĐVT khác (vd "cuốn", "xấp") khớp theo tên.

## Nạp danh mục Booking

Nạp một lần danh mục từ sheet `Booking` của file Excel chủ dự án (SPEC giao diện Hành chính §11.4). Món đã có
(trùng mã, hoặc trùng tên khi hàng không mã) được bỏ qua, không ghi đè — chạy lại không nhân bản. File Excel
**không commit**. Prod chỉ chạy khi chủ dự án đồng ý (chủ dự án tự chạy).

```bash
# Dev bỏ "-f docker-compose.yml"; prod BẮT BUỘC có -f
# cp giữ quyền và chủ của file máy chủ: cho mọi người đọc để user node trong container đọc được
chmod 644 "VPPham.xlsx"
docker compose -f docker-compose.yml cp "VPPham.xlsx" api:/tmp/booking.xlsx
# 1. Chạy thử: in báo cáo (món tạo, bỏ qua + lý do, ĐVT tạo mới, "Cần đặt mã"), không ghi gì
docker compose -f docker-compose.yml exec api node scripts/import-booking.mjs /tmp/booking.xlsx
# 2. Prod: backup tay ngay trước khi ghi (cùng lệnh mục Prod), kiểm file backup mới xuất hiện
docker compose -f docker-compose.yml --profile backup run --rm backup
# 3. Đọc báo cáo, đúng thì ghi (một transaction, audit catalog.imported, actor system:import)
docker compose -f docker-compose.yml exec api node scripts/import-booking.mjs /tmp/booking.xlsx --apply
# 4. Xóa file khỏi container
docker compose -f docker-compose.yml exec -u root api rm /tmp/booking.xlsx
```

- Mã ĐVT mới trong báo cáo chạy thử chỉ là dự kiến: nếu Hành chính thêm ĐVT giữa lúc chạy thử và `--apply`,
  mã thật có thể khác (vd `cuon-3`). Hàng dùng ĐVT đã ngừng bị bỏ (`ĐVT đã ngừng`) — mở lại ĐVT rồi chạy lại.
- Món mới: chưa xếp nhóm, chưa có ảnh, tối đa = `default_max_qty`, tồn 0, đang dùng. Hành chính bổ sung nhóm,
  ảnh và mã cho các hàng trong mục "Cần đặt mã" ở trang Danh mục.
- **Không chạy lại** sau khi Hành chính đã đổi tên món thuộc "Cần đặt mã" (kể cả khi đã đặt mã cho món): trong
  file hàng đó không có mã (hoặc mã trùng đã bị bỏ) nên được khớp theo tên — tên đã đổi thì bị nạp thêm bản trùng.
  Bắt buộc chạy lại thì chạy thử trước và chỉ `--apply` khi "Món tạo" đúng như mong đợi.
- Lỗi giữa chừng (vd tên quá 120 ký tự) thì không ghi gì; sửa file rồi chạy lại.

## Prod

```bash
docker compose -f docker-compose.yml up -d --build   # BẮT BUỘC -f: không nạp override dev
```

- https://de-vpp.pmh.com.vn:8443 — TLS do EDGE (PMH_IDE `deploy/edge`); `web` chỉ join mạng `edge`
  alias `vpp-web`, không publish cổng; `api`/`postgres` chỉ ở mạng default.
- Cập nhật: `bash update-vpp.sh` (repo sạch → `git pull --ff-only` → build → chờ `/api/health` 200 qua EDGE;
  migration chạy lúc api boot).
- Backup: service `backup-cron` (hằng ngày lúc `BACKUP_AT`); chạy tay
  `docker compose -f docker-compose.yml --profile backup run --rm backup`; phục hồi `bash ops/backup/restore.sh`.

## Trước khi deploy

Checklist lần deploy đầu (và khi đổi hạ tầng):

- [ ] `.env` prod: `NODE_ENV=production`, `AUTH_DEV_MODE=false`, không còn `CHANGE_ME`; `APP_BASE_URL` khớp hệt
      `app_url` đã khai với PMH ID.
- [ ] Mật khẩu SA prod: trong `api/`, `npm run -s sa:hash` rồi gõ mật khẩu (không hiện chữ gõ; hoặc bash:
      `IFS= read -rsp 'Mật khẩu SA: ' PW; echo; printf '%s' "$PW" | npm run -s sa:hash; unset PW`) → dán vào `LOCAL_SA_PASSWORD_HASH` (mật khẩu cất két IT, không dùng lại mật khẩu dev; không truyền mật khẩu
      làm tham số dòng lệnh vì sẽ nằm trong lịch sử shell).
- [ ] `TRUST_PROXY_HOPS` (chỉ kiểm được trên prod, sau EDGE thật): đăng nhập SA một lần từ máy trong LAN, mở
      Nhật ký → dòng `auth.sa_login` **đầu tiên** trên prod (`detail.ip`) —
      IP phải là IP **máy người dùng**, không phải IP EDGE/docker. Sai thì chỉnh số hop (EDGE `vpp.conf` dùng
      `proxy_add_x_forwarded_for`, nginx `web` thêm một hop nữa) rồi `docker compose -f docker-compose.yml up -d api`.
      IP sai làm lockout/throttle SA gộp mọi người vào một IP.
- [ ] Seed danh mục lần đầu: `docker compose -f docker-compose.yml exec api node scripts/seed-catalog.mjs`.
- [ ] Chạy thử backup tay (mục Prod) và kiểm file `.tar.gz`/`.enc` xuất hiện trong thư mục backup.
- [x] Lỗ hổng multer GHSA-q7qp-rjg7-q26m đã vá (NestJS 12, multer 2.5.0); trước mỗi lần deploy chạy
      `cd api && npm audit --omit=dev` — phải 0 high/critical.

Runbook sự cố:

- **SA bị khóa toàn cục** (50 lần sai/15′ từ mọi IP → `SA_LOGIN_LOCKED` kể cả mật khẩu đúng): bộ đếm nằm trong
  bộ nhớ api — `docker compose -f docker-compose.yml restart api` để xóa, rồi xem Nhật ký `auth.sa_login_failed`
  để tìm nguồn dò mật khẩu.
- **PMH ID sập**: người đang có phiên nhận 503 `SSO_UNAVAILABLE` (phiên được giữ, tự sống lại khi PMH ID về);
  màn đăng nhập hiện thông báo và IT vào bằng "Dành cho IT" (SA).
- **Restore không nguyên tử**: luôn chạy backup tay ngay trước khi restore. `restore.sh` DROP database rồi nạp lại;
  lỗi ở bước 6/6 (nạp file upload) thì DB đã phục hồi nhưng ảnh chưa — sửa nguyên nhân rồi chạy lại restore
  với cùng bản backup.
