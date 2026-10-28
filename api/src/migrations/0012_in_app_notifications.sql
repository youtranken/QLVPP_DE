-- Lưu topic + params thay vì câu chữ để FE dịch vi/en. UNIQUE (event_id, user_sub) cho phép ghi lại an toàn bằng ON CONFLICT DO NOTHING.
CREATE TABLE IF NOT EXISTS in_app_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_sub text NOT NULL,
  event_id uuid,
  topic text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS in_app_notifications_event_user_uq
  ON in_app_notifications (event_id, user_sub);

CREATE INDEX IF NOT EXISTS in_app_notifications_user_idx
  ON in_app_notifications (user_sub, read_at, created_at DESC);

CREATE INDEX IF NOT EXISTS in_app_notifications_created_idx
  ON in_app_notifications (created_at);
