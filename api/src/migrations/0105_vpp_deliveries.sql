-- 0105: lịch sử đợt giao theo dòng (không hoàn tác) và chỗ để sẵn cho phiếu giao nhận GĐ2

CREATE TABLE IF NOT EXISTS line_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES request_lines ON DELETE RESTRICT,
  qty int NOT NULL CHECK (qty > 0),
  movement_id uuid REFERENCES stock_movements,
  actor_sub text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS line_deliveries_line_idx
  ON line_deliveries (line_id, created_at);

CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_ym date,
  department text,
  delivered_by_sub text,
  received_by_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
