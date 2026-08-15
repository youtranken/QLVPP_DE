# USER STORIES / BACKLOG — DE-VPP

|               |                                                         |
| ------------- | ------------------------------------------------------- |
| **Phiên bản** | v3.0 (mỗi story đủ 8 trường)                            |
| **Ngày**      | 2026-08-06                                              |
| **Nguồn**     | `PRD.md` v1.2 · `SDD.md` v4 · `SSO-INTEGRATION.md` v1.0 |
| **Phạm vi**   | **MVP = làm đầy đủ** (mọi story trừ Payment)            |

> **Cấu trúc mỗi story:** ID · Persona · Mục tiêu · Lý do · Acceptance criteria (AC) · Edge cases · Priority · Dependencies.
> **Priority:** **P0** = cốt lõi (demo không chạy nếu thiếu) · **P1** = quan trọng · **P2** = có thì tốt.
> **Nhãn:** **[✅]** đã chốt · **[🔶]** đề xuất cần duyệt · **[⏳]** phụ thuộc tài sản/credential.
> **Nền tảng ngầm định:** mọi story (trừ AUTH-1) đều cần **AUTH-1** (đăng nhập) và **PROF-2** (map vai trò) — mục _Dependencies_ chỉ ghi thêm phụ thuộc _đặc thù_.

---

## 1. Authentication

### AUTH-1 — Đăng nhập qua PMH ID `[✅]`

- **Persona:** NV/AD
- **Mục tiêu:** Đăng nhập bằng tài khoản PMH ID (OIDC).
- **Lý do:** Dùng một danh tính chung toàn công ty, không phải nhớ mật khẩu riêng.
- **AC:**
  1. Trang chưa đăng nhập chỉ có nút "Đăng nhập bằng PMH ID" (không ô mật khẩu).
  2. Bấm → sang PMH ID → quay lại **đúng trang** định vào; app tạo phiên cookie `httpOnly`.
  3. Lần đầu **upsert** user theo `sub`; lần sau nhận diện đúng cùng người.
- **Edge cases:** PMH ID sập → chỉ chặn _đăng nhập mới_ (user đã đăng nhập vẫn dùng nhờ verify offline); callback bị gọi 2 lần (StrictMode) → `code` dùng-một-lần, guard cờ "đã dùng"; `state` không khớp → từ chối, khởi động lại login; PKCE thiếu → IdP trả lỗi (dùng thư viện chuẩn nên không xảy ra).
- **Priority:** **P0**
- **Dependencies:** PMH ID / **mock-idp** (external); `packages/shared`.

### AUTH-2 — Đăng xuất (local & toàn hệ) `[✅]`

- **Persona:** NV/AD
- **Mục tiêu:** Đăng xuất đúng phạm vi mong muốn.
- **Lý do:** Bảo vệ phiên; phân biệt "rời app này" và "rời toàn hệ SSO".
- **AC:**
  1. "Đăng xuất khỏi VPP" → xoá phiên app, **không** gọi IdP; vào lại tự đăng nhập im lặng nếu phiên SSO còn.
  2. "Đăng xuất khỏi PMH ID" → `end_session` + `id_token_hint`; vào lại phải đăng nhập lại.
- **Edge cases:** logout-local xong vào lại vẫn bị bắt login → lỗi giữ `state/verifier` phía app (checklist gỡ lỗi SSO §4.6); mất `id_token` → không gửi được hint (vẫn logout local được).
- **Priority:** **P0**
- **Dependencies:** AUTH-1.

### AUTH-3 — Chặn khi không có quyền (`access_denied`) `[✅]`

- **Persona:** HT (thay mặt NV)
- **Mục tiêu:** Xử lý callback `?error=access_denied` gọn gàng.
- **Lý do:** Tránh văng trang lỗi 500, giải thích rõ cho người dùng.
- **AC:** User không được cấp quyền → trang "Bạn chưa được cấp quyền — liên hệ quản trị", không 500.
- **Edge cases:** user có phiên SSO từ app khác nhưng vẫn `access_denied` ở VPP (đúng thiết kế gác cửa theo group); silent re-auth ra `access_denied` sau khi bị gỡ group.
- **Priority:** **P1**
- **Dependencies:** AUTH-1.

### AUTH-4 — Đá user tức thì (Webhook + BCL + refresh-fail) `[✅]`

- **Persona:** HT
- **Mục tiêu:** Vô hiệu phiên khi user bị khoá/xoá/đổi nhóm hoặc logout toàn hệ.
- **Lý do:** An toàn — người bị thu hồi quyền không dùng tiếp được.
- **AC:**
  1. Webhook `user.locked/deleted` (verify **HMAC v2** + timestamp ±5') → `disabled=true` + huỷ phiên của `sub`.
  2. BCL `logout_token` (verify JWKS, không `nonce`) → huỷ phiên của `sub`.
  3. Refresh `invalid_grant` → tự đăng xuất.
- **Edge cases:** sự kiện tới >1 lần → **idempotent**; gói webhook cũ (replay) → timestamp hết hạn → từ chối; idle 15' không bắn BCL → refresh-fail phủ; app on-prem cần allowlist IP.
- **Priority:** **P1**
- **Dependencies:** AUTH-1; cấu hình webhook/BCL ở IdP (external, **[⏳]** cho PMH ID thật).

---

## 2. User profile

### PROF-1 — Xem hồ sơ của tôi `[✅]`

- **Persona:** NV/AD
- **Mục tiêu:** Xem thông tin cá nhân trong hệ thống.
- **Lý do:** Biết mình đang đăng nhập là ai, thuộc phòng ban/vai trò nào.
- **AC:** Hiển thị tên, email, phòng ban, vai trò (từ token PMH ID); **chỉ đọc** (đổi ở PMH ID).
- **Edge cases:** user chỉ có group admin (không phòng ban) → phòng ban hiển thị "—"; email đổi ở PMH ID → app vẫn nhận diện đúng nhờ `sub`.
- **Priority:** **P1**
- **Dependencies:** AUTH-1, PROF-2.

### PROF-2 — Map group → vai trò & phòng ban `[✅]`

- **Persona:** HT
- **Mục tiêu:** Suy ra `role` và `department` từ `groups`.
- **Lý do:** Phân quyền và tổng hợp báo cáo đúng theo phòng ban.
- **AC:**
  1. `groups` chứa `VPP-Admin` ⇒ `admin`; ngược lại `member`.
  2. `department` = group phòng ban đầu tiên (theo `VPP_DEPARTMENT_GROUPS`); chỉ group admin ⇒ `null`.
  3. `GET /me` trả `{ sub, email, name, role, department, groups }`.
- **Edge cases:** nhiều group phòng ban → lấy cái đầu + ghi audit cảnh báo **[🔶]**; `groups_changed` (webhook) → cập nhật lại role/department; group tên lệch cấu hình → mặc định `member`.
- **Priority:** **P0**
- **Dependencies:** AUTH-1.

---

## 3. Core business (Đăng ký → Duyệt → Giao)

### CORE-1 — Xem danh mục VPP theo nhóm `[✅]`

- **Persona:** NV/AD · **Mục tiêu:** Duyệt danh mục để chọn món. · **Lý do:** Chọn nhanh, đúng đơn vị.
- **AC:** Nhóm (sort_order) → món `active`; hiện đơn vị + giới hạn; A4 gắn nhãn "chỉ admin"; có nhóm "Khác".
- **Edge cases:** danh mục rỗng → thông báo "chưa có VPP"; món `inactive` bị ẩn; món admin_only hiện khoá với NV.
- **Priority:** **P0** · **Dependencies:** AUTH-1; dữ liệu danh mục (seed hoặc ADMIN-1).

### CORE-2 — Đăng ký VPP `[✅]`

- **Persona:** NV · **Mục tiêu:** Chọn món + số lượng và gửi đơn. · **Lý do:** Nhận VPP cho kỳ này.
- **AC:** Chọn nhiều món, có giỏ xem lại; gửi → đơn `submitted`, sinh mã, gắn kỳ + phòng ban; đơn trống → chặn (`EMPTY_REQUEST`).
- **Edge cases:** đã có đơn hiệu lực kỳ này → chặn (xem CORE-7); double-submit do mất mạng/nhấn 2 lần → khoá nút + kiểm phía server; thời điểm giao kỳ (nửa đêm 10→11 giờ VN) → dùng `periodForDate`.
- **Priority:** **P0** · **Dependencies:** CORE-1, PROF-2 (phòng ban), `packages/shared`.

### CORE-3 — Mục "Khác" + đính kèm ảnh `[✅]`

- **Persona:** NV · **Mục tiêu:** Nhập món ngoài danh mục kèm ảnh. · **Lý do:** Mô tả nhu cầu đặc biệt rõ ràng.
- **AC:** Nhập tên tự do + SL (≤20) + upload ảnh (`image/*`, ≤5MB); trả về đường dẫn ảnh gắn vào dòng.
- **Edge cases:** ảnh >5MB / sai định dạng → báo lỗi, không gửi; upload thành công nhưng gửi đơn thất bại → ảnh mồ côi, **job dọn định kỳ** xoá sau ân hạn 24h (RUNBOOK §4b) **[✅]**; tên "Khác" rỗng → chặn.
- **Priority:** **P1** · **Dependencies:** CORE-2, dịch vụ upload.

### CORE-4 — Cấm A4 với nhân viên `[✅]`

- **Persona:** HT · **Mục tiêu:** Chặn NV đăng ký món `admin_only`. · **Lý do:** Đúng chính sách VPP.
- **AC:** Món A4 khoá với NV ở giao diện; NV cố gửi → server chặn (`ITEM_ADMIN_ONLY`); AD được phép.
- **Edge cases:** NV gọi API trực tiếp bỏ qua UI → **server vẫn chặn**; món đổi cờ admin_only sau khi NV mở form → kiểm tại thời điểm gửi.
- **Priority:** **P0** · **Dependencies:** CORE-2, PROF-2 (vai trò).

### CORE-5 — Giới hạn số lượng ≤ 20/món `[✅]`

- **Persona:** HT · **Mục tiêu:** Chặn số lượng vượt `max_qty`. · **Lý do:** Kiểm soát định mức mỗi lần.
- **AC:** >`max_qty` (mặc định 20) hoặc ≤0 → chặn ở UI và server (`QTY_INVALID`).
- **Edge cases:** nhập chữ/thập phân/âm; món có `max_qty` khác 20; dán số lớn.
- **Priority:** **P0** · **Dependencies:** CORE-2.

### CORE-6 — Khung ngày đăng ký `[✅ đổi theo yêu cầu 2026-08-14]`

- **Persona:** HT/NV · **Mục tiêu:** Chỉ nhận đăng ký NV trong khung ngày do admin đặt (mặc định **ngày 20 đến hết tháng**). · **Lý do:** Đúng chu kỳ mua sắm tháng.
- **AC:** Trong cửa sổ form mở và gắn **kỳ tháng kế tiếp**; ngoài cửa sổ hiện "đã đóng", gửi bị chặn (`REGISTRATION_CLOSED`); AD bỏ qua. Đổi khung ngày ở màn Cài đặt có hiệu lực ngay (ADMIN-8).
- **Edge cases:** đúng nửa đêm chuyển ngày theo giờ VN (container `TZ=Asia/Ho_Chi_Minh`); admin thao tác ngoài cửa sổ (được phép); người dùng mở form trong cửa sổ rồi gửi sau khi đóng → kiểm tại thời điểm gửi; **tháng 2 / tháng 30 ngày** → ngày cuối co lại (đặt 31 = hết tháng); admin đổi khung ngày lúc người dùng đang điền dở → kiểm lại lúc gửi.
- **Priority:** **P0** · **Dependencies:** CORE-2, `packages/shared`.

### CORE-7 — 1 đơn hiệu lực/kỳ, không tự sửa `[✅]`

- **Persona:** HT/NV · **Mục tiêu:** Mỗi người 1 đơn hiệu lực mỗi kỳ. · **Lý do:** Dữ liệu nhất quán, tránh trùng.
- **AC:** Đã có đơn `submitted/approved/delivered` kỳ này → chặn tạo mới; NV không có nút sửa đơn đã gửi.
- **Edge cases:** đơn `rejected/cancelled` → cho tạo mới; hai tab cùng gửi → **partial unique index** chặn ở DB.
- **Priority:** **P0** · **Dependencies:** CORE-2.

### CORE-8 — Huỷ đơn `[✅]`

- **Persona:** NV · **Mục tiêu:** Huỷ đơn khi cần đăng ký lại. · **Lý do:** Sửa sai khi chưa được xử lý.
- **AC:** Huỷ chỉ khi đơn `submitted` **và** còn trong khung ngày đăng ký; sau `cancelled` được tạo đơn mới.
- **Edge cases:** huỷ đơn đã `approved` → chặn; huỷ sau khi cửa sổ đóng → chặn; huỷ đơn không phải của mình → chặn (403).
- **Priority:** **P1** · **Dependencies:** CORE-2.

### CORE-2b — Tìm món & dùng lại đơn cũ `[✅ bổ sung sau, theo yêu cầu]`

- **Persona:** NV · **Mục tiêu:** Tìm nhanh món trong danh mục và không phải chọn lại từ đầu mỗi kỳ. · **Lý do:** VPP hằng tháng gần như giống nhau; danh mục dài thì cuộn rất mất công.
- **AC:** Ô tìm lọc theo tên món **và** tên nhóm, gõ **không dấu** vẫn ra; nút **Dùng lại đơn gần nhất**; nút **Sửa và gửi lại** ở đơn bị từ chối mở sẵn nội dung đơn đó.
- **Edge cases:** món trong đơn cũ đã ngừng/bị xoá/chuyển thành chỉ-admin → **bỏ ra và nói rõ lý do**; số lượng vượt giới hạn mới → **hạ xuống** thay vì bỏ cả dòng; hai dòng cùng món → cộng dồn; dòng "Khác" giữ nguyên cả ảnh đính kèm; không tìm thấy món nào → gợi ý khai ở mục "Khác".
- **Priority:** **P1** · **Dependencies:** CORE-2, CORE-9.

### CORE-9 — Đơn của tôi, lịch sử & gửi lại `[✅]`

- **Persona:** NV · **Mục tiêu:** Xem đơn + trạng thái theo kỳ; gửi lại khi bị từ chối. · **Lý do:** Theo dõi và khắc phục.
- **AC:** Danh sách theo kỳ + chi tiết dòng + trạng thái duyệt/giao; `rejected` hiện **lý do** + nút "Gửi lại".
- **Edge cases:** nhiều đơn rejected trong 1 kỳ (lịch sử); "Gửi lại" khi cửa sổ đã đóng → chặn theo CORE-6; đơn nhiều kỳ.
- **Priority:** **P0** · **Dependencies:** CORE-2, CORE-12.

### CORE-10 — Danh sách đăng ký (admin, lọc, phân trang) `[✅]`

- **Persona:** AD · **Mục tiêu:** Xem & lọc mọi đơn. · **Lý do:** Xử lý theo kỳ/phòng ban.
- **AC:** Lọc kỳ/phòng ban/trạng thái; phân trang; mở chi tiết đơn.
- **Edge cases:** kỳ không có đơn (rỗng); bộ lọc không kết quả; trang cuối; số đơn lớn (hiệu năng).
- **Priority:** **P0** · **Dependencies:** AUTH-1(AD), PROF-2.

### CORE-11 — Duyệt đơn `[✅]`

- **Persona:** AD · **Mục tiêu:** Duyệt đơn hợp lệ. · **Lý do:** Chuyển sang bước mua & giao.
- **AC:** `submitted` → Duyệt → `approved` (ghi `approved_by/at`) + thông báo NV.
- **Edge cases:** duyệt đơn đã bị NV huỷ/không còn `submitted` (race) → báo "trạng thái đã đổi"; duyệt 2 lần.
- **Priority:** **P0** · **Dependencies:** CORE-10.

### CORE-12 — Từ chối kèm lý do `[✅]`

- **Persona:** AD · **Mục tiêu:** Từ chối và ghi lý do. · **Lý do:** NV biết vì sao và gửi lại.
- **AC:** Lý do **bắt buộc** → `rejected` (lưu `reject_reason`) + thông báo NV; NV gửi lại được.
- **Edge cases:** lý do rỗng → chặn; từ chối đơn không còn `submitted` (race).
- **Priority:** **P0** · **Dependencies:** CORE-10.

### CORE-13 — Điều chỉnh đặc biệt `[✅]`

- **Persona:** AD · **Mục tiêu:** Sửa số lượng/thêm món (kể cả A4). · **Lý do:** Xử lý trường hợp đặc biệt.
- **AC:** Sửa/thêm dòng, **bỏ qua** cửa sổ ngày & cấm A4; thao tác ghi **audit**.
- **Edge cases:** điều chỉnh đơn đã `delivered` một phần → chỉ dòng chưa giao **[🔶]**; thêm A4 vào đơn của NV; giảm số lượng < đã giao.
- **Priority:** **P1** · **Dependencies:** CORE-10.

### CORE-14 — Xác nhận giao từng dòng `[✅]`

- **Persona:** AD · **Mục tiêu:** Đánh dấu đã giao từng món. · **Lý do:** Theo dõi chi tiết tình trạng giao.
- **AC:** Chỉ đơn **`approved`** mới giao (BR-09); tick từng dòng (`delivered`, `delivered_qty`); mọi dòng giao → đơn `delivered` (ghi `delivered_at`).
- **Edge cases:** giao khi đơn chưa duyệt → chặn; `delivered_qty` > `quantity` → cảnh báo/chặn **[🔶]**; untick dòng đã làm đơn `delivered` → đơn về `approved`.
- **Priority:** **P0** · **Dependencies:** CORE-11.

### CORE-15 — Giao toàn bộ / hoàn tác `[✅]`

- **Persona:** AD · **Mục tiêu:** Đánh dấu cả đơn đã giao hoặc hoàn tác. · **Lý do:** Thao tác nhanh.
- **AC:** "Đã giao tất cả" → mọi dòng `delivered`, đơn `delivered` + thông báo NV; "Hoàn tác" → về `approved`.
- **Edge cases:** đơn không có dòng; hoàn tác đơn đã đóng lịch sử; đơn chưa duyệt (nút ẩn).
- **Priority:** **P1** · **Dependencies:** CORE-11.

### CORE-16 — Admin tự đăng ký VPP `[✅]`

- **Persona:** AD · **Mục tiêu:** Đăng ký như nhân viên (kể cả A4). · **Lý do:** Admin cũng có nhu cầu VPP.
- **AC:** AD dùng màn Đăng ký; được chọn A4; không bị khoá cửa sổ ngày.
- **Edge cases:** admin không có phòng ban (chỉ group admin) → đơn không gắn phòng ban (báo cáo xử lý riêng) **[🔶]**.
- **Priority:** **P2** · **Dependencies:** CORE-2, PROF-2.

---

## 4. Payment · **KHÔNG ÁP DỤNG**

> **Không có story thanh toán** — theo **BR-11**, DE-VPP không dùng giá tiền/thành tiền/ngân sách/định mức; quy trình chỉ theo _số lượng_, không có giao dịch tiền, không thu phí.
>
> **Nếu tương lai bổ sung** (đơn giá để duyệt ngân sách) → mở lại PRD; story ứng viên: _"AD nhập đơn giá món"_, _"Báo cáo có thành tiền/tổng"_, _"Định mức ngân sách/phòng ban"_. **[🔶 ngoài phạm vi hiện tại]**

---

## 5. Notification

### NOTIF-1 — Thông báo cho nhân viên `[✅]`

- **Persona:** NV · **Mục tiêu:** Được báo khi đơn đổi trạng thái. · **Lý do:** Biết kịp thời, không phải vào kiểm tra thủ công.
- **AC:** Chuông báo khi đơn **được duyệt / bị từ chối / đã giao** (kèm số chưa đọc); bấm → mở đúng đơn; đánh dấu đã đọc / đọc tất cả.
- **Edge cases:** nhiều sự kiện liên tiếp; đọc-tất-cả khi rỗng; thông báo trỏ tới đơn đã bị xoá lịch sử **[🔶]**.
- **Priority:** **P1** · **Dependencies:** CORE-11, CORE-12, CORE-15.

### NOTIF-2 — Thông báo cho admin `[✅]`

- **Persona:** AD · **Mục tiêu:** Được báo khi có đơn mới. · **Lý do:** Xử lý sớm, không bỏ sót.
- **AC:** Chuông báo mỗi khi NV gửi đơn mới.
- **Edge cases:** nhiều đơn mới cùng lúc (cân nhắc gộp) **[🔶]**; nhiều admin đều nhận.
- **Priority:** **P1** · **Dependencies:** CORE-2.

---

## 6. Admin (Quản trị hệ thống)

### ADMIN-1 — Quản lý món VPP `[✅]`

- **Persona:** AD · **Mục tiêu:** Thêm/sửa/ngừng món. · **Lý do:** Danh mục luôn cập nhật.
- **AC:** Thêm (tên, đơn vị, nhóm, `admin_only`, `max_qty=20`); sửa mọi thuộc tính; bật/tắt `active`; "Xoá" = ngừng (`active=false`) giữ lịch sử.
- **Edge cases:** ngừng món đang có trong đơn hiện hành (giữ nguyên đơn cũ); đổi `max_qty` chỉ áp cho đơn tương lai; đổi `admin_only` của A4.
- **Priority:** **P1** · **Dependencies:** AUTH-1(AD).

### ADMIN-1b — Ảnh minh hoạ cho món VPP `[✅ bổ sung sau, theo yêu cầu]`

- **Persona:** AD · **Mục tiêu:** Tải lên / đổi / gỡ ảnh của từng món. · **Lý do:** Nhân viên nhìn ảnh để chọn đúng món, đỡ nhầm giữa các món tên gần giống nhau.
- **AC:**
  1. Trong màn quản lý danh mục, mỗi món có thể gắn **một** ảnh (`image/*`, ≤5MB).
  2. Đổi ảnh và gỡ ảnh được; món không có ảnh vẫn dùng bình thường.
  3. Ảnh hiện ở **màn Đăng ký VPP** cạnh tên món, và ở bảng quản lý danh mục.
  4. Chỉ **admin** đổi được ảnh; nhân viên chỉ xem.
- **Edge cases:** ảnh sai định dạng/quá 5MB → chặn; món cũ chưa có ảnh → hiện "—"; đổi ảnh thì ảnh cũ thành mồ côi trên đĩa → **job dọn định kỳ** xoá sau ân hạn 24h (RUNBOOK §4b). **[✅]**
- **Priority:** **P2** · **Dependencies:** ADMIN-1, dịch vụ upload (CORE-3).

### ADMIN-2 — Quản lý nhóm VPP `[✅]`

- **Persona:** AD · **Mục tiêu:** Thêm/sửa nhóm (kể cả cờ "Khác"). · **Lý do:** Tổ chức danh mục hợp lý.
- **AC:** Thêm/sửa nhóm (`name`, `sort_order`, `is_other`); không xoá nhóm còn món (báo lỗi rõ).
- **Edge cases:** xoá nhóm còn món → chặn; có nhiều nhóm gắn `is_other` **[🔶]**.
- **Priority:** **P2** · **Dependencies:** ADMIN-1.

### ADMIN-3 — Danh bạ nhân viên `[✅]`

- **Persona:** AD · **Mục tiêu:** Xem danh bạ (từ Directory). · **Lý do:** Nắm đủ nhân sự theo phòng ban.
- **AC:** Bảng: tên, email, phòng ban, vai trò, trạng thái, "đã đăng nhập chưa"; phân trang/tìm kiếm.
- **Edge cases:** user chỉ ở Directory (chưa đăng nhập); user bị `disabled`; danh bạ lớn.
- **Priority:** **P2** · **Dependencies:** ADMIN-4.

### ADMIN-4 — Đồng bộ danh bạ (Directory API) `[✅]`

- **Persona:** AD/HT · **Mục tiêu:** Kéo user theo group từ PMH ID. · **Lý do:** Danh bạ đầy đủ kể cả người chưa đăng nhập.
- **AC:** Job định kỳ (~60') + nút "Đồng bộ ngay" gọi `GET /api/v1/users` (M2M) → upsert `source='directory'`.
- **Edge cases:** Directory API lỗi/timeout → giữ dữ liệu cũ + báo lỗi; cursor `events` >90 ngày → **410** → resync toàn bộ; user vừa đăng nhập vừa có trong Directory (không nhân đôi — khoá theo `sub`).
- **Priority:** **P2** · **Dependencies:** AUTH-1, Directory API (external, **[⏳]** cho PMH ID thật).

### ADMIN-5 — Nhật ký audit `[✅]`

- **Persona:** AD · **Mục tiêu:** Xem ai làm gì, khi nào. · **Lý do:** Đối soát/kiểm toán.
- **AC:** Ghi hành động (duyệt/từ chối/giao/điều chỉnh) + actor + thời điểm + chi tiết; danh sách phân trang, lọc cơ bản.
- **Edge cases:** lượng audit rất lớn (phân trang/giữ vô thời hạn); hành động của HT (webhook cập nhật) cũng ghi actor hệ thống.
- **Priority:** **P1** · **Dependencies:** CORE-11…CORE-15 (các hành động cần ghi).

### ADMIN-6 — Cấu hình thương hiệu `[⏳]`

- **Persona:** AD · **Mục tiêu:** Áp tên + logo + màu công ty. · **Lý do:** Đúng nhận diện thương hiệu.
- **AC:** Khi có tài sản → áp vào header + báo cáo Excel; trước đó dùng theme trung tính.
- **Edge cases:** chưa có logo → dùng đặt chỗ; logo sai kích thước/định dạng.
- **Priority:** **P2** · **Dependencies:** tài sản thương hiệu **[⏳]**.

### ADMIN-9 — Nhập danh mục từ Excel/CSV `[✅ bổ sung sau, theo yêu cầu]`

- **Persona:** AD · **Mục tiêu:** Nạp/cập nhật danh mục hàng loạt từ file. · **Lý do:** Gõ tay hàng trăm món trên web vừa lâu vừa dễ sai.
- **AC:** Nhận `.xlsx` và `.csv`; cột **Nhóm · Tên món · Đơn vị tính · Tối đa · Chỉ admin** (hai cột cuối không bắt buộc); **xem trước** từng dòng sẽ thêm/cập nhật/không đổi/lỗi rồi mới ghi; món trùng (nhóm + tên) được **cập nhật theo file**; nhóm chưa có thì tạo mới; ghi audit `catalog.import`.
- **Edge cases:** việc nhập **KHÔNG xoá** món nào — file thiếu món thì món đó vẫn còn; tên gõ thiếu dấu vẫn khớp món cũ (không tạo bản sao); trùng dòng trong cùng file → chỉ dòng sau báo lỗi; trùng tên với nhiều món đang có → báo lỗi, không tự đoán; món đang ngừng mà file có → **bật lại**, ghi rõ ở bảng xem trước; dòng lỗi bị bỏ qua, các dòng còn lại vẫn ghi; file dùng dấu `;` (Excel bản Việt) vẫn đọc đúng; dòng chỉ có vài ô rời rạc vẫn bị kiểm chứ không nuốt im lặng.
- **Priority:** **P1** · **Dependencies:** ADMIN-1, ADMIN-2.

### ADMIN-8 — Đổi khung ngày đăng ký `[✅ bổ sung sau, theo yêu cầu]`

- **Persona:** AD · **Mục tiêu:** Tự đổi ngày mở/đóng đăng ký trên web. · **Lý do:** Lịch mua sắm là quyết định hành chính, không nên phải chờ phát hành phần mềm.
- **AC:** Màn **Cài đặt** (`/quan-tri/cai-dat`) sửa được ngày mở/đóng (1–31, mở ≤ đóng); **xem trước** kỳ tương ứng và cửa sổ đang mở/đóng trước khi lưu; lưu xong có hiệu lực **ngay**; ghi **audit** kèm giá trị cũ; NV gọi API bị chặn 403.
- **Edge cases:** đặt ngày đóng 31 ⇒ "đến hết tháng" (tháng 2 → 28/29); đặt mở > đóng → chặn ở cả form, API và **CHECK của CSDL**; đổi khung ngày khiến NV mất quyền huỷ đơn đang mở → có cảnh báo trước khi lưu; chưa có dòng cài đặt (CSDL mới) → dùng mặc định 20→31 thay vì lỗi.
- **Priority:** **P1** · **Dependencies:** CORE-6, ADR-0013.

---

## 7. Reporting

### REPORT-1 — Tổng hợp theo món `[✅]`

- **Persona:** AD · **Mục tiêu:** Xem tổng số lượng mỗi món trong kỳ. · **Lý do:** Biết cần mua bao nhiêu.
- **AC:** Bảng gộp theo (tên món, đơn vị): tổng SL đăng ký, đã giao, số đơn; lọc theo kỳ (+ phòng ban).
- **Edge cases:** kỳ rỗng → bảng trống; cùng tên món khác đơn vị → tách dòng; loại trừ đơn `cancelled`.
- **Priority:** **P0** · **Dependencies:** CORE-2 (dữ liệu đơn).

### REPORT-2 — Xuất Excel trình ký `[✅]`

- **Persona:** AD · **Mục tiêu:** Xuất báo cáo Excel để in trình ký. · **Lý do:** Quy trình duyệt mua bằng giấy ký tay.
- **AC:** 2 sheet (Tổng hợp theo món + Chi tiết theo người); có **tiêu đề đơn vị + "Kỳ tháng M/YYYY" + ngày lập** + **khối ô chữ ký** (Người lập / Trưởng bộ phận / Ban giám đốc); có **logo** khi được cung cấp **[⏳]**.
- **Edge cases:** kỳ rỗng → file vẫn có tiêu đề + bảng trống; logo chưa có → bỏ chỗ logo; tên file `bao-cao-vpp-<kỳ>.xlsx`.
- **Priority:** **P0** · **Dependencies:** REPORT-1.

### REPORT-3 — Thống kê biểu đồ nhiều kỳ `[✅]`

- **Persona:** AD · **Mục tiêu:** Xem biểu đồ theo tháng/phòng ban. · **Lý do:** Nắm xu hướng tiêu thụ VPP.
- **AC:** Biểu đồ số đơn & số món theo tháng; theo phòng ban; tỉ lệ đã giao; chọn khoảng thời gian (from/to).
- **Edge cases:** khoảng thời gian rỗng; chỉ 1 kỳ dữ liệu; phòng ban không có đơn.
- **Priority:** **P1** · **Dependencies:** CORE-2 (dữ liệu nhiều kỳ).

---

## Phụ lục — Phi chức năng (xuyên suốt)

| ID    | Story                  | Persona | AC tóm tắt                                                                        | Edge cases                        | Priority | Deps    |
| ----- | ---------------------- | ------- | --------------------------------------------------------------------------------- | --------------------------------- | -------- | ------- |
| NFR-1 | Responsive (mobile)    | NV/AD   | Mọi màn hình dùng tốt trên điện thoại (menu thu gọn, form 1 cột, bảng cuộn ngang) | Màn nhỏ 360px; bảng nhiều cột     | **P0**   | —       |
| NFR-2 | Tiếng Việt             | NV/AD   | Toàn bộ nhãn/thông báo tiếng Việt (khung i18next)                                 | Ký tự có dấu; ngày/giờ VN         | **P0**   | —       |
| NFR-3 | Hiệu năng & phân trang | AD      | Danh sách admin phân trang; phản hồi nhanh ở tải bình thường                      | Danh sách lớn; cao điểm đầu tháng | **P1**   | CORE-10 |
| NFR-4 | Bảo mật SSO            | HT      | Không lưu mật khẩu; verify JWT offline; cookie `httpOnly`; refresh-fail ⇒ logout  | Token rotation; JWKS rotate       | **P0**   | AUTH-1  |

---

## Bảng truy vết (Nhóm ↔ Story ↔ FR/BR ↔ Priority)

| Nhóm              | Stories    | FR/BR                               | Priority          |
| ----------------- | ---------- | ----------------------------------- | ----------------- |
| 1. Authentication | AUTH-1…4   | FR-01, FR-04                        | P0×1, P1×3        |
| 2. User profile   | PROF-1…2   | FR-02, FR-05                        | P0×1, P1×1        |
| 3. Core business  | CORE-1…16  | FR-10, FR-20…24, FR-30…34, BR-01…10 | P0×11, P1×4, P2×1 |
| 4. Payment        | —          | **BR-11 (không áp dụng)**           | —                 |
| 5. Notification   | NOTIF-1…2  | FR-50                               | P1×2              |
| 6. Admin          | ADMIN-1…6  | FR-11,12, FR-03, FR-43, NFR-09      | P1×2, P2×4        |
| 7. Reporting      | REPORT-1…3 | FR-40…42                            | P0×2, P1×1        |
| Phi chức năng     | NFR-1…4    | NFR-01…04                           | P0×3, P1×1        |

> **P0** = cần cho demo chạy đúng nghiệp vụ lõi; **P1/P2** = nâng cao trải nghiệm/quản trị. Tất cả (trừ Payment) đều nằm trong MVP đã chốt.
