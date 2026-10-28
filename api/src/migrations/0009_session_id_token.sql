-- id_token dùng làm id_token_hint khi RP-initiated logout; thiếu hint thì PMH ID không nhận ra phiên.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS id_token text;
