# PHƯƠNG ÁN KIẾN TRÚC — DE-VPP

|                   |                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phiên bản**     | v1.0                                                                                                                                              |
| **Ngày**          | 2026-08-06                                                                                                                                        |
| **Nguồn**         | PRD v1.2 · SDD v4 · SSO-INTEGRATION v1.0 · USER_STORIES v3.0                                                                                      |
| **Mục đích**      | So sánh 2 kiến trúc phù hợp + khuyến nghị cho MVP. Chọn theo **độ phù hợp**, không theo độ phổ biến.                                              |
| **✅ QUYẾT ĐỊNH** | **Chốt Phương án A (Modular Monolith gọn)** cho MVP — 2026-08-06. Giữ codebase module hoá + API stateless để nâng lên B khi có tín hiệu tải thật. |

---

## 0. Ràng buộc chi phối (rút từ 4 tài liệu)

| Yếu tố     | Ràng buộc                                                          | Hệ quả kiến trúc                                                      |
| ---------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Quy mô     | ≤ 500 user; cao điểm ngày 1–10 nhưng tuyệt đối nhỏ                 | Không cần cluster/microservice; 1 node đủ                             |
| Xác thực   | PMH ID **SSO OIDC**, mẫu **BFF**, đầy đủ Directory + Webhook + BCL | Backend giữ `client_secret`, nhận webhook/BCL, có job đồng bộ danh bạ |
| Dữ liệu    | Quan hệ + ràng buộc _1 đơn hiệu lực/kỳ_ (partial unique), audit    | **SQL** (Postgres), giao dịch ACID                                    |
| File       | Ảnh mục "Khác" ≤5MB, ít                                            | Lưu file đơn giản; chưa cần CDN                                       |
| Thông báo  | Trong app (chuông), không email                                    | Bảng `notifications`; không cần hạ tầng mail                          |
| Thanh toán | **Không** (BR-11)                                                  | Không có cổng thanh toán                                              |
| Báo cáo    | Excel trình ký + biểu đồ nhiều kỳ                                  | ExcelJS + truy vấn tổng hợp                                           |
| Triển khai | Docker demo trước; prod on-prem/EDGE hoặc riêng (chưa chốt)        | Ưu tiên self-host, portable, ít phụ thuộc cloud                       |

**Đã cố định (không đưa ra so sánh):** FE **React + Vite + Ant Design + TanStack Query + ECharts**; Auth **OIDC BFF** (`openid-client` + `jose`); DB **PostgreSQL**; Excel **ExcelJS**; đóng gói **Docker**. → Hai phương án khác nhau ở **caching / background jobs / lưu file / tách dịch vụ / realtime**.

---

## Phương án A — **Modular Monolith gọn** (một dịch vụ backend)

> Toàn bộ backend (API + BFF auth + nhận webhook/BCL + jobs định kỳ) trong **một tiến trình**; Postgres một instance; SPA tĩnh sau nginx; ảnh lưu **đĩa cục bộ** (volume). Không Redis, không object storage, không worker riêng.

| Chiều                | Lựa chọn                                                                                                                                                                                 | Ghi chú phù hợp                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Frontend**         | React 19 + Vite (SPA) + Antd + TanStack Query + ECharts, build tĩnh sau nginx                                                                                                            | Nội bộ, sau đăng nhập; SSR không cần thiết                         |
| **Backend**          | **NestJS** một service (module hoá: auth/catalog/requests/notify/report/admin)                                                                                                           | 1 ngôn ngữ TS dùng chung `packages/shared` (quy tắc kỳ/≤20) với FE |
| **Database**         | PostgreSQL 16, một instance                                                                                                                                                              | ACID cho duyệt/giao; partial unique; JSONB cho audit               |
| **Authentication**   | OIDC BFF: `openid-client` (code+PKCE, refresh), `jose` (verify JWKS); **phiên lưu Postgres** (`app_sessions`)                                                                            | Không thêm store phiên riêng                                       |
| **File storage**     | **Đĩa cục bộ** (Docker volume), phục vụ qua endpoint stream có kiểm quyền                                                                                                                | Ảnh ít, ≤5MB; on-prem đơn giản                                     |
| **Caching**          | **Không có tầng cache riêng**: JWKS cache trong tiến trình (`jose`), catalog cache in-memory TTL ngắn, HTTP cache header cho tĩnh                                                        | Đủ ở quy mô này; ít bộ phận                                        |
| **Background jobs**  | `@nestjs/schedule` **in-process** (đồng bộ Directory ~60', dọn phiên hết hạn, retry webhook gửi-đi nếu có); hàng đợi nhẹ bằng **Postgres `FOR UPDATE SKIP LOCKED`** khi cần              | Không cần Redis/broker                                             |
| **Search**           | Truy vấn Postgres + index + phân trang; tuỳ chọn `pg_trgm` cho tìm tên món                                                                                                               | Không có nhu cầu full-text thực sự                                 |
| **Notification**     | Bảng `notifications`; FE **poll** (hoặc SSE nhẹ) đếm chưa đọc                                                                                                                            | Không cần realtime phức tạp                                        |
| **Payment**          | Không áp dụng                                                                                                                                                                            | —                                                                  |
| **Deployment**       | Docker Compose: `web`, `api`, `postgres`, `mock-idp` (demo) — **1 node**                                                                                                                 | Portable on-prem/VPS/EDGE                                          |
| **Monitoring**       | `pino` JSON log, `/health`, Docker healthcheck; (tuỳ chọn) Uptime Kuma                                                                                                                   | Nhẹ, đủ vận hành nội bộ                                            |
| **Độ phức tạp**      | **Thấp–Trung bình**                                                                                                                                                                      | Ít bộ phận, dễ hiểu, dễ vận hành                                   |
| **Khả năng mở rộng** | Dọc (tăng RAM/CPU) + có thể chạy **nhiều bản `api`** (phiên ở DB, không state RAM) → đủ tới vài nghìn user                                                                               | Nghẽn khả dĩ: 1 Postgres (đủ xa so với 500)                        |
| **Chi phí vận hành** | **Thấp** (1 VM nhỏ, 1 DB)                                                                                                                                                                | Ít dịch vụ = ít giám sát/bảo trì                                   |
| **Ưu điểm**          | Ít bộ phận, ít điểm hỏng; deploy/backup đơn giản (dump Postgres + thư mục ảnh); khớp đúng quy mô ≤500; nhanh ra demo                                                                     |                                                                    |
| **Nhược điểm**       | Job nặng chạy chung tiến trình API (ở quy mô này không đáng kể); file cục bộ khó chia sẻ khi chạy **nhiều node** (cần NFS/đổi sang object storage lúc scale); realtime chuông ở mức poll |                                                                    |

---

## Phương án B — **Tách dịch vụ + hàng đợi** (API + Worker + Redis + object storage)

> Backend tách **API** và **Worker** riêng; **Redis** làm cache + hàng đợi (**BullMQ**) + pub/sub realtime; ảnh trên **MinIO** (S3-compatible). Hướng "sẵn sàng lớn".

| Chiều                | Lựa chọn                                                                                                                     | Ghi chú                                                          |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| **Frontend**         | Như A (SPA Antd). Tuỳ chọn CDN/edge cache cho tĩnh                                                                           | Có thể thêm SSR nếu cần TTFB, nhưng tăng phức tạp token          |
| **Backend**          | **NestJS API** + **NestJS Worker** (2 tiến trình), chung codebase                                                            | Tách tải job khỏi request                                        |
| **Database**         | PostgreSQL 16 (+ read replica khi cần)                                                                                       | Như A, có đường mở rộng đọc                                      |
| **Authentication**   | OIDC BFF; **phiên + JWKS + idempotency-key webhook trên Redis** (nhanh), Postgres lưu bền                                    | Redis giảm tải DB cho phiên                                      |
| **File storage**     | **MinIO** (S3 API), URL có chữ ký; tách khỏi node app                                                                        | Chạy nhiều node không vướng file cục bộ                          |
| **Caching**          | **Redis**: cache catalog, kết quả tổng hợp, rate-limit, dedupe webhook                                                       | Có tầng cache thật                                               |
| **Background jobs**  | **BullMQ trên Redis**, Worker xử lý: Directory sync, xử lý webhook/BCL, fan-out thông báo, retry có backoff                  | Khớp ngữ nghĩa retry của PMH ID; bền, quan sát được (Bull Board) |
| **Search**           | Postgres + `pg_trgm`; (chỉ khi thật cần) thêm engine — **không** mặc định                                                    | Vẫn chưa cần Elasticsearch                                       |
| **Notification**     | Postgres + **Redis pub/sub → SSE/WebSocket** chuông realtime                                                                 | Trải nghiệm tức thì                                              |
| **Payment**          | Không áp dụng                                                                                                                | —                                                                |
| **Deployment**       | Docker Compose: `web`, `api`, `worker`, `postgres`, `redis`, `minio`, `mock-idp`; prod có thể lên k8s                        | Nhiều dịch vụ hơn                                                |
| **Monitoring**       | Prometheus + Grafana + Loki; Bull Board; healthcheck                                                                         | Bộ giám sát đầy đủ                                               |
| **Độ phức tạp**      | **Trung bình–Cao**                                                                                                           | Nhiều bộ phận, nhiều cấu hình                                    |
| **Khả năng mở rộng** | **Cao**: scale `api`/`worker` độc lập, object storage, Redis, replica                                                        | Dư sức tới hàng chục nghìn user                                  |
| **Chi phí vận hành** | **Trung bình–Cao** (thêm Redis, MinIO, giám sát; nhiều RAM)                                                                  | Cần người vận hành cứng tay hơn                                  |
| **Ưu điểm**          | Bền & mở rộng tốt; job cô lập, retry/quan sát tốt; realtime; đa node dễ                                                      |                                                                  |
| **Nhược điểm**       | **Thừa** so với ≤500; nhiều điểm hỏng (Redis/MinIO); backup/vận hành phức tạp hơn; ra demo chậm hơn; chi phí hạ tầng cao hơn |                                                                  |

---

## So sánh nhanh

| Tiêu chí          | A — Monolith gọn            | B — Tách dịch vụ + hàng đợi |
| ----------------- | --------------------------- | --------------------------- |
| Số dịch vụ (demo) | **4** (web/api/pg/mock-idp) | 7 (thêm worker/redis/minio) |
| Độ phức tạp       | Thấp–TB                     | TB–Cao                      |
| Phù hợp ≤500      | **Rất phù hợp**             | Thừa công suất              |
| Mở rộng tối đa    | Vài nghìn (đủ xa)           | Hàng chục nghìn             |
| Realtime chuông   | Poll/SSE nhẹ                | SSE/WS tức thì              |
| File đa node      | Cần đổi khi scale           | Sẵn (MinIO)                 |
| Vận hành/giám sát | Nhẹ                         | Nặng                        |
| Chi phí           | Thấp                        | TB–Cao                      |
| Thời gian ra demo | **Nhanh**                   | Chậm hơn                    |
| Rủi ro vận hành   | Thấp                        | Cao hơn (nhiều bộ phận)     |

---

## Khuyến nghị cho MVP: **Phương án A (Modular Monolith gọn)**

**Lý do — theo độ phù hợp, không theo độ phổ biến:**

1. **Khớp đúng quy mô.** ≤500 user, cao điểm ngày 1–10 nhưng tổng lượng nhỏ. Một Postgres + một API xử lý dư sức. Thêm Redis/MinIO/worker lúc này là **giải bài toán chưa tồn tại** (YAGNI) — vi phạm nguyên tắc "không chọn vì phổ biến".
2. **Ít điểm hỏng = vận hành nội bộ an toàn.** Đội nội bộ, ưu tiên demo rồi mới prod, host chưa chốt. 4 dịch vụ dễ dựng/sao lưu/khắc phục hơn 7. Redis/MinIO thêm 2 thứ có thể hỏng mà **chưa mang lại giá trị** ở quy mô này.
3. **Vẫn mở đường lớn.** API **không giữ state trong RAM** (phiên ở Postgres) → chạy **nhiều bản api** sau nginx khi cần; job tách thành worker sau này chỉ là **refactor cùng codebase**, không viết lại. Kiến trúc **module hoá** (A) chính là bước đệm tự nhiên lên (B).
4. **Chọn từng mảnh theo nhu cầu thật, không theo mặc định thời thượng:**
   - **PostgreSQL** vì dữ liệu quan hệ + ràng buộc _1 đơn/kỳ_ + duyệt/giao cần ACID — **không** MongoDB (mô hình quan hệ rõ, NoSQL gây hại tính toàn vẹn).
   - **Không Redis** vì chưa có tải cache/queue thực; hàng đợi hiếm (webhook/directory) xử được bằng **Postgres SKIP LOCKED** + `@nestjs/schedule`. Thêm Redis chỉ vì "ai cũng dùng" là thừa.
   - **Đĩa cục bộ** cho ảnh vì lượng nhỏ, on-prem; **MinIO/S3** chỉ cần khi chạy đa node — để dành cho (B).
   - **Không Elasticsearch/engine tìm kiếm**: nhu cầu chỉ là lọc + phân trang, Postgres index (+`pg_trgm` nếu cần) là đủ.
   - **Không serverless/managed cloud (Cognito/Lambda…)**: auth là **PMH ID tự-host OIDC**, host prod có thể **on-prem sau EDGE**; serverless gây khó cho webhook/BCL/long-job + khoá nhà cung cấp + lệch mô hình.
   - **Node/TypeScript** cho backend **không phải vì phổ biến** mà vì **dùng chung `packages/shared`** (quy tắc cửa sổ 1–10, `≤20`, kỳ tháng) với FE → một nguồn sự thật, không lệch FE/BE; và hệ OIDC (`openid-client`/`jose`) + `ExcelJS` trưởng thành. Backend đa ngôn ngữ (Go/.NET) sẽ phải **viết lại các quy tắc** ở 2 nơi.
   - **SPA (không SSR)**: app nội bộ sau đăng nhập, SEO vô nghĩa; SSR làm phức tạp việc giữ token/cookie trong BFF mà không lợi ích tương xứng.

**Khi nào nâng lên (B) — tín hiệu cụ thể, không nâng sớm:**

- Cần chạy **nhiều node api** thường trực (khi đó đổi ảnh sang **MinIO/S3**, cân nhắc **Redis** cho phiên/cache).
- Job/webhook tăng mạnh hoặc cần **quan sát hàng đợi** tốt → tách **Worker + BullMQ**.
- Cần **chuông realtime** đúng nghĩa cho nhiều người → thêm **Redis pub/sub + SSE/WS**.
- Người dùng vượt ~vài nghìn hoặc đọc báo cáo nặng → thêm **read replica**.

**Đường di trú A → B** rẻ vì cùng codebase NestJS module hoá + Postgres: tách worker, cắm Redis/MinIO là **thay adapter**, không đổi mô hình miền.

---

## Bảng tóm tắt khuyến nghị theo 16 chiều (MVP)

| Chiều            | Chốt cho MVP                                                                  |
| ---------------- | ----------------------------------------------------------------------------- |
| Frontend         | React+Vite SPA + Antd + TanStack Query + ECharts                              |
| Backend          | NestJS **một service** module hoá (TS, dùng chung `packages/shared`)          |
| Database         | PostgreSQL 16 (một instance)                                                  |
| Authentication   | OIDC **BFF** (`openid-client`+`jose`), phiên ở Postgres; demo dùng `mock-idp` |
| File storage     | Đĩa cục bộ (Docker volume), phục vụ có kiểm quyền                             |
| Caching          | In-process (JWKS/catalog TTL) + HTTP cache; **chưa dùng Redis**               |
| Background jobs  | `@nestjs/schedule` in-process + Postgres `SKIP LOCKED`                        |
| Search           | Postgres index + phân trang (+`pg_trgm` nếu cần)                              |
| Notification     | Bảng `notifications` + poll/SSE nhẹ                                           |
| Payment          | Không áp dụng (BR-11)                                                         |
| Deployment       | Docker Compose 4 dịch vụ; prod chốt ở M6 (on-prem/EDGE)                       |
| Monitoring       | pino + /health + Docker healthcheck (tuỳ chọn Uptime Kuma)                    |
| Độ phức tạp      | Thấp–Trung bình                                                               |
| Khả năng mở rộng | Đủ tới vài nghìn; có đường nâng lên (B)                                       |
| Chi phí vận hành | Thấp (1 node)                                                                 |
| Ưu/nhược         | Ít điểm hỏng, nhanh ra demo / realtime & đa-node cần nâng cấp sau             |

> Kết luận: **A cho MVP**, giữ codebase **module hoá + stateless api** để nâng lên **B** khi có tín hiệu tải thật — không trả giá phức tạp trước khi cần.
