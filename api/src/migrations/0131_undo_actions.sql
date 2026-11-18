-- TC-18 (18/11/2026): hoàn tác 5 giây cho giao, hủy nợ, xóa món; cửa sổ tính ở server từ created_at (ClockService)
CREATE TABLE IF NOT EXISTS undo_actions (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('delivery', 'cancel', 'item_delete')),
  actor_sub text NOT NULL,
  created_at timestamptz NOT NULL,
  undone_at timestamptz,
  payload jsonb
);

-- Một lần giao (một dòng hay cả lô bulk nhiều transaction) gom các đợt bằng undo_id; không FK vì dòng undo_actions của lô ghi sau cùng
ALTER TABLE line_deliveries ADD COLUMN IF NOT EXISTS undo_id uuid;

CREATE INDEX IF NOT EXISTS line_deliveries_undo_idx
  ON line_deliveries (undo_id) WHERE undo_id IS NOT NULL;
