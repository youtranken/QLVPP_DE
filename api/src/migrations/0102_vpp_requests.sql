-- 0102: kỳ, phiếu đăng ký, dòng phiếu (docs/architecture.md §5)

CREATE TABLE IF NOT EXISTS periods (
  ym date PRIMARY KEY,
  deadline timestamptz NOT NULL,
  headcount int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_ym date NOT NULL REFERENCES periods,
  user_sub text NOT NULL REFERENCES users(sub),
  department text,
  note text,
  created_by_sub text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT requests_period_user_uq UNIQUE (period_ym, user_sub)
);

CREATE TABLE IF NOT EXISTS request_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES requests ON DELETE CASCADE,
  item_id uuid REFERENCES items,
  custom_name text,
  custom_unit text,
  custom_note text,
  image_file_id uuid REFERENCES files,
  qty int NOT NULL CHECK (qty > 0),
  delivered_qty int NOT NULL DEFAULT 0
    CHECK (delivered_qty >= 0 AND delivered_qty <= qty),
  cancelled_qty int NOT NULL DEFAULT 0
    CHECK (cancelled_qty >= 0 AND delivered_qty + cancelled_qty <= qty),
  cancel_note text,
  last_delivered_at timestamptz,
  admin_note text,
  added_by_admin bool NOT NULL DEFAULT false,
  review_status text NOT NULL DEFAULT 'n/a'
    CHECK (review_status IN ('n/a', 'pending', 'accepted', 'converted', 'rejected')),
  review_note text,
  reviewed_by_sub text,
  reviewed_at timestamptz,
  delivery_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT request_lines_item_review_ck CHECK (
    (item_id IS NOT NULL AND custom_name IS NULL
      AND review_status IN ('n/a', 'converted'))
    OR (item_id IS NULL AND custom_name IS NOT NULL AND custom_unit IS NOT NULL
      AND image_file_id IS NOT NULL
      AND review_status IN ('pending', 'accepted', 'rejected'))
  )
);

-- Dòng converted giữ nguyên bản ghi, không gộp với dòng cùng món.
CREATE UNIQUE INDEX IF NOT EXISTS request_lines_item_uq
  ON request_lines (request_id, item_id)
  WHERE item_id IS NOT NULL AND review_status = 'n/a';

CREATE INDEX IF NOT EXISTS request_lines_request_idx ON request_lines (request_id);
CREATE INDEX IF NOT EXISTS request_lines_item_idx ON request_lines (item_id);
-- Còn nợ = dòng còn hiệu lực mà chưa giao/hủy đủ.
CREATE INDEX IF NOT EXISTS request_lines_backlog_idx ON request_lines (item_id)
  WHERE review_status IN ('n/a', 'accepted', 'converted')
    AND delivered_qty + cancelled_qty < qty;
CREATE INDEX IF NOT EXISTS requests_period_idx ON requests (period_ym);

-- 0100 để ref_line_id chưa có FK vì request_lines chưa tồn tại.
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movements_ref_line_id_fkey
  FOREIGN KEY (ref_line_id) REFERENCES request_lines(id) ON DELETE RESTRICT;
