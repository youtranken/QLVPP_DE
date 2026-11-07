-- Giờ nhân viên lưu phiếu (cột "Lưu lúc" ở Tổng hợp); updated_at còn đổi theo việc Hành chính giảm/duyệt/giao
ALTER TABLE requests ADD COLUMN IF NOT EXISTS saved_at timestamptz;

UPDATE requests r
SET saved_at = coalesce(
  (SELECT max(a.created_at) FROM audit_log a
   WHERE a.object_type = 'request' AND a.object_id = r.id::text
     AND a.actor = r.user_sub AND a.action IN ('request.created', 'request.updated')),
  r.created_at)
WHERE r.saved_at IS NULL;

ALTER TABLE requests ALTER COLUMN saved_at SET DEFAULT now();
ALTER TABLE requests ALTER COLUMN saved_at SET NOT NULL;
