import { snapshotsFixture } from './report-snapshots.fixture';

// audit_log.created_at là now() của DB (giờ thật) → bản chốt kỳ 10 đặt ngay trước giờ thật, thao tác thật sau đó
const YM = '2026-10';
const DEBT_YM = '2026-09';

describe('V2D-4 changedAfter theo thao tác thật: giao không tính, điều chỉnh và Hủy nợ tính (R-D-4)', () => {
  const f = snapshotsFixture('chgreal');
  const { ADMIN, B, as, http, pool, seedLine, sendState } = f;

  f.onCleanup((p) =>
    p.query(
      `DELETE FROM periods WHERE ym = '2026-09-01'
         AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = '2026-09-01')
         AND NOT EXISTS (SELECT 1 FROM report_snapshots WHERE period_ym = '2026-09-01')`,
    ),
  );
  beforeEach(async () => {
    await f.resetPeriod(YM);
    await pool().query(
      `INSERT INTO periods (ym, deadline) VALUES ('2026-09-01', '2026-09-10T17:00:00Z') ON CONFLICT (ym) DO NOTHING`,
    );
  });
  afterEach(() => f.resetPeriod(YM));

  // Nợ kỳ 9 (3) + đăng ký kỳ 10 (2) cùng món, tủ 10; bản chốt kỳ 10 lúc giờ thật − 1 phút
  const setup = async () => {
    const item = await f.stockItem(10);
    const debt = await seedLine(DEBT_YM, B, { item_id: item, qty: 3 });
    const own = await seedLine(YM, B, { item_id: item, qty: 2 });
    f.freeze(new Date(Date.now() - 60_000).toISOString());
    await f.create(YM, { kind: 'print' }).expect(201);
    f.freeze(new Date().toISOString());
    expect((await sendState(YM)).changed_after).toBe(false);
    return { item, debt, own };
  };

  it('giao một dòng sau bản → không có thay đổi sau bản', async () => {
    const { own } = await setup();
    await f.deliver(own, { qty: 1, expected_delivered_qty: 0 }).expect(200);
    expect((await sendState(YM)).changed_after).toBe(false);
  });

  it('điều chỉnh (giảm) một dòng sau bản → có thay đổi sau bản', async () => {
    const { own } = await setup();
    const view = (
      await as(
        http().get(`/api/admin/requests/${await requestOf(own)}`),
        ADMIN,
        'admin',
      ).expect(200)
    ).body as { id: string; updated_at: string };
    await as(http().put(`/api/admin/requests/${view.id}/lines`), ADMIN, 'admin')
      .send({
        expected_updated_at: view.updated_at,
        lines: [
          { id: own, qty: 1, expected_qty: 2, reason_code: 'over_quota' },
        ],
      })
      .expect(200);
    expect((await sendState(YM)).changed_after).toBe(true);
  });

  it('Hủy nợ dòng nợ kỳ trước sau bản → có thay đổi sau bản', async () => {
    const { debt } = await setup();
    await f
      .cancel(debt, {
        reason: 'Người đã nghỉ',
        expected_delivered_qty: 0,
        expected_qty: 3,
      })
      .expect(200);
    expect((await sendState(YM)).changed_after).toBe(true);
  });

  const requestOf = async (lineId: string) =>
    (
      await pool().query<{ request_id: string }>(
        'SELECT request_id FROM request_lines WHERE id = $1',
        [lineId],
      )
    ).rows[0].request_id;
});
