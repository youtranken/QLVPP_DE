-- Phiên SA cục bộ dùng user_sub='local:sa', không có trong users → bỏ FK sessions.user_sub.
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_user_sub_fkey;
