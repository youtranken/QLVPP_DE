-- Phiên app tối đa 12 h kể từ lúc đăng nhập (chuẩn phiên chung PMH ID); quá hạn → từ chối + xóa,
-- job dọn định kỳ. Cookie vpp_sid thôi maxAge 30 ngày (cookie phiên trình duyệt).
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS expires_at timestamptz;
UPDATE sessions SET expires_at = created_at + interval '12 hours' WHERE expires_at IS NULL;
ALTER TABLE sessions ALTER COLUMN expires_at SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);
