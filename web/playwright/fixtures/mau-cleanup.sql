-- Gỡ dữ liệu mẫu 'mau-*' (kể cả giao hàng, điều chỉnh, chuông làm thêm qua API); chỉ DB dev, chạy lại được.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN IF current_database() <> 'vpp' THEN RAISE EXCEPTION 'chỉ DB dev'; END IF; END $$;

CREATE TEMP TABLE mau_lines ON COMMIT DROP AS
SELECT l.id FROM request_lines l JOIN requests r ON r.id = l.request_id WHERE r.user_sub LIKE 'mau-%';

CREATE TEMP TABLE mau_moves ON COMMIT DROP AS
SELECT id, item_id, delta FROM stock_movements
WHERE ref_line_id IN (SELECT id FROM mau_lines) OR recipient_sub LIKE 'mau-%' OR note = 'Tồn đầu kỳ (dữ liệu mẫu)';

UPDATE items i SET stock_qty = GREATEST(0, i.stock_qty - s.d)
FROM (SELECT item_id, sum(delta) d FROM mau_moves GROUP BY item_id) s WHERE s.item_id = i.id;
UPDATE items SET restock_level = NULL
WHERE id IN (SELECT item_id FROM mau_moves) AND restock_level = 5;

-- Bảng điều chỉnh chỉ-thêm: tạm tắt trigger chặn DELETE trong giao dịch này, chỉ cho dòng mẫu
ALTER TABLE request_line_adjustments DISABLE TRIGGER request_line_adjustments_append_only;
DELETE FROM request_line_adjustments WHERE line_id IN (SELECT id FROM mau_lines) OR user_sub LIKE 'mau-%';
ALTER TABLE request_line_adjustments ENABLE TRIGGER request_line_adjustments_append_only;

DELETE FROM line_deliveries WHERE line_id IN (SELECT id FROM mau_lines) OR movement_id IN (SELECT id FROM mau_moves);
DELETE FROM stock_movements WHERE ref_movement_id IN (SELECT id FROM mau_moves);
DELETE FROM stock_movements WHERE id IN (SELECT id FROM mau_moves);
DELETE FROM in_app_notifications WHERE event_id LIKE 'mau:%' OR user_sub LIKE 'mau-%';
UPDATE periods
SET headcount_subs = ARRAY(SELECT x FROM unnest(headcount_subs) WITH ORDINALITY AS t(x, n) WHERE x NOT LIKE 'mau-%' ORDER BY n),
    headcount = cardinality(ARRAY(SELECT x FROM unnest(headcount_subs) AS t(x) WHERE x NOT LIKE 'mau-%'))
WHERE headcount_subs IS NOT NULL;
DELETE FROM requests WHERE user_sub LIKE 'mau-%';
DELETE FROM users WHERE sub LIKE 'mau-%';
COMMIT;
