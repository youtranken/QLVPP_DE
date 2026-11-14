-- sid của phiên SSO PMH ID (claim sid trong id_token lúc đăng nhập): back-channel logout có sid
-- chỉ hủy phiên mở từ đúng phiên SSO đó. NULL = PMH ID chưa phát sid hoặc phiên SA/tài khoản thử.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS idp_sid text;
CREATE INDEX IF NOT EXISTS idx_sessions_user_sub_idp_sid ON sessions (user_sub, idp_sid);
