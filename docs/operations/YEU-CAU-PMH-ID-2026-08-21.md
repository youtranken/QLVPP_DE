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

## 2. Xin **bật cờ `m2m_enabled`** cho `client_vpp` (Directory API)

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

**Hiện trạng:** đang dùng giá trị dev nên bị từ chối đúng như phải thế:

```
POST /oidc/token (client_credentials) -> 401 {"error":"invalid_client"}
log app: Đồng bộ danh bạ định kỳ thất bại. Dữ liệu danh bạ giữ nguyên.
```

**Hệ quả:** DE-VPP chỉ thấy người **đã từng đăng nhập**, không lên trước được danh
sách nhân viên.

**Kèm theo — xin `PMH_WEBHOOK_SECRET` thật** để bật xác thực chữ ký HMAC-SHA256 v2
(app **không** nhận v1).

---

## 3. Xin chốt nhóm và phòng ban

### 3a. Nhóm quyết định quyền quản trị

Phiếu onboarding khai `VPP-Admin`, nhưng PMH ID hiện **chỉ có nhóm `Test_VPP`**. App
đang tạm trỏ `VPP_ADMIN_GROUP=Test_VPP`. Xin lập nhóm chính thức **`VPP-Admin`** và
báo lại khi dùng được — bọn em đổi cấu hình, không phải sửa code.

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
