import { Client } from 'pg';

export const DB_PROBE = 'DB_PROBE';
export type DbProbe = () => Promise<void>;

const PROBE_TIMEOUT_MS = 3000;

// Client riêng có hạn giờ: pool chính chờ client rảnh vô hạn, còn health phải trả 503 nhanh khi DB treo
export async function probeDatabase(
  connectionString: string | undefined,
): Promise<void> {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: PROBE_TIMEOUT_MS,
    query_timeout: PROBE_TIMEOUT_MS,
  });
  client.on('error', () => undefined);
  try {
    await client.connect();
    await client.query('SELECT 1');
  } finally {
    void client.end().catch(() => undefined);
  }
}
