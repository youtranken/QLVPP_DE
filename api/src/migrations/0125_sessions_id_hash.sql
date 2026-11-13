-- Khóa phiên = sha256 hex của cookie vpp_sid (cookie thô chỉ trình duyệt giữ).
-- Không băm tại chỗ: id cũ (UUID = cookie) đã lộ qua audit/log/backup → xóa hết phiên, mọi người đăng nhập lại.
DELETE FROM sessions;
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_pkey;
ALTER TABLE sessions DROP COLUMN IF EXISTS id;
ALTER TABLE sessions
  ADD COLUMN id_hash text PRIMARY KEY CHECK (id_hash ~ '^[0-9a-f]{64}$');

-- Nhật ký phiên (auth.login/sa_login/test_login/logout/session_expired) ghi object_id = cookie thô:
-- đổi thành 12 ký tự đầu sha256 của giá trị cũ, như ứng dụng ghi từ nay. Ngoại lệ duy nhất của
-- append-only, tắt trigger trong chính transaction migration này.
ALTER TABLE audit_log DISABLE TRIGGER audit_log_append_only;
UPDATE audit_log
   SET object_id = left(encode(sha256(convert_to(object_id, 'UTF8')), 'hex'), 12)
 WHERE object_type = 'session'
   AND object_id IS NOT NULL
   AND object_id !~ '^[0-9a-f]{12}$';
ALTER TABLE audit_log ENABLE TRIGGER audit_log_append_only;
