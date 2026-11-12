import { arrivalsFixture } from './arrivals.fixture';

// Kỳ riêng nhỏ nhất (object_id <= ym): audit mang giờ ClockService (2000) nên không rơi sau bản chốt của suite khác, và audit giờ thật cũ của kỳ khác không lọt vào
const PREV = '2000-02';
const YM = '2000-03';
const NEXT = '2000-04';
const AFTER_NEXT = '2000-05';
const PRIVATE_YMS = [PREV, YM, NEXT, AFTER_NEXT].map((ym) => `${ym}-01`);
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
  // Thao tác không đổi đơn (hệ quả của nhận/giao hàng kỳ này): trước, cùng và sau mốc bản đều không tính
  const neverCounts = async (acts: Act[]) => {
    for (const [i, act] of acts.entries()) {
      expect(await at(T - 1 + i, act)).toMatchObject({
        changed_after: false,
        changed_at: null,
      });
    }
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

  // Hủy nợ chỉ cho nợ tháng trước kỳ đang giao: dòng kỳ PREV, bản chốt kỳ YM
  it('line.cancel_remaining (Hủy nợ)', async () => {
    await f.ensurePeriod(PREV);
    const lines: string[] = [];
    for (let i = 0; i < 3; i++) {
      const item = await f.stockItem(0);
      lines.push(await seedLine(PREV, A, { item_id: item, qty: 2 }));
    }
    await snapshotAtT();
    await boundary(
      lines.map(
        (line) => () =>
          f
            .cancel(line, {
              reason_code: 'not_needed',
              expected_delivered_qty: 0,
              expected_qty: 2,
            })
            .expect(200),
      ),
    );
  });

  it('line.review (duyệt dòng ngoài danh mục)', async () => {
    await base();
    // Chốt bản ghi Không mua cho dòng còn chờ → gieo dòng chờ sau bản (SQL thẳng, không audit)
    await snapshotAtT();
    const lines: string[] = [];
    for (const n of ['Bìa 1', 'Bìa 2', 'Bìa 3']) {
      lines.push(
        await seedLine(YM, A, f.customCols(f.customName(n), 1, 'pending')),
      );
    }
    await boundary(
      lines.map((l) => () => f.review(l, { action: 'accept' }).expect(200)),
    );
  });

  it('line.cancel_remaining {reason_code: adm_out_of_stock} không tính (hủy vì NCC hết hàng không đổi đơn)', async () => {
    await base();
    const lines = await itemLines(3);
    for (const { item } of lines) await f.markOut(YM, item).expect(200);
    await snapshotAtT();
    await neverCounts(
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

  // Hủy phần thiếu vì NCC hết hàng là hệ quả của nhận/giao hàng kỳ này, không đổi đơn: web cộng lại vào cần nay như phần đã giao
  it('settled_since = giao + hủy NCC hết hàng sau bản trên dòng có trong căn cứ, theo khóa; cùng mốc bản hoặc dòng vào sau bản không cộng', async () => {
    await base();
    const item = await f.stockItem(1);
    const line = await seedLine(YM, A, { item_id: item, qty: 3 });
    const same = await seedLine(YM, B, { item_id: item, qty: 2 });
    // Dòng có trong căn cứ lúc chốt: tạo trước bản (seed mang giờ thật, bản chốt ở năm 2000)
    await pool().query(
      'UPDATE request_lines SET created_at = $2::timestamptz WHERE id = ANY($1::uuid[])',
      [[line, same], iso(T - 60_000)],
    );
    const other = await f.stockItem(0);
    // Dòng vào sau bản (giờ thật > bản chốt năm 2000), món khác cùng NCC hết hàng: không có trong căn cứ
    const late = await seedLine(YM, B, { item_id: other, qty: 4 });
    await f.markOut(YM, item).expect(200);
    await f.markOut(YM, other).expect(200);
    await snapshotAtT();
    const cancel = (id: string, delivered: number, qty: number) =>
      f
        .cancel(id, {
          reason_code: 'adm_out_of_stock',
          expected_delivered_qty: delivered,
          expected_qty: qty,
        })
        .expect(200);
    await at(T, () => cancel(same, 0, 2));
    expect((await sendState(YM)).settled_since).toEqual({});
    await at(T + 1, async () => {
      await f.deliver(line, { qty: 1, expected_delivered_qty: 0 }).expect(200);
      await cancel(line, 1, 3);
      await cancel(late, 0, 4);
    });
    const state = await sendState(YM);
    expect(state.settled_since).toEqual({ [item]: 3 });
    expect(state).toMatchObject({ changed_after: false, changed_at: null });
  });

  // Nợ tháng trước hủy mã adm_out_of_stock khi khóa không đánh dấu đi đường hủy thường (audit không có cancelled_now): vẫn cộng theo before/after
  it('settled_since cộng cả hủy nợ kỳ trước mã adm_out_of_stock (khóa không đánh dấu)', async () => {
    await base();
    await f.ensurePeriod(PREV);
    const item = await f.stockItem(0);
    const debt = await seedLine(PREV, A, { item_id: item, qty: 2 });
    await pool().query(
      'UPDATE request_lines SET created_at = $2::timestamptz WHERE id = $1',
      [debt, iso(T - 60_000)],
    );
    await snapshotAtT();
    await at(T + 1, () =>
      f
        .cancel(debt, {
          reason_code: 'adm_out_of_stock',
          expected_delivered_qty: 0,
          expected_qty: 2,
        })
        .expect(200),
    );
    const state = await sendState(YM);
    expect(state.settled_since).toEqual({ [item]: 2 });
    expect(state).toMatchObject({ changed_after: false, changed_at: null });
  });

  it('arrival.adm_out_marked không tính (đánh dấu/đóng nợ NCC không đổi cần)', async () => {
    await base();
    const lines = await itemLines(3);
    await snapshotAtT();
    await neverCounts(
      lines.map(
        ({ item }) =>
          () =>
            f.markOut(YM, item).expect(200),
      ),
    );
  });

  it('arrival.adm_out_unmarked không tính (đánh dấu/đóng nợ NCC không đổi cần)', async () => {
    await base();
    const lines = await itemLines(3);
    for (const { item } of lines) await f.markOut(YM, item).expect(200);
    await snapshotAtT();
    await neverCounts(
      lines.map(
        ({ item }) =>
          () =>
            f.unmarkOut(YM, item).expect(204),
      ),
    );
  });

  it('arrival.adm_owed_closed không tính (đánh dấu/đóng nợ NCC không đổi cần)', async () => {
    await base();
    const lines = await itemLines(3);
    await snapshotAtT();
    await neverCounts(
      lines.map(
        ({ item }) =>
          () =>
            f.closeOwed(YM, item).expect(200),
      ),
    );
  });

  it('arrival.adm_owed_reopened không tính (đánh dấu/đóng nợ NCC không đổi cần)', async () => {
    await base();
    const lines = await itemLines(3);
    for (const { item } of lines) await f.closeOwed(YM, item).expect(200);
    await snapshotAtT();
    await neverCounts(
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
