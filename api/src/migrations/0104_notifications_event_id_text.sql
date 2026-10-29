-- 0104: event_id là chuỗi theo docs/architecture.md §9 (vd 'period_open:2026-11'), bắt buộc để UNIQUE (event_id, user_sub) chống trùng
DELETE FROM in_app_notifications WHERE event_id IS NULL;
ALTER TABLE in_app_notifications
  ALTER COLUMN event_id TYPE text USING event_id::text,
  ALTER COLUMN event_id SET NOT NULL;
