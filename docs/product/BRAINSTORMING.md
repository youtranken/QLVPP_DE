# Brainstorming — DE-VPP

> Sổ ý tưởng. Ghi lại những gì **phát hiện được khi cắm VPP vào PMH ID thật**
> (21–25/08/2026), trước khi quyết định làm hay không.
>
> Ở đây **không cam kết gì**. Mục nào được chốt thì mới đi tiếp sang
> [`PRD.md`](./PRD.md) → [`USER_STORIES.md`](./USER_STORIES.md) → ADR.
>
> Quy ước trạng thái: `[đề xuất]` chưa quyết · `[đã chốt]` đã sang PRD ·
> `[gác lại]` có lý do rõ ràng để chưa làm.

---

## B-01 — "Đăng nhập bằng tài khoản khác" `[đã chốt → FR-06, AUTH-5, ADR-0014]`

**Vướng gì.** Người bị gỡ nhóm hoặc bị khoá ở PMH ID mà **phiên SSO vẫn còn sống**
sẽ kẹt vòng lặp: bấm _Đăng nhập_ → PMH ID xác thực im lặng → trả `access_denied`
→ VPP đưa về `/khong-co-quyen` → bấm lại → y hệt. Không có đường ra ngoài việc
xoá cookie thủ công.

**Vì sao mới thấy.** Chỉ lộ khi có IdP thật với nhóm thật. Với mock-idp mọi tài
khoản đều được phép nên không bao giờ chạm tới nhánh này.

**Có tiền lệ.** QLTS đã gặp và phải làm nút này
(`integration/qlts-group-access-notes.md`, mục "Logout + user bị xóa/gỡ group").
VPP hiện **chưa có** — đã kiểm, không có route `switch-account` nào.

**Rẻ hay đắt.** Rẻ. Một route gọi `end_session` kèm `id_token_hint`, thêm một nút
trên trang `/khong-co-quyen`. Không đụng CSDL, không đụng luồng đăng nhập đang chạy.

---

## B-02 — Tách nhóm truy cập khỏi nhóm quản trị `[vẫn đang chặn — đo lại 03/09/2026]`

**Vướng gì.** `client_vpp` từng chỉ được gán đúng một nhóm `Test_VPP`, mà
`VPP_ADMIN_GROUP` cũng là `Test_VPP`. Hai vai trùng làm một: **thêm một nhân viên
thường vào nhóm đó để họ vào được app là vô tình cấp luôn quyền quản trị** — thấy
mọi đơn, duyệt được, sửa được danh mục.

**Ý tưởng.** Xin PMH ID lập `VPP-User` (quyền vào app) tách khỏi `VPP-Admin`
(quyền quản trị), gán cả hai cho client. VPP chỉ cần đổi biến môi trường.

**Bài học 03/09/2026: "đã lập nhóm" chưa phải là "app thấy nhóm".** Admin PMH ID báo
đã lập `VPP-Admin`. Đổi `VPP_ADMIN_GROUP` sang tên đó xong mới đo lại bằng Directory
API (nay đã dùng được) thì thấy client vẫn chỉ được gán đúng một nhóm:

```
GET /api/v1/groups  -> [{"name":"Test_VPP"}]
GET /api/v1/users   -> huuthong@pmh.com.vn | active | ["Test_VPP"]
```

Nhóm phải được **gán cho client** thì mới lọt vào claim `groups`. Chưa gán mà đã đổi
cấu hình ⇒ claim không bao giờ chứa `VPP-Admin` ⇒ **không còn ai là quản trị viên**.
Đã trả `VPP_ADMIN_GROUP` về `Test_VPP`.

**Phép thử rẻ, làm trước khi đổi cấu hình lần sau:** `pnpm check:pmh-id` in ra thẳng
danh sách nhóm client được cấp. Thấy tên nhóm trong đó thì mới đổi — không tin lời
báo "đã lập xong", vì lập nhóm và gán nhóm cho client là hai thao tác khác nhau.

**Còn thiếu cả hai vế** (đã xin ở `operations/YEU-CAU-PMH-ID-2026-08-21.md` §3a/§3c):
gán `VPP-Admin` cho client, và một nhóm truy cập cho nhân viên thường. Chừng nào chưa
có vế thứ hai, ai vào được app cũng là quản trị viên — nên nó **vẫn chặn** việc thêm
nhân viên thường vào hệ thống.

---

## B-03 — Giao thiếu theo số lượng trong một dòng `[đề xuất]`

**Vướng gì.** Hiện "đã giao" là **checkbox cho cả dòng**: tick là `delivered_qty`
bằng đúng số lượng đăng ký. Không diễn đạt được "đăng ký 3 cây, phát 2, còn thiếu 1".
Giao thiếu chỉ thể hiện ở mức _dòng nào xong, dòng nào chưa_.

**Cần xác minh trước khi làm.** Nghiệp vụ thật có phát thiếu trong một món không,
hay luôn phát đủ-hoặc-chưa-phát? Nếu không có thì đây là phức tạp thừa.

---

## B-04 — Chặn tự duyệt đơn của chính mình `[đề xuất]`

**Vướng gì.** Đo được ngày 21/08: `huuthong@` vừa gửi vừa duyệt đơn
`VPP-2026-09-0006`, không cảnh báo gì. Với văn phòng nhỏ thì tiện; nếu quy chế đòi
"người duyệt khác người đăng ký" thì đây là lỗ hổng.

**Là quyết định nghiệp vụ, không phải kỹ thuật.** Cần chủ nghiệp vụ chốt trước.

---

## B-05 — "Giao tất cả" ghi nhật ký thô hơn tick từng dòng `[gác lại]`

Bấm _Giao tất cả_ ra **một** dòng `request.deliver_all`; tick từng món ra **nhiều**
dòng `request.deliver_line` kèm tên món và số lượng. Truy vết "ai phát món nào lúc
mấy giờ" mất chi tiết ở đường thứ nhất.

**Gác lại** vì chưa có nhu cầu truy vết tới mức đó, và cả hai đường đều cho cùng kết
quả nghiệp vụ. Ghi lại để nếu sau này cần đối soát thì biết chỗ mà sửa.

---

## B-06 — Chuẩn hoá tên phòng ban IdP gửi sang `[đã làm tạm — VPP_DEPARTMENT_ALIASES]`

PMH ID trả `department` là **chuỗi tự do do admin bên đó nhập**, thực tế đang là
`Dept_Test_VPP`. Chuỗi này in thẳng lên màn duyệt đơn và báo cáo Excel trình ký.

Đã có `VPP_DEPARTMENT_ALIASES` để đổi/bỏ. Còn mở: có nên **ràng buộc** phòng ban vào
danh sách chuẩn của VPP thay vì nhận mọi chuỗi IdP gửi? Đánh đổi: chặt chẽ hơn nhưng
thêm một chỗ phải bảo trì khi công ty đổi cơ cấu.

---

## B-07 — Tự kiểm cấu hình PMH ID lúc khởi động `[đề xuất]`

**Vướng gì.** Buổi tích hợp 21/08 mất nhiều thời gian vì các lệch cấu hình **không
báo lỗi**: danh bạ đồng bộ 0 người mà vẫn ghi "thành công"; webhook bị từ chối vì
lệch đơn vị timestamp; đăng xuất 400 mà trang lỗi không nói lý do.

**Ý tưởng.** Lúc khởi động (hoặc trong `/api/health`), tự đối chiếu vài thứ rẻ tiền:
`issuer` khai có khớp discovery không, `post_logout_redirect_uri` có nằm trong danh
sách IdP đăng ký không, token M2M xin được không. Sai thì **nói ra ngay**, thay vì để
phát hiện lúc người dùng gặp lỗi.

Có sẵn `scripts/check-pmh-id.sh` làm việc này từ ngoài; ý tưởng là đưa phần quan
trọng vào trong app để không phụ thuộc việc ai đó nhớ chạy script.
