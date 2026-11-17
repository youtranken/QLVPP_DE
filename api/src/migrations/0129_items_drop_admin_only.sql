-- G7 (chủ dự án chốt 15/11/2026): bỏ "món chỉ Adm D&E". Dừng nếu còn món đang bật cờ, để người vận hành xử lý trước.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM items WHERE admin_only) THEN
    RAISE EXCEPTION 'Còn món admin_only = true — bỏ cờ trước khi chạy 0129';
  END IF;
END $$;

ALTER TABLE items DROP COLUMN admin_only;
