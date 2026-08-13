# ADR-0003 — Tích hợp SSO đầy đủ: Directory API + Webhook + Back-Channel Logout

- **Trạng thái:** Accepted
- **Ngày:** 2026-08-06

## Bối cảnh

PMH ID cho phép **3 mức tích hợp cộng thêm** ngoài đăng nhập OIDC:

1. **Directory API** (M2M, client-credentials): kéo danh bạ user theo group — thấy cả người **chưa từng đăng nhập**.
2. **Webhook** (HMAC): báo khi user bị khoá/xoá/đổi nhóm.
3. **Back-Channel Logout (BCL)**: đá user khỏi app **tức thì** khi logout toàn hệ/bị khoá.
   Admin VPP cần tổng hợp theo phòng ban (kể cả người chưa đăng nhập), và cần thu hồi truy cập nhanh khi nhân sự biến động.

## Quyết định

Tích hợp **đầy đủ cả 3**:

- **Directory sync** job (~60' + "Đồng bộ ngay") upsert user `source='directory'`.
- **Webhook receiver** `/api/webhooks/pmh-id` — verify **HMAC v2** (timestamp ±5', `timingSafeEqual`), **idempotent**; `user.locked/deleted` ⇒ `disabled` + huỷ phiên; `groups_changed` ⇒ cập nhật vai trò/phòng ban.
- **BCL endpoint** `/api/auth/backchannel-logout` — verify `logout_token` qua JWKS, huỷ phiên của `sub`.
- Luôn kèm cơ chế nền: **refresh-fail ⇒ đăng xuất** (đúng cho mọi ca kể cả idle mà BCL không phủ).

## Hệ quả

**Tích cực:** danh bạ đầy đủ để tổng hợp; thu hồi truy cập tức thì; đúng chuẩn PMH ID.
**Tiêu cực:** thêm 3 luồng phải làm đúng (HMAC, idempotency, JWKS verify); phụ thuộc `webhook_secret` + cấu hình `webhook_url`/`backchannel_logout_uri` với admin PMH ID (chỉ cần khi lên prod thật — demo dùng mock).

## Phương án đã cân nhắc

- **Chỉ đăng nhập OIDC:** đơn giản nhất, nhưng admin không thấy người chưa đăng nhập, và user bị khoá vẫn dùng tới khi token hết hạn (≤5'). → không đủ cho yêu cầu.
- **Chỉ webhook (bỏ BCL):** đủ đá khi bị khoá nhưng thiếu logout-toàn-hệ tức thì. → chọn đủ cả cho nhất quán.

## Liên kết

`../architecture/SSO-INTEGRATION.md` §7, §8 · `integration/README.md` §5–6 · `integration/directory-api.openapi.json`.
