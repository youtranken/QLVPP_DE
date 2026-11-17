-- Dữ liệu mẫu cho kiểm giao diện trên DB dev (người 'mau-*'). Nạp/gỡ: README mục Playwright.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN IF current_database() <> 'vpp' THEN RAISE EXCEPTION 'chỉ DB dev'; END IF;
  IF EXISTS (SELECT 1 FROM users WHERE sub LIKE 'mau-%') THEN RAISE EXCEPTION 'đã seed rồi'; END IF; END $$;

INSERT INTO users (sub, email, employee_code, full_name, status, department, team, inactive_at) VALUES
 ('mau-01','mau01@mau.example','CT-0412','Trần Minh Khoa','active','Phòng Kỹ thuật','Tổ Thiết kế',NULL),
 ('mau-02','mau02@mau.example','CT-0388','Nguyễn Thị Phương Thảo','active','Phòng Kỹ thuật','Tổ Giám sát',NULL),
 ('mau-03','mau03@mau.example','CT-0521','Lê Hoàng Bảo Ngọc','active','Phòng Kế toán',NULL,NULL),
 ('mau-04','mau04@mau.example','CT-0107','Phạm Quốc Việt','active','Ban Quản lý dự án','Dự án Riverpark',NULL),
 ('mau-05','mau05@mau.example','CT-0633','Đặng Thị Mỹ Duyên','active','Ban Quản lý dự án','Dự án Riverpark',NULL),
 ('mau-06','mau06@mau.example','CT-0290','Võ Trọng Nghĩa','active','Phòng Nhân sự',NULL,NULL),
 ('mau-07','mau07@mau.example','CT-0715','Huỳnh Ngọc Thiên Kim Nguyên Khánh','active','Phòng Kỹ thuật','Tổ Thiết kế',NULL),
 ('mau-08','mau08@mau.example','CT-0098','Bùi Văn Tâm','deleted','Phòng Kế toán',NULL, now() - interval '5 days');

INSERT INTO periods (ym, deadline) VALUES ('2026-11-01','2026-10-10T17:00:00Z'), ('2026-10-01','2026-09-10T17:00:00Z') ON CONFLICT DO NOTHING;

CREATE TEMP TABLE it AS SELECT id, row_number() OVER (ORDER BY sort_order, name) n FROM items WHERE active;

-- phiếu: (sub, ym, note, [(n, qty)])
CREATE TEMP TABLE plan(sub text, ym date, note text, n int, qty int, pos int);
INSERT INTO plan VALUES
 ('mau-01','2026-11-01',NULL,1,5,0),('mau-01','2026-11-01',NULL,4,2,1),('mau-01','2026-11-01',NULL,9,3,2),
 ('mau-02','2026-11-01','Cần gấp cho đợt nghiệm thu',2,10,0),('mau-02','2026-11-01',NULL,6,4,1),
 ('mau-08','2026-11-01',NULL,3,6,0),('mau-08','2026-11-01',NULL,12,2,1),
 ('mau-01','2026-12-01',NULL,1,4,0),('mau-01','2026-12-01',NULL,5,2,1),('mau-01','2026-12-01',NULL,14,1,2),
 ('mau-02','2026-12-01',NULL,2,8,0),('mau-02','2026-12-01',NULL,3,3,1),('mau-02','2026-12-01',NULL,20,6,2),('mau-02','2026-12-01',NULL,21,2,3),
 ('mau-03','2026-12-01','Giao giúp trước ngày 20',8,10,0),('mau-03','2026-12-01',NULL,11,5,1),
 ('mau-04','2026-12-01',NULL,1,10,0),('mau-04','2026-12-01',NULL,2,10,1),('mau-04','2026-12-01',NULL,6,6,2),('mau-04','2026-12-01',NULL,15,3,3),('mau-04','2026-12-01',NULL,18,2,4),('mau-04','2026-12-01',NULL,25,4,5),
 ('mau-05','2026-12-01',NULL,4,2,0),('mau-05','2026-12-01',NULL,9,1,1),
 ('mau-06','2026-12-01',NULL,30,3,0),
 ('mau-07','2026-12-01',NULL,1,2,0),('mau-07','2026-12-01',NULL,33,5,1),('mau-07','2026-12-01',NULL,40,1,2),
 ('mau-01','2027-01-01',NULL,1,3,0),('mau-01','2027-01-01',NULL,2,5,1),
 ('mau-03','2027-01-01',NULL,8,6,0),
 ('mau-04','2027-01-01',NULL,6,4,0),('mau-04','2027-01-01',NULL,15,2,1),
 ('mau-07','2027-01-01',NULL,33,2,0);

INSERT INTO requests (period_ym, user_sub, created_by_sub, department, note, saved_at)
SELECT DISTINCT ON (p.sub, p.ym) p.ym, p.sub, p.sub, u.department,
  (SELECT note FROM plan q WHERE q.sub=p.sub AND q.ym=p.ym AND note IS NOT NULL LIMIT 1),
  CASE WHEN p.ym = '2027-01-01' THEN now() - interval '1 day' ELSE p.ym - interval '25 days' END
FROM plan p JOIN users u ON u.sub = p.sub;

INSERT INTO request_lines (request_id, item_id, qty, created_at)
SELECT r.id, it.id, p.qty, r.saved_at + p.pos * interval '1 second'
FROM plan p JOIN requests r ON r.user_sub=p.sub AND r.period_ym=p.ym JOIN it ON it.n = p.n;

-- món ngoài danh mục ở kỳ 12: 2 chờ duyệt, 1 đã nhận, 1 từ chối
INSERT INTO request_lines (request_id, custom_name, custom_unit, custom_note, qty, review_status, review_note, created_at)
SELECT r.id, x.name, x.unit, x.cnote, x.qty, x.st, x.rnote, r.saved_at + interval '10 seconds'
FROM (VALUES
  ('mau-02','Bút kỹ thuật Rotring Isograph 0.35mm','cay','Loại vỏ xám, dùng cho bản vẽ A1',2,'pending',NULL),
  ('mau-04','Thước cuộn thép 7.5m Stanley','cai',NULL,1,'pending',NULL),
  ('mau-07','Sổ tay bìa da A5 có khóa','cuon-2','Màu đen',3,'accepted',NULL),
  ('mau-03','Máy tính Casio FX-580VN X','cai',NULL,1,'rejected','Đã có trong danh mục: Máy tính Casio')
) AS x(sub,name,unit,cnote,qty,st,rnote)
JOIN requests r ON r.user_sub = x.sub AND r.period_ym = '2026-12-01';

-- kỳ 11 đã giao xong phần lớn: mau-02 còn nợ 4 + 2; mau-08 (đã nghỉ) còn nợ 6; NV giao đủ
UPDATE request_lines l SET delivered_qty = l.qty - CASE
    WHEN r.user_sub = 'mau-02' AND l.qty = 10 THEN 4 WHEN r.user_sub = 'mau-02' THEN 2
    WHEN r.user_sub = 'mau-08' AND l.qty = 6 THEN 6 WHEN r.user_sub = 'mau-08' THEN 0 ELSE 0 END,
  last_delivered_at = r.period_ym + interval '20 days'
FROM requests r WHERE r.id = l.request_id AND r.period_ym = '2026-11-01';
INSERT INTO line_deliveries (line_id, qty, actor_sub, created_at)
SELECT l.id, l.delivered_qty, 'mau-adm', l.last_delivered_at
FROM request_lines l JOIN requests r ON r.id=l.request_id WHERE r.period_ym='2026-11-01' AND l.delivered_qty > 0;

-- tủ: hàng có sẵn cho khoảng nửa danh mục (nhập kho thật bằng phiếu mua)
INSERT INTO stock_movements (item_id, delta, reason, note, actor_sub, created_at)
SELECT id, (n * 7) % 23 + 2, 'purchase', 'Tồn đầu kỳ (dữ liệu mẫu)', 'mau-adm', now() - interval '40 days'
FROM it WHERE n % 2 = 1 AND n > 10;
UPDATE items i SET stock_qty = i.stock_qty + m.delta FROM stock_movements m
WHERE m.item_id = i.id AND m.note = 'Tồn đầu kỳ (dữ liệu mẫu)';
-- vài món sắp hết để có cảnh báo
UPDATE items SET restock_level = 5 WHERE id IN (SELECT id FROM it WHERE n IN (13, 17, 21));

SELECT 'users', count(*) FROM users WHERE sub LIKE 'mau-%'
UNION ALL SELECT 'requests', count(*) FROM requests WHERE user_sub LIKE 'mau-%'
UNION ALL SELECT 'lines', count(*) FROM request_lines l JOIN requests r ON r.id=l.request_id WHERE r.user_sub LIKE 'mau-%'
UNION ALL SELECT 'stocked items', count(*) FROM items WHERE stock_qty > 0;
COMMIT;
