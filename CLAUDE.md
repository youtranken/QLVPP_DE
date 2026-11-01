# VPP Công trình — quy ước làm việc

App quản lý văn phòng phẩm phòng Công trình, đăng nhập bằng PMH ID (OIDC), cùng gia đình với QLTS_DE. Tài liệu là nguồn sự thật, theo thứ tự ưu tiên: `docs/prd.md` → `docs/architecture.md` → `docs/backlog/*.md` → `design-preview/_SPEC.md` (mục "Thay đổi sau review" thắng mockup HTML) → `docs/plans/*`. Mâu thuẫn giữa code và spec: spec đúng; nếu spec sai thì ghi vào `docs/review-spec.md` rồi mới sửa.

## Stack và lệnh

- `api/`: NestJS 12 (core ESM-only; jest chạy với `--experimental-vm-modules`), Node 24, `pg` + drizzle (schemaless), migration SQL thuần `api/src/migrations/NNNN_*.sql` (checksum — **không sửa file đã apply**, viết file mới).
- `web/`: React 19, Vite 8, TS 6, TanStack Query, react-router 7, react-i18next, Radix Dialog; CSS token riêng (`web/src/css/tokens.css`), không AntD/Tailwind.
- Dev: `cp .env.example .env` → `docker compose up -d --build` (override publish Postgres `127.0.0.1:5492`, `AUTH_DEV_MODE=true`); DB test: `docker compose exec postgres createdb -U $POSTGRES_USER vpp_test`, `DATABASE_URL=…/vpp_test`.
- Test api: `npm test` (unit) · `npm run test:e2e` (`test/*.e2e-spec.ts`, app thật + supertest) · `npm run test:db` (`test/*.db-spec.ts`, Postgres thật, chạy tuần tự). Web: `npm test` (vitest + Testing Library) · `npm run lint` (oxlint) · `npx playwright test` (smoke trên compose dev).

## TDD — bắt buộc cho mọi thay đổi hành vi

1. Viết test thất bại trước (RED) — tên test nói rõ hành vi và giá trị trong spec (`PERIOD_LOCKED khi lưu lúc 00:00:00 ngày 11`).
2. Chạy, xác nhận fail đúng lý do (không phải lỗi cú pháp/import).
3. Viết code tối thiểu để pass (GREEN). Không viết code chưa có test đòi.
4. Chạy lại test liên quan; trước khi commit chạy toàn bộ bộ test của gói đang sửa.
5. Refactor nếu cần, test vẫn xanh.
6. **Kiểm biên theo phễu:** mỗi giới hạn trong spec (mốc giờ, số lượng, độ dài, kích thước tệp, phân trang, ngưỡng khóa/throttle, năm/tháng) có test ở **cả hai phía mốc** (vd 23:59:59.999 ngày 10 được / 00:00:00 ngày 11 `PERIOD_LOCKED`; `max_qty` được / `max_qty+1` bị từ chối; 5 MB được / 5 MB + 1 byte 413), đặt ở tầng rẻ nhất chứng minh được rồi thu hẹp dần: unit (luật thuần) → db-spec (CHECK/đồng thời) → e2e (mã lỗi, vai) → Playwright (người dùng thấy). Test chỉ ở giá trị giữa hoặc một phía = chưa kiểm biên.
Báo cáo/commit phải có bằng chứng RED và GREEN (lệnh + output). Test không assert gì, test chỉ kiểm mock, test bị `skip` = chưa làm.

Tầng test theo loại code:
- Luật thuần (`period.ts`, `role.ts`, validate, công thức `need`) → unit jest, không DB.
- Ràng buộc CSDL (CHECK/UNIQUE/trigger/đồng thời) → `*.db-spec.ts` với Postgres thật; đồng thời thì dùng `Promise.all` hai request thật, không mock.
- Endpoint, guard, mã lỗi → `*.e2e-spec.ts` qua `createTestApp` + dev-identity (`x-dev-user-sub`, `x-dev-role`, chỉ khi `AUTH_DEV_MODE=true` và `NODE_ENV=test`).
- Component web → vitest + Testing Library: kiểm hành vi người dùng thấy (nhãn, nút vô hiệu, lỗi gắn đúng ô), không kiểm chi tiết triển khai.
- Luồng người dùng xuyên api+web → Playwright.

## Playwright (E2E thật)

- Chạy trên `docker compose` dev; đăng nhập bằng SA local (`LOCAL_SA_*` dev) hoặc dev-identity qua `extraHTTPHeaders`. Không bao giờ chạy với PMH ID thật trong test tự động.
- Xem live hoặc thử tay bằng tài khoản PMH ID thật (Hành chính / Nhân viên): lấy tài khoản và mật khẩu ở `test-accounts.local.md` (gốc repo, đã gitignore — không commit, không chép mật khẩu sang file khác hay vào chat/log).
- Mỗi luồng chạy ở **1280 px và 390 px**; trang member phải kiểm 390 px (thanh dưới 3 mục, Lịch sử/Tôi ≤ 2 chạm). Chạy `@axe-core/playwright` trên màn chính ở 390 px: không lỗi tương phản.
- Kiểm bằng vai trò/nhãn người dùng (`getByRole`, `getByLabel`, text tiếng Việt), không bằng CSS class. Luật kỳ, cron, chuông theo giờ kiểm ở e2e api với `ClockService` cố định (mốc tới ms); Playwright chỉ kiểm hiển thị (kỳ khóa/thông báo seed bằng SQL), không giả đồng hồ trình duyệt.
- Mỗi story của backlog có AC Playwright thì spec Playwright phải có test mang tên story đó (`E2-S5 …`).
- Ảnh chụp/`playwright-report/` không commit.

## Definition of Done (một task/story chỉ "xong" khi đủ)

- [ ] Mọi AC của story trong `docs/backlog/` có test tương ứng và xanh; mã lỗi đúng tên trong `architecture.md` §7.
- [ ] Mọi giới hạn mà task chạm tới có test biên hai phía theo phễu (TDD mục 6); report liệt kê bảng biên → tầng test.
- [ ] `npm test`, `npm run test:e2e`, `npm run test:db` (api) và `npm test`, `npm run lint`, `npm run build` (web) đều pass, output sạch (không warning lạ, không `console.error` rơi vãi).
- [ ] Luật nghiệp vụ ép ở server/CSDL, UI chỉ hỗ trợ; không có luật chỉ tồn tại trên FE.
- [ ] Mọi chuỗi UI qua i18n (`vi` + `en`), không chuỗi cứng trong component; câu chữ theo `_SPEC.md` mục "Câu chữ" (gọi admin là **Hành chính**, "Chép lại danh sách tháng X", "Lưu phiếu", "Quay lại sửa").
- [ ] Mutate có audit (`AuditWriterService`) với before/after khi sửa dữ liệu; GET không audit.
- [ ] Thao tác thay đổi dữ liệu là idempotent hoặc có `expected_*`/`ON CONFLICT` như architecture §6 quy định.
- [ ] Không lộ secret, không log `code/state/login_hint/logout_token`, không log body webhook.
- [ ] `grep -ri qlts api web` = 0; không có `TODO` bỏ ngỏ; không có `.env` trong `git status`.
- [ ] `docs/map.md` đã cập nhật cho module chạm tới; không file nào > 400 dòng; `madge --circular` = 0.
- [ ] Report của task có: RED/GREEN, lệnh verify, danh sách file, điều còn băn khoăn.

## Bản đồ mã nguồn (`docs/map.md`)

- `docs/map.md` là bản đồ sống của repo: mỗi module/feature một dòng — trách nhiệm, file chính, endpoint/bảng nó sở hữu, phụ thuộc vào module nào. Tối đa 200 dòng; không chép code vào.
- **Cuối mỗi task**, implementer cập nhật `docs/map.md` cho những module mình chạm (thêm/đổi/bỏ) trong cùng commit cuối của task; reviewer kiểm map khớp diff. Map lệch code = finding Important.
- Trước khi sửa một module, đọc dòng của nó trong map thay vì lần cả repo; nếu map không đủ để biết bắt đầu từ đâu thì map đang thiếu — bổ sung.
- Cuối mỗi plan: vẽ lại sơ đồ kiến trúc + luồng chính bằng skill `archify` từ bằng chứng trong code → `docs/diagrams/` (HTML + PNG), đối chiếu với `architecture.md`; lệch thì sửa tài liệu hoặc code, ghi vào `review-spec.md`.

## Kích thước và ranh giới

- **File ≤ 400 dòng** (kể cả test); chạm 350 là phải tách theo trách nhiệm trước khi thêm. Hàm/method ≤ 50 dòng; component React ≤ 250 dòng; file SQL migration không giới hạn nhưng một migration = một chủ đề.
- Một module NestJS = một thư mục `modules/<ten>/` với `*.module.ts`, controller, service, dto, schema; module khác chỉ gọi qua service được `export`, không truy cập bảng của module khác bằng SQL trực tiếp (trừ báo cáo đọc-only).
- Web: `features/<ten>/` chứa page, components, `<ten>.api.ts`; `ui/` chỉ chứa thành phần không biết nghiệp vụ; `lib/` không import từ `features/`.
- Không import vòng (api: `madge --circular src` = 0; web tương tự). Không thêm dependency mới nếu chưa ghi một dòng lý do trong report; không thêm thư viện UI/CSS.
- i18n key theo cây `<feature>.<man>.<ten>`; thêm key phải thêm cả `vi` và `en` trong cùng commit.

## Quy ước code

- Lỗi API: `{code, message, line_id?, …}`; `code` là hằng SCREAMING_SNAKE đã liệt kê trong `architecture.md` §7; thêm mã mới thì cập nhật §7 trong cùng commit.
- Thời gian nghiệp vụ lấy từ `ClockService`, không `new Date()`/`now()` DB cho luật kỳ.
- SQL: tham số hóa, `FOR UPDATE` theo thứ tự khóa cố định (requests → request_lines → items); UPDATE có điều kiện (`WHERE stock_qty >= $q`) thay vì đọc-rồi-ghi.
- Tên: bảng/cột snake_case, TS camelCase, DTO class-validator; file một trách nhiệm; không tạo helper "utils" chung chung.
- Copy từ QLTS_DE: copy nguyên rồi cắt, đổi `qlts → vpp`; không "cải tiến" phần auth trừ 4 điểm spec đã chốt (role mỗi request, SA lockout theo (IP,user), webhook v2, `TRUST_PROXY_HOPS`).
- Commit theo task, tiếng Việt, tiền tố `feat/fix/chore/docs/test`; **không push**, không rebase lịch sử đã có; nhánh `feat/*` từ `main`.
- **Comment ít.** Chỉ comment khi giải thích *tại sao* một chỗ khác thường (luật nghiệp vụ, quyết định spec, cạm bẫy đã gặp), một dòng là đủ. Không comment mô tả *cái gì* code làm, không JSDoc cho hàm tên đã rõ, không header mô tả file, không code bị comment-out, không ghi chú kiểu nhật ký ("story 1.1", "AC 2", "review 2.8") — khi copy từ QLTS phải xóa các ghi chú đó. Tên hàm/biến rõ thay cho comment.

## Review

Mỗi task qua reviewer độc lập: (1) đúng spec — không thiếu, không thừa; (2) chất lượng — test thật, tách trách nhiệm, không trùng lặp. Reviewer kiểm thêm: mỗi giới hạn task chạm tới có test biên hai phía ở đúng tầng; thiếu = finding Important. Finding Critical/Important phải sửa trước khi sang task kế; Minor ghi ledger.

Cuối mỗi plan, theo thứ tự: chạy đủ `npm run test:e2e`/`test:db`/unit → Playwright cả bộ một vòng (1280 + 390) → review toàn nhánh + code review mức high → một đợt sửa + re-review → báo chủ dự án; chỉ gộp `main` khi chủ dự án đồng ý, không push nếu chưa được bảo.
