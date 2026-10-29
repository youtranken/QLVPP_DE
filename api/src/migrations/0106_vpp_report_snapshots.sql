-- 0106: bản chốt báo cáo (mỗi lần Xuất Excel / In tạo một bản)

CREATE TABLE IF NOT EXISTS report_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_ym date NOT NULL REFERENCES periods,
  kind text NOT NULL CHECK (kind IN ('xlsx', 'print')),
  data jsonb NOT NULL,
  created_by_sub text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS report_snapshots_period_idx
  ON report_snapshots (period_ym, created_at DESC);
