-- Nhật ký hỏi "dòng gộp hàng về này có món con không" theo detail->>'batch_id' mỗi lần tải trang
CREATE INDEX IF NOT EXISTS idx_audit_log_batch_id ON audit_log ((detail->>'batch_id')) WHERE (detail->>'batch_id') IS NOT NULL;
