-- Khóa chính là claim `sub` của PMH ID, không khóa theo email.
CREATE TABLE IF NOT EXISTS users (
  sub text PRIMARY KEY,
  email text,
  employee_code text,
  full_name text,
  groups jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'active',
  role text NOT NULL DEFAULT 'member',
  first_login_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
