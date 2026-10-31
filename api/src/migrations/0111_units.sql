-- ĐVT do Hành chính quản lý; code sinh một lần khi tạo, không đổi (FK RESTRICT giữ món/dòng phiếu cũ).
CREATE TABLE units (
  code text PRIMARY KEY,
  name text NOT NULL CHECK (name = btrim(name) AND char_length(name) BETWEEN 1 AND 40),
  name_en text CHECK (char_length(name_en) <= 40),
  sort_order int NOT NULL DEFAULT 0,
  active bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX units_name_uq ON units (lower(name));

INSERT INTO units (code, name, name_en, sort_order) VALUES
  ('cai', 'cái', 'piece', 10),
  ('hop', 'hộp', 'box', 20),
  ('cay', 'cây', 'stick', 30),
  ('ram', 'ram', 'ream', 40),
  ('cuon', 'cuộn', 'roll', 50),
  ('loc', 'lốc', 'pack', 60),
  ('bich', 'bịch', 'bag', 70),
  ('chai', 'chai', 'bottle', 80),
  ('bo', 'bộ', 'set', 90);

ALTER TABLE items DROP CONSTRAINT items_unit_check;
ALTER TABLE items ADD CONSTRAINT items_unit_fkey FOREIGN KEY (unit)
  REFERENCES units (code) ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE request_lines ADD CONSTRAINT request_lines_custom_unit_fkey FOREIGN KEY (custom_unit)
  REFERENCES units (code) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE INDEX request_lines_custom_unit_idx ON request_lines (custom_unit) WHERE custom_unit IS NOT NULL;
CREATE INDEX items_unit_idx ON items (unit);
