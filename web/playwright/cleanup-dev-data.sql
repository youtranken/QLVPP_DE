-- KHÔNG CHẠY TRÊN PROD. Chỉ cho DB dev của docker compose (POSTGRES_DB=vpp trong .env.example).
-- Prod dùng cùng tên DB nên tên chưa đủ chặn: phải gọi kèm `-v dev_ok=1` (xem README) mới chạy.
-- Dọn dữ liệu Playwright còn sót (món/nhóm tên "PW …", người sub "pw-…", đợt giao, bản chốt, chuông); chỉ xóa dòng không còn bị
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
  (SELECT count(*) FROM users WHERE sub LIKE 'pw-%') AS users,
  (SELECT count(*) FROM requests WHERE user_sub LIKE 'pw-%') AS requests,
  (SELECT count(*) FROM stock_movements m JOIN items i ON i.id = m.item_id WHERE i.name LIKE 'PW %') AS movements,
  (SELECT count(*) FROM line_deliveries d JOIN request_lines l ON l.id = d.line_id JOIN requests r ON r.id = l.request_id
    WHERE r.user_sub LIKE 'pw-%') AS deliveries,
  (SELECT count(*) FROM report_snapshots WHERE created_by_sub LIKE 'pw-%') AS snapshots,
  (SELECT count(*) FROM in_app_notifications WHERE user_sub LIKE 'pw-%' OR params->>'name' LIKE 'PW %') AS notifications;

SELECT 'before' AS at, * FROM pw_counts;

DELETE FROM in_app_notifications WHERE user_sub LIKE 'pw-%' OR params->>'name' LIKE 'PW %';
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

DELETE FROM line_deliveries WHERE line_id IN (SELECT id FROM pw_lines);
DELETE FROM stock_movements WHERE ref_line_id IN (SELECT id FROM pw_lines);
DELETE FROM requests r
WHERE r.user_sub LIKE 'pw-%' AND NOT EXISTS (SELECT 1 FROM request_lines l WHERE l.request_id = r.id AND l.id NOT IN (SELECT id FROM pw_lines));

DELETE FROM pw_items p WHERE EXISTS (SELECT 1 FROM request_lines l WHERE l.item_id = p.id);
DELETE FROM stock_movements WHERE item_id IN (SELECT id FROM pw_items);
DELETE FROM items WHERE id IN (SELECT id FROM pw_items);

DELETE FROM item_categories c
WHERE c.name LIKE 'PW %' AND NOT EXISTS (SELECT 1 FROM items i WHERE i.category_id = c.id);

DELETE FROM users u
WHERE u.sub LIKE 'pw-%'
  AND NOT EXISTS (SELECT 1 FROM requests r WHERE r.user_sub = u.sub)
  AND NOT EXISTS (SELECT 1 FROM stock_movements m WHERE m.recipient_sub = u.sub);

SELECT 'after' AS at, * FROM pw_counts;
COMMIT;
