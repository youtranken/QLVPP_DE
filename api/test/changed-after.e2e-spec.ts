import { snapshotsFixture } from './report-snapshots.fixture';

const YM = '2026-11';
const FIRST_BASE_MS = Date.parse('2026-11-10T17:00:01Z');

const ACTIONS = [
  ['request.updated', 'request'],
  ['line.cancel_remaining', 'request_line'],
  ['line.review', 'request_line'],
  ['arrival.adm_out_marked', 'period'],
  ['arrival.adm_owed_closed', 'period'],
  ['arrival.adm_out_unmarked', 'period'],
  ['arrival.adm_owed_reopened', 'period'],
] as const;

describe('V2D-4 changedAfter: thay đổi sau bản chốt có hàng (R-X.1)', () => {
  const f = snapshotsFixture('chgafter');
  const { ADMIN, create, pool, sendState } = f;
  let ids: { request: string; line: string };
  // audit_log chỉ thêm, không xóa: mốc lần này đặt sau mọi dòng "kỳ" lần chạy trước để không bị đọc nhầm
  let BASE_MS = FIRST_BASE_MS;

  beforeAll(async () => {
    const { rows } = await pool().query<{ last: Date | null }>(
      `SELECT max(created_at) AS last FROM audit_log
       WHERE object_type = 'period' AND action LIKE 'arrival.%' AND created_at < '2026-11-12'`,
    );
    if (rows[0].last) {
      BASE_MS = Math.max(FIRST_BASE_MS, rows[0].last.getTime() + 1000);
    }
  });

  beforeEach(async () => {
    await f.resetPeriod(YM);
    const { request, line } = await f.lockedLine(0, 5);
    ids = { request: request.id, line: line.id };
  });

  const snapshotAt = async (ms: number) => {
    f.freeze(new Date(ms).toISOString());
    await create(YM, { kind: 'print' }).expect(201);
  };
  const audit = (action: string, type: string, ms: number) =>
    pool().query(
      `INSERT INTO audit_log (actor, action, object_type, object_id, detail, created_at)
       VALUES ($1, $2, $3, $4, '{}'::jsonb, $5::timestamptz)`,
      [
        ADMIN,
        action,
        type,
        type === 'period' ? YM : type === 'request' ? ids.request : ids.line,
        new Date(ms).toISOString(),
      ],
    );

  it.each(ACTIONS.map(([action, type], i) => [action, type, i] as const))(
    '%s: T−1 ms → false, T → false, T+1 ms → true (changed_at = T+1)',
    async (action, type, i) => {
      const t = BASE_MS + i * 10;
      await snapshotAt(t);
      await audit(action, type, t - 1);
      expect(await sendState(YM)).toMatchObject({
        changed_after: false,
        changed_at: null,
      });
      await audit(action, type, t);
      expect((await sendState(YM)).changed_after).toBe(false);
      await audit(action, type, t + 1);
      expect(await sendState(YM)).toMatchObject({
        changed_after: true,
        changed_at: new Date(t + 1).toISOString(),
      });
    },
  );

  it('requests.updated_at sau bản (giao hàng/Hủy nợ cũng chạm) không tính là thay đổi: T+1 ms → false', async () => {
    const t = BASE_MS + ACTIONS.length * 10;
    await snapshotAt(t);
    await pool().query('UPDATE requests SET updated_at = $2 WHERE id = $1', [
      ids.request,
      new Date(t + 1).toISOString(),
    ]);
    expect((await sendState(YM)).changed_after).toBe(false);
  });

  it('thay đổi của kỳ sau hoặc hành động khác không tính; chưa có bản → false', async () => {
    const t = BASE_MS + (ACTIONS.length + 1) * 10;
    expect(await sendState(YM)).toMatchObject({
      state: 'unsent',
      changed_after: false,
    });
    await snapshotAt(t);
    await pool().query(
      `INSERT INTO audit_log (actor, action, object_type, object_id, detail, created_at)
       VALUES ($1, 'stock.receipt', 'period', $2, '{}'::jsonb, $3::timestamptz),
              ($1, 'arrival.adm_out_marked', 'period', '2026-12', '{}'::jsonb, $3::timestamptz)`,
      [ADMIN, YM, new Date(t + 5).toISOString()],
    );
    expect((await sendState(YM)).changed_after).toBe(false);
  });
});
