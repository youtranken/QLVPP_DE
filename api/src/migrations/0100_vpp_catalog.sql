-- Nhóm không phân biệt hoa thường để "Giấy" và "giấy" không thành hai nhóm.
CREATE TABLE IF NOT EXISTS item_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_en text,
  sort_order int NOT NULL DEFAULT 0,
  active bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS item_categories_name_uq
  ON item_categories (lower(name));

-- ĐVT là tập chuẩn không dấu để báo cáo gộp được; stock_qty >= 0 chặn xuất quá tồn ở tầng DB.
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  name text NOT NULL,
  name_en text,
  unit text NOT NULL
    CHECK (unit IN ('cai', 'hop', 'cay', 'ram', 'cuon', 'loc', 'bich', 'chai', 'bo')),
  pack_note text,
  category_id uuid REFERENCES item_categories,
  image_file_id uuid REFERENCES files,
  admin_only bool NOT NULL DEFAULT false,
  max_qty int NOT NULL DEFAULT 20 CHECK (max_qty > 0),
  stock_qty int NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  min_stock int NOT NULL DEFAULT 0,
  low_stock_notified_at timestamptz,
  active bool NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS items_category_idx ON items (category_id);

-- ref_line_id chưa có FK vì request_lines tới ở Plan 2, khi đó ADD CONSTRAINT ... ON DELETE RESTRICT.
-- Sổ cái chỉ thêm, không sửa: mỗi reason có dấu delta và trường bắt buộc riêng để không ghi sổ mơ hồ.
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items,
  delta int NOT NULL CHECK (delta <> 0),
  reason text NOT NULL
    CHECK (reason IN ('purchase', 'delivery', 'issue', 'return', 'adjust')),
  ref_line_id uuid,
  recipient_sub text REFERENCES users,
  ref_movement_id uuid REFERENCES stock_movements,
  note text,
  actor_sub text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (reason = 'purchase' AND delta > 0)
    OR (reason = 'delivery' AND delta < 0)
    OR (reason = 'issue' AND delta < 0 AND note IS NOT NULL)
    OR (reason = 'return' AND delta > 0 AND ref_movement_id IS NOT NULL)
    OR (reason = 'adjust' AND note IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS stock_movements_item_created_idx
  ON stock_movements (item_id, created_at);
