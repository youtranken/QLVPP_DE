-- SA chỉ đến từ env; bảng users không bao giờ chứa role 'sa'.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('member', 'admin'));
