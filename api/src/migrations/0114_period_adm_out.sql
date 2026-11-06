-- line_key = item_id::text hoặc khóa 'custom:[tên, đvt]' nên không FK món; lịch sử bật/tắt nằm ở audit_log
CREATE TABLE period_adm_out (
  period_ym date NOT NULL REFERENCES periods(ym) ON DELETE CASCADE,
  line_key  text NOT NULL,
  kind      text NOT NULL DEFAULT 'out' CHECK (kind IN ('out','owed_closed')),
  marked_by text NOT NULL,
  marked_at timestamptz NOT NULL,
  PRIMARY KEY (period_ym, line_key, kind)
);
