-- Claim `department` từ PMH ID; NULL khi IdP chưa gửi.
ALTER TABLE users ADD COLUMN IF NOT EXISTS department text;
