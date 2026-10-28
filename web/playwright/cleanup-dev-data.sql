-- KHÔNG CHẠY TRÊN PROD. Chỉ cho DB dev của docker compose (POSTGRES_DB=vpp trong .env.example).
-- Prod dùng cùng tên DB nên tên chưa đủ chặn: phải gọi kèm `-v dev_ok=1` (xem README) mới chạy.
-- Dọn dữ liệu Playwright còn sót (món/nhóm tên "PW …", người sub "pw-…"); chỉ xóa dòng không còn bị
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
  (SELECT count(*) FROM stock_movements m JOIN items i ON i.id = m.item_id WHERE i.name LIKE 'PW %') AS movements;

SELECT 'before' AS at, * FROM pw_counts;

-- Phiếu đã giao thì sổ kho của món thật trỏ vào dòng phiếu: giữ lại
DELETE FROM requests r
WHERE r.user_sub LIKE 'pw-%'
  AND NOT EXISTS (SELECT 1 FROM request_lines l JOIN stock_movements m ON m.ref_line_id = l.id WHERE l.request_id = r.id);

CREATE TEMP TABLE pw_items ON COMMIT DROP AS
SELECT i.id FROM items i
WHERE i.name LIKE 'PW %'
  AND NOT EXISTS (SELECT 1 FROM request_lines l WHERE l.item_id = i.id)
  AND NOT EXISTS (
    SELECT 1 FROM stock_movements m JOIN stock_movements src ON src.id = m.ref_movement_id
    WHERE src.item_id = i.id AND m.item_id <> i.id
  );

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
