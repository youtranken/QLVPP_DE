# ADR-0014 — Lối thoát "đăng nhập bằng tài khoản khác" qua `end_session`

- **Trạng thái:** Proposed
- **Ngày:** 2026-08-25
- **Liên quan:** [ADR-0002](./0002-xac-thuc-pmh-id-sso-bff.md) (BFF/SSO), [ADR-0003](./0003-tich-hop-sso-day-du.md) (BCL) · `FR-06` · `AUTH-5`

## Bối cảnh

DE-VPP không tự xác thực: PMH ID gác cửa theo nhóm. Ai không thuộc nhóm được gán cho
`client_vpp` (và client không bật `allow_all_groups`) sẽ bị trả `?error=access_denied`
**ngay ở callback, không cấp token** — VPP bắt lỗi này và đưa về `/khong-co-quyen`
(AUTH-3, đã làm).

Chỗ hỏng nằm ở **bước sau đó**. Phiên SSO tại PMH ID vẫn còn sống, nên khi người dùng
bấm _Đăng nhập_ lần nữa, PMH ID xác thực **im lặng** bằng chính phiên cũ và lại trả
`access_denied`. Vòng lặp khép kín: trang chặn → đăng nhập → trang chặn. Người dùng
không có cách nào đăng nhập bằng tài khoản khác ngoài việc tự xoá cookie.

Đây không phải giả định. QLTS đã gặp đúng tình huống này và phải bổ sung nút riêng
(`integration/qlts-group-access-notes.md`, mục "Logout + user bị xóa/gỡ group",
2026-07-11). VPP hiện chưa có gì tương đương — đã kiểm, không tồn tại route nào.

Hai hoàn cảnh dẫn tới đây đều **bình thường**, không phải sự cố: người dùng bị chuyển
nhóm/nghỉ việc, hoặc một máy dùng chung mà người trước còn phiên SSO.

## Quyết định

- Thêm route **`GET /api/auth/switch-account`**: huỷ phiên local, rồi chuyển hướng tới
  `end_session` của IdP kèm `id_token_hint` (nếu phiên còn giữ được `id_token`).
  Dùng lại đúng `endSessionUrl()` mà "Đăng xuất khỏi PMH ID" đang dùng — **không** tự
  ghép URL, để chỉ có một chỗ dựng tham số đăng xuất.
- Nút **"Đăng nhập bằng tài khoản khác"** chỉ hiện ở trang `/khong-co-quyen`. Người
  dùng bình thường không thấy: đây là lối thoát cho người đang kẹt, không phải chức
  năng thường ngày.
- **Không** tự dựng cơ chế thoát riêng của VPP (xoá cookie, cờ `prompt=login`…).
  Nguồn của vòng lặp là phiên SSO ở IdP, nên phải kết thúc đúng nó; mọi cách khác chỉ
  che triệu chứng và sẽ lệch với hành vi thật của PMH ID.

## Hệ quả

**Được.** Người bị gỡ nhóm tự thoát được, không cần gọi IT xoá cookie hộ. Cách xử lý
khớp với QLTS nên người vận hành PMH ID chỉ phải nhớ **một** kiểu hành vi giữa các app.

**Mất.** Bấm nút này sẽ **đăng xuất khỏi MỌI app PMH ID**, không riêng VPP — đó là bản
chất của `end_session`. Nhãn nút phải nói rõ, nếu không người dùng sẽ bất ngờ khi thấy
mình văng khỏi QLTS/QLHS.

**Phụ thuộc một thứ đang hỏng.** Đăng xuất toàn hệ hiện trả **400** tại
`POST /oidc/logout/confirm` phía PMH ID (đo 3/3 lần ngày 21/08/2026, request đã đúng
hợp đồng từng tham số — xem `docs/operations/YEU-CAU-PMH-ID-2026-08-21.md` §1). Nút này
**chỉ dùng được sau khi lỗi đó được gỡ**. Vì vậy ADR ở trạng thái _Proposed_, và AUTH-5
mang nhãn `[⏳]`.

**Đã có sẵn van an toàn.** `OIDC_POST_LOGOUT_REDIRECT=off` cho phép bỏ tham số
`post_logout_redirect_uri` khi IdP chưa đăng ký URL — để một cấu hình thiếu ở IdP không
làm gãy cả lượt đăng xuất.
