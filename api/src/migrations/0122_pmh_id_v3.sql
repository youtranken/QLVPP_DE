-- PMH ID v3: không còn groups; vai Hành chính lấy từ app_role (ghi vào users.role), PMH ID tự gác cửa.
UPDATE users u SET role = CASE WHEN jsonb_typeof(u.groups) = 'array' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(u.groups) g, config c
    WHERE c.key = 'admin_group' AND lower(g) = lower(c.value #>> '{}')) THEN 'admin' ELSE 'member' END
WHERE u.sub <> 'local:sa';
ALTER TABLE users DROP COLUMN groups;
DELETE FROM config WHERE key IN ('admin_group', 'authorized_groups');
-- inactive_at: lúc rời active (khóa/xóa/mất quyền) theo đồng hồ DB; so với iat khi đăng nhập và mốc bắt đầu sync
ALTER TABLE users ADD COLUMN inactive_at timestamptz, ADD COLUMN access_checked_at timestamptz;
UPDATE users SET inactive_at = updated_at WHERE status <> 'active';
-- Thứ tự webhook theo loại; không FK vì sự kiện có thể tới trước khi user có ở VPP
CREATE TABLE webhook_user_order (
  sub text PRIMARY KEY, seqs jsonb NOT NULL DEFAULT '{}'::jsonb,
  access_revoked boolean NOT NULL DEFAULT false, updated_at timestamptz NOT NULL DEFAULT now());
COMMENT ON COLUMN users.status IS 'active | locked | deleted | no_access (0122)';
