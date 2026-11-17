-- G2 (chủ dự án chốt 15/11/2026): lý do "Không mua được" cho giảm/từ chối dòng
ALTER TABLE request_line_adjustments
  DROP CONSTRAINT request_line_adjustments_reason_code_check,
  ADD CONSTRAINT request_line_adjustments_reason_code_check
    CHECK (reason_code IN ('over_quota','adm_out_of_stock','duplicate','other','user_left','removed','cannot_buy'));
