-- Đường dẫn vật lý suy từ id + mime (/data/files/<id>.<ext>), không lưu cột path.
CREATE TABLE IF NOT EXISTS files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_name text NOT NULL,
  mime text NOT NULL,
  size_bytes int NOT NULL,
  purpose text NOT NULL CHECK (purpose IN ('item_image', 'line_image')),
  uploaded_by_sub text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS files_created_idx ON files (created_at);
