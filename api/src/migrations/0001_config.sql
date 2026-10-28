CREATE TABLE IF NOT EXISTS config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO config (key, value) VALUES
  ('registration_last_day', '10'),
  ('default_max_qty', '20'),
  ('admin_group', '"vpp-admin"'),
  ('authorized_groups', '[]'),
  ('low_stock_notify', 'true'),
  ('signers', '{"preparer": "", "head": "", "approver": ""}'),
  ('admin_contact', '""')
ON CONFLICT (key) DO NOTHING;
