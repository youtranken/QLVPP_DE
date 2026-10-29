-- 0107: min_stock đã thay bằng restock_level (0101), code không còn đọc/ghi
ALTER TABLE items DROP COLUMN IF EXISTS min_stock;
