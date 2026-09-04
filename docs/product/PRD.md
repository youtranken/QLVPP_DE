# PRD — Website Đăng ký Văn phòng phẩm (DE-VPP)

|                |                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| **Phiên bản**  | v1.2                                                                                                       |
| **Ngày**       | 2026-08-06                                                                                                 |
| **Trạng thái** | Đã chốt yêu cầu · **Xác thực đổi sang PMH ID SSO** (xem `docs/architecture/SSO-INTEGRATION.md`)            |
| **Nguồn**      | 4 vòng phỏng vấn + 3 vòng làm rõ + phân tích `integration/` (PMH ID) + file gốc _"ĐĂNG KÝ VĂN PHÒNG PHẨM"_ |

> **⚠️ Thay đổi lớn ở v1.2 — Xác thực:** DE-VPP **tích hợp PMH ID SSO** (OIDC + Directory API + Webhook + Back-Channel Logout) thay cho tài khoản tự quản. Chi tiết ở **`docs/architecture/SSO-INTEGRATION.md`**. Phần nghiệp vụ VPP không đổi.

> **Quy ước nhãn:**
>
> - **[✅]** Đã xác nhận (bạn trả lời trực tiếp).
> - **[🔶]** Giả định của người soạn — cần xác nhận.
> - **[⏳]** Phụ thuộc — chờ bạn cung cấp tài sản (vd logo).
>
> Toàn bộ **[❓]** ở v1.0 đã được giải quyết qua 3 vòng làm rõ (xem _§14 — Nhật ký quyết định_).

---

## 1. Product overview (Tổng quan sản phẩm)

**DE-VPP** là website nội bộ giúp **nhân viên đăng ký văn phòng phẩm (VPP) theo tháng** và **quản trị viên (admin) duyệt – tổng hợp – xác nhận đã giao – xuất báo cáo trình ký**. Thay thế quy trình Google Form + Google Sheet. **[✅]**

- Quy mô: **≤ 500 người dùng**, một công ty, vài phòng ban. **[✅]**
- **Đăng nhập qua PMH ID SSO** (OIDC); không tự quản mật khẩu. Ngoài PMH ID, không tích hợp bên thứ ba khác. **[✅]**
- Dùng tốt trên **cả máy tính và điện thoại** (responsive). **[✅]**
- Ưu tiên **demo trên Docker** trước (dùng **mock OIDC** thay PMH ID khi chưa có credential); môi trường thật quyết định sau. **[✅]**

---

## 2. Problem statement (Vấn đề cần giải quyết)

Quy trình hiện tại (Google Form + Google Sheet) hạn chế **[🔶 suy ra từ bối cảnh — cần xác nhận mức ưu tiên]**:

- Không tự ràng buộc **quy tắc đăng ký** (khung ngày đăng ký, cấm A4 với nhân viên, giới hạn ≤ 20/món).
- **Tổng hợp & báo cáo trình ký** làm thủ công, dễ sai.
- Thiếu **luồng duyệt** và **theo dõi tình trạng giao**.
- Không **phân quyền / thông báo / nhật ký**.

Mục tiêu: đưa toàn bộ quy trình lên web có ràng buộc nghiệp vụ, phân quyền, duyệt, xác nhận giao, thông báo và báo cáo tự động.

---

## 3. Target users (Người dùng mục tiêu)

| Nhóm                     | Mô tả                                                                                    | Nguồn    |
| ------------------------ | ---------------------------------------------------------------------------------------- | -------- |
| **Nhân viên**            | Người cần nhận VPP hằng tháng; tự đăng ký cho bản thân.                                  | **[✅]** |
| **Admin (Quản trị VPP)** | Phụ trách VPP — duyệt, tổng hợp, giao, báo cáo, quản trị. Cũng tự đăng ký như nhân viên. | **[✅]** |

- Không có **trưởng phòng** / **bộ phận kho**. **[✅]**
- **Danh tính đến từ PMH ID** (không tạo/import tài khoản trong app). Vai trò **admin** = thành viên group **`VPP-Admin`**; còn lại **member**. **Phòng ban lấy từ `groups`** PMH ID. Danh bạ (kể cả người chưa đăng nhập) đồng bộ qua **Directory API**. **[✅]**

---

## 4. User personas (Chân dung người dùng)

> Vai trò là **[✅]**; **chi tiết nhân khẩu học/kỹ năng dưới đây là [🔶]** (minh hoạ định hướng thiết kế).

### 4.1 Nhân viên — "Chị Lan, Chuyên viên Kinh doanh" **[🔶]**

- **Mục tiêu:** đăng ký nhanh vài món đầu tháng, biết khi nào được giao; thường thao tác **trên điện thoại**.
- **Khó khăn:** hay quên hạn đăng ký; muốn biết đơn đã duyệt/giao chưa.
- **Kỳ vọng:** tiếng Việt, đơn giản, mượt trên mobile, có thông báo trạng thái.

### 4.2 Admin — "Anh Minh, Nhân viên Hành chính" **[🔶]**

- **Mục tiêu:** tổng hợp nhu cầu, duyệt đơn, xác nhận giao, xuất báo cáo trình ký.
- **Khó khăn:** gộp số liệu thủ công tốn thời gian; khó theo dõi đơn đã giao.
- **Kỳ vọng:** danh sách lọc được, tổng hợp tự động, một nút xuất Excel, đánh dấu giao dễ.

---

## 5. User journeys (Hành trình người dùng)

### 5.1 Nhân viên đăng ký VPP **[✅]**

1. **Đăng nhập qua PMH ID SSO** (bấm "Đăng nhập" → chuyển sang PMH ID → quay lại app).
2. Thấy trạng thái kỳ hiện tại (đang mở hay đã đóng, kèm khung ngày đang áp dụng).
3. **Đăng ký VPP**: chọn món theo nhóm → nhập số lượng (≤ 20/món). A4 **khoá** với nhân viên. Mục **"Khác"**: nhập tự do + **đính kèm ảnh**.
4. **Gửi đơn** (mỗi kỳ 1 đơn hiệu lực; gửi rồi **không tự sửa**). Có thể **huỷ** khi _chưa duyệt_ & còn trong khung ngày đăng ký.
5. Nhận **thông báo (chuông)** khi admin **duyệt / từ chối / đã giao**.
6. Nếu **bị từ chối**: xem **lý do** → **gửi lại** đơn mới trong kỳ.

### 5.2 Admin xử lý & báo cáo **[✅]**

1. Nhận thông báo **đơn mới**.
2. Xem **danh sách đăng ký** (lọc kỳ/phòng ban/trạng thái).
3. **Duyệt** hoặc **Từ chối kèm lý do**.
4. **Điều chỉnh đặc biệt** (sửa số lượng, thêm món kể cả **A4**).
5. Sau khi mua: **xác nhận đã giao** theo **từng dòng** / **toàn bộ** (chỉ với đơn **đã duyệt**).
6. Xem **tổng hợp theo món** → **xuất Excel** trình ký.
7. Xem **thống kê nhiều kỳ (biểu đồ)** + **nhật ký audit**.
8. Quản trị: **danh mục VPP**; xem **danh bạ nhân viên** (đồng bộ từ PMH ID qua Directory).

---

## 6. Functional requirements (Yêu cầu chức năng) — tất cả **[✅]** trừ ghi chú

### 6.1 Xác thực & danh tính (qua PMH ID SSO)

- **FR-01** **Đăng nhập qua PMH ID (OIDC)**; app không có trang nhập mật khẩu riêng. Đăng xuất **local** (khỏi VPP) và **toàn hệ** (khỏi PMH ID).
- **FR-02** **Map `groups` → vai trò**: có `VPP-Admin` ⇒ `admin`, ngược lại `member`. **Phòng ban** suy ra từ `groups`.
- **FR-03** **Đồng bộ danh bạ** qua **Directory API** (M2M): hiển thị cả nhân viên **chưa từng đăng nhập** để tổng hợp theo phòng ban.
- **FR-04** **Đá user tức thì** khi bị khoá/xoá/đổi nhóm/logout toàn hệ (**Webhook** + **Back-Channel Logout**); refresh token thất bại ⇒ tự đăng xuất.
- **FR-05** Tham chiếu user nội bộ bằng **`sub`** của PMH ID (không dùng email làm khoá). _(Không còn tạo/import tài khoản hay quản lý mật khẩu trong app.)_
- **FR-06** **Lối thoát "Đăng nhập bằng tài khoản khác"** ở trang chặn quyền: kết thúc phiên SSO tại PMH ID rồi quay về trang đăng nhập. Không có lối này, người bị gỡ nhóm/khoá mà phiên SSO còn sống sẽ **kẹt vòng lặp** `access_denied` — bấm đăng nhập lại là lại bị chặn, vì PMH ID xác thực im lặng bằng chính phiên cũ. **[⏳ bổ sung sau khi cắm PMH ID thật]**

### 6.2 Danh mục VPP

- **FR-10** Xem danh mục theo **nhóm**; mục **"Khác"** cho nhập tự do.
- **FR-11** Admin **thêm/sửa/ngừng (xoá)** món & nhóm.
- **FR-12** Mỗi món có **đơn vị tính**, cờ **chỉ-admin** (A4), **giới hạn ≤ 20**.
- **FR-13** Admin **tải lên / đổi / gỡ ảnh minh hoạ** cho từng món; nhân viên thấy ảnh khi chọn món lúc đăng ký. **[✅ bổ sung sau theo yêu cầu]**

### 6.3 Đăng ký (đơn)

- **FR-20** Đăng ký chọn món + số lượng; mục "Khác" + **đính kèm ảnh**.
- **FR-21** Chỉ đăng ký trong **khung ngày** do admin đặt (mặc định **ngày 20 đến hết tháng**); cửa sổ phục vụ **kỳ tháng kế tiếp**.
- **FR-22** **Mỗi kỳ 1 đơn hiệu lực/người**; gửi 1 lần, **không tự sửa**.
- **FR-23** Nhân viên **huỷ** đơn khi **chưa duyệt (`submitted`)** _và_ **còn trong khung ngày đăng ký**.
- **FR-24** Xem **đơn của mình** + trạng thái + **lịch sử theo kỳ**.
- **FR-25** **Tìm món** trong danh mục (gõ không dấu vẫn ra) và **dùng lại đơn cũ** khi đăng ký. **[✅ bổ sung sau theo yêu cầu]**
- **FR-26** Xem **dòng thời gian đơn**: gửi lúc nào, ai duyệt, giao khi nào. **[✅ bổ sung sau theo yêu cầu]**

### 6.4 Duyệt & giao (Admin)

- **FR-30** **Duyệt** đơn.
- **FR-31** **Từ chối kèm lý do**; nhân viên **gửi lại** được.
- **FR-32** **Điều chỉnh đặc biệt** (sửa SL, thêm món kể cả A4).
- **FR-33** **Xác nhận đã giao** theo **từng dòng** / **toàn bộ** — **chỉ đơn đã duyệt**.
- **FR-34** Admin **đăng ký VPP như nhân viên** (kể cả A4).
- **FR-35** Admin **nhập đơn hộ** một nhân viên; đơn đứng tên người đó, nhật ký ghi ai nhập hộ và người đó được thông báo. **[✅ bổ sung sau theo yêu cầu]**
- **FR-36** **Duyệt hàng loạt** nhiều đơn một lượt, vẫn ghi nhật ký từng đơn. **[✅ bổ sung sau theo yêu cầu]**
- **FR-37** **Tìm nhanh** đơn theo mã đơn hoặc tên người đăng ký. **[✅ bổ sung sau theo yêu cầu]**

### 6.5 Tổng hợp, báo cáo, thống kê

- **FR-40** **Tổng hợp theo món** trong kỳ.
- **FR-41** **Xuất Excel** báo cáo tháng, gồm: 2 sheet _(Tổng hợp theo món + Chi tiết theo người)_ **+ tiêu đề đơn vị/kỳ/ngày lập + ô chữ ký (Người lập / Trưởng bộ phận / Ban giám đốc) + logo công ty** _(logo:_ **[⏳]** _chờ bạn cung cấp)_.
- **FR-42** **Thống kê nhiều kỳ** bằng **biểu đồ** (theo tháng, theo phòng ban).
- **FR-43** **Nhật ký audit**: ai duyệt/từ chối/giao và thời điểm.
- **FR-48** **Phiếu phát hàng in được** theo phòng ban: từng người, từng món, cột ký nhận. **[✅ bổ sung sau theo yêu cầu]**
- **FR-44** Admin **tự đổi khung ngày đăng ký** trên web (màn Cài đặt), có xem trước ảnh hưởng và ghi audit. **[✅ bổ sung sau theo yêu cầu]**
- **FR-45** Admin **nhập danh mục hàng loạt** từ Excel/CSV, có **xem trước** từng dòng trước khi ghi; không xoá món nào. **[✅ bổ sung sau theo yêu cầu]**
- **FR-46** Mỗi món có **mã** do admin đặt (không bắt buộc, không trùng nhau). **[✅ bổ sung sau theo yêu cầu]**
- **FR-47** **Trang chủ** hiện (với admin) **danh sách đăng ký theo từng món** của các phòng ban (STT, mã món, số lượng, người đăng ký, phòng ban, trạng thái); bấm vào dòng để mở đơn và duyệt. **[✅ bổ sung sau theo yêu cầu]**

### 6.6 Thông báo

- **FR-50** **Thông báo trong app (chuông)**: nhân viên khi **duyệt/từ chối/đã giao**; admin khi có **đơn mới**.

### 6.7 Phân quyền

- **FR-60** Kiểm soát truy cập theo **vai trò** (member/admin) ở phía máy chủ.

---

## 7. Non-functional requirements (Yêu cầu phi chức năng)

- **NFR-01 Hiệu năng [✅ hướng]:** thiết kế **dư tải** (index, phân trang, connection pool). Không có số cao điểm cụ thể (thiết kế chắc chắn thay vì đo). Mục tiêu mềm **[🔶]**: thao tác thường < 1s ở tải bình thường.
- **NFR-02 Bảo mật [✅]:** xác thực qua **PMH ID SSO (OIDC + PKCE)**; **không lưu mật khẩu** trong app; verify JWT offline (JWKS); mẫu **BFF** giữ token ở server; cookie phiên `httpOnly`/`sameSite=lax` (prod `secure`), **phiên 7 ngày**; refresh-fail ⇒ đăng xuất. _(MFA/khoá tài khoản do PMH ID quản.)_
- **NFR-03 Ngôn ngữ [✅]:** giao diện **tiếng Việt**.
- **NFR-04 Responsive [✅]:** dùng tốt trên **máy tính và điện thoại** (web responsive, không cần app native).
- **NFR-05 Triển khai [✅]:** đóng gói **Docker**; môi trường thật (on-prem/cloud/VPS) chốt ở M6.
- **NFR-06 Tích hợp [✅]:** phụ thuộc **PMH ID** cho xác thực/danh bạ (OIDC + Directory + Webhook + BCL). Ngoài PMH ID, không tích hợp bên thứ ba khác. Chi tiết: `docs/architecture/SSO-INTEGRATION.md`.
- **NFR-07 Lưu trữ [✅]:** giữ **đơn & nhật ký vô thời hạn**.
- **NFR-08 Sao lưu [🔶]:** sao lưu CSDL định kỳ (chi tiết ở tài liệu vận hành prod — cần duyệt).
- **NFR-09 Thương hiệu [⏳]:** áp **tên hệ thống + logo + màu** do bạn cung cấp; trước khi có, dùng giao diện trung tính đặt chỗ.

---

## 8. Business rules (Quy tắc nghiệp vụ) — tất cả **[✅]**

| Mã        | Quy tắc                                                                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BR-01** | Khung ngày đăng ký do **admin cấu hình** (mặc định **ngày 20 đến hết tháng**), khoá cứng với nhân viên; đăng ký trong cửa sổ tính cho **tháng kế tiếp**. |
| **BR-02** | Kỳ theo **tháng** (`YYYY-MM`).                                                                                                                           |
| **BR-03** | Nhân viên **không đăng ký A4**; admin được.                                                                                                              |
| **BR-04** | **Mỗi món ≤ 20**.                                                                                                                                        |
| **BR-05** | Mục **"Khác"**: nhập tự do + **đính kèm ảnh**.                                                                                                           |
| **BR-06** | **1 đơn hiệu lực/người/kỳ**; đơn từ chối/huỷ giữ làm lịch sử, cho gửi lại.                                                                               |
| **BR-07** | Gửi rồi **không tự sửa** (chỉ huỷ theo FR-23, hoặc admin điều chỉnh).                                                                                    |
| **BR-08** | Vòng đời: `submitted → approved → delivered` \| `submitted → rejected` \| `submitted → cancelled`.                                                       |
| **BR-09** | **Chỉ giao sau khi đã duyệt** (bắt buộc).                                                                                                                |
| **BR-10** | Admin **bỏ qua** ràng buộc cửa sổ ngày & cấm A4 (điều chỉnh đặc biệt).                                                                                   |
| **BR-11** | **Không giá tiền**; báo cáo chỉ số lượng.                                                                                                                |
| **BR-12** | **Không định mức** phòng ban/ngân sách.                                                                                                                  |

---

## 9. Roles and permissions (Vai trò & phân quyền)

| Chức năng                       | Member | Admin |
| ------------------------------- | :----: | :---: |
| Đăng nhập (PMH ID SSO)          |   ✅   |  ✅   |
| Đăng ký VPP (không A4)          |   ✅   |  ✅   |
| Đăng ký **A4**                  |   ❌   |  ✅   |
| Đính kèm ảnh mục "Khác"         |   ✅   |  ✅   |
| Xem đơn của mình + lịch sử      |   ✅   |  ✅   |
| Nhận thông báo (chuông)         |   ✅   |  ✅   |
| Xem tất cả đơn / lọc            |   ❌   |  ✅   |
| **Duyệt / Từ chối**             |   ❌   |  ✅   |
| **Xác nhận đã giao**            |   ❌   |  ✅   |
| Điều chỉnh đơn (đặc biệt)       |   ❌   |  ✅   |
| Tổng hợp + **Xuất Excel**       |   ❌   |  ✅   |
| Thống kê / Audit                |   ❌   |  ✅   |
| Quản lý danh mục VPP            |   ❌   |  ✅   |
| Xem danh bạ (đồng bộ Directory) |   ❌   |  ✅   |

---

## 10. MVP scope (Phạm vi bản demo đầu tiên) — **[✅] làm đầy đủ**

Toàn bộ chức năng đã chốt: **đăng nhập PMH ID SSO** (đầy đủ: OIDC + Directory + Webhook + BCL; demo dùng **mock OIDC**) · danh mục VPP (+ "Khác" + ảnh) · đăng ký theo kỳ (BR-01…BR-07) · duyệt/từ chối/điều chỉnh · xác nhận giao (dòng + toàn bộ) · tổng hợp + xuất Excel · thông báo chuông · audit + thống kê biểu đồ · **responsive** · dữ liệu mẫu · chạy **Docker Compose**.

---

## 11. Out-of-scope (Ngoài phạm vi)

- **Tự quản tài khoản/mật khẩu trong app** (đã chuyển sang **PMH ID SSO**). **[✅ loại trừ]**
- **Tạo/import tài khoản** thủ công (danh tính đến từ PMH ID; danh bạ qua Directory API). **[✅ loại trừ]**
- **2FA / OTP tự làm** (do **PMH ID** đảm nhận). **[✅ loại trừ]**
- Tích hợp Email / Zalo / Teams / Google Sheet / ERP / kế toán. **[✅ loại trừ]**
- Vai trò **trưởng phòng** & **bộ phận kho**. **[✅ loại trừ]**
- **Giá tiền / ngân sách / định mức**. **[✅ loại trừ]**
- **App di động native** (đã dùng web responsive thay thế). **[✅ loại trừ]**
- **Chữ ký số / phê duyệt điện tử** trên báo cáo (chỉ Excel để in ký tay). **[✅ loại trừ]**

---

## 12. Success metrics (Chỉ số thành công) — **[✅] đã chốt dùng bộ này**

1. ≥ 90% đơn đăng ký thực hiện qua web (thay Google Form) sau 2 kỳ.
2. Thời gian admin lập báo cáo tháng **< 10 phút**.
3. ≥ 95% đơn hợp lệ ngay nhờ ràng buộc tự động (đúng cửa sổ, đúng giới hạn).
4. 100% đơn có trạng thái **đã giao** được ghi nhận rõ trong kỳ.
5. Không mất dữ liệu đơn; audit đầy đủ mọi thao tác duyệt/giao.

---

## 13. Risks (Rủi ro)

| Rủi ro                                                           | Ảnh hưởng                                  | Giảm thiểu                                                                                            |
| ---------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **Khoá cứng khung ngày** không thao tác được ngoài cửa sổ.       | Nhân viên không đăng ký được ngoài cửa sổ. | Admin bỏ qua để xử lý đặc biệt, và **tự đổi được khung ngày** ở màn Cài đặt (FR-44). **[✅]**         |
| **Cao điểm đầu tháng** (số chưa rõ).                             | Có thể chậm.                               | Thiết kế dư tải. **[✅]** — không có số để test tải.                                                  |
| **Logo/tên/màu** chưa có.                                        | Chưa hoàn thiện thương hiệu & báo cáo.     | Dùng đặt chỗ trung tính; áp khi bạn cung cấp. **[⏳]**                                                |
| **Phụ thuộc PMH ID** (chưa có client_id/secret; host chưa chốt). | Chưa tích hợp SSO thật khi demo.           | Demo bằng **mock OIDC**; đổi sang PMH ID chỉ bằng cấu hình. Xin credential + chốt host ở M6. **[✅]** |
| **Map group→vai trò/phòng ban** phụ thuộc cách PMH ID đặt group. | Sai vai trò/phòng ban nếu tên group lệch.  | Cấu hình qua env (`VPP_ADMIN_GROUP`…); xác minh với admin PMH ID khi lên prod. **[🔶]**               |
| **Môi trường thật chưa chốt**.                                   | Ảnh hưởng cấu hình prod & mạng EDGE.       | Chốt ở M6; demo Docker không ảnh hưởng. **[✅]**                                                      |

---

## 14. Nhật ký quyết định (các câu hỏi mở v1.0 → đã giải quyết)

| #   | Câu hỏi mở (v1.0)          | Kết luận                                                                                 |
| --- | -------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | Mẫu Excel trình ký         | 2 sheet + **tiêu đề đơn vị/kỳ/ngày** + **ô chữ ký** + **logo**. **[✅]** (logo **[⏳]**) |
| 2   | Buộc đổi mật khẩu lần đầu  | **Không**. **[✅]**                                                                      |
| 3   | Chính sách mật khẩu/phiên  | **≥ 8 ký tự, phiên 7 ngày**. **[✅]**                                                    |
| 4   | Điều kiện huỷ đơn          | **Chưa duyệt & còn trong khung ngày đăng ký**. **[✅]**                                  |
| 5   | Giao có bắt buộc sau duyệt | **Có, bắt buộc**. **[✅]**                                                               |
| 6   | Hỗ trợ mobile              | **Cần dùng tốt trên điện thoại** (responsive). **[✅]**                                  |
| 7   | Số cao điểm                | **Không rõ → thiết kế dư tải**. **[✅]**                                                 |
| 8   | Success metrics            | **Dùng bộ đề xuất (§12)**. **[✅]**                                                      |
| 9   | Thời gian lưu trữ          | **Vô thời hạn**. **[✅]**                                                                |
| 10  | Tên/logo/màu thương hiệu   | **Bạn sẽ cung cấp**. **[⏳]**                                                            |

**Quyết định XÁC THỰC (v1.2 — sau khi đọc `integration/`):**

| #   | Chủ đề                   | Kết luận                                                   |
| --- | ------------------------ | ---------------------------------------------------------- |
| 11  | Mô hình xác thực         | **PMH ID SSO (OIDC)** thay tài khoản riêng. **[✅]**       |
| 12  | Mức tích hợp             | **Đầy đủ**: OIDC + Directory API + Webhook + BCL. **[✅]** |
| 13  | Ai được vào app          | **Mọi nhân viên** (`allow_all_groups`). **[✅]**           |
| 14  | Vai trò admin            | Group **`VPP-Admin`**. **[✅]**                            |
| 15  | Phòng ban                | Lấy từ **`groups`** PMH ID. **[✅]**                       |
| 16  | Nguồn đăng nhập khi demo | **Mock OIDC** (chưa có credential PMH ID). **[✅]**        |
| 17  | Vị trí host              | **Chưa chốt** → demo local; chốt ở M6. **[⏳]**            |

**Phụ thuộc còn lại (không chặn thiết kế demo):**

- Tên hệ thống + **logo** + màu thương hiệu (áp ở M4). **[⏳]**
- **client_id/secret + webhook_secret** từ admin PMH ID, và **vị trí host** (redirect/webhook/BCL URI) — chỉ cần khi ghép PMH ID thật (M6). **[⏳]**

---

_Tài liệu liên quan:_ `docs/architecture/SDD.md` (kiến trúc, schema, API, màn hình) · **`docs/architecture/SSO-INTEGRATION.md`** (thiết kế xác thực PMH ID). Lựa chọn **công nghệ** nằm ở các tài liệu đó, không thuộc PRD này.
