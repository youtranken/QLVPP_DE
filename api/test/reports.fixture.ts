import type {
  MonthReport,
  ReportCustomRow,
} from '../src/modules/reports/report.types';
import { deliveryFixture } from './delivery.fixture';

// Báo cáo chỉ đọc cột → seed thẳng SQL dòng phiếu ở mọi trạng thái; kỳ 2026-10 đã khóa, 2026-11 khóa lúc 10/11 17:00Z
export function reportsFixture(tag: string) {
  const f = deliveryFixture(tag);
  const { ADMIN, SUFFIX, as, http, imgA, pool } = f;

  const report = (ym: string, sub = ADMIN, role = 'admin') =>
    as(http().get(`/api/admin/reports/${ym}`), sub, role);
  const build = async (ym: string) =>
    (await report(ym).expect(200)).body as MonthReport;

  const seedLine = async (
    ym: string,
    sub: string,
    cols: Record<string, unknown>,
    department: string | null = 'Phòng CT',
  ) => {
    await pool().query(
      `INSERT INTO periods (ym, deadline) VALUES ('2026-10-01', '2026-10-10T17:00:00Z')
       ON CONFLICT (ym) DO NOTHING`,
    );
    const { rows } = await pool().query<{ id: string }>(
      `INSERT INTO requests (period_ym, user_sub, department, created_by_sub)
       VALUES ($1::date, $2, $3, $2)
       ON CONFLICT (period_ym, user_sub) DO UPDATE SET updated_at = requests.updated_at
       RETURNING id`,
      [`${ym}-01`, sub, department],
    );
    const keys = Object.keys(cols);
    const line = await pool().query<{ id: string }>(
      `INSERT INTO request_lines (request_id, ${keys.join(', ')})
       VALUES ($1, ${keys.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING id`,
      [rows[0].id, ...Object.values(cols)],
    );
    return line.rows[0].id;
  };

  const customName = (base: string) => `${base}-${SUFFIX}`;
  const customCols = (name: string, qty: number, status = 'accepted') => ({
    custom_name: name,
    custom_unit: 'cai',
    image_file_id: imgA(),
    review_status: status,
    qty,
  });
  const customRow = (r: MonthReport, base: string) =>
    r.custom.find((c: ReportCustomRow) =>
      c.name.toLowerCase().includes(customName(base).toLowerCase()),
    );
  const itemRow = (r: MonthReport, itemId: string) =>
    r.byItem.find((i) => i.key === itemId);
  const itemName = async (itemId: string) =>
    (
      await pool().query<{ name: string }>(
        'SELECT name FROM items WHERE id = $1',
        [itemId],
      )
    ).rows[0].name;
  const issueAt = async (
    itemId: string,
    qty: number,
    at: string,
    recipient: string | null,
  ) =>
    pool().query(
      `INSERT INTO stock_movements (item_id, delta, reason, recipient_sub, note, actor_sub, created_at)
       VALUES ($1, $2, 'issue', $3, 'dùng cho hội nghị', $4, $5::timestamptz)`,
      [itemId, -qty, recipient, ADMIN, at],
    );

  return {
    ...f,
    report,
    build,
    seedLine,
    customName,
    customCols,
    customRow,
    itemRow,
    itemName,
    issueAt,
  };
}
