import type { Pool } from 'pg';

// Nhận hàng kỳ chỉ được khi kỳ đã có bản gửi NCC (bản chốt có hàng). Suite chỉ cần "đã gửi",
// không cần nội dung: một khóa giả có order_qty > 0, không đụng món thật của suite
export const SENT_HELPER_SUB = 'test-sent-helper';

export async function markSent(pool: Pool, ym: string): Promise<void> {
  const day = `${ym}-01`;
  await pool.query(
    `INSERT INTO periods (ym, deadline) VALUES ($1::date, ($1::date + interval '9 days'))
     ON CONFLICT (ym) DO NOTHING`,
    [day],
  );
  await pool.query(
    `INSERT INTO report_snapshots (period_ym, kind, data, created_by_sub, created_at)
     SELECT $1::date, 'print', $2::jsonb, $3, '2000-01-01T00:00:00Z'
     WHERE NOT EXISTS (SELECT 1 FROM report_snapshots WHERE period_ym = $1::date AND created_by_sub = $3)`,
    [
      day,
      JSON.stringify({
        order_qty: { 'custom:["seed","cai"]': 1 },
        byItem: [],
        custom: [],
      }),
      SENT_HELPER_SUB,
    ],
  );
}
