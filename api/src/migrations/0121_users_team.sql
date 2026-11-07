-- Nhóm/tổ của người dùng từ claim `team` của PMH ID (nếu IdP gửi); không có thì NULL, UI ghi "—"
ALTER TABLE users ADD COLUMN IF NOT EXISTS team text;
