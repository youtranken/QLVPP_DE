-- Không FK (như audit_log): phiếu/dòng/món/người/kỳ xóa được mà không vướng 23503
CREATE TABLE request_line_adjustments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id    uuid NOT NULL,
  period_ym   date NOT NULL,
  user_sub    text NOT NULL,
  request_id  uuid NOT NULL,
  line_id     uuid NOT NULL,
  item_id     uuid,
  name        text NOT NULL,
  unit        text NOT NULL,
  qty_before  int  NOT NULL CHECK (qty_before > 0),
  qty_after   int  NOT NULL CHECK (qty_after >= 0),
  reason_code text NOT NULL CHECK (reason_code IN ('over_quota','adm_out_of_stock','duplicate','other','user_left')),
  reason_note text CHECK (reason_note IS NULL OR char_length(reason_note) BETWEEN 1 AND 200),
  actor_sub   text NOT NULL,
  created_at  timestamptz NOT NULL,
  CHECK (qty_after < qty_before),
  CHECK (reason_code <> 'other' OR (reason_note IS NOT NULL AND char_length(btrim(reason_note)) >= 3)),
  UNIQUE (batch_id, line_id)
);
CREATE INDEX request_line_adjustments_request_idx ON request_line_adjustments (request_id);
CREATE INDEX request_line_adjustments_period_idx  ON request_line_adjustments (period_ym, created_at);
CREATE INDEX request_line_adjustments_owner_idx   ON request_line_adjustments (user_sub, period_ym, created_at);

CREATE FUNCTION forbid_adjustment_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'request_line_adjustments is append-only — không được %', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER request_line_adjustments_append_only
  BEFORE UPDATE OR DELETE ON request_line_adjustments
  FOR EACH ROW EXECUTE FUNCTION forbid_adjustment_mutation();
CREATE TRIGGER request_line_adjustments_no_truncate
  BEFORE TRUNCATE ON request_line_adjustments
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_adjustment_mutation();
