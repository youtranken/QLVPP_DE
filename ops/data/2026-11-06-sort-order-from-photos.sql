-- Một lần: sort_order = số trên tên ảnh × 10 cho đúng 50 món (khớp theo code); lệch số dòng thì rollback cả khối.
-- Chạy lại cho cùng kết quả (thêm một dòng audit); detail.before giữ số cũ để đảo ngược bằng tay.
DO $$
DECLARE n int; before jsonb;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('id', id, 'sort_order', sort_order)) INTO before FROM items WHERE active;
  UPDATE items i SET sort_order = m.no * 10, updated_at = now()
  FROM (VALUES
    ('B05',1), ('B04',2), ('B47',3), ('K05',4), ('K04',5), ('B18',6), ('A01',7), ('BIA-CAY',8), ('B17',9), ('B19',10),
    ('B12',11), ('B22',12), ('BIA-2-KEP-F4',13), ('BIA-CONG-5CM',14), ('K03',15), ('RO-NHUA',16), ('B23',17), ('BUT-BI-TL-027',18), ('B41',19), ('B38',20),
    ('BUT-KIM-JELLITTO-04',21), ('B45',22), ('X01',23), ('R02',24), ('B35',25), ('B34',26), ('R01',27), ('C02',28), ('CHUOT-CHI-QUAY-TAY',29), ('G10',30),
    ('CUC-HIT-30MM',31), ('T06',32), ('G08',33), ('T05',34), ('T04',35), ('G11',36), ('KEP-GIAY',37), ('K10',38), ('KEO-NHO',39), ('DAO-RACH',40),
    ('D02',41), ('M01',42), ('K14',43), ('GO-KIM',44), ('M11',45), ('M03',46), ('M05',47), ('P01',48), ('S02',49), ('T01',50)
  ) AS m(code, no)
  WHERE i.code = m.code;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 50 THEN RAISE EXCEPTION 'sort-order: % dòng, cần 50', n; END IF;
  -- Cột người làm của audit_log là "actor"
  INSERT INTO audit_log (actor, action, object_type, object_id, detail)
  VALUES ('ops', 'item.reordered', 'catalog', 'photo-number',
          jsonb_build_object('source', 'photo-number', 'count', n, 'before', before));
END $$;
