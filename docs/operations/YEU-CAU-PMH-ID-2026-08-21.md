# Yêu cầu gửi admin PMH ID — DE-VPP (21/08/2026)

> Phiếu bổ sung, đi sau `ONBOARDING-PMH-ID.md`. Client đăng nhập **đã được cấp và
> đang chạy tốt**; phiếu này chỉ xin những thứ còn thiếu để hoàn tất tích hợp.
>
> Người gửi: nhóm DE-VPP · Ngày: 21/08/2026 (bản 2)
> Client hiện có: `client_vpp` · Host: `https://de-vpp.pmh.com.vn:8443`
> Issuer đang dùng: `https://de-admin.pmh.com.vn:8443/oidc`
>
> **Bản 2 khác bản 1 ở đâu:** bọn em đã đọc mã nguồn `sso-server`, nên ba mục dưới
> đây được viết lại cho đúng cơ chế thật, và bỏ hẳn một câu hỏi đã tự trả lời được.

---

## 0. Hiện trạng — cái gì đã chạy

Nghiệm thu bằng tài khoản thật `huuthong@pmh.com.vn` trong ngày 21/08/2026:

| Hạng mục                                   | Kết quả                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| Discovery                                  | HTTP 200, `issuer` khớp từng ký tự với `OIDC_ISSUER`                                  |
| Chứng chỉ TLS                              | Tin cậy được, không cần CA phụ                                                        |
| Đăng nhập (Authorization Code + PKCE S256) | **Đạt**                                                                               |
| Claim nhận được                            | `sub` (UUID), `email`, `full_name`, `employee_code`, `department`, `groups`           |
| Ánh xạ nhóm → vai trò                      | **Đạt** — nhóm `Test_VPP` ra `role=admin`                                             |
| SSO liên app                               | **Đạt** — đăng nhập ở Cổng PMH ID rồi vào DE-VPP là vào thẳng, không hỏi lại mật khẩu |
| Nghiệp vụ trọn vòng                        | **Đạt** — gửi đơn → duyệt → điều chỉnh → giao, nhật ký ghi đúng người thao tác        |

**Bốn URI phía DE-VPP đều mount đúng route** (phép thử theo `edge-va-luong-hoat-dong.md` §5:
404 = sai route, 400/200 = đúng route):

```
GET  https://de-vpp.pmh.com.vn:8443/                              -> 200
GET  https://de-vpp.pmh.com.vn:8443/api/auth/callback             -> 302
POST https://de-vpp.pmh.com.vn:8443/api/webhooks/pmh-id           -> 400  {"code":"VALIDATION","message":"Thiếu nội dung."}
POST https://de-vpp.pmh.com.vn:8443/api/auth/backchannel-logout   -> 400  {"message":"logout_token không hợp lệ"}
```

Không URI nào trả 404 ⇒ phía app không sai đường dẫn.

---

## 1. Đăng xuất toàn hệ trả 400 ở bước xác nhận — xin xem log phía PMH ID

**Đây KHÔNG phải lỗi thiếu đăng ký URL.** Bản 1 của phiếu này nghi
`post_logout_redirect_uri` chưa được khai; đọc mã nguồn thì thấy nghi sai:
`oidc/pg-adapter.ts:97` tự suy ra nó từ trường `app_url` của client, nên
`client_vpp` đã có sẵn `https://de-vpp.pmh.com.vn:8443`.

**Request DE-VPP gửi lên — đã đối chiếu từng tham số với `docs/integration/README.md` §4.5:**

```
GET https://de-admin.pmh.com.vn:8443/oidc/logout
      ?post_logout_redirect_uri=https%3A%2F%2Fde-vpp.pmh.com.vn%3A8443   (khớp app_url, KHÔNG dấu / cuối)
      &client_id=client_vpp
      &id_token_hint=<JWT 898 ký tự>
```

**Tách hai bước ra đo riêng thì thấy lỗi nằm ở bước sau:**

```
GET  /oidc/logout?...(đủ 3 tham số)  -> 200   render form tự-submit, có action=/oidc/logout/confirm + field xsrf
POST /oidc/logout/confirm            -> 400   trang "Có lỗi xảy ra — Vui lòng đăng nhập lại"
```

Bước GET chấp nhận cả `id_token_hint` lẫn `post_logout_redirect_uri`. Chỉ bước POST
xác nhận là hỏng. Tái hiện **3/3 lần** (10:52, 12:09, 15:43 ngày 21/08/2026) trên
trình duyệt thường, không phải trục trặc nhất thời.

**Hệ quả:** phiên bị huỷ ở cả hai phía (đăng xuất vẫn có tác dụng thật), nhưng người
dùng bị bỏ lại ở trang lỗi của PMH ID thay vì được đưa về DE-VPP.

> **Nhờ anh/chị:** xin dòng log của `sso-server` ở thời điểm
> `POST /oidc/logout/confirm` (khoảng 15:43 ngày 21/08, client `client_vpp`).
> Trang lỗi không nói lý do nên bọn em không lần tiếp được từ ngoài. Nghi ngờ hiện
> tại là trạng thái phiên logout không tìm thấy ở bước xác nhận, nhưng chỉ log phía
> PMH ID mới xác nhận được.

---

## 2. Directory API và Webhook — hai thứ chưa bật được

### 2a. Xin **bật cờ `m2m_enabled`** cho `client_vpp` (Directory API)

Bản 1 xin "cấp thêm một cặp client id/secret M2M" — nói vậy chưa đúng cơ chế.
`oidc/pg-adapter.ts:83` cho thấy `client_credentials` **chỉ được cấp cho client có cờ
`m2m_enabled`**, không mặc định mở cho mọi client có secret:

```ts
// M3: chỉ cấp M2M (Directory API) cho client được bật cờ — không mặc định mở
// cho mọi client có secret.
if (c.m2m_enabled) {
  grantTypes.push('client_credentials');
}
```

Nên đề nghị: **bật `m2m_enabled` cho `client_vpp`** (dùng luôn client hiện có), hoặc
cấp client M2M riêng nếu quy chế bên mình muốn tách. Kiểu nào cũng được, chỉ cần cho
bọn em biết để điền đúng `PMH_M2M_CLIENT_ID` / `PMH_M2M_CLIENT_SECRET`.

~~**Hiện trạng:** đang dùng giá trị dev nên bị từ chối đúng như phải thế:~~

```
POST /oidc/token (client_credentials) -> 401 {"error":"invalid_client"}   (21/08)
```

> ✅ **XONG — đo lại 03/09/2026.** `m2m_enabled` đã được bật cho `client_vpp`:
>
> ```
> POST /oidc/token (client_credentials)  -> 200, có access_token
> GET  /api/v1/groups                    -> 200
> GET  /api/v1/users                     -> 200
> ```
>
> Cảm ơn anh/chị. Không cần làm gì thêm ở mục này.

**Hệ quả còn lại:** danh bạ hiện chỉ trả về **một** bản ghi (`huuthong@pmh.com.vn`) —
đúng như phải thế, vì client mới được gán một nhóm. Khi §3c xong (có nhóm truy cập
cho nhân viên thường) thì DE-VPP mới lên trước được danh sách nhân viên.

### 2b. Xin **khai `webhook_url`** cho `client_vpp` — hiện CHƯA hề được khai

**Giá trị cần khai:**

```
https://de-vpp.pmh.com.vn:8443/api/webhooks/pmh-id
```

**Vì sao xin:** đối chiếu bản đăng ký client của `client_vpp` thì thấy chỉ có **ba**
URI — `redirect_uris`, `app_url`, `backchannel_logout_uri`. **Không có `webhook_url`.**
Mục 15 trong phiếu onboarding gốc đã khai giá trị này, nhưng nó không có mặt trong
bản đăng ký thực tế.

**Hệ quả:** dù có cấp `PMH_WEBHOOK_SECRET` thật thì webhook vẫn không chạy — PMH ID
không biết gọi về đâu. Các sự kiện `user.locked/unlocked/deleted/groups_changed/`
`password_changed` sẽ không tới được DE-VPP, nên người bị khoá vẫn dùng app cho tới
khi phiên hết hạn.

Phía DE-VPP endpoint đã sẵn sàng — gọi thử cho thấy đúng route, không phải 404:

```
POST https://de-vpp.pmh.com.vn:8443/api/webhooks/pmh-id
-> 400 {"code":"VALIDATION","message":"Thiếu nội dung."}
```

### 2c. Xin `PMH_WEBHOOK_SECRET` thật

Để bật xác thực chữ ký **HMAC-SHA256 v2** trên `${timestamp}.${body}` — app **không**
nhận v1. Hiện đang dùng giá trị dev `dev-webhook-secret-change-me`.

> Lưu ý thứ tự: **2b trước 2c**. Có secret mà chưa khai URL thì webhook vẫn im lặng
> không chạy, và rất khó nhận ra vì không có lỗi nào hiện ra ở cả hai phía.

---

## 3. Xin chốt nhóm và phòng ban

### 3a. Nhóm quyết định quyền quản trị — 🔶 **lập rồi nhưng CHƯA GÁN CHO CLIENT**

Anh/chị báo đã lập nhóm `VPP-Admin` — cảm ơn. Nhưng đo lại ngày **03/09/2026** thì
DE-VPP **vẫn chưa thấy nhóm đó**, nên phần cấu hình bên bọn em phải để nguyên
`VPP_ADMIN_GROUP=Test_VPP`.

Hai lệnh dưới đây gọi bằng chính token M2M của `client_vpp`:

```
GET /api/v1/groups
-> [{"id":"0fb2236f-4a4f-4be1-9bb0-e9cc0e1c15b1","name":"Test_VPP"}]     ← chỉ MỘT nhóm

GET /api/v1/users
-> huuthong@pmh.com.vn | active | ["Test_VPP"]                           ← chưa có VPP-Admin
```

Suy ra: nhóm đã **tồn tại trong PMH ID**, nhưng chưa được **gán cho client
`client_vpp`** (và/hoặc `huuthong@` chưa là thành viên). Nhóm không gán cho client
thì không lọt vào claim `groups`; app đọc không thấy tên đó ⇒ nếu bọn em cứ đổi
sang `VPP-Admin` thì kết quả là **không còn ai là quản trị viên**.

> **Nhờ anh/chị hai việc:**
>
> 1. **Gán nhóm `VPP-Admin` cho client `client_vpp`.**
> 2. **Thêm `huuthong@pmh.com.vn` vào nhóm đó** (tài khoản dùng để nghiệm thu).
>
> Xong thì bọn em chạy lại `GET /api/v1/groups`; thấy `VPP-Admin` trong danh sách là
> đổi một dòng cấu hình, không phải sửa code, không phải triển khai lại.
>
> Và cho biết nhóm `Test_VPP` nay dùng vào việc gì — nếu giữ lại làm **nhóm truy
> cập** (được vào app, không có quyền quản trị) thì đúng ý bọn em muốn ở **§3c**.

### 3b. Phòng ban của tài khoản

Claim `department` **có hoạt động** — đo được ngày 21/08, tài khoản
`huuthong@pmh.com.vn` trả về `Dept_Test_VPP`. (Bản 1 hỏi "PMH ID có thực sự phát
claim này không" — đã tự trả lời, bỏ câu hỏi đó.)

Đọc mã nguồn thì thấy `oidc/provider.factory.ts:82,101` lấy thẳng cột `users.department`,
và có sẵn `DepartmentsModule` với API `admin/departments` để quản lý danh sách tên.
Nghĩa là `Dept_Test_VPP` là **tên phòng ban do admin đặt cho tài khoản**, sửa được
ngay trong cổng quản trị.

> **Nhờ anh/chị:** đổi `department` của `huuthong@pmh.com.vn` sang **tên phòng ban
> thật** (dạng tiếng Việt đọc được, ví dụ `Kỹ thuật`). Chuỗi này hiện **thẳng cho
> người dùng** ở màn duyệt đơn và trong báo cáo Excel trình ký, nên để `Dept_Test_VPP`
> thì khó đọc.
>
> Và cho biết danh sách **tên phòng ban chuẩn** bên PMH ID, để DE-VPP dùng đúng bộ
> tên đó thay vì tự bịa.

### 3c. Xin một nhóm TRUY CẬP tách khỏi nhóm quản trị

Nay đã có `VPP-Admin` (§3a), còn thiếu vế kia: nhóm cho **nhân viên thường**.

Cách PMH ID gác cửa là theo nhóm được gán cho client — ai không thuộc nhóm nào của
`client_vpp` thì bị `access_denied` ngay ở callback. Nếu nhóm duy nhất được gán cũng
chính là nhóm quản trị, thì **thêm một nhân viên vào đó cho họ vào được app là vô
tình cấp luôn quyền quản trị**: thấy mọi đơn của mọi người, duyệt được, sửa được
danh mục. Không có cách nào phân biệt ở phía DE-VPP, vì cả hai vế đều đọc từ cùng
một danh sách `groups`.

> **Nhờ anh/chị:** gán cho `client_vpp` **hai** nhóm —
>
> - `VPP-User` (hoặc giữ luôn `Test_VPP` nếu bên mình muốn dùng lại tên đó): quyền
>   **vào app**, không có quyền quản trị. Đây là nhóm để thêm nhân viên thường.
> - `VPP-Admin`: quyền **quản trị**, chỉ vài người.
>
> Phía DE-VPP không phải sửa gì — `VPP_ADMIN_GROUP` đã trỏ `VPP-Admin`, mọi nhóm
> khác tự động ra `role=member`. **Việc này đang chặn** bọn em thêm nhân viên thường
> vào hệ thống, nên xin ưu tiên hơn các mục còn lại.

---

## 4. Xin xoay lại `client_secret` của `client_vpp`

`client_secret` hiện tại đã bị chia sẻ qua ảnh chụp màn hình trong quá trình hỗ trợ
kỹ thuật, tức đã ra khỏi vòng kiểm soát. Xin cấp lại secret mới; bọn em cập nhật vào
`deploy/.env.pmhid` (file này không commit).

---

## 5. Việc phía DE-VPP tự làm, không cần anh/chị

- **Đã xong** — đọc claim `department` (trước đây code bỏ qua hoàn toàn, nên phòng
  ban luôn rỗng dù PMH ID có gửi).
- **Đã xong** — thêm `VPP_DEPARTMENT_ALIASES` để đổi/bỏ tên phòng ban IdP gửi sang,
  đang tạm bỏ `Dept_Test_VPP` cho khỏi lọt vào báo cáo. Sẽ gỡ khi mục 3b xong.
- **Đã xong** — `OIDC_POST_LOGOUT_REDIRECT` cấu hình được, đang khai đúng `app_url`.
- **Còn lại** — đưa stack lên mạng `edge` để webhook/BCL gọi ngược tới được, theo
  đúng **LUẬT VÀNG** (`edge-va-luong-hoat-dong.md` §5): chỉ `vpp-web` lên `edge`,
  **`vpp-api` không bao giờ** — tránh lặp lại sự cố alias `api` ngày 04/08/2026.

---

## 6. Đính chính tài liệu nội bộ (không phải việc của admin PMH ID)

`integration/edge-va-luong-hoat-dong.md` §1 ghi hostname `admin-de.pmh.com.vn` trong
bảng routing. Thực tế đang chạy là **`de-admin.pmh.com.vn`** — discovery ở host này
trả 200 và toàn bộ luồng đăng nhập hoạt động. Nên sửa tài liệu cho khớp.
