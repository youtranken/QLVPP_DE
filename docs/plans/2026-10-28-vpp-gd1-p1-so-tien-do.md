# SDD ledger — plan: docs/plans/2026-10-28-vpp-gd1-p1-nen-tang.md

Spec: docs/prd.md v1.1, docs/architecture.md v1.1, docs/backlog/*, design-preview/_SPEC.md (đọc được). Nhánh: feat/p1-nen-tang từ main@491771c (commit mốc tài liệu).
Ruling: tạo commit mốc tài liệu trên main trước khi tách nhánh — review-package cần BASE/merge-base; chủ dự án đã duyệt plan có commit từng task — chi phí nếu sai: một commit docs thừa, hoàn tác được.
Ruling (cập nhật theo chủ dự án, không dùng Haiku): implementer Opus mọi task trừ 7 và 9 (Sonnet); reviewer Opus trừ 7/9 (Sonnet); re-review Sonnet; vòng sửa 4–5 Opus agent mới; final review Opus; Fable không viết code.

## Pre-flight scan (cặp task chia sẻ file/interface)

| Cặp | Produces → Consumes | Kết quả |
|---|---|---|
| T1 → T2 | `main.ts` tạm (health) → T2 thêm `runMigrations` trước listen | OK, T2 sửa cùng file |
| T2 → T3 | bảng users/sessions/audit/config/processed_webhook_events → module copy QLTS | OK; rủi ro: cột QLTS dùng mà migration bỏ (0008 user_permissions) → T3 phải bỏ code permissions (đã ghi) |
| T3 → T4 | `toIdentity` trong session-auth.service → T4 sửa role từ groups | OK, T3 copy nguyên, T4 đổi |
| T3 → T5 | webhook.controller copy v1 → T5 đổi v2; `SystemConfigService` → config-admin validate | OK |
| T3 → T10 | `GET auth/me` có `config{…admin_contact}` | OK (đã thêm vào Produces T3); `public-config` ở T5 |
| T2 → T6 | bảng `files(purpose, uploaded_by_sub)` 0013 → module files mới | OK |
| T6 → T8 | `FileAccessPolicy.registerReference`, `assertOwnedBy(fileId, sub, purpose)` | OK, tên khớp |
| T7 → T8 | DDL catalog, `ref_line_id` chưa FK | OK, Plan 2 thêm FK |
| T8 → T9 | upsert theo `code`; `missing_image` cờ ở `GET admin/items` | OK |
| T8 → T11/T12 | endpoint catalog/stock | OK; `GET admin/stock/low` chỉ ở T8 Produces |
| T10 → T11–13 | `apiFetch`, `useMe`, routes, `compressImage` | OK |
| T5 → T13 | `GET|PUT admin/config` shape | OK |
| T1 nội tại | compose giữ `edge` external network | OK |
| T3 nội tại | test `/api/_ip` chỉ khi NODE_ENV=test | OK, không lộ prod |
| Review-rubric | không task nào bắt test rỗng hay copy logic trùng | OK |

Kết luận: sạch; không ruling thêm.

## Tiến độ
Task 1: dispatched (Opus, agent implementer, BASE 491771c)
Ruling: thêm CLAUDE.md (TDD/DoD/Playwright/quy ước) theo yêu cầu chủ dự án trước khi code; commit riêng ba36c5d trên nhánh; BASE Task 1 vẫn 491771c (diff Task 1 sẽ gồm cả CLAUDE.md — reviewer bỏ qua file này)
Task 1: implementer DONE_WITH_CONCERNS (73d6bf4). Review base = ffe4cd4 (commit cha của 73d6bf4, loại các commit docs của controller).
Ruling: WEBHOOK_TS_SKEW_SEC giữ `:-300` (brief) thay vì `:?` (Global Constraints) — giá trị an toàn mặc định, có trong .env.example, architecture §12 ghi 300 — nếu sai: phải thêm vào .env prod, rủi ro thấp.
Ruling: "no tests found" ở api unit/db và web vitest chấp nhận cho Task 1 — Task 2 (db-spec) và Task 10 (vitest) thêm test; Task 3 có unit — nếu sai: DoD Task 1 lệch tạm thời.
Ruling: dev override publish web 127.0.0.1 cổng ngẫu nhiên, tạo network edge cục bộ — cần cho Step 5; không ảnh hưởng prod compose.
Task 1: review → Needs fixes (2 Important: filesdata volume không ghi được bởi user node; ts-jest warning isolatedModules).
Task 1: minor (deferred): vite dev proxy trỏ https://localhost (không có EDGE ở dev)
Task 1: minor (deferred): mem limit fallback trong compose khác .env.example
Task 1: minor (deferred): README/.env.example nói boot assert AUTH_DEV_MODE/LOCAL_SA trước khi Task 3 thêm
Task 1: minor (deferred): comment mô tả trong tsconfig, header Dockerfile, đầu .env.example
Task 1: minor (deferred): thụt lề jest json, nháy kép eslint.config.mjs
Task 1: fix round 1/5 (2 addressed, 1 new open — restore.sh step 6 fails when run by uid≠1000 because mktemp dir 0700; commits 73d6bf4..977ba8b)
Task 1: fix round 2/5 (1 addressed, 0 open; commits 977ba8b..fb9bd10)
Task 1: minor (deferred): restore không nguyên tử — DB đã thay nếu bước 6/6 lỗi (đã biết)
Task 1: complete (commits ffe4cd4..fb9bd10, review clean)
Task 2: dispatched (Opus, BASE fb9bd10)
Task 2: implementer DONE_WITH_CONCERNS (77d00f5).
Ruling: bỏ config `directory_sync_interval_minutes` và `users.offboard_alerted_at` (tính năng offboarding QLTS) — Task 3 phải dùng hằng 60 phút trong code (spec FR-80: 60′) nếu code copy đọc khóa này — nếu sai: thêm migration seed khóa.
Ruling: bỏ marker `qlts:no-transaction` và backfill checksum cũ khỏi runner — repo mới không có journal cũ; nếu cần migration ngoài transaction (CREATE INDEX CONCURRENTLY) phải thêm lại — rủi ro thấp ở quy mô 40 người.
Task 2: review → Needs fixes (1 Important: db-spec DROP SCHEMA không chặn DB không phải *_test).
Task 2: minor (deferred) → carry Task 3: directory-sync scheduler đọc `directory_sync_interval_minutes` (getInt ném lỗi khi thiếu) → hằng 60; bỏ `can_long_term`/`can_recurring` khỏi users.schema/service/users-admin.controller/auth.controller
Task 2: minor (deferred): in_app_notifications.event_id nullable → UNIQUE không chống trùng khi NULL; producer VPP luôn set event_id (P3)
Task 2: minor (deferred): test chưa insert files.purpose='line_image'
Task 2: minor (deferred): runner finally client.release() thay vì release(err)
Task 2: minor (deferred): DatabaseModule không assert DATABASE_URL (main.ts có)
Task 2: fix round 1/5 (1 addressed, 0 open; commits 77d00f5..dd68699)
Task 2: minor (deferred): assertTestDatabase không chặn `?dbname=` trong query; các db-spec sau phải tự import helper
Task 2: complete (commits fb9bd10..dd68699, review clean)
Task 3: dispatched (Opus, BASE dd68699)
Task 3: implementer DONE_WITH_CONCERNS (14a9e66).
Ruling: giữ hình audit QLTS `{actor, objectType, objectId, detail}` (before/after/ip nằm trong `detail`) và `req.user` thay cho tên trong plan (`actorSub/targetType/before/after`, `req.identity`) — khớp cột audit_log đã có, tránh đổi 12 chỗ; các task sau dùng tên QLTS — nếu sai: đổi tên hàng loạt, cơ học.
Ruling: callback `?error=access_denied` chỉ chuyển `/?login=forbidden` khi có cookie tx hợp lệ (chống callback giả, theo QLTS) — đúng ý bảo mật; e2e gửi kèm cookie.
Task 3: review → Needs fixes (2 Important: directory sync không chạy lúc boot/đặt lại mỗi restart; admin/users ẩn cả locked).
Task 3: minor (deferred): cursor audit rác → 500 thay vì 400 (audit-query.service.ts:91-93)
Task 3: minor (deferred): filter actor không escapeLike
Task 3: minor (deferred) → carry Task 4/5: auth.controller.ts 368 dòng > 350 — tách MeResponse ra file types trước khi thêm code
Task 3: minor (deferred): /me ném lỗi nếu thiếu khóa config (đã seed)
Task 3: fix round 1/5 (2 addressed, 1 open — marker directory_sync_last_at ghi trước khi sync nên sync lỗi vẫn đẩy mốc 60′; commits 14a9e66..9dc2e07)
Task 3: minor (deferred): e2e marker yếu (bootstrap đã ghi trước tick)
Task 3: minor (deferred): marker không chống chạy nhiều replica (prod 1 replica)
Task 3: fix round 2/5 (1 addressed, 0 open; commits 9dc2e07..a874b4a)
Task 3: minor (deferred): backoff tính từ lúc lỗi xong — sync timeout >30s trượt thêm một tick
Task 3: complete (commits dd68699..a874b4a, review clean)
Task 4: dispatched (Opus, BASE a874b4a)
Task 4: implementer DONE_WITH_CONCERNS (3ebcf61). Carry Task 5: role.e2e-spec.ts ký webhook v1 → chuyển sang v2.
Ruling: đăng nhập SA đúng reset bộ đếm cặp (ip,user), không reset bộ đếm toàn cục — tránh kẻ dò xen kẽ đăng nhập đúng để xóa dấu; chi phí: SA thật có thể bị khóa toàn cục 15′ khi bị dò 50 lần (đánh đổi đã chốt trong spec).
Task 4: minor (deferred): users.role không được ghi nữa (cột chết, hiển thị sai nếu ai đọc) — quyết định ghi resolveRole hoặc bỏ cột
Task 4: minor (deferred): admin_group thiếu → mọi request AD 500 (fail-closed)
Task 4: minor (deferred): khóa SA toàn cục có thể bị giữ mãi với ~50 req/15′ — ghi runbook: restart api để xóa
Task 4: minor (deferred): prune O(10k) khi chạm trần
Task 4: complete (commits a874b4a..3ebcf61, review clean)
Task 5: dispatched (Opus, BASE 3ebcf61)
Task 5: implementer DONE (51d2421). Hợp đồng PMH ID khớp brief (README §6, edge §3): X-PMH-Signature-V2, X-PMH-Timestamp giây, ±300 s, payload `user_id`.
Ruling: audit `config.updated` một dòng mỗi PUT (objectId = các khóa đổi, detail {before, after}) — đủ để xem cũ/mới và lọc theo hành động; nếu sai: tách theo khóa, cơ học.
Ruling: `signers` merge theo từng người ký — đúng ngữ nghĩa partial merge của PUT config.
Ruling: WEBHOOK_TS_SKEW_SEC mặc định 300 (đã chốt ở Task 1), không assert lúc boot.
Task 5: review → Needs fixes (1 Important: RULES[key] lọt khóa prototype `constructor`/`toString`; `__proto__` → 500).
Task 5: minor (deferred): `signers: {}` ghi audit thừa
Task 5: minor (deferred): hai webhook cùng event_id đồng thời đều xử lý (idempotent, chỉ trùng audit)
Task 5: minor (deferred): webhook bị từ chối không xác thực vẫn ghi audit → có thể phình bảng; cân nhắc throttle
Task 5: minor (deferred): timestamp sai định dạng báo reason `skew`
Task 5: fix round 1/5 (1 addressed, 0 open; commits 51d2421..ec24f7e)
Task 5: complete (commits 3ebcf61..ec24f7e, review clean)
Task 6: dispatched (Opus, BASE ec24f7e)
Task 6: implementer DONE (5ad74f6).
Ruling: giao diện tham chiếu ảnh là SQL fragment `FileReference {name, readCondition, referencedCondition}` thay cho `references()`/`orphanQuery` của plan — để gộp một truy vấn đọc và NOT EXISTS khi dọn; Task 8 và Plan 2 dùng hình này — nếu sai: đổi interface nhỏ.
Ruling: chấp nhận dời UserThrottlerGuard sau Identity→CSRF→Roles (sửa lỗi QLTS đếm theo IP thay vì user) — reviewer kiểm route @Public (sa-login, webhook, public-config) vẫn bị throttle.
Task 6: review → Needs fixes (2 Important: request chưa xác thực tới route bảo vệ không còn bị throttle; sa-login thiếu 10/phút/IP theo §13).
Ruling: nâng Minor "dọn mồ côi fail-open khi purpose chưa có reference" vào vòng sửa — rẻ, và nếu không thì bất kỳ deploy giữa chừng xóa ảnh mỗi đêm; thêm `purpose` vào FileReference, chỉ dọn purpose đã đăng ký — chi phí nếu sai: thêm một trường interface.
Task 6: minor (deferred): crash giữa writeFile và insert để lại file đĩa không có dòng (không quét thư mục)
Task 6: minor (deferred): e2e chạy song song trên một DB — sửa race bằng nới assertion, chưa cô lập
Task 6: minor (deferred): storedPath với mime lạ tạo `<id>.undefined`
Task 6: minor (deferred): 404 dùng NOT_FOUND chung
Task 6: fix round 1/5 (3 addressed, 0 open; commits 5ad74f6..0bcb341)
Task 6: minor (deferred): giới hạn IP 300/phút tính theo route; NAT chung/TRUST_PROXY_HOPS sai → mọi người chung một IP — ops kiểm số hop
Task 6: complete (commits ec24f7e..0bcb341, review clean)
Task 7: dispatched (Sonnet, BASE 0bcb341)
Task 7: implementer DONE_WITH_CONCERNS (2f98353). Controller kiểm: trust-proxy e2e pass khi không có NODE_ENV=development từ .env → lỗi môi trường chạy test, không phải do 0100.
Task 7: minor (deferred): e2e phụ thuộc NODE_ENV của shell — jest e2e nên ép NODE_ENV=test (setup file)
Ruling: Task 7 chấp nhận dù report thiếu output RED/GREEN nguyên văn — implementer báo RED "20 failed, relation items does not exist" và GREEN 34/34; reviewer xác nhận test assert mã lỗi đúng — chi phí: bằng chứng TDD yếu cho một migration thuần SQL.
Task 7: minor (deferred): helper insertItem khó đọc; test "delivery then return" phụ thuộc thứ tự; tiêu đề describe migrations phải sửa mỗi lần thêm migration
Task 7: complete (commits 0bcb341..2f98353, review clean)
Task 8: dispatched (Opus, BASE 2f98353)
Task 8: implementer DONE_WITH_CONCERNS (98cf55a).
Ruling: `include_inactive_ids` cho member thấy cả món admin_only theo id chỉ định — cần cho FR-21 (dòng "Hành chính thêm" hiện chỉ đọc trong giỏ); id là uuid nên không dò được — nếu sai: một dòng trong CatalogService.listFor.
Ruling: DELETE món đã có biến động kho cũng trả ITEM_IN_USE — giữ sổ cái toàn vẹn.
Ruling: "sắp hết" theo spec `stock_qty <= min_stock` (món mới tồn 0, min 0 hiện là sắp hết) — đúng chữ FR-50; nếu Hành chính thấy phiền thì đổi thành `<` hoặc chỉ khi min_stock > 0.
Task 8: review → Needs fixes (1 Important: `admin/issues?ym=` sai định dạng trả VALIDATION thay vì INVALID_PERIOD theo §7).
Task 8: minor (deferred): cursor lỗi trả BAD_REQUEST trong khi DTO trả VALIDATION — thống nhất mã
Task 8: minor (deferred): cursor timestamp đúng hình nhưng sai giá trị → 500 (map pg 22xxx → 400)
Task 8: minor (deferred): files.e2e đếm cleanup toàn cục — dễ flaky nếu DB test còn orphan cũ
Task 8: minor (deferred): stock.db-spec không dọn dữ liệu, tích lũy mỗi lần chạy
Task 8: minor (deferred): thiếu test me/issues loại người khác, cursor rác, limit biên, điều chỉnh âm thành công
Task 8: minor (deferred) → carry Plan 2: thêm `request_lines_item_id_fkey` vào CONSTRAINT_ERRORS (ITEM_IN_USE); isUsed chạy ngoài tx
Task 8: fix round 1/5 (2 addressed, 0 open; commits 98cf55a..bab0d71)
Task 8: minor (deferred): cursor nhật ký/danh bạ đúng hình sai giá trị vẫn 500 — chuyển isRealTimestamp sang common/
Task 8: complete (commits 2f98353..bab0d71, review clean)
Task 9: dispatched (Sonnet, BASE bab0d71)
Task 9: implementer DONE (68513ff).
Ruling: Giấy A5 KHÔNG admin_only — chủ dự án chỉ chốt "không được đăng ký A4"; implementer tự thêm A5 → phải bỏ.
Ruling: seed phải chạy được trên prod (`docker compose exec api node scripts/seed-catalog.mjs`) — copy scripts/ + seed/ vào image runtime; danh mục ban đầu cần cho lần deploy đầu.
Task 9: review → Needs fixes (2 Important = 2 ruling: A5 admin_only; seed không có trong image prod).
Task 9: minor (deferred): Hồ dán đơn vị `chai` — câu hỏi sản phẩm; missing_image có cả ở danh sách member (vô hại); ROLLBACK có thể che lỗi gốc
Task 9: fix round 1/5 (2 addressed, 0 open; commits 68513ff..08d9115)
Task 9: complete (commits bab0d71..08d9115, review clean)
Task 10: dispatched (Opus, BASE 08d9115)
Task 10: implementer DONE (e5b8af3).
Ruling: trang "Chưa được cấp quyền" dùng câu không có {email} — callback không mang email (không đưa email lên URL vì lộ PII); chi phí: câu chữ lệch _SPEC một mệnh đề.
Ruling: nút chính/logo dùng --brand-deep #047857 (chữ trắng trên #059669 chỉ 3.8:1, trượt axe) — ưu tiên đọc được; màu thương hiệu vẫn #059669 cho nền/nhấn.
Ruling: /admin chuyển hướng /admin/catalog trong Plan 1 (Tổng hợp kỳ có ở Plan 2).
Task 10: minor (deferred): npm audit — vite 8.0–8.1.5 lỗ hổng high (có từ Task 1) → nâng vite bản vá trước deploy
Task 10: minor (deferred): madge tải bị chặn — kiểm vòng import bằng script Python thay thế
Task 10: minor (deferred): vòng focus mờ trên sidebar tối (<3:1)
Task 10: minor (deferred) → carry Task 13: logout bỏ qua lỗi (không CSRF khi null, không kiểm res.ok); key auth.logoutFailed, nav.closeMenu chưa dùng
Task 10: minor (deferred) → carry Task 11: thêm helper apiErrorCode/apiErrorMessage đọc {code,message} từ ApiError.body
Task 10: minor (deferred): LanguageSwitch role=radio thiếu phím mũi tên
Task 10: minor (deferred): body[data-shell] không reset ở /forbidden
Task 10: complete (commits 08d9115..e5b8af3, review clean)
Task 11: dispatched (Opus, BASE e5b8af3)
Task 11: implementer DONE (d1049a2).
Ruling: lọc "Hiện món đã ngừng" làm phía client (API admin items đã trả tất cả) — đúng ý brief, khác tham số.
Ruling: chưa có nút xóa món và ô mã món trên form — brief không liệt kê; ngừng món là đường chính (FR-11); để Plan 2/GĐ2 nếu Hành chính cần.
Task 11: minor (deferred): Playwright để lại nhóm/món test (đã ngừng) và đổi sort_order trong DB dev mỗi lần chạy
Task 11: minor (deferred): form món ở 390 px — nút Lưu nằm dưới màn hình đầu (cuộn trong dialog)
Task 11: minor (deferred): nút Ngừng/Mở lại lặp cùng tên truy cập mỗi dòng; aria-label ảnh khác chữ hiển thị; câu VALIDATION fallback hứa đánh dấu ô; bộ lọc nhóm không ghi (đã ngừng); đóng form khi đang tải ảnh; thiếu test FILE_TOO_LARGE/UNKNOWN/đổi ảnh; reorder nhiều PATCH+audit; ô thứ tự thiếu data-label
Task 11: complete (commits e5b8af3..d1049a2, review clean)
Task 12: dispatched (Opus, BASE d1049a2)
Task 12: implementer DONE (5be5f49).
Ruling: sổ cái tra tên người bằng danh bạ tải phía trình duyệt (40 người) — chấp nhận ở quy mô này; sub thô cho người đã xóa/local:sa/dev — nếu sai: thêm JOIN users trong movements() phía api.
Task 12: minor (deferred) → carry Task 13: locale vi/en 318/322 dòng — tách theo feature trước khi thêm khóa Task 13
Task 12: minor (deferred): Playwright seed user `pw-recipient` qua psql vào DB dev (còn lại trong Danh bạ)
Task 12: minor (deferred): chặn bấm đúp dựa state (nên thêm useRef); thiếu available → "Chỉ còn 0"; không làm mới tồn sau STOCK_INSUFFICIENT; nhãn Trạng thái rỗng trên mobile; picker không lọc locked phía server; JOIN tên người trong movements()
Task 12: complete (commits d1049a2..5be5f49, review clean)
Task 13: dispatched (Opus, BASE 5be5f49)
Task 13: implementer DONE (d718ef0 refactor locale, a3fb47c feat).
Ruling: chưa có bộ lọc `self` ở Nhật ký — API audit chưa hỗ trợ; `self` gắn với sửa phiếu (Plan 2) → làm cùng Plan 2.
Ruling: không hiện `low_stock_notify` trên Cấu hình — FR-82 không liệt kê.
Task 13: minor (deferred): một lần vitest đỏ không rõ nguyên nhân (8 lần sau xanh) — theo dõi flaky
Task 13: minor (deferred): lọc hành động nhật ký là gõ khớp chính xác, mã hành động hiển thị thô
Task 13: review → Needs fixes (2 Important: Cấu hình gửi lại khóa không đổi — audit thừa, ghi đè sửa đồng thời; lọc Nhật ký theo người phải gõ sub).
Task 13: minor (deferred): khóa mkdir Playwright có race/rò khi beforeAll lỗi; bảng Danh bạ sắp xếp chỉ trong trang đã tải; logout 403 CSRF nên gợi ý tải lại trang; lỗi ô Cấu hình không xóa khi sửa; vitest flaky 1 lần; spread locale có thể nuốt khóa trùng
Task 13: minor (deferred): API audit actor lọc ILIKE '%sub%' → nên so khớp chính xác khi lọc theo người đã chọn
Task 13: fix round 1/5 (2 addressed, 0 open; commits a3fb47c..1625d66)
Task 13: minor (deferred): Danh bạ giữ dòng cũ khi tìm nhưng thiếu dấu hiệu đang tải (aria-busy)
Task 13: complete (commits 5be5f49..1625d66, review clean)
Task 14: dispatched (Opus, BASE 1625d66)
Task 14: implementer DONE (12913f8). vite 8.1.3 → 8.1.6.
Ruling: grep chuỗi cứng 34 kết quả đều là file test và comment — lệnh grep trong plan sai phạm vi, sửa cho Plan 2 (loại *.test.tsx và dòng comment).
Ruling: không thêm seed vào update-vpp.sh — seed chạy tay lần deploy đầu (tránh tạo lại món đã xóa/ngừng... upsert không đổi active, nhưng món bị xóa sẽ quay lại).
Task 14: minor (deferred): npm audit api — body-parser high (`npm audit fix` được), multer high (cần platform-express 12, major), uuid qua exceljs moderate
Task 14: minor (deferred): sơ đồ archify cuối plan (CLAUDE.md) chưa làm
Task 14: minor (deferred): lệnh seed prod trong README thiếu `-f docker-compose.yml`; cleanup p1-flow ném lỗi thì không release khóa; log ERROR cố ý trong global-exception.filter.spec làm bẩn output npm test
Task 14: complete (commits 1625d66..12913f8, review clean)
Final review (Opus): With fixes — Important: (1) SA break-glass bị chặn khi PMH ID sập nếu trình duyệt còn phiên (503 trên route @Public + web không tới được form SA); (2) body-parser high.
Ruling: đợt sửa cuối gồm Important 1–2 + Minor 1,2,3,5,6,7,8,9,10 + mục README "Trước khi deploy" (runbook) + sơ đồ archify; users.role: cập nhật tài liệu (§4: cột không dùng cho quyền, bỏ ở migration sau) thay vì ghi lại — ít code, khớp thực tế.
Ruling: seed đổi sang DO NOTHING cho món đã có (không đè chỉnh sửa của Hành chính) — chi phí: sửa dữ liệu seed sau này phải sửa tay qua UI.
Ruling: quy tắc "sắp hết" 0/0 → hỏi chủ dự án trước Plan 3.
Final fix wave: DONE (9708cf3..069f33a, 12 commits). Controller docs commit 575c403.
Final fix wave re-review: all 13 addressed, no new Critical/Important (12913f8..069f33a).
Final: minor (deferred): sso-outage e2e không assert cookie SA mới khác cookie cũ; README ghi "khi platform-express 12 ra" (đã có 12.3.2); pool chưa có connectionTimeoutMillis; README sa:hash đặt mật khẩu trên dòng lệnh (lưu lịch sử shell)
