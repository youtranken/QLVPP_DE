-- jti của logout_token đã xử (OIDC Back-Channel Logout §2.6): cùng jti tới lần 2 bị từ chối.
-- Giữ tới exp + độ lệch đồng hồ; quá hạn thì token tự bị jose từ chối, dòng xóa được.
CREATE TABLE IF NOT EXISTS logout_token_jti (
  jti text PRIMARY KEY CHECK (length(jti) BETWEEN 1 AND 255),
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logout_token_jti_expires_at ON logout_token_jti (expires_at);
