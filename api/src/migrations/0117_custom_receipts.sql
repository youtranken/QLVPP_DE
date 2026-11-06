-- Hàng về của món ngoài danh mục: không vào tủ, chỉ làm trần giao theo khóa custom
CREATE TABLE custom_receipts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_ym  date NOT NULL REFERENCES periods(ym),
  line_key   text NOT NULL,
  qty        int  NOT NULL CHECK (qty > 0),
  note       text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX custom_receipts_period_key_idx ON custom_receipts (period_ym, line_key);
