-- Lý do "removed": Hành chính bấm X bỏ cả dòng trong ngăn Điều chỉnh (qty_after = 0); hủy nợ không dùng mã này
ALTER TABLE request_line_adjustments
  DROP CONSTRAINT request_line_adjustments_reason_code_check,
  ADD CONSTRAINT request_line_adjustments_reason_code_check
    CHECK (reason_code IN ('over_quota','adm_out_of_stock','duplicate','other','user_left','removed'));
