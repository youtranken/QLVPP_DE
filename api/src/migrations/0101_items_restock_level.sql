-- Mốc "sắp hết" theo FR-50: tồn ngay sau lần nhập mua gần nhất; NULL = chưa nhập mua lần nào.
-- min_stock giữ lại nhưng không đọc/ghi nữa, bỏ ở migration sau.
ALTER TABLE items ADD COLUMN IF NOT EXISTS restock_level int
  CHECK (restock_level IS NULL OR restock_level > 0);
