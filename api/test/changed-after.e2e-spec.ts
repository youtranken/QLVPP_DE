import { arrivalsFixture } from './arrivals.fixture';

// Kỳ riêng nhỏ nhất (object_id <= ym): audit mang giờ ClockService (2000) nên không rơi sau bản chốt của suite khác, và audit giờ thật cũ của kỳ khác không lọt vào
const YM = '2000-03';
const NEXT = '2000-04';
const AFTER_NEXT = '2000-05';
const PRIVATE_YMS = [YM, NEXT, AFTER_NEXT].map((ym) => `${ym}-01`);
// audit_log chỉ thêm: audit kỳ của lần chạy trước còn đó → mốc T mỗi ca đặt sau mọi audit kỳ ≤ YM đã có (vẫn trong năm 2000, trước hạn kỳ sau)
const FIRST_T = Date.parse('2000-03-15T03:00:00Z');
const NEXT_DEADLINE = Date.parse('2000-04-10T17:00:00Z');
const STEP_MS = 1000;
const NEXT_LOCKED_AT = '2000-04-15T03:00:00Z';
const iso = (ms: number) => new Date(ms).toISOString();

type Act = () => Promise<unknown>;

describe('V2D-4 changedAfter qua endpoint thật, đồng hồ đứng (R-X.1, R-D-4)', () => {
  const f = arrivalsFixture('chgafter');
  const { A, B, ADMIN, as, http, pool, seedLine, sendState } = f;

  f.onCleanup(async (p) => {
    await p.query(
      'DELETE FROM requests WHERE period_ym = ANY($1::date[]) AND user_sub LIKE $2',
      [PRIVATE_YMS, `e2e-req-%-${f.SUFFIX}`],
    );
    await p.query(
      `DELETE FROM periods p WHERE p.ym = ANY($1::date[])
         AND NOT EXISTS (SELECT 1 FROM requests r WHERE r.period_ym = p.ym)
         AND NOT EXISTS (SELECT 1 FROM report_snapshots s WHERE s.period_ym = p.ym)
         AND NOT EXISTS (SELECT 1 FROM custom_receipts c WHERE c.period_ym = p.ym)`,
      [PRIVATE_YMS],
    );
  });

  let T = FIRST_T;
  beforeAll(async () => {
    const { rows } = await pool().query<{ last: Date | null }>(
      `SELECT max(created_at) AS last FROM audit_log
       WHERE object_type = 'period' AND object_id <= $1 AND created_at < $2`,
      [YM, iso(NEXT_DEADLINE)],
    );
    if (rows[0].last) T = Math.max(T, rows[0].last.getTime() + 60_000);
  });

  beforeEach(async () => {
    T += STEP_MS;
    expect(T + 60_000).toBeLessThan(NEXT_DEADLINE);
    await f.resetPeriod(YM);
    await f.ensurePeriod(YM);
    await f.ensurePeriod(NEXT);
    f.freeze(iso(T - 60_000));
  });

  const snapshotAtT = async () => {
    f.freeze(iso(T));
    await f.create(YM, { kind: 'print' }).expect(201);
    f.freeze(iso(T + 60_000));
    expect(await sendState(YM)).toMatchObject({
      state: 'sent',
      changed_after: false,
      changed_at: null,
    });
  };
  const at = async (ms: number, act: Act) => {
    f.freeze(iso(ms));
    await act();
    return sendState(YM);
  };
  // Ba thao tác thật cùng loại lúc T−1 ms, T, T+1 ms sau bản chốt lúc T
  const boundary = async ([before, same, after]: Act[]) => {
    expect(await at(T - 1, before)).toMatchObject({
      changed_after: false,
      changed_at: null,
    });
    expect(await at(T, same)).toMatchObject({
      changed_after: false,
      changed_at: null,
    });
    expect(await at(T + 1, after)).toMatchObject({
      changed_after: true,
      changed_at: iso(T + 1),
    });
  };
  // Món tủ 0 → số đề nghị > 0: bản chốt có hàng dù các món thử bị đánh dấu
  const base = async () =>
    seedLine(YM, B, { item_id: await f.stockItem(0), qty: 2 });
  const itemLines = async (n: number, qty = 2) => {
    const out: { item: string; line: string }[] = [];
    for (let i = 0; i < n; i++) {
      const item = await f.stockItem(0);
      out.push({ item, line: await seedLine(YM, A, { item_id: item, qty }) });
    }
    return out;
  };
  const requestOf = async (lineId: string) =>
    (
      await pool().query<{ request_id: string }>(
        'SELECT request_id FROM request_lines WHERE id = $1',
        [lineId],
      )
    ).rows[0].request_id;

  it('request.updated (điều chỉnh giảm qua PUT admin/requests/:id/lines)', async () => {
    const [{ line }] = await itemLines(1, 5);
    const id = await requestOf(line);
    await snapshotAtT();
    const reduce = (from: number) => async () => {
      const view = (
        await as(
          http().get(`/api/admin/requests/${id}`),
          ADMIN,
          'admin',
        ).expect(200)
      ).body as { updated_at: string };
      await as(http().put(`/api/admin/requests/${id}/lines`), ADMIN, 'admin')
        .send({
          expected_updated_at: view.updated_at,
          lines: [
            {
              id: line,
              qty: from - 1,
              expected_qty: from,
              reason_code: 'over_quota',
            },
          ],
        })
        .expect(200);
    };
    await boundary([reduce(5), reduce(4), reduce(3)]);
  });

  it('line.cancel_remaining (Hủy nợ)', async () => {
    const lines = await itemLines(3);
    await snapshotAtT();
    await boundary(
      lines.map(
        ({ line }) =>
          () =>
            f
              .cancel(line, {
                reason: 'Người đã nghỉ',
                expected_delivered_qty: 0,
                expected_qty: 2,
              })
              .expect(200),
      ),
    );
  });

  it('line.review (duyệt dòng ngoài danh mục)', async () => {
    await base();
    const lines: string[] = [];
    for (const n of ['Bìa 1', 'Bìa 2', 'Bìa 3']) {
      lines.push(
        await seedLine(YM, A, f.customCols(f.customName(n), 1, 'pending')),
      );
    }
    await snapshotAtT();
    await boundary(
      lines.map((l) => () => f.review(l, { action: 'accept' }).expect(200)),
    );
  });

  it('line.cancel_remaining {reason_code: adm_out_of_stock}', async () => {
    await base();
    const lines = await itemLines(3);
    for (const { item } of lines) await f.markOut(YM, item).expect(200);
    await snapshotAtT();
    await boundary(
      lines.map(
        ({ line }) =>
          () =>
            f
              .cancel(line, {
                reason_code: 'adm_out_of_stock',
                expected_delivered_qty: 0,
                expected_qty: 2,
              })
              .expect(200),
      ),
    );
  });

  it('arrival.adm_out_marked', async () => {
    await base();
    const lines = await itemLines(3);
    await snapshotAtT();
    await boundary(
      lines.map(
        ({ item }) =>
          () =>
            f.markOut(YM, item).expect(200),
      ),
    );
  });

  it('arrival.adm_out_unmarked', async () => {
    await base();
    const lines = await itemLines(3);
    for (const { item } of lines) await f.markOut(YM, item).expect(200);
    await snapshotAtT();
    await boundary(
      lines.map(
        ({ item }) =>
          () =>
            f.unmarkOut(YM, item).expect(204),
      ),
    );
  });

  it('arrival.adm_owed_closed', async () => {
    await base();
    const lines = await itemLines(3);
    await snapshotAtT();
    await boundary(
      lines.map(
        ({ item }) =>
          () =>
            f.closeOwed(YM, item).expect(200),
      ),
    );
  });

  it('arrival.adm_owed_reopened', async () => {
    await base();
    const lines = await itemLines(3);
    for (const { item } of lines) await f.closeOwed(YM, item).expect(200);
    await snapshotAtT();
    await boundary(
      lines.map(
        ({ item }) =>
          () =>
            f.reopenOwed(YM, item).expect(204),
      ),
    );
  });

  it('chưa có bản → false; giao hàng và nhập hàng về sau bản (T+1) không tính (R-D-4)', async () => {
    const [{ item, line }] = await itemLines(1);
    expect(await sendState(YM)).toMatchObject({
      state: 'unsent',
      changed_after: false,
    });
    await snapshotAtT();
    const state = await at(T + 1, async () => {
      await f
        .receipts({
          ym: YM,
          lines: [{ item_id: item, qty: 2, expected_stock_qty: 0 }],
        })
        .expect(200);
      await f.deliver(line, { qty: 1, expected_delivered_qty: 0 }).expect(200);
    });
    expect(state).toMatchObject({ changed_after: false, changed_at: null });
  });

  it('đánh dấu của kỳ sau không tính cho kỳ này', async () => {
    await base();
    await snapshotAtT();
    await f.ensurePeriod(AFTER_NEXT);
    const item = await f.stockItem(0);
    await seedLine(NEXT, A, { item_id: item, qty: 2 });
    f.freeze(NEXT_LOCKED_AT);
    await f.markOut(NEXT, item).expect(200);
    expect(await sendState(YM)).toMatchObject({
      changed_after: false,
      changed_at: null,
    });
  });
});
