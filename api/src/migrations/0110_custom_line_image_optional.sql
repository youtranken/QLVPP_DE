-- Q1 2026-10-30: dòng ngoài danh mục không bắt buộc ảnh; ảnh chỉ bắt buộc khi Hành chính tạo món mới.
ALTER TABLE request_lines DROP CONSTRAINT request_lines_item_review_ck;
ALTER TABLE request_lines ADD CONSTRAINT request_lines_item_review_ck CHECK (
  (item_id IS NOT NULL AND custom_name IS NULL
    AND review_status IN ('n/a', 'converted'))
  OR (item_id IS NULL AND custom_name IS NOT NULL AND custom_unit IS NOT NULL
    AND review_status IN ('pending', 'accepted', 'rejected'))
);
