ALTER TABLE stock_movements ADD COLUMN receipt_ym date;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_receipt_ym_check
  CHECK (receipt_ym IS NULL OR reason = 'purchase');
CREATE INDEX stock_movements_receipt_ym_idx ON stock_movements (receipt_ym, item_id);

-- Hàng về trước đây chỉ ghi kỳ trong note "Hàng về kỳ YYYY-MM[ · ghi chú]"
UPDATE stock_movements
SET receipt_ym = to_date(substring(note FROM '^Hàng về kỳ (\d{4}-\d{2})'), 'YYYY-MM')
WHERE reason = 'purchase' AND note ~ '^Hàng về kỳ \d{4}-\d{2}';
