-- Access token PMH ID của phiên SSO: backend gọi PUT /api/me/locale thay người dùng (docs 7a).
-- Không lưu ngôn ngữ của người dùng ở đâu khác ngoài claims phiên (bản sao token).
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS access_token text;
