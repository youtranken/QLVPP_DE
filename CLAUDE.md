# VPP Công trình — quy ước làm việc

App quản lý văn phòng phẩm phòng Công trình, đăng nhập bằng PMH ID (OIDC), cùng gia đình với QLTS_DE. Tài liệu là nguồn sự thật, theo thứ tự ưu tiên: `docs/prd.md` → `docs/architecture.md` → `docs/backlog/*.md` → `design-preview/_SPEC.md` (mục "Thay đổi sau review" thắng mockup HTML) → `docs/plans/*`. Mâu thuẫn giữa code và spec: spec đúng; nếu spec sai thì ghi vào `docs/review-spec.md` rồi mới sửa.

## Stack và lệnh

- `api/`: NestJS 11, Node 24, `pg` + drizzle (schemaless), migration SQL thuần `api/src/migrations/NNNN_*.sql` (checksum — **không sửa file đã apply**, viết file mới).
- `web/`: React 19, Vite 8, TS 6, TanStack Query, react-router 7, react-i18next, Radix Dialog; CSS token riêng (`web/src/css/tokens.css`), không AntD/Tailwind.
- Dev: `cp .env.example .env` → `docker compose up -d --build` (override publish Postgres `127.0.0.1:5492`, `AUTH_DEV_MODE=true`); DB test: `docker compose exec postgres createdb -U $POSTGRES_USER vpp_test`, `DATABASE_URL=…/vpp_test`.
- Test api: `npm test` (unit) · `npm run test:e2e` (`test/*.e2e-spec.ts`, app thật + supertest) · `npm run test:db` (`test/*.db-spec.ts`, Postgres thật, chạy tuần tự). Web: `npm test` (vitest + Testing Library) · `npm run lint` (oxlint) · `npx playwright test` (smoke trên compose dev).

## TDD — bắt buộc cho mọi thay đổi hành vi

1. Viết test thất bại trước (RED) — tên test nói rõ hành vi và giá trị trong spec (`PERIOD_LOCKED khi lưu lúc 00:00:00 ngày 11`).
2. Chạy, xác nhận fail đúng lý do (không phải lỗi cú pháp/import).
3. Viết code tối thiểu để pass (GREEN). Không viết code chưa có test đòi.
4. Chạy lại test liên quan; trước khi commit chạy toàn bộ bộ test của gói đang sửa.
5. Refactor nếu cần, test vẫn xanh.
Báo cáo/commit phải có bằng chứng RED và GREEN (lệnh + output). Test không assert gì, test chỉ kiểm mock, test bị `skip` = chưa làm.

Tầng test theo loại code:
- Luật thuần (`period.ts`, `role.ts`, validate, công thức `need`) → unit jest, không DB.
- Ràng buộc CSDL (CHECK/UNIQUE/trigger/đồng thời) → `*.db-spec.ts` với Postgres thật; đồng thời thì dùng `Promise.all` hai request thật, không mock.
- Endpoint, guard, mã lỗi → `*.e2e-spec.ts` qua `createTestApp` + dev-identity (`x-dev-user-sub`, `x-dev-role`, chỉ khi `AUTH_DEV_MODE=true` và `NODE_ENV=test`).
- Component web → vitest + Testing Library: kiểm hành vi người dùng thấy (nhãn, nút vô hiệu, lỗi gắn đúng ô), không kiểm chi tiết triển khai.
- Luồng người dùng xuyên api+web → Playwright.

## Playwright (E2E thật)

- Chạy trên `docker compose` dev; đăng nhập bằng SA local (`LOCAL_SA_*` dev) hoặc dev-identity qua `extraHTTPHeaders`. Không bao giờ chạy với PMH ID thật trong test tự động.
- Mỗi luồng chạy ở **1280 px và 390 px**; trang member phải kiểm 390 px (thanh dưới 3 mục, Lịch sử/Tôi ≤ 2 chạm). Chạy `@axe-core/playwright` trên màn chính ở 390 px: không lỗi tương phản.
- Kiểm bằng vai trò/nhãn người dùng (`getByRole`, `getByLabel`, text tiếng Việt), không bằng CSS class. Luật kỳ kiểm bằng `CLOCK_OFFSET_MS` phía server, không giả đồng hồ trình duyệt.
- Mỗi story của backlog có AC Playwright thì spec Playwright phải có test mang tên story đó (`E2-S5 …`).
- Ảnh chụp/`playwright-report/` không commit.

## Definition of Done (một task/story chỉ "xong" khi đủ)

- [ ] Mọi AC của story trong `docs/backlog/` có test tương ứng và xanh; mã lỗi đúng tên trong `architecture.md` §7.
- [ ] `npm test`, `npm run test:e2e`, `npm run test:db` (api) và `npm test`, `npm run lint`, `npm run build` (web) đều pass, output sạch (không warning lạ, không `console.error` rơi vãi).
- [ ] Luật nghiệp vụ ép ở server/CSDL, UI chỉ hỗ trợ; không có luật chỉ tồn tại trên FE.
- [ ] Mọi chuỗi UI qua i18n (`vi` + `en`), không chuỗi cứng trong component; câu chữ theo `_SPEC.md` mục "Câu chữ" (gọi admin là **Hành chính**, "Chép lại danh sách tháng X", "Lưu phiếu", "Quay lại sửa").
- [ ] Mutate có audit (`AuditWriterService`) với before/after khi sửa dữ liệu; GET không audit.
- [ ] Thao tác thay đổi dữ liệu là idempotent hoặc có `expected_*`/`ON CONFLICT` như architecture §6 quy định.
- [ ] Không lộ secret, không log `code/state/login_hint/logout_token`, không log body webhook.
- [ ] `grep -ri qlts api web` = 0; không có `TODO` bỏ ngỏ; không có `.env` trong `git status`.
- [ ] Report của task có: RED/GREEN, lệnh verify, danh sách file, điều còn băn khoăn.

## Quy ước code

- Lỗi API: `{code, message, line_id?, …}`; `code` là hằng SCREAMING_SNAKE đã liệt kê trong `architecture.md` §7; thêm mã mới thì cập nhật §7 trong cùng commit.
- Thời gian nghiệp vụ lấy từ `ClockService`, không `new Date()`/`now()` DB cho luật kỳ.
- SQL: tham số hóa, `FOR UPDATE` theo thứ tự khóa cố định (requests → request_lines → items); UPDATE có điều kiện (`WHERE stock_qty >= $q`) thay vì đọc-rồi-ghi.
- Tên: bảng/cột snake_case, TS camelCase, DTO class-validator; file một trách nhiệm; không tạo helper "utils" chung chung.
- Copy từ QLTS_DE: copy nguyên rồi cắt, đổi `qlts → vpp`; không "cải tiến" phần auth trừ 4 điểm spec đã chốt (role mỗi request, SA lockout theo (IP,user), webhook v2, `TRUST_PROXY_HOPS`).
- Commit theo task, tiếng Việt, tiền tố `feat/fix/chore/docs/test`; **không push**, không rebase lịch sử đã có; nhánh `feat/*` từ `main`.
- Comment chỉ khi giải thích *tại sao* (luật nghiệp vụ, quyết định spec), không mô tả *cái gì*.

## Review

Mỗi task qua reviewer độc lập: (1) đúng spec — không thiếu, không thừa; (2) chất lượng — test thật, tách trách nhiệm, không trùng lặp. Finding Critical/Important phải sửa trước khi sang task kế; Minor ghi ledger. Cuối mỗi plan review toàn nhánh trước khi gộp về `main`.
