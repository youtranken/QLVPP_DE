# VPP — Plan 3b: Giao diện Hành chính mới (E9-S0…S7)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay toàn bộ giao diện Hành chính bằng bản mẫu M1 · P3 "Navy & cát" theo từng tính năng. Trước đó làm lát S0: Hành chính không có phiếu riêng, và món ngoài danh mục không cần ảnh.

**Architecture:**
- S0 là lát API nhỏ: guard vai trên `me/*`, mẫu số loại `admin_group`, mã `USER_IS_ADMIN`, migration bỏ CHECK ảnh dòng ngoài DM. Kèm điều hướng web.
- S1 dựng nền chung: token M1 trong `tokens-m1.css`, mọi luật CSS dưới phạm vi `[data-shell='admin']`, sprite icon, bộ thành phần `ui/*`, shell sidebar 232.
- S2–S6 port từng màn trên nền đó; mỗi màn chỉ đổi web, giữ nguyên API.
- S7 hoàn thiện 390 px.
- Trang Nhân viên không đổi.

**Tech Stack:** NestJS 12 (ESM, jest `--experimental-vm-modules`), Postgres 18, migration SQL thuần; React 19, Vite 8, TS 6, TanStack Query 5, react-router 7, react-i18next, Radix Dialog, vitest + Testing Library, Playwright 1.64.1 + `@axe-core/playwright`. **Không thêm dependency.**

**Spec:** `docs/specs/2026-10-30-giao-dien-moi-hanh-chinh.md`, gọi tắt **SPEC**; đã duyệt 2026-10-30, Q1–Q5 đã chốt.
- Câu chữ, giá trị, lỗi → vị trí của từng màn: lấy nguyên văn ở SPEC §5.x. Plan chỉ trỏ tới SPEC, không chép lại.
- Bản mẫu hình: canvas https://claude.ai/artifact/LWVLQXEpeFbzdBCotCYFzT, bản tệp ở `design-preview/redesign/` và `canvas/project/A-*.dc.html` trong scratchpad của phiên thiết kế.
- `CLAUDE.md` (TDD, kiểm biên theo phễu, DoD).

## Global Constraints

- Nhánh: **mọi lát làm trên `feat/giao-dien-hanh-chinh`** (đã có spec và cấu hình dev PMH ID). Ruling thay cho SPEC §5 "nhánh `feat/ui-h-sN` từ main", vì main chưa có hai thứ đó. Commit theo task, tiếng Việt, tiền tố `feat/fix/test/docs/chore`, **không push**.
- Trang Nhân viên (`/`, `/history*`, `/me`, C1–C4) giữ nguyên hình. `npm test` web và mọi Playwright member hiện có phải xanh **mà không sửa test member**. Ngoại lệ duy nhất: T3 bỏ bắt buộc ảnh ở dòng "Món khác".
- Mọi luật CSS M1 bắt đầu bằng `[data-shell='admin']`; mã màu hex chỉ được xuất hiện trong `web/src/css/tokens-m1.css`.
- Không đổi API/DTO/mã lỗi/luật, trừ S0 (T1–T3). Phần tử bản mẫu thiếu dữ liệu: bỏ theo SPEC §6.1 (G1…G25), dẫn xuất theo §6.2 (D1…D17). Q3 đã chốt **bỏ** G1/G12/G22.
- Q2 chốt: Báo cáo cho chốt (In/Excel) khi kỳ còn mở, kèm cảnh báo "tạm tính".
- Gọi admin là **Hành chính**. Mọi chuỗi qua i18n `vi` + `en` trong cùng commit, key theo `<feature>.<man>.<ten>`. Không emoji, không "↗"/"✓" làm icon.
- Kích thước: file ≤ 400 dòng (chạm 350 thì tách), component ≤ 250 dòng, hàm ≤ 50 dòng. `madge --circular` = 0 (api, web). `ui/` và `lib/` không import `features/`.
- Lỗi API không bao giờ hiện bằng toast. Vị trí hiện lỗi (ô/dòng/khối/trang) theo SPEC §4.3 và bảng lỗi của từng màn.
- Biên: mọi giới hạn task chạm tới có test hai phía ở tầng rẻ nhất (SPEC §7.2). Report của task có bảng biên → tầng test.
- Playwright mỗi test chạy 1280 + 390. Test mới mang tên story `E9-Sn …`; test cũ đổi tên thì giữ tiền tố story cũ. axe `color-contrast` ở 390 cho màn chính của lát.
- Mỗi lát xong là một **mốc kiểm**, xem mục "Mốc kiểm của chủ dự án".

## Review Focus

1. **Kỳ cũ có `registered > headcount`** (phiếu cũ của người nay là Hành chính, R5): Tổng hợp hiện đúng "5/4 người", số "chưa đăng ký" không âm, thanh tiến độ không vượt 100%. Test ở T10.
2. **Bấm đúp nút lưu** trong ngăn kéo Điều chỉnh / hộp thoại Tạo phiếu hộ / Chấp nhận: chỉ gửi một request (nút vào trạng thái "Đang lưu…" và vô hiệu). Test ở T11 và T12.
3. **Bị gỡ nhóm Hành chính khi đang mở trang quản lý:** request kế tiếp nhận 403 `FORBIDDEN_ROLE` → trang hiện `NoPermission` "Trang này dành cho Hành chính.", không hiện màn trắng hay toast. Test ở T9.
4. **`?ym=` gõ tay vượt trần** (`/admin/summary?ym=2099-01`, `/admin/delivery?ym=<kỳ đang mở>`): `MonthSwitcher` kẹp về trần, trang không gọi API với tháng sai. Test ở T10 và T13.
5. **Món có `category_id` không còn trong danh sách nhóm**, hoặc danh sách nhóm rỗng: `groupTone` trả `g0`, món về nhóm "Chưa xếp nhóm", không crash. Test ở T5 (unit) và T17 (bảng Danh mục).

## Phân công model

Luật chủ dự án: chỉ Opus/Sonnet, không Haiku, Fable không viết code. Opus làm phần phán đoán/API/đồng thời/thành phần lõi; Sonnet làm port màn theo SPEC đã đủ chi tiết. Review mặc định Opus; re-review sửa nhỏ dùng Sonnet.

| Task | Lát | Nội dung | Làm | Review |
|---|---|---|---|---|
| 1 | S0 | Guard vai `me/*` + `periods/current` cho admin + sửa fixture | Opus | Opus |
| 2 | S0 | Mẫu số loại Hành chính + `USER_IS_ADMIN` + chuông | Opus | Opus |
| 3 | S0 | Món ngoài DM không cần ảnh (migration 0110) | Sonnet | Opus |
| 4 | S0 | Web điều hướng + Playwright E9-S0 + tài liệu + epic-9 | Sonnet | Opus |
| 5 | S1 | Token, font, phạm vi, `groupTone`, điểm gãy, Icon, EmptyArt, ItemThumb | Sonnet | Opus |
| 6 | S1 | Thành phần trang: PageHeader, StatCard/Row, FilterNotice, Toolbar, Segmented, BulkBar | Sonnet | Opus |
| 7 | S1 | Thành phần phản hồi/nhập: Toast, Skeleton, Progress, InlineNumber, Stepper, MonthSwitcher, EmptyState/LoadError, FormField | Sonnet | Opus |
| 8 | S1 | DataTable (`groupBy`, `activeRowId`, lửng), Drawer, Dialog/Confirm, lớp tương thích | Opus | Opus |
| 9 | S1 | Shell Hành chính (sidebar, đếm, thẻ kỳ, máy tính bảng) + Playwright E9-S1 | Opus | Opus |
| 10 | S2 | B1 Tổng hợp kỳ (trang, thẻ lọc, hai bảng, sao chép chưa đăng ký) | Opus | Opus |
| 11 | S2 | B1a ngăn kéo Điều chỉnh + B1b Tạo phiếu hộ | Opus | Opus |
| 12 | S2 | B2 Món ngoài danh mục + 3 hộp thoại | Sonnet | Opus |
| 13 | S3 | B3 Giao hàng | Opus | Opus |
| 14 | S3 | B4 Còn nợ | Sonnet | Opus |
| 15 | S4 | B5 Báo cáo & in | Opus | Opus |
| 16 | S4 | B6 Bản in A4 | Sonnet | Opus |
| 17 | S5 | B8 Danh mục: bảng, sửa tại chỗ, hàng loạt | Opus | Opus |
| 18 | S5 | B8 ngăn kéo món + B9 Nhóm món | Sonnet | Opus |
| 19 | S5 | B7 Kho | Sonnet | Opus |
| 20 | S6 | B10 Danh bạ | Sonnet | Opus |
| 21 | S6 | B11 Nhật ký | Sonnet | Opus |
| 22 | S6 | B12 Cấu hình | Sonnet | Opus |
| 23 | S7 | 390 px: thanh trên, menu sheet, bảng → thẻ, sheet, Giao hàng 390 | Opus | Opus |
| 24 | S7 | Chốt plan: axe 390 cả bộ, chạm 44, sơ đồ archify, tài liệu | Sonnet | Opus (review toàn nhánh) |

## Mốc kiểm của chủ dự án (sau T4, T9, T12, T14, T16, T19, T22, T24)

Chủ dự án yêu cầu: "tới đâu báo tôi kiểm tra tới đó". Mỗi mốc là một **điểm dừng bắt buộc** (luật chủ dự án thắng "chạy liên tục" của SDD). Các bước:

1. Chạy đủ bộ test: `cd api && npm test && npm run test:e2e && npm run test:db`; `cd web && npm test && npm run lint && npm run build`. Chạy Playwright các spec của lát.
2. Dựng lại máy dev phục vụ de-vpp: `docker compose up -d --build api web`. Kiểm `curl -sk https://de-vpp.pmh.com.vn:8443/api/health` → `{"status":"ok"…}`.
3. Báo chủ dự án bằng tiếng Việt:
   - đường dẫn cần mở;
   - 3–6 việc cụ thể để thử bằng tài khoản `youtranken` (Hành chính). Nếu lát chạm phía nhân viên (S0) thì thêm việc thử bằng `huuthong123`;
   - điều đã bỏ theo SPEC §6.1.
4. Chờ chủ dự án báo OK hoặc góp ý rồi mới sang lát kế. Góp ý thì sửa trong lát hiện tại, ghi vào ledger.

---

## Lát S0 — Hành chính không có phiếu (SPEC §1.4, §5.0)

### Task 1: Guard vai cho phiếu cá nhân + `periods/current` cho Hành chính

**Files:**
- Modify: `api/src/modules/requests/me-request.controller.ts` (thêm `@Roles('member')` ở cấp class)
- Modify: `api/src/modules/catalog/stock.controller.ts:57` (`@Roles('member')` cho `GET me/issues`)
- Modify: `api/src/modules/requests/current-period.service.ts` (nhận `role`; admin/sa → `previous: null`, không truy vấn phiếu)
- Modify: controller gọi `CurrentPeriodService` (truyền `identity.role`)
- Modify fixture/test: `api/test/me-request.fixture.ts`, `review.fixture.ts`, `admin-requests.e2e-spec.ts`, `custom-line-notify.e2e-spec.ts`, `cancel-remaining.e2e-spec.ts`, `me-request-concurrency.db-spec.ts`. Phiếu của người là Hành chính phải **seed bằng SQL**; mọi luồng "người đăng ký" dùng vai member.
- Test: `api/test/me-request-lines.e2e-spec.ts`, `me-request.e2e-spec.ts`, `me-history.e2e-spec.ts`, `me-issues.e2e-spec.ts`, `periods.e2e-spec.ts`, mới `api/test/admin-group.e2e-spec.ts`
- Docs: `docs/architecture.md` §7 thêm `FORBIDDEN_ROLE` (403) vào danh sách mã; bảng endpoint nhóm "Phiếu của tôi" và `me/issues` đổi sang vai **member**.

**Interfaces:**
- Produces: `CurrentPeriodService.get(sub: string, role: Role): Promise<CurrentPeriod>`. Trả `previous: null` khi `role !== 'member'`.

- [ ] **Step 1: Viết test RED.**
  - Theo SPEC §5.0.5 dòng 1–4. Cả ba vai gửi cùng body tới `PUT me/request/lines`: `x-dev-role: admin` → 403 `{code:'FORBIDDEN_ROLE'}`; `sa` → 403; `member` → 200.
  - `GET me/request`, `POST me/request/copy-previous`, `GET me/requests`, `GET me/issues` với admin → 403.
  - `GET periods/current` với admin → 200, `body.previous === null`, kể cả khi đã seed bằng SQL một phiếu kỳ trước cho admin đó.
  - `admin-group.e2e-spec.ts`, ca `vai đổi theo users.groups ở request kế tiếp`:
    - Đăng nhập bằng phiên thật: phiên SA giả lập qua fixture có `users.groups`, **không** dùng `x-dev-role`. Xem cách `auth` e2e hiện có dựng phiên.
    - Lưu phiếu → 200.
    - `UPDATE users SET groups = '["Test_VPP","VPP_ADMIN"]'` (khác hoa thường so với `admin_group = 'vpp_admin'`) → lần lưu kế → 403.
    - Gỡ nhóm `VPP_ADMIN` → 200.
- [ ] **Step 2:** `cd api && npm run test:e2e -- me-request periods admin-group me-history me-issues`. Kỳ vọng: FAIL vì nhận 200 thay cho 403, và `previous` khác null.
- [ ] **Step 3:** Thêm guard, đổi `CurrentPeriodService`. Sửa fixture: tạo phiếu cho admin bằng `INSERT` SQL, không gọi `me/request`.
- [ ] **Step 4:** `npm test && npm run test:e2e && npm run test:db` → xanh toàn bộ. Ghi output.
- [ ] **Step 5:** Commit `feat(api): Hành chính không đọc/ghi phiếu cá nhân (FORBIDDEN_ROLE)`.

### Task 2: Mẫu số loại Hành chính + `USER_IS_ADMIN`

**Files:**
- Modify: `api/src/modules/requests/summary.service.ts:152` `headcountCondition()`. Thêm điều kiện loại `admin_group` (SQL đúng SPEC §5.0.1 R3; lấy nhóm từ `config.getAdminGroup()`). Hàm này đã dùng chung cho `liveCounts`, `unregisteredRows`, `audienceSubs`, `unregisteredSubs`; `NotificationScheduler` ghi `periods.headcount` qua `liveCounts`.
- Modify: `api/src/modules/requests/admin-request.service.ts` `create()`. Sau kiểm `USER_NOT_FOUND`/`USER_INACTIVE`, trước khi mở phiếu: người đích có nhóm khớp `admin_group` (không phân biệt hoa thường) → `BadRequestException({code:'USER_IS_ADMIN', message:'Người này là Hành chính — Hành chính không đăng ký VPP.'})`.
- Test: mới `api/test/summary-headcount.db-spec.ts`; `api/test/admin-summary-lists.e2e-spec.ts`, `reminders.e2e-spec.ts`, `admin-requests-create.e2e-spec.ts`
- Docs: `docs/architecture.md` §6 (headcount), §7 (`USER_IS_ADMIN` 400; Tổng hợp "mẫu số loại Hành chính"), §9 (người nhận `period_open`/`reminder`).

**Interfaces:**
- Consumes: `SystemConfigService.getAdminGroup(): Promise<string>` (đã có).

- [ ] **Step 1: Test RED** theo SPEC §5.0.5 dòng 5–8.
  - db-spec `liveCounts loại người thuộc admin_group`. Có 3 user active: A thuộc `Test_VPP`; B thuộc `["Test_VPP","VPP_Admin"]`; C thuộc nhóm ngoài `authorized_groups=["Test_VPP"]`.
    - Kỳ vọng `headcount === 1`, `unregistered` chỉ `[A]`.
    - Đổi B về `["Test_VPP"]` → `headcount === 2`. Đây là biên có/không nhóm.
  - e2e: `GET admin/periods/:ym/unregistered` không chứa sub của Hành chính. Phiếu cũ của Hành chính seed bằng SQL vẫn được tính vào `summary.registered`.
  - e2e `reminders`, `ClockService` cố định:
    - `runHourly` lúc 00:00 ngày 1 → không có `in_app_notifications` kind `period_open` cho Hành chính;
    - ngày `lastDay−2` → không có `reminder` cho Hành chính;
    - `periods.headcount` ghi lúc khóa không đếm Hành chính.
  - e2e `POST admin/requests` chọn user thuộc `admin_group` → 400 `USER_IS_ADMIN`; chọn user thường → 201.
- [ ] **Step 2:** Chạy các test trên. Kỳ vọng FAIL: `headcount` là 2, 201 thay vì 400.
- [ ] **Step 3:** Cài đặt như mục Files.
- [ ] **Step 4:** Chạy đủ ba bộ api → xanh.
- [ ] **Step 5:** Commit `feat(api): mẫu số và chuông kỳ loại Hành chính; tạo hộ cho Hành chính → USER_IS_ADMIN`.

### Task 3: Món ngoài danh mục không cần ảnh (R7, Q1)

**Files:**
- Create: `api/src/migrations/0110_custom_line_image_optional.sql`. Thay CHECK `request_lines_item_review_ck`: giữ nguyên mọi vế của bản 0102, **chỉ bỏ** `AND image_file_id IS NOT NULL`. Làm bằng `DROP CONSTRAINT` + `ADD CONSTRAINT` trong một tệp; comment một dòng nêu lý do (Q1 2026-10-30).
- Modify: `api/src/modules/requests/request-lines.diff.ts:195-196` (bỏ `IMAGE_REQUIRED` cho dòng ngoài DM; ảnh gửi kèm vẫn qua kiểm `FILE_FORBIDDEN`)
- Kiểm, sửa nếu cần: `api/src/modules/requests/review.service.ts:198`. Convert sang món mới đang gửi `image_file_id: input.image_file_id ?? line.image_file_id` vào `catalog.service` (đã ném `IMAGE_REQUIRED` khi null). Chỉ thêm test nếu đã đúng.
- Modify web nhân viên, thay đổi tối thiểu được phép: ô ảnh trong form "Món khác" thành tùy chọn. Bỏ chặn phía client, nhãn "Ảnh (không bắt buộc)" — thêm key `vi`/`en`. Tìm bằng `grep -rn "IMAGE_REQUIRED\|imageRequired" web/src/features/request`.
- Test: `api/test/migrations.db-spec.ts` (đếm 24 migration, tiêu đề 0100–0110), mới ca db-spec `request_lines cho dòng ngoài DM không ảnh`, `api/test/me-request-lines.e2e-spec.ts`, `api/test/review*.e2e-spec.ts`, vitest form Món khác.
- Docs: `docs/prd.md` FR-22 + BR-9; `docs/architecture.md` §6 bước 4 + review convert; `docs/backlog/epic-2-phieu-dang-ky.md`, `epic-3-tong-hop-dieu-chinh.md`.

- [ ] **Step 1: Test RED.**
  - db-spec: `INSERT` dòng ngoài DM có `image_file_id NULL` → thành công (trước đó vi phạm CHECK). Dòng có `item_id` và `custom_name` cùng lúc → vẫn vi phạm, để chứng minh các vế khác giữ nguyên.
  - e2e `PUT me/request/lines` dòng ngoài DM:
    - không ảnh → 200;
    - ảnh hợp lệ của mình → 200;
    - ảnh của người khác → 400 `FILE_FORBIDDEN`.
  - Cùng ba ca qua `PUT admin/requests/:id/lines`.
  - e2e review convert sang **món mới**:
    - dòng không ảnh và `item.image_file_id` vắng → 400 `IMAGE_REQUIRED`;
    - có `item.image_file_id` do admin tải (purpose `item_image`) → 200;
    - convert sang món có sẵn, dòng không ảnh → 200.
  - vitest: gửi form Món khác không chọn ảnh → không hiện lỗi ảnh, gọi API.
- [ ] **Step 2:** Chạy → FAIL: vi phạm CHECK, 400 `IMAGE_REQUIRED`.
- [ ] **Step 3:** Viết migration, sửa diff, sửa web.
- [ ] **Step 4:** Ba bộ api và `npm test` web → xanh. Chạy Playwright `request.spec.ts`, `review.spec.ts` → xanh.
- [ ] **Step 5:** Commit `feat: món ngoài danh mục không bắt buộc ảnh (migration 0110)`.

### Task 4: Web điều hướng S0 + Playwright + tài liệu

**Files:**
- Modify: `web/src/shell/require-role.tsx` (thêm `RequireMember`: `me.role ∈ {admin, sa}` → `<Navigate to="/admin" replace />`), `web/src/shell/app-routes.tsx` (bọc `/`, `/history`, `/history/:ym`, `/me`), `web/src/shell/use-auth-boot.ts` (`returnTo` là route nhân viên mà người là admin → `/admin`)
- Modify: `web/src/shell/admin-sidebar.tsx`, `admin-nav.ts` (bỏ nhóm "Cá nhân", "Phiếu của tôi"); `web/src/locales/{vi,en}/nav.ts` (xóa `nav.groups.personal`, `nav.myRequest` nếu hết chỗ dùng); `features/profile/*` (bỏ "Mở trang quản lý", key `profile.openAdmin`)
- Modify: `web/src/features/summary/*-errors.ts` (ánh xạ `USER_IS_ADMIN` → ô "Người đăng ký" với câu ở SPEC §5.0.2)
- Modify: `web/playwright/admin.spec.ts`. Thay `E0-S9 admin: "Phiếu của tôi" về khung nhân viên` bằng `E9-S0 Hành chính không có phiếu: đăng nhập vào thẳng Tổng hợp, mở / bị đưa về /admin, sidebar không có Phiếu của tôi`. Rà `p1-flow.spec.ts`, `p2-flow.spec.ts`, `p3-seed.ts`: bước nào admin tự đăng ký thì đổi sang vai member hoặc seed SQL.
- Test: `web/src/app.test.tsx`
- Create: `docs/backlog/epic-9-giao-dien-hanh-chinh.md`. Story E9-S0…E9-S7: tên và AC chép từ SPEC §5.0.5 và AC của từng lát, mỗi story một dòng trỏ SPEC.
- Docs: phần còn lại của SPEC §5.0.6 (PRD §2, FR-30, §7, nhật ký quyết định; architecture §4, §11; backlog E0-S9, E2-S3, E3-S1/S4); `docs/map.md` (requests, summary, reminders, shell); `docs/review-spec.md` mục E.

- [ ] **Step 1: Test RED** (vitest `app.test.tsx`):
  - admin vào lần lượt `/`, `/history`, `/history/2026-10`, `/me` → `location.pathname === '/admin/summary'`;
  - `sa` → như admin;
  - `member` vào `/` → ở lại `/`;
  - sidebar admin không có link tên "Phiếu của tôi".
- [ ] **Step 2:** `cd web && npm test -- app` → FAIL.
- [ ] **Step 3:** Cài đặt.
- [ ] **Step 4:**
  - `npm test && npm run lint && npm run build` → xanh.
  - Playwright `admin.spec.ts p1-flow p2-flow p3-flow request.spec.ts` ở 1280 + 390 → xanh.
  - `grep -rn "myRequest\|openAdmin" web/src` = 0.
- [ ] **Step 5:** Commit `feat(web): Hành chính vào thẳng Quản lý VPP, bỏ Phiếu của tôi` và `docs: S0 Hành chính không có phiếu, epic 9`.
- [ ] **Step 6: MỐC KIỂM S0.**
  - Dựng lại, chạy `curl health`.
  - Báo chủ dự án các việc cần thử:
    - (a) `youtranken` đăng nhập → vào thẳng Tổng hợp, sidebar không có Phiếu của tôi;
    - (b) `youtranken` gõ `/` → bị đưa về `/admin`;
    - (c) `huuthong123` thêm "Món khác" **không ảnh** → lưu được;
    - (d) Tổng hợp: số người không đếm `youtranken`;
    - (e) Tạo phiếu hộ chọn `youtranken` → báo lỗi tại ô người.
  - Chờ OK.

---

## Lát S1 — Nền M1 và shell (SPEC §3, §4)

### Task 5: Token, font, phạm vi, tông nhóm, điểm gãy, Icon, EmptyArt, ItemThumb

**Files:**
- Create: `web/src/css/tokens-m1.css`. Chép nguyên khối `design-preview/redesign/m1/SYSTEM.md` §2.1 dòng 19–62 vào `:root`, cộng thang chữ/khoảng cách/bo/độ nổi/chuyển động/focus của SPEC §3.2–3.3, cộng `--ill-*` cho `es-*`.
- Modify: `web/src/css/tokens.css` (thêm `Be Vietnam Pro` 500;600;700;800 vào `@import` Google Fonts đang có), `web/src/main.tsx` (import `tokens-m1.css` rồi `css/m1/base.css` sau `tokens.css`)
- Create: `web/src/css/m1/base.css`. Tạm thời chỉ chứa `[data-shell='admin'] { color-scheme: light; font-family: var(--font); background: var(--c-page); }` và khối `prefers-reduced-motion`.
- Create: `web/src/lib/group-tone.ts`: `export type Tone = 'g0'|'g1'|…|'g7'`; `groupTone(categories: {id: string; sort_order: number}[], categoryId: string | null): Tone`
- Modify: `web/src/lib/use-media-query.ts` (thêm `ADMIN_PHONE_QUERY = '(max-width: 767px)'`, `ADMIN_TABLET_QUERY = '(min-width: 768px) and (max-width: 1279px)'`; **không** đổi `NARROW_QUERY`)
- Create: `web/src/ui/icon-sprite.tsx` (`<IconSprite />`, gồm 46 symbol ở SPEC §3.5, path chép từ `design-preview/redesign/m1/components.html`), `web/src/ui/icon.tsx` (`IconName` union literal; `<Icon name size? = 20 />`)
- Create: `web/src/ui/empty-art.tsx` (`EmptyArtKind` = 6 kiểu SPEC §3.6; 160×120 `aria-hidden`)
- Create: `web/src/ui/item-thumb.tsx` (props SPEC §3.6; `onError` → placeholder; badge "Thiếu ảnh" do nơi gọi hiện khi `fileId == null`)
- Test: `web/src/test/m1-scope.test.ts`, `web/src/lib/group-tone.test.ts`, `web/src/ui/icon.test.tsx`, `web/src/ui/item-thumb.test.tsx`

- [ ] **Step 1: Test RED.**
  - `m1-scope.test.ts`: đọc mọi tệp `web/src/css/m1/*.css` và `web/src/features/**/*.m1.css`. Mọi selector cấp cao nhất (trừ `@keyframes`, `@media`, `@font-face`) phải bắt đầu bằng `[data-shell='admin']`. Không tệp nào chứa `#[0-9a-fA-F]{3,8}`.
  - `group-tone.test.ts`:
    - 8 nhóm sắp `sort_order` → nhóm hạng 0 là `g1`, hạng 6 là `g7`, hạng 7 là `g1` (biên lặp 7/8);
    - nhóm đã ngừng vẫn giữ hạng;
    - `categoryId` null → `g0`;
    - `categoryId` không có trong danh sách → `g0` (Review Focus 5);
    - danh sách rỗng → `g0`;
    - cùng `sort_order` thì sắp theo `id`.
  - `icon.test.tsx`: `<Icon name="truck"/>` render `use[href="#u-truck"]`, `aria-hidden="true"`.
  - `item-thumb.test.tsx`:
    - `fileId='f1'` → `img[src="/api/files/f1"]` có alt đúng;
    - bắn sự kiện `error` → không còn `img`, có placeholder;
    - `fileId=null` → placeholder.
- [ ] **Step 2:** `npm test -- m1-scope group-tone icon item-thumb` → FAIL (thiếu module).
- [ ] **Step 3:** Cài đặt.
- [ ] **Step 4:** `npm test && npm run lint && npm run build` → xanh. Playwright member `request.spec.ts` xanh, chứng minh trang Nhân viên không đổi.
- [ ] **Step 5:** Commit `feat(web): token M1 P3, phạm vi data-shell admin, icon, ô ảnh món`.

### Task 6: Thành phần trang

**Files:** Create `web/src/ui/{page-header,stat-card,stat-row,filter-notice,toolbar,segmented,bulk-bar}.tsx` + test cạnh từng tệp; CSS trong `web/src/css/m1/base.css` (≤ 400 dòng; tràn thì sang `css/m1/states.css`); i18n `common.filter.*`, `common.table.*`.

**Interfaces (Produces):**
- `PageHeader({crumbs: string[], title: string, description?: string, actions?: ReactNode})`
- `StatCard({label, icon?: IconName, value: ReactNode, unit?, sub?, tone?: 'neutral'|'warn'|'danger'|'dark', pressed?: boolean, onClick?: () => void})`
- `StatRow({children})`
- `FilterNotice({label, count, onClear})`
- `Toolbar({search?: {value, onChange, label, placeholder?, maxLength?}, children})`
- `Segmented<T extends string>({label, value: T, options: {value: T; label: string; count?: number}[], onChange})`
- `BulkBar({count, label, onClear, children})`

- [ ] **Step 1: Test RED** theo cột "trạng thái phải có test" SPEC §4.2:
  - StatCard có `onClick` → `role=button`, bấm thì `onClick` chạy, `aria-pressed` phản ánh `pressed`; không `onClick` → `queryByRole('button')` null.
  - FilterNotice: bấm "Bỏ lọc" → `onClear`.
  - Toolbar:
    - nhấn "/" khi focus ở body → ô tìm được focus;
    - nhấn "/" khi đang gõ trong một input khác → không chuyển focus, ký tự "/" được gõ vào ô đó.
  - Segmented: `ArrowRight` từ mục cuối quay về mục đầu và gọi `onChange`; mục có `aria-checked`.
  - BulkBar: `count=0` → không render; `count=2` → `role=toolbar` có "2 … đã chọn".
  - PageHeader: có/không `actions`; breadcrumb là `nav` có `aria-label` "Vị trí".
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Cài đặt. Câu chữ lấy ở SPEC §4.2.
- [ ] **Step 4:** `npm test && npm run lint` → xanh.
- [ ] **Step 5:** Commit `feat(web): thành phần trang M1 (đầu trang, thẻ số liệu, lọc, thanh công cụ)`.

### Task 7: Thành phần phản hồi và nhập

**Files:**
- Create: `web/src/ui/{toast.tsx,toast-context.ts,toast-provider.tsx,skeleton.tsx,progress.tsx,inline-number.tsx}` + test
- Modify (restyle + prop): `web/src/ui/stepper.tsx` (`min`, `max`), `month-switcher.tsx` (badge trạng thái kỳ), `load-state.tsx` (`EmptyState art?`, `LoadError` câu mới), `form-field.tsx` (đếm ký tự tùy chọn `counter?: {value: number; max: number}`)
- i18n `common.toast.*`, `common.empty.*`

**Interfaces (Produces):**
- `useToast(): {show(t: {text: string; tone?: 'ok'|'info'|'warn'; action?: {label: string; onClick(): void}}): void}`. `ToastProvider` gắn trong `AdminShell` (T9) và `App` nếu cần.
- `Skeleton({shape: 'row'|'stat'|'card', count?: number, delayMs?: number = 300})`
- `Progress({done: number, total: number, tone?: 'ok'|'warn'|'danger', label: string})`
- `InlineNumber({value: number, label: string, min?: number, max?: number, onCommit(n: number): Promise<void>})`. Lỗi server: `onCommit` reject với `ApiError` → hiện `message` đã ánh xạ ngay dưới ô.
- `Stepper` thêm `min?: number`, `max?: number`.

- [ ] **Step 1: Test RED** (biên SPEC §7.2, dùng `vi.useFakeTimers`):
  - Toast: còn hiện ở 3999 ms, mất ở 4000 ms; `show` lần hai thay lần một (chỉ 1 `role=status`); action bấm được.
  - Skeleton: chưa có ở 299 ms, có ở 300 ms.
  - Progress: chữ "đã giao 3/5"; `done > total` thì thanh kẹp 100%.
  - InlineNumber:
    - Enter gọi `onCommit(7)`;
    - Esc trả giá trị cũ, không gọi `onCommit`;
    - `onCommit` reject → ô `aria-invalid="true"`, `aria-describedby` trỏ câu lỗi.
  - Stepper `max=5`: tại 5 nút "Thêm …" vô hiệu, tại 4 thì bật; `min=3`: tại 3 nút "Bớt …" vô hiệu, tại 4 thì bật.
  - MonthSwitcher: ở trần thì "›" vô hiệu.
  - LoadError: bấm "Thử lại" gọi `onRetry`.
  - FormField counter: "500/500".
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Cài đặt. CSS ở `css/m1/states.css`.
- [ ] **Step 4:** `npm test && npm run lint` xanh. Test cũ của `stepper`, `load-state` phải xanh mà không đổi assertion.
- [ ] **Step 5:** Commit `feat(web): toast, khung xương, tiến độ, ô sửa tại chỗ, stepper min/max`.

### Task 8: DataTable, Drawer, Dialog và lớp tương thích

**Files:**
- Modify: `web/src/ui/data-table.tsx` + test
  - `groupBy?: {key(row: T): string; header(key: string, rows: T[]): ReactNode}`;
  - `activeRowId?: string`;
  - checkbox đầu nhóm có trạng thái lửng;
  - `density?: 'compact'`;
  - tách `data-table-group.tsx` nếu > 250 dòng.
- Modify: `web/src/ui/drawer.tsx` + test
  - rộng mặc định 384;
  - `onPrev?`, `onNext?` (↑/↓/J/K khi focus không ở ô nhập);
  - ≥ 1440 thêm lớp `has-drawer` vào `#main`; 1280–1439 overlay trong suốt;
  - trả focus về phần tử mở;
  - < 768 thành sheet toàn màn.
- Modify: `web/src/ui/dialog.tsx`, `confirm-dialog.tsx` (restyle SPEC §4.2; nguy hiểm → nút danger đặc)
- Create: `web/src/css/m1/{table,overlay}.css`. Lớp tương thích trong `base.css`: `.btn*`, `.tag*`, `.alert*`, `.field`, `.table`, `.seg`, `.drawer`, `.dialog-viewport` dưới phạm vi admin, để trang chưa port không vỡ (SPEC §5.1).

- [ ] **Step 1: Test RED.**
  - DataTable:
    - `groupBy` tạo dòng tiêu đề nhóm; bấm chevron → `aria-expanded="false"` và ẩn hàng của nhóm;
    - chọn 1/2 hàng của nhóm → checkbox nhóm có `indeterminate === true`; chọn đủ → `checked`;
    - `activeRowId` → hàng đó có `aria-current="true"` (hoặc `aria-selected`; chọn một và ghi ruling);
    - rỗng → `EmptyState`.
  - Drawer:
    - ↓ gọi `onNext` khi focus ở nút;
    - ↓ khi focus trong `input` → không gọi;
    - `dirty` + Esc → hỏi "Bỏ thay đổi chưa lưu?";
    - đóng → focus trả về nút đã mở.
  - ConfirmDialog `danger` → nút xác nhận mang lớp danger đặc. Kiểm qua role + tên, không qua lớp: assert nút có tên đúng và là nút cuối.
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Cài đặt.
- [ ] **Step 4:**
  - `npm test && npm run lint && npm run build` xanh.
  - Playwright toàn bộ spec admin hiện có ở 1280 xanh trên shell **cũ** + lớp tương thích. Chỉ được sửa selector khi nhãn đổi theo SPEC.
  - Playwright member xanh mà không sửa.
- [ ] **Step 5:** Commit `feat(web): bảng nhóm dính, ngăn kéo 384 có ↑/↓, hộp thoại M1, lớp tương thích`.

### Task 9: Shell Hành chính

**Files:**
- Rewrite: `web/src/shell/admin-shell.tsx` (≤ 150 dòng; gắn `IconSprite`, `ToastProvider`, skip link `#main`), `admin-sidebar.tsx`, `admin-nav.ts` (bảng 11 mục SPEC §4.1; xóa `ADMIN_HIDDEN_PAGES`)
- Create: `web/src/shell/admin-period-card.tsx`, `web/src/shell/use-admin-badges.ts`. `staleTime` 60 s, refetch khi focus; lỗi → không có đếm.
- Create: `web/src/shell/admin-topbar.tsx`, bản tối thiểu cho < 768: nút "Mở menu quản lý" mở Radix Dialog liệt kê đủ 11 mục. S7 hoàn thiện.
- Create: `web/src/css/m1/shell.css`. Xóa `web/src/css/admin.css` khi `grep -rn "a-[a-z]" web/src --include=*.tsx` không còn lớp `a-*`.
- Restyle: `features/notifications` chuông (icon button 44, chấm `--c-dot`), `ui/language-switch.tsx` (segmented M1 trong phạm vi admin)
- Modify: lỗi `FORBIDDEN_ROLE` khi đang ở `/admin/*` → `NoPermission` "Trang này dành cho Hành chính." Đặt ở `lib/api-error.ts` / query error boundary của shell (Review Focus 3).
- i18n: `nav.*` theo SPEC §5.1
- Test: `web/src/shell/admin-shell.test.tsx` (viết lại), mới `admin-period-card.test.tsx`, `use-admin-badges.test.ts`; Playwright mới `web/playwright/admin-shell.spec.ts`
- Docs: `docs/architecture.md` §11 (token Hành chính), `design-preview/_SPEC.md` dòng đầu, PRD §7 dòng hệ thị giác, `docs/map.md` (shell, ui)

- [ ] **Step 1: Test RED** theo AC E9-S1 1–4 và Review Focus 3.
  - Sidebar:
    - 3 nhóm, đúng 11 link theo thứ tự bảng §4.1;
    - mục đang chọn có `aria-current="page"`;
    - không có "Phiếu của tôi".
  - Đếm: review trả 3 dòng → link "Món ngoài danh mục" chứa "3"; trả 0 → không có số; lỗi → không có số và sidebar vẫn render.
  - Thẻ kỳ: `days_left=1` → "Hôm nay là ngày cuối"; `days_left=2` → "còn 2 ngày".
  - API trả 403 `FORBIDDEN_ROLE` trên `/admin/catalog` → hiện "Trang này dành cho Hành chính."
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Cài đặt.
- [ ] **Step 4:** Playwright `admin-shell.spec.ts`:
  - `E9-S1 shell Hành chính: sidebar 3 nhóm 11 mục, thẻ kỳ, chuông, đổi en đổi nhãn sidebar`;
  - `E9-S1 điểm gãy 767/768 và 1279/1280`: 768 → sidebar rộng 72; 767 → có nút "Mở menu quản lý"; 1280 → 232; 1279 → 72;
  - `E9-S1 trang member giữ giao diện cũ`: `getComputedStyle` ở `/admin`: nền `rgb(239, 235, 228)`, font h1 chứa "Be Vietnam Pro"; ở `/` với member: nền `rgb(244, 247, 245)`, font chứa "Nunito".

  Rồi chạy toàn bộ Playwright (admin + member) ở 1280 + 390, toàn bộ `npm test/lint/build`, cùng `madge`.
- [ ] **Step 5:** Commit `feat(web): shell Hành chính M1 — sidebar 3 nhóm, đếm, thẻ kỳ` + `docs: S1 nền M1`.
- [ ] **Step 6: MỐC KIỂM S1.** Báo chủ dự án các việc cần thử bằng `youtranken`:
  - sidebar mới, 11 mục;
  - các con số đếm;
  - thẻ kỳ ở đáy sidebar;
  - đổi English;
  - thu cửa sổ còn tầm máy tính bảng → sidebar chỉ còn icon;
  - các trang chưa port vẫn dùng được, chỉ đổi màu nút.

---

## Lát S2 — Tổng hợp kỳ + Món ngoài danh mục (SPEC §5.2)

Chung cho T10–T22, mỗi màn đều có:
- Viết lại page trong `features/<ten>/`, tách mỗi tệp một trách nhiệm (hàng, ngăn kéo, hộp thoại, thanh công cụ).
- CSS `features/<ten>/<ten>.m1.css`; xóa `<ten>.css` cũ khi xong màn.
- Test vitest hiện có giữ hành vi, sửa theo nhãn mới.
- Test Playwright "trạng thái lỗi tải": route `/api/admin/...` trả 500 → thấy "Không tải được dữ liệu — thử lại." và nút "Thử lại" (SPEC §7.1).
- Cập nhật dòng `docs/map.md` của feature; đánh dấu story trong `epic-9`.

### Task 10: B1 Tổng hợp kỳ

**Files:** `web/src/features/summary/`:
- `summary-page.tsx` (vỏ trang, URL state `ym/view/filter/q`)
- `summary-stats.tsx` (4 thẻ)
- `summary-person-table.tsx`
- `summary-item-table.tsx`
- `unregistered-table.tsx`
- `unregistered-copy.tsx` (giữ logic, restyle; hộp thoại B1c)
- `summary.m1.css`
- test cạnh mỗi tệp
- Playwright `web/playwright/summary.spec.ts`

**Interfaces:**
- Consumes: T5–T9 (`PageHeader`, `StatCard`, `DataTable.groupBy`, `MonthSwitcher`, `Toolbar`, `Segmented`, `FilterNotice`, `ItemThumb`, `groupTone`, `useToast`).
- Produces: `openAdjust(requestId: string)` qua URL `?request=<id>`, để T11 và hộp thoại "Mở Điều chỉnh" dùng chung.

- [ ] **Step 1: Test RED** (vitest, dữ liệu giả):
  - Kỳ khóa: bấm thẻ "Dòng chờ giao" → `filter=pending_delivery` trong URL, `aria-pressed="true"`, nhãn "Đang lọc: Còn dòng chờ giao · {n} người"; bấm lại → bỏ.
  - Kỳ mở: thẻ đó không có role button, dòng phụ "giao sau khi khóa 00:00 ngày {d}/{M}".
  - `registered=5, headcount=4, unregistered=0` → hiện "5/4" và "0 chưa đăng ký"; `Progress` không vượt 100% (Review Focus 1).
  - `?ym=2099-01` → URL được thay bằng tháng trần, không có request với `2099-01` (Review Focus 4).
  - Bảng theo người nhóm theo phòng ban, "Chưa có phòng ban" cuối.
  - Bảng theo món nhóm theo danh mục, dòng ngoài DM nhóm "Ngoài danh mục"; có liên kết "Xem số cần mua ở Báo cáo" và không có cột "Cần mua thêm" (G4).
  - Sao chép: `clipboard.writeText` nhận đúng chuỗi SPEC → toast "Đã sao chép {n} người"; clipboard reject → hộp thoại B1c; n=0 → nút vô hiệu, chú thích "Mọi người đã đăng ký".
  - Ô tìm `maxLength=100`.
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Cài đặt theo SPEC §5.2 B1.
- [ ] **Step 4:** Playwright `E9-S2 Tổng hợp: thẻ lọc dòng chờ giao, chưa đăng ký không có Hành chính, theo món nhóm có tồn` (1280 + 390) + lỗi tải. Chạy đủ bộ web.
- [ ] **Step 5:** Commit `feat(web): Tổng hợp kỳ M1 — thẻ lọc, bảng theo người/món nhóm dính`.

### Task 11: B1a ngăn kéo Điều chỉnh + B1b Tạo phiếu hộ

**Files:** `web/src/features/summary/`:
- `adjust-drawer.tsx`, `adjust-lines.tsx`, `adjust-line-row.tsx`, `use-adjust.ts`
- `add-line-picker.tsx` (6 kết quả, gồm món `admin_only`)
- `create-request-dialog.tsx`
- `summary-errors.ts` (đủ mã SPEC §5.2)
- test; Playwright `adjust.spec.ts` (đổi tên test theo SPEC), `summary.spec.ts`

- [ ] **Step 1: Test RED.**
  - Kỳ khóa:
    - cảnh báo warn đúng câu;
    - ô lý do có "*";
    - server trả `REASON_REQUIRED` → lỗi gắn ô lý do (FE không chặn trước).
  - Dòng `max_qty=5` tại 5 → "Thêm" vô hiệu. Dòng `delivered_qty=3` → "Bớt" vô hiệu ở 3.
  - Server trả `QTY_BELOW_DELIVERED` với `line_id` → câu lỗi ở đúng dòng.
  - `STALE_UPDATE` → khối "Nhân viên vừa sửa phiếu này — tải bản mới nhất rồi sửa lại." + nút; bấm thì refetch.
  - Lưu thành công → toast "Đã lưu điều chỉnh phiếu của {tên}". Server trả `request: null` → toast "Đã bỏ phiếu của {tên}".
  - Bấm đúp "Lưu điều chỉnh" → `PUT` gọi đúng 1 lần (Review Focus 2).
  - ↓ khi ngăn kéo bẩn → hỏi bỏ thay đổi.
  - Dòng `pending` có 3 nút review + liên kết "Xem ở Món ngoài danh mục" (L3).
  - Tạo phiếu hộ:
    - gửi thiếu người → "Cần thêm: người đăng ký.";
    - `REQUEST_EXISTS` → khối + "Mở Điều chỉnh" mở ngăn kéo đúng `request_id`;
    - `USER_IS_ADMIN` → lỗi ô người;
    - kỳ đang xem đã khóa → nút "Tạo phiếu" vô hiệu kèm câu;
    - bấm đúp → `POST` 1 lần.
  - Lý do `maxLength=500`.
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Cài đặt theo SPEC B1a/B1b.
- [ ] **Step 4:** Playwright:
  - `E9-S2 Điều chỉnh kỳ khóa: cận dưới đã giao, lý do 2/3 ký tự, lưu ra toast`. Lý do 2 ký tự sau trim → lỗi ô; 3 → lưu.
  - `E9-S2 Tạo phiếu hộ: trùng phiếu mở Điều chỉnh`.
  - AC 5 `STALE_UPDATE`: member lưu ở tab khác trước.

  Chạy đủ bộ web.
- [ ] **Step 5:** Commit `feat(web): ngăn kéo Điều chỉnh và Tạo phiếu hộ M1`.

### Task 12: B2 Món ngoài danh mục

**Files:** `web/src/features/review/`:
- `review-page.tsx`
- `review-card.tsx`
- `accept-dialog.tsx`, `reject-dialog.tsx`, `convert-dialog.tsx` (tách `convert-new-fields.tsx` / `convert-existing.tsx` nếu > 250 dòng)
- `review-errors.ts`, `review.m1.css`
- test; Playwright `review.spec.ts`

- [ ] **Step 1: Test RED.**
  - 4 tab có đếm từ 4 truy vấn (D9).
  - Thẻ dòng không ảnh → placeholder + nhãn "Không có ảnh" (R7). Có ảnh → `img` alt "Ảnh {tên} do nhân viên gửi".
  - `previously_accepted` → gợi ý warn.
  - Từ chối: server `REASON_REQUIRED` → lỗi ô. Thành công → thẻ ở lại với badge "Đã từ chối" + "vừa xong".
  - Thêm vào danh mục, món mới:
    - `VALIDATION {fields:['item.name']}` → lỗi ô tên;
    - `['item.max_qty']` → lỗi ô tối đa;
    - dòng không ảnh → ô "Ảnh món *" bắt buộc tải (R7; server `IMAGE_REQUIRED` → ô ảnh).
  - Món có sẵn khác ĐVT → cảnh báo đúng câu.
  - `LINE_ALREADY_REVIEWED` → khối "Dòng này vừa được xử lý ở nơi khác."
  - Bấm đúp "Chấp nhận" → `POST` 1 lần (Review Focus 2).
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Cài đặt theo SPEC B2. Bổ sung theo R7: dialog Thêm vào danh mục, khi dòng không có ảnh, hiện ô `image-field` (purpose `item_image`) thay cho chú thích "Dùng ảnh nhân viên đã gửi…".
- [ ] **Step 4:** Playwright `E9-S2 Món ngoài danh mục: chấp nhận, từ chối có lý do, thêm vào danh mục món mới`. Tên 120 qua / 121 lỗi; tối đa 0/1000 lỗi, 1/999 qua. Chạy đủ bộ web và Playwright cả bộ.
- [ ] **Step 5:** Commit `feat(web): Món ngoài danh mục M1 — thẻ, chấp nhận, từ chối, thêm vào danh mục`.
- [ ] **Step 6: MỐC KIỂM S2.** Báo chủ dự án các việc cần thử bằng `youtranken`:
  - Tổng hợp: bấm các thẻ lọc, đổi Theo món;
  - mở Điều chỉnh một phiếu, sửa rồi lưu;
  - Tạo phiếu hộ cho `huuthong123` (nếu chưa có phiếu);
  - Món ngoài danh mục: món khác mà `huuthong123` tạo ở S0 → thử "Thêm vào danh mục" (phải tải ảnh món).

---

## Lát S3 — Giao hàng + Còn nợ (SPEC §5.3)

### Task 13: B3 Giao hàng

**Files:** `web/src/features/delivery/`:
- `delivery-page.tsx` (master–detail 320 + chi tiết, URL `ym/request/all`)
- `delivery-list.tsx`
- `delivery-detail.tsx`
- `delivery-line-row.tsx`
- `use-deliver-selected.ts` (D6, chạy tuần tự)
- `delivery-result.tsx`
- `delivery.m1.css`
- giữ `useStickyRows`, single-flight hiện có
- test; Playwright `delivery.spec.ts`

**Interfaces:**
- Produces: `deliverSelected(lines: {id: string; qty: number; expectedDelivered: number}[]): Promise<{delivered: string[]; failed: {id: string; code: string; available?: number}[]}>`. T14 dùng lại cho "Giao bổ sung" nếu cần.

- [ ] **Step 1: Test RED** (vitest, AC E9-S3 1–5):
  - Còn 5, tồn 3 → stepper max 3, ở 3 nút + vô hiệu. Còn 2, tồn 10 → max 2. Ngoài DM: max = còn lại.
  - Tồn 0 → "Hết hàng — còn nợ {r}", stepper vô hiệu.
  - `STOCK_INSUFFICIENT {available:2}` → câu "Chỉ còn 2 {ĐVT}." ở dòng, stepper kẹp về 2.
  - `STALE_UPDATE` → câu ở dòng + refetch.
  - `PERIOD_NOT_LOCKED` → khối đầu chi tiết.
  - Giao dòng đã chọn 2 dòng, dòng 1 lỗi → dòng 2 vẫn gửi; khối kết quả "Đã giao 1 dòng · Không giao được 1: …".
  - Giao tất cả `{delivered:[], failed:[]}` → "Không còn dòng nào cần giao".
  - `?ym=<kỳ đang mở>` → kẹp về kỳ khóa gần nhất (Review Focus 4).
  - Giảm chuyển động → phiếu giao đủ rời danh sách ngay. Bình thường → sau 600 ms (fake timers 599/600).
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Cài đặt theo SPEC B3.
- [ ] **Step 4:** Playwright:
  - `E9-S3 Giao hàng: thực giao kẹp theo tồn và còn lại, giao dòng đã chọn, giao tất cả rời bộ lọc`. Có bước giảm tồn qua API giữa chừng → `STOCK_INSUFFICIENT`.
  - `E9-S3 Giao hàng bấm đúp: tồn trừ một lần`. Đếm `stock_movements` qua API sổ cái = 1.

  Chạy đủ bộ web.
- [ ] **Step 5:** Commit `feat(web): Giao hàng M1 — master–detail, thực giao kẹp tồn, giao dòng đã chọn`.

### Task 14: B4 Còn nợ

**Files:** `web/src/features/delivery/`:
- `backlog-page.tsx`, `backlog-stats.tsx`, `backlog-table.tsx`
- `deliver-more-dialog.tsx`, `cancel-dialog.tsx`, `deliveries-drawer.tsx` (restyle)
- `backlog.m1.css`
- test; Playwright `backlog.spec.ts`

- [ ] **Step 1: Test RED** (AC E9-S3 6–7):
  - Giao bổ sung: còn 4, tồn 2 → max 2; số 1 và 2 gửi được, nút "+" vô hiệu ở 2. "Tồn sau khi giao {s − q}" cập nhật.
  - Hủy nợ: `REASON_REQUIRED` → lỗi ô; `cancelled_now = 0` → toast info "Dòng này không còn nợ."; `STALE_UPDATE {qty, delivered_qty}` → khối + số trong tiêu đề cập nhật; lý do `maxLength=500`.
  - Thẻ "Của người đã nghỉ" → `filter=left`, chỉ các dòng có nhãn "Người đã nghỉ".
  - Thẻ "Có hàng" đếm cả dòng ngoài DM.
  - Ngăn kéo lịch sử: đợt cũ trước, có dòng "Đã hủy {n} — {note}".
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Cài đặt theo SPEC B4.
- [ ] **Step 4:** Playwright `E9-S3 Còn nợ: thẻ lọc, giao bổ sung tối đa min(nợ, tồn), hủy nợ có lý do, lịch sử đợt giao` (hủy nợ 2/3 ký tự). Chạy đủ bộ web và Playwright cả bộ.
- [ ] **Step 5:** Commit `feat(web): Còn nợ M1 — thẻ lọc, giao bổ sung, hủy nợ, lịch sử giao`.
- [ ] **Step 6: MỐC KIỂM S3.** Báo chủ dự án các việc cần thử bằng `youtranken`, với kỳ đã khóa có dữ liệu (dev có kỳ 2026-10):
  - giao một dòng;
  - giao tất cả;
  - giao thiếu kho → sang Còn nợ;
  - hủy nợ có lý do.

---

## Lát S4 — Báo cáo + Bản in (SPEC §5.4)

### Task 15: B5 Báo cáo & in

**Files:** `web/src/features/reports/`:
- `reports-page.tsx`
- `report-part1.tsx` (nhóm theo D7, ô Đặt mua)
- `report-issues.tsx`
- `report-part2.tsx`
- `report-snapshots.tsx`
- `use-snapshot.ts` (chốt + tải Excel qua `apiFetchBlob`)
- `reports-errors.ts`, `reports.m1.css`
- test; Playwright `reports.spec.ts`

- [ ] **Step 1: Test RED** (AC E9-S4 1, 2, 3, 5 + Q2):
  - Ô Đặt mua: 0 và 99999 hợp lệ; −1, 100000, 1.5, "a" → lỗi tại ô "Từ 0 đến 99 999.".
  - Bấm chốt khi có ô lỗi → cảnh báo "Sửa {n} ô Đặt mua đang lỗi trước khi chốt.", không có `POST`.
  - `pending_custom_count=1` → hộp thoại; "Xem món chờ" không `POST`; "Vẫn chốt" `POST` 1 lần.
  - Chỉ gửi `order_qty` cho ô khác `need`.
  - Kỳ mở → cảnh báo info "tạm tính" và nút chốt **bật** (Q2).
  - `VALIDATION {fields:['order_qty.<key>']}` → lỗi đúng ô.
  - Đổi tháng khi có ô sửa → hỏi; "Tiếp tục sửa" giữ tháng và số.
  - "Tải lại" Excel không `POST` snapshot. Tải lỗi → khối trong mục Bản chốt.
  - Phần 1 món không nhóm hoặc `category_id` lạ → "Chưa xếp nhóm" (Review Focus 5).
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Cài đặt theo SPEC B5.
- [ ] **Step 4:** Playwright `E9-S4 Báo cáo: Đặt mua biên 0/99999/100000, chốt hỏi món chưa xem, Excel tải về và tải lại không tạo bản mới`. Tên tệp `vpp-bao-cao-<ym>.xlsx`; đếm `GET …/snapshots` +1 rồi không đổi. Chạy đủ bộ web.
- [ ] **Step 5:** Commit `feat(web): Báo cáo M1 — Đặt mua, chốt, bản chốt, tạm tính khi kỳ mở`.

### Task 16: B6 Bản in A4

**Files:** `web/src/features/reports/print-page.tsx` (+ `print-sheet.tsx` nếu > 250 dòng), `web/src/css/print.css` (giữ `@page`, đen trắng); test; Playwright `print.spec.ts`

- [ ] **Step 1: Test RED** (AC E9-S4 4):
  - Hiện tên người ký từ bản chốt; ô trống → dòng chấm.
  - Bản thứ hai của kỳ → "Bản chốt số 2 của kỳ".
  - Mọi `order_qty = need` → "· Đặt mua mặc định".
  - Phần 1 phẳng theo thứ tự bản chốt, nhóm "Ngoài danh mục (đã chấp nhận)" cuối, không có cột Số người cho hàng món (G12).
  - `SNAPSHOT_NOT_FOUND` → `NotFound`.
  - Thanh công cụ có `aria-label` "Thanh công cụ bản in (không in ra giấy)".
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Cài đặt theo SPEC B6.
- [ ] **Step 4:** Playwright `E9-S4 Bản in A4: ô ký, số chốt không đổi sau giao thêm, in lại không tạo bản mới`. Chạy đủ bộ web và Playwright cả bộ.
- [ ] **Step 5:** Commit `feat(web): bản in A4 M1 từ bản chốt`.
- [ ] **Step 6: MỐC KIỂM S4.** Báo chủ dự án các việc cần thử bằng `youtranken`:
  - sửa ô Đặt mua;
  - Xuất Excel rồi mở tệp;
  - In trình ký → xem trang in (in thử ra PDF);
  - kỳ đang mở có dòng "tạm tính".

---

## Lát S5 — Danh mục + Nhóm món + Kho (SPEC §5.5)

### Task 17: B8 Danh mục — bảng, sửa tại chỗ, hàng loạt

**Files:** `web/src/features/catalog/`:
- `catalog-page.tsx` (URL `cat/q/inactive/filter`)
- `catalog-stats.tsx`
- `catalog-table.tsx`
- `category-chips.tsx`
- `use-bulk-items.ts` (D12, tuần tự)
- `bulk-dialogs.tsx`
- `catalog.m1.css`
- test; Playwright `catalog.spec.ts`

**Interfaces:**
- Produces: `openItemDrawer(itemId: string | 'new', categoryId?: string)` qua URL `?item=` cho T18.

- [ ] **Step 1: Test RED** (AC E9-S5 1, 3):
  - InlineNumber tối đa/tháng: 1 và 999 → `PATCH {max_qty}` + toast "Đã lưu tối đa {n} cho {tên}"; server `VALIDATION ['max_qty']` → câu "Tối đa từ 1 đến 999." trong hàng; Esc → không `PATCH`.
  - Hàng loạt đổi tối đa 2 món → 2 `PATCH` tuần tự, toast. 1 món lỗi → món đó còn chọn, câu lỗi ở hàng, toast warn "Đã đổi 1/2 món — xem dòng lỗi."
  - Công tắc ngừng hỏi "Ngừng {tên}?".
  - Chip nhóm `aria-pressed`. Thẻ "Thiếu ảnh" lọc `filter=noimage`.
  - Món có `category_id` lạ → nhóm "Chưa xếp nhóm" (Review Focus 5).
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Cài đặt theo SPEC B8 (phần bảng).
- [ ] **Step 4:** Chạy đủ bộ web. Playwright để T18.
- [ ] **Step 5:** Commit `feat(web): Danh mục M1 — bảng nhóm, sửa tối đa tại chỗ, hàng loạt`.

### Task 18: B8 ngăn kéo món + B9 Nhóm món

**Files:**
- `web/src/features/catalog/`: `item-drawer.tsx`, `item-fields.tsx`, `image-field.tsx` (restyle; giữ `image-compress.ts`); xóa `item-form.tsx` dạng Dialog
- `web/src/features/catalog/categories-page.tsx`, `category-order.ts` (`sort_order = vị trí*10`), `add-category-dialog.tsx`, `category-preview.tsx`
- test; Playwright `catalog.spec.ts`, mới `categories.spec.ts`

- [ ] **Step 1: Test RED** (AC E9-S5 2, 4):
  - Ngăn kéo:
    - gửi thiếu ảnh và tên → khối "Cần thêm: ảnh, tên." và ô ảnh `aria-invalid`;
    - `IMAGE_REQUIRED`/`FILE_TOO_LARGE` → ô ảnh;
    - `ITEM_IN_USE` → câu "Món đã có trong phiếu — chỉ ngừng được.";
    - ↑/↓ chuyển món;
    - tên `maxLength=120`.
  - Nhóm:
    - "Đưa {tên} lên" đổi vị trí và hiện dải "Thứ tự đã đổi (n nhóm)";
    - "Lưu thứ tự" gửi `PATCH {sort_order}` chỉ cho nhóm đổi vị trí, giá trị `vị trí*10`;
    - lỗi giữa chừng → toast warn + refetch;
    - `CATEGORY_EXISTS` → ô tên "Đã có nhóm tên này.";
    - hộp thoại thêm nhóm báo "đứng thứ {k} và nhận màu {tên màu}" theo `groupTone`.
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Cài đặt theo SPEC B8 (ngăn kéo) và B9.
- [ ] **Step 4:** Playwright:
  - `E9-S5 Danh mục: sửa tại chỗ tối đa 0/1/999/1000, thêm món có ảnh trong ngăn kéo, hàng loạt đổi tối đa`;
  - `E9-S5 Nhóm món: đổi thứ tự, màu theo vị trí, trùng tên` (tải lại vẫn đúng thứ tự; trùng khác hoa thường).

  Chạy đủ bộ web.
- [ ] **Step 5:** Commit `feat(web): ngăn kéo thêm/sửa món và trang Nhóm món M1`.

### Task 19: B7 Kho

**Files:** `web/src/features/stock/`:
- `stock-page.tsx`, `stock-stats.tsx`, `stock-table.tsx`
- `purchase-dialog.tsx`, `adjust-stock-dialog.tsx`, `issue-dialog.tsx` (tách từ `stock-dialogs.tsx`)
- `movements-drawer.tsx` (D11 "tồn sau")
- `stock.m1.css`
- test; Playwright `stock.spec.ts`

- [ ] **Step 1: Test RED** (AC E9-S5 5–7):
  - Xuất lẻ: tồn 3, số 3 gửi; server `STOCK_INSUFFICIENT {available:3}` → ô số "Chỉ còn 3 {ĐVT}.". Nút "Xuất lẻ…" vô hiệu khi tồn 0.
  - Điều chỉnh: lý do rỗng → server `REASON_REQUIRED` gắn ô.
  - Sổ cái dữ liệu giả `[+10, −3]` với tồn hiện tại 7 → dòng mới "tồn 7", dòng cũ "tồn 10". Có "Xem thêm" khi có `next_cursor`.
  - `?filter=low` lọc đúng.
  - Cột Còn nợ 0 → "—".
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Cài đặt theo SPEC B7.
- [ ] **Step 4:** Playwright `E9-S5 Kho: nhập 10, xuất lẻ 3 rồi 4 bị chặn, sổ cái tồn sau từng dòng`. Chạy đủ bộ web và Playwright cả bộ.
- [ ] **Step 5:** Commit `feat(web): Kho M1 — thẻ lọc, nhập/điều chỉnh/xuất lẻ, sổ cái tồn sau`.
- [ ] **Step 6: MỐC KIỂM S5.** Báo chủ dự án các việc cần thử bằng `youtranken`:
  - thêm món có ảnh thật;
  - sửa tối đa tại chỗ;
  - đổi thứ tự nhóm → màu đổi;
  - nhập kho, xuất lẻ, xem sổ cái.

---

## Lát S6 — Danh bạ + Nhật ký + Cấu hình (SPEC §5.6)

### Task 20: B10 Danh bạ

**Files:** `web/src/features/directory/`:
- `users-page.tsx`
- `use-all-users.ts` (tải hết trang 200, ngưỡng `DIRECTORY_FULL_LOAD_MAX = 2000`)
- `users-table.tsx`, `user-drawer.tsx`, `sync-result.tsx`
- `directory.m1.css`
- test; Playwright mới `users.spec.ts`

- [ ] **Step 1: Test RED** (AC E9-S6 5):
  - Thẻ Đang dùng / Chưa đăng nhập / Đã khóa lọc đúng.
  - Lọc phòng ban dẫn xuất.
  - Đồng bộ lỗi `SSO_UNAVAILABLE` → khối danger + "Thử lại", bảng vẫn còn. Thành công → "Đã đồng bộ từ PMH ID: {created} người mới, {updated} cập nhật."
  - Ô tìm `maxLength=200`.
  - Ngăn kéo:
    - không có mục "Vai trò trong app" (G25);
    - `locked` → cảnh báo;
    - "Xem nhật ký" → `/admin/audit?actor=<sub>`.
  - Quá 2000 người → chuyển sang tìm server.
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Cài đặt theo SPEC B10.
- [ ] **Step 4:** Playwright `E9-S6 Danh bạ: thẻ lọc trạng thái, đồng bộ lỗi PMH ID bảng vẫn còn, ngăn kéo người`.
- [ ] **Step 5:** Commit `feat(web): Danh bạ M1`.

### Task 21: B11 Nhật ký

**Files:** `web/src/features/admin/` (hoặc nơi trang audit đang ở; xem `docs/map.md`):
- `audit-page.tsx`, `audit-filters.tsx`
- `audit-quick-ranges.ts` (ngày theo giờ VN)
- `audit-table.tsx`, `audit-diff.tsx` (bảng Trước/Sau chỉ khóa khác)
- test; Playwright mới `audit.spec.ts`

- [ ] **Step 1: Test RED** (AC E9-S6 4):
  - Đến ngày < Từ ngày → lỗi ô, không gọi API. Bằng nhau thì hợp lệ (biên).
  - "Hôm nay" gửi `from = to =` ngày VN. Kiểm cả lúc 23:30 UTC (đã sang ngày mới ở VN).
  - Có `next_cursor` → nút "Xem thêm"; không có → "Đã hiện hết nhật ký trong khoảng lọc."
  - `audit-diff` chỉ liệt kê khóa khác nhau giữa `before`/`after`.
  - Nhóm theo ngày VN.
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Cài đặt theo SPEC B11.
- [ ] **Step 4:** Playwright `E9-S6 Nhật ký: lọc nhanh Hôm nay, khoảng ngày sai báo tại ô, mở Trước/Sau`. Seed 51 dòng → có nút; 50 dòng → không.
- [ ] **Step 5:** Commit `feat(web): Nhật ký M1`.

### Task 22: B12 Cấu hình

**Files:** `web/src/features/admin/` (trang config hiện có):
- `config-page.tsx`
- `config-section.tsx` (restyle)
- `period-block.tsx` (+ `period-preview.tsx`)
- `access-block.tsx`, `signers-block.tsx`, `contact-block.tsx`
- `recent-changes.tsx`
- giữ `config-form.ts`
- test; Playwright mới `config.spec.ts`

- [ ] **Step 1: Test RED** (AC E9-S6 1–3):
  - Nút ± dừng ở 3 và 28; gõ tay 2 vẫn gửi → server `CONFIG_INVALID {field:'registration_last_day'}` → lỗi ô "Nhập số từ 3 đến 28.".
  - Lịch xem trước: số ngoài 3–28 → "Nhập ngày hạn hợp lệ để xem trước".
  - Mỗi khối chỉ gửi khóa của khối.
  - Liên hệ: đếm "500/500", `maxLength=500`.
  - Người ký `maxLength=200`.
  - Nhóm Hành chính mới có 0 người và người đang đăng nhập không thuộc → cảnh báo tự mất quyền. Lưu hỏi xác nhận danger.
  - Rời trang khi bẩn → hỏi, liệt kê khối.
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Cài đặt theo SPEC B12.
- [ ] **Step 4:** Playwright `E9-S6 Cấu hình: ngày hạn 2/3/28/29, liên hệ 500 ký tự, mỗi khối lưu riêng`; lưu liên hệ → "Thay đổi gần đây" thêm một dòng. Chạy đủ bộ web và Playwright cả bộ.
- [ ] **Step 5:** Commit `feat(web): Cấu hình M1 — 4 khối lưu riêng, xem trước lịch kỳ`.
- [ ] **Step 6: MỐC KIỂM S6.** Báo chủ dự án các việc cần thử bằng `youtranken`:
  - Đồng bộ ngay;
  - mở ngăn kéo một người;
  - lọc nhật ký Hôm nay;
  - đổi tên người ký rồi in lại báo cáo.
  - **Lưu ý:** không đổi ô "Nhóm Hành chính" khi đang thử, kẻo mất quyền.

---

## Lát S7 — Hành chính ở 390 px (SPEC §5.7)

### Task 23: Bố cục điện thoại

**Files:**
- `web/src/shell/admin-topbar.tsx` (hoàn thiện), `admin-menu-sheet.tsx`
- `web/src/ui/data-table.tsx` (`stackOnMobile` dạng thẻ hàng)
- `ui/drawer.tsx`, `ui/dialog.tsx` (sheet)
- `web/src/features/delivery/delivery-page.tsx` (390: danh sách ↔ chi tiết theo `?request=`)
- `css/m1/shell.css`, `table.css`, `overlay.css`
- i18n `nav.mobile.*`
- Playwright mới `web/playwright/admin-mobile.spec.ts`

- [ ] **Step 1: Test RED.**
  - vitest:
    - topbar ở chi tiết Giao hàng có nút "Quay lại danh sách phiếu";
    - menu sheet liệt kê 11 mục, chọn mục thì đóng.
  - Playwright 390:
    - mọi route `/admin/*`: `document.documentElement.scrollWidth <= 390`;
    - từ mỗi trang tới mọi trang khác trong ≤ 2 chạm.
- [ ] **Step 2:** Chạy → FAIL.
- [ ] **Step 3:** Cài đặt theo SPEC §5.7.
- [ ] **Step 4:** Playwright:
  - `E9-S7 Hành chính 390: menu sheet ≤ 2 chạm, không cuộn ngang mọi trang`;
  - `E9-S7 Giao hàng 390: danh sách → chi tiết → giao tất cả → về danh sách` (quay lại giữ bộ lọc; giao đủ thì tự về sau 1,4 s).

  Chạy đủ bộ web.
- [ ] **Step 5:** Commit `feat(web): Hành chính 390 px — thanh trên, menu sheet, bảng thành thẻ, Giao hàng 2 màn`.

### Task 24: Chốt plan

**Files:** Playwright mới `web/playwright/admin-a11y.spec.ts`; `docs/diagrams/` (archify); `docs/backlog/epic-9-giao-dien-hanh-chinh.md`; `docs/map.md`; `docs/review-spec.md`; xóa CSS cũ không còn dùng (`features/*/*.css` của admin, `css/admin.css` nếu chưa xóa)

- [ ] **Step 1:** Playwright `E9-S7 axe 390 các màn Hành chính`:
  - chạy `color-contrast` trên 11 màn + menu sheet mở + một ngăn kéo mở + một hộp thoại mở → 0 vi phạm;
  - đo `boundingBox` mọi `button` hiển thị ở Giao hàng chi tiết và Danh mục → ≥ 44×44 (AC E9-S7 4–5).
- [ ] **Step 2:** Sửa vi phạm, chạy lại → xanh.
- [ ] **Step 3:** Chạy đủ:
  - api: `npm test && npm run test:e2e && npm run test:db`;
  - web: `npm test && npm run lint && npm run build`;
  - `npx madge --circular src` (api, web);
  - `grep -ri qlts api web` = 0;
  - không tệp nào > 400 dòng (`find api/src web/src -name '*.ts*' -o -name '*.css' | xargs wc -l | awk '$1>400'`);
  - Playwright cả bộ 1280 + 390.
- [ ] **Step 4:** Vẽ lại sơ đồ shell Hành chính + luồng tháng bằng skill `archify` vào `docs/diagrams/`. Lệch với `architecture.md` thì sửa và ghi `review-spec.md`.
- [ ] **Step 5:** Commit `test(web): axe 390 và vùng chạm Hành chính` + `docs: chốt plan giao diện Hành chính`.
- [ ] **Step 6:** Review toàn nhánh trên Opus, code review mức high → một đợt sửa → re-review.
- [ ] **Step 7: MỐC KIỂM S7 / cuối plan.**
  - Báo chủ dự án thử trên điện thoại thật: mở `https://de-vpp.pmh.com.vn:8443` bằng `youtranken`, đi hết menu, giao một phiếu.
  - Hỏi chủ dự án có gộp `chore/pmh-id-dev` + `feat/giao-dien-hanh-chinh` vào `main` không. Không push.
