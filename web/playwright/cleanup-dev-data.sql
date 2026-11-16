-- audit_log append-only: dòng `pw-audit-*` (ngày 2001) và `pw-audit-51/50` gieo nhầm không xóa được, chỉ có ở DB dev, lọc theo actor nên vô hại.
-- request_line_adjustments cũng append-only: spec không được ghi vào bảng (finally không xóa được; bộ quét playwright-data-policy chặn); dòng `pw-*` sót lại chỉ script này dọn (tắt trigger bên dưới).
-- KHÔNG CHẠY TRÊN PROD. Chỉ cho DB dev của docker compose (POSTGRES_DB=vpp trong .env.example).
-- Prod dùng cùng tên DB nên tên chưa đủ chặn: phải gọi kèm `-v dev_ok=1` (xem README) mới chạy.
-- Dọn dữ liệu Playwright còn sót (món/nhóm/ĐVT tên "PW …", người sub "pw-…", đợt giao, bản chốt, chuông, điều chỉnh, ADM hết hàng,
-- hàng về ngoài DM, danh sách người lúc khóa sổ); chỉ xóa dòng không còn bị
-- dữ liệu thật tham chiếu; chạy lại bao nhiêu lần cũng được.
\set QUIET on
\set ON_ERROR_STOP on
\pset footer off
BEGIN;

\if :{?dev_ok}
\else
DO $$ BEGIN RAISE EXCEPTION 'Dừng: thiếu -v dev_ok=1 — script chỉ dành cho DB dev'; END $$;
\endif

DO $$
BEGIN
  IF current_database() <> 'vpp' THEN
    RAISE EXCEPTION 'Dừng: DB "%" không phải DB dev "vpp"', current_database();
  END IF;
END $$;

CREATE TEMP VIEW pw_counts AS
SELECT
  (SELECT count(*) FROM items WHERE name LIKE 'PW %') AS items,
  (SELECT count(*) FROM item_categories WHERE name LIKE 'PW %') AS categories,
  (SELECT count(*) FROM units WHERE name LIKE 'PW %') AS units,
  (SELECT count(*) FROM users WHERE sub LIKE 'pw-%') AS users,
  (SELECT count(*) FROM requests WHERE user_sub LIKE 'pw-%') AS requests,
  (SELECT count(*) FROM stock_movements m JOIN items i ON i.id = m.item_id WHERE i.name LIKE 'PW %') AS movements,
  (SELECT count(*) FROM line_deliveries d JOIN request_lines l ON l.id = d.line_id JOIN requests r ON r.id = l.request_id
    WHERE r.user_sub LIKE 'pw-%') AS deliveries,
  (SELECT count(*) FROM report_snapshots WHERE created_by_sub LIKE 'pw-%') AS snapshots,
  (SELECT count(*) FROM in_app_notifications WHERE user_sub LIKE 'pw-%' OR params->>'name' LIKE 'PW %') AS notifications,
  (SELECT count(*) FROM request_line_adjustments WHERE user_sub LIKE 'pw-%') AS adjustments,
  (SELECT count(*) FROM period_adm_out a JOIN items i ON a.line_key = i.id::text WHERE i.name LIKE 'PW %') AS adm_out,
  (SELECT count(*) FROM periods p WHERE EXISTS (SELECT 1 FROM unnest(p.headcount_subs) s WHERE s LIKE 'pw-%')) AS headcount_periods,
  (SELECT count(*) FROM config c, jsonb_array_elements(c.value) b WHERE c.key = 'signature_boxes' AND b->>'name' LIKE 'PW %') AS signer_names;

SELECT 'before' AS at, * FROM pw_counts;

DELETE FROM in_app_notifications WHERE user_sub LIKE 'pw-%' OR params->>'name' LIKE 'PW %';
-- p3-seed đổi tạm tên người ký thành "PW …"; lượt bị dừng giữa chừng để lại thì xóa tên (giữ chức danh)
UPDATE config SET value = (
  SELECT jsonb_agg(CASE WHEN b->>'name' LIKE 'PW %' THEN b || '{"name": ""}'::jsonb ELSE b END ORDER BY ord)
  FROM jsonb_array_elements(value) WITH ORDINALITY AS e(b, ord))
WHERE key = 'signature_boxes' AND EXISTS (SELECT 1 FROM jsonb_array_elements(value) b WHERE b->>'name' LIKE 'PW %');
DELETE FROM report_snapshots WHERE created_by_sub LIKE 'pw-%';

-- Món PW chỉ còn bị phiếu của người thử dùng (không phải phiếu người thật)
CREATE TEMP TABLE pw_items ON COMMIT DROP AS
SELECT i.id FROM items i
WHERE i.name LIKE 'PW %'
  AND NOT EXISTS (
    SELECT 1 FROM request_lines l JOIN requests r ON r.id = l.request_id
    WHERE l.item_id = i.id AND r.user_sub NOT LIKE 'pw-%'
  )
  AND NOT EXISTS (
    SELECT 1 FROM stock_movements m JOIN stock_movements src ON src.id = m.ref_movement_id
    WHERE src.item_id = i.id AND m.item_id <> i.id
  );

-- Phiếu đã giao từ món thật thì sổ kho món thật trỏ vào dòng phiếu: giữ lại; giao từ món PW thì xóa cả đợt giao
CREATE TEMP TABLE pw_lines ON COMMIT DROP AS
SELECT l.id FROM request_lines l JOIN requests r ON r.id = l.request_id
WHERE r.user_sub LIKE 'pw-%'
  AND NOT EXISTS (
    SELECT 1 FROM request_lines l2 JOIN stock_movements m ON m.ref_line_id = l2.id
    WHERE l2.request_id = r.id AND m.item_id NOT IN (SELECT id FROM pw_items)
  );

-- Khóa ngoài DM (cùng công thức CUSTOM_ITEM_KEY của api) chỉ do người thử dùng trong kỳ đó; người thật cùng khóa thì giữ
CREATE TEMP TABLE pw_line_keys ON COMMIT DROP AS
SELECT DISTINCT r.period_ym, 'custom:' || jsonb_build_array(lower(trim(l.custom_name)), lower(trim(l.custom_unit)))::text AS line_key
FROM request_lines l JOIN requests r ON r.id = l.request_id
WHERE l.id IN (SELECT id FROM pw_lines) AND l.item_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM request_lines l2 JOIN requests r2 ON r2.id = l2.request_id
    WHERE r2.period_ym = r.period_ym AND r2.user_sub NOT LIKE 'pw-%' AND l2.item_id IS NULL
      AND lower(trim(l2.custom_name)) = lower(trim(l.custom_name)) AND lower(trim(l2.custom_unit)) = lower(trim(l.custom_unit))
  );

-- Bảng điều chỉnh chỉ-thêm: tạm tắt trigger chặn DELETE trong giao dịch này, chỉ cho dòng của người thử
ALTER TABLE request_line_adjustments DISABLE TRIGGER request_line_adjustments_append_only;
DELETE FROM request_line_adjustments WHERE line_id IN (SELECT id FROM pw_lines) OR user_sub LIKE 'pw-%';
ALTER TABLE request_line_adjustments ENABLE TRIGGER request_line_adjustments_append_only;
DELETE FROM period_adm_out WHERE line_key IN (SELECT id::text FROM pw_items)
  OR (period_ym, line_key) IN (SELECT period_ym, line_key FROM pw_line_keys);
DELETE FROM custom_receipts WHERE line_key IN (SELECT id::text FROM pw_items)
  OR (period_ym, line_key) IN (SELECT period_ym, line_key FROM pw_line_keys);
-- Giữ bất biến headcount = số người trong danh sách đóng băng
UPDATE periods
SET headcount_subs = ARRAY(SELECT x FROM unnest(headcount_subs) WITH ORDINALITY AS t(x, n) WHERE x NOT LIKE 'pw-%' ORDER BY n),
    headcount = cardinality(ARRAY(SELECT x FROM unnest(headcount_subs) AS t(x) WHERE x NOT LIKE 'pw-%'))
WHERE headcount_subs IS NOT NULL;

DELETE FROM line_deliveries WHERE line_id IN (SELECT id FROM pw_lines);
DELETE FROM stock_movements WHERE ref_line_id IN (SELECT id FROM pw_lines);
DELETE FROM requests r
WHERE r.user_sub LIKE 'pw-%' AND NOT EXISTS (SELECT 1 FROM request_lines l WHERE l.request_id = r.id AND l.id NOT IN (SELECT id FROM pw_lines));

DELETE FROM pw_items p WHERE EXISTS (SELECT 1 FROM request_lines l WHERE l.item_id = p.id);
DELETE FROM stock_movements WHERE item_id IN (SELECT id FROM pw_items);
DELETE FROM items WHERE id IN (SELECT id FROM pw_items);

DELETE FROM item_categories c
WHERE c.name LIKE 'PW %' AND NOT EXISTS (SELECT 1 FROM items i WHERE i.category_id = c.id);

DELETE FROM units u
WHERE u.name LIKE 'PW %'
  AND NOT EXISTS (SELECT 1 FROM items i WHERE i.unit = u.code)
  AND NOT EXISTS (SELECT 1 FROM request_lines l WHERE l.custom_unit = u.code);

DELETE FROM users u
WHERE u.sub LIKE 'pw-%'
  AND NOT EXISTS (SELECT 1 FROM requests r WHERE r.user_sub = u.sub)
  AND NOT EXISTS (SELECT 1 FROM stock_movements m WHERE m.recipient_sub = u.sub);

SELECT 'after' AS at, * FROM pw_counts;
COMMIT;
