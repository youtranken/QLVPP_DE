import { snapshotsFixture } from './report-snapshots.fixture';

const YM = '2026-11';
// audit_log chỉ thêm, không xóa: mốc tăng theo giờ thật để dòng "kỳ" của lần chạy trước luôn cũ hơn bản chốt lần này
const BASE_MS =
  Date.parse('2026-11-10T17:00:01Z') +
  Math.floor((Date.now() - Date.parse('2026-01-01')) / 1000);

const ACTIONS = [
  ['request.updated', 'request'],
  ['line.cancel_remaining', 'request_line'],
  ['line.review', 'request_line'],
  ['arrival.adm_out_marked', 'period'],
  ['arrival.adm_owed_closed', 'period'],
] as const;

describe('V2D-4 changedAfter: thay đổi sau bản chốt có hàng (R-X.1)', () => {
  const f = snapshotsFixture('chgafter');
  const { ADMIN, create, pool, sendState } = f;
  let ids: { request: string; line: string };

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

  it('requests.updated_at: T−1 ms / T → false; T+1 ms → true', async () => {
    const t = BASE_MS + ACTIONS.length * 10;
    await snapshotAt(t);
    const touch = (ms: number) =>
      pool().query('UPDATE requests SET updated_at = $2 WHERE id = $1', [
        ids.request,
        new Date(ms).toISOString(),
      ]);
    for (const [ms, changed] of [
      [t - 1, false],
      [t, false],
      [t + 1, true],
    ] as const) {
      await touch(ms);
      expect((await sendState(YM)).changed_after).toBe(changed);
    }
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
