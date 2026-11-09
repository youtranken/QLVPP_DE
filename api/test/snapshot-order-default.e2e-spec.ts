import type { MonthReport } from '../src/modules/reports/report.types';
import { snapshotsFixture } from './report-snapshots.fixture';

const YM = '2026-11';
const PREV = '2026-10';

describe('V2D-4 số đề nghị mặc định gộp khi chốt (R-D13.1–R-D13.11)', () => {
  const f = snapshotsFixture('orderdef');
  const { A, B, ADMIN, SUFFIX, create, insertSnapshot, pool, seedLine } = f;
  const C = `e2e-req-c-${SUFFIX}`;

  beforeAll(() =>
    pool().query(
      `INSERT INTO users (sub, full_name, department, status) VALUES ($1, 'Nhân viên C', 'Phòng CT', 'deleted')`,
      [C],
    ),
  );
  f.onCleanup(async (p) => {
    await p.query('DELETE FROM requests WHERE user_sub = $1', [C]);
    await p.query(
      'DELETE FROM period_adm_out WHERE marked_by = $1 OR marked_by LIKE $2',
      [ADMIN, `e2e-req-%-${SUFFIX}`],
    );
  });
  beforeEach(async () => {
    await Promise.all([f.resetPeriod(YM), f.resetPeriod(PREV)]);
    await pool().query('DELETE FROM requests WHERE user_sub = $1', [C]);
    await pool().query('DELETE FROM period_adm_out WHERE marked_by = $1', [
      ADMIN,
    ]);
    f.freeze('2026-11-12T03:00:00Z');
  });
  // Kỳ 10 bị fixture xóa khi hết phiếu → bản chốt kỳ 10 phải đi trước (FK)
  afterEach(() => f.resetPeriod(PREV));

  const printOk = async (order_qty: object = {}) =>
    (await create(YM, { kind: 'print', order_qty }).expect(201)).body as {
      data: {
        order_qty: Record<string, number>;
        order_basis: Record<string, Record<string, unknown>>;
      };
    };
  const row = (r: MonthReport, key: string) =>
    [...r.byItem, ...r.custom].find((x) => x.key === key)!;
  // Đăng ký 8 (A, kỳ này) + nợ 2 (B, kỳ trước)
  const eightPlusTwo = async (stock: number) => {
    const item = await f.stockItem(stock);
    await seedLine(YM, A, { item_id: item, qty: 8 });
    await seedLine(PREV, B, { item_id: item, qty: 2 });
    return item;
  };

  it.each([0, 3, 15])(
    'đăng ký 8 + nợ 2, tủ %i → order_qty 10 (không trừ tủ), order_basis lưu căn cứ',
    async (stock) => {
      const item = await eightPlusTwo(stock);
      const { data } = await printOk();
      expect(data.order_qty[item]).toBe(10);
      expect(data.order_basis[item]).toEqual({
        requested: 8,
        debt: 2,
        adm_owed: 0,
        left_excluded: 0,
        discontinued: false,
      });
    },
  );

  it('ngoài danh mục đăng ký 2 → 2; need (net) vẫn trả trong báo cáo cho client cũ', async () => {
    const item = await eightPlusTwo(3);
    await seedLine(YM, B, f.customCols(f.customName('kep'), 2));
    const live = await f.build(YM);
    const custom = f.customRow(live, 'kep')!;
    expect(row(live, item)).toMatchObject({ need: 7, adm_owed: 0 });
    const { data } = await printOk();
    expect(data.order_qty[custom.key]).toBe(2);
  });

  // Dòng món ngừng chưa giao gì không còn được tính (mục 7 vòng 4) → dùng dòng đã giao 1 phần để còn hàng trong báo cáo
  it('món ngừng có dòng đã giao 1/4 (còn 3) → mặc định 0, discontinued; sửa 3 → bản lưu 3; nhóm ngừng cũng 0', async () => {
    const item = await eightPlusTwo(0);
    const off = await f.stockItem(0);
    await seedLine(YM, B, { item_id: off, qty: 4, delivered_qty: 1 });
    await pool().query('UPDATE items SET active = false WHERE id = $1', [off]);
    expect(row(await f.build(YM), off)).toMatchObject({ usable: false });
    const first = await printOk();
    expect(first.data.order_qty[off]).toBe(0);
    expect(first.data.order_basis[off]).toMatchObject({ discontinued: true });
    f.freeze('2026-11-12T03:01:00Z');
    expect((await printOk({ [off]: 3 })).data.order_qty[off]).toBe(3);

    await pool().query('UPDATE items SET active = true WHERE id = $1', [off]);
    const { rows } = await pool().query<{ id: string }>(
      `INSERT INTO item_categories (name, active) VALUES ($1, false) RETURNING id`,
      [`e2e-off-cat-${SUFFIX}`],
    );
    await pool().query('UPDATE items SET category_id = $2 WHERE id = $1', [
      off,
      rows[0].id,
    ]);
    try {
      f.freeze('2026-11-12T03:02:00Z');
      expect((await printOk()).data.order_qty[off]).toBe(0);
      expect((await printOk()).data.order_qty[item]).toBe(10);
    } finally {
      await pool().query('UPDATE items SET category_id = NULL WHERE id = $1', [
        off,
      ]);
      await pool().query('DELETE FROM item_categories WHERE id = $1', [
        rows[0].id,
      ]);
    }
  });

  it('A đăng ký 8 + C (đã nghỉ) chờ 3 + nợ 2 → không tính phần của C: 10, left_excluded 3', async () => {
    const item = await eightPlusTwo(0);
    await seedLine(YM, C, { item_id: item, qty: 3 });
    const live = row(await f.build(YM), item);
    expect(live).toMatchObject({ requested: 11, left_excluded: 3 });
    const { data } = await printOk();
    expect(data.order_qty[item]).toBe(10);
    expect(data.order_basis[item]).toMatchObject({
      requested: 11,
      debt: 2,
      left_excluded: 3,
    });
  });

  it('cột sống progress: đăng ký 5, đã giao 2 → registered 5, delivered 2, requested (chưa giao) 3; giao hết vẫn có progress; received theo receipt_ym', async () => {
    const item = await f.stockItem(0);
    const line = await seedLine(YM, A, { item_id: item, qty: 5 });
    await pool().query(
      'UPDATE request_lines SET delivered_qty = 2 WHERE id = $1',
      [line],
    );
    await pool().query(
      `INSERT INTO stock_movements (item_id, delta, reason, note, actor_sub, receipt_ym, created_at)
       VALUES ($1, 6, 'purchase', 'Hàng về kỳ 2026-11', $2, '2026-11-01', '2026-11-12T01:00:00Z')`,
      [item, ADMIN],
    );
    const live = (await f.report(YM).expect(200)).body as MonthReport & {
      progress: Record<string, unknown>;
    };
    expect(row(live, item).requested).toBe(3);
    expect(live.progress[item]).toEqual({
      registered: 5,
      delivered: 2,
      received: 6,
    });
    expect((await printOk()).data).not.toHaveProperty('progress');
    await pool().query(
      'UPDATE request_lines SET delivered_qty = 5 WHERE id = $1',
      [line],
    );
    const done = (await f.report(YM).expect(200)).body as MonthReport & {
      progress: Record<string, unknown>;
    };
    expect(done.byItem.find((r) => r.key === item)).toBeUndefined();
    expect(done.progress[item]).toEqual({
      registered: 5,
      delivered: 5,
      received: 6,
    });
  });

  describe('ADM còn nợ giao kỳ trước (R-D13.9)', () => {
    // Kỳ 10: bản in đặt 7, về 3, B còn chờ 4 → ADM còn nợ 4; kỳ 11: A đăng ký 8
    const owedSetup = async () => {
      const item = await f.stockItem(0);
      await seedLine(PREV, B, { item_id: item, qty: 4 });
      await seedLine(YM, A, { item_id: item, qty: 8 });
      await insertSnapshot(
        PREV,
        { ym: PREV, byItem: [], custom: [], order_qty: { [item]: 7 } },
        '2026-10-11T03:00:00Z',
      );
      await pool().query(
        `INSERT INTO stock_movements (item_id, delta, reason, note, actor_sub, receipt_ym, created_at)
         VALUES ($1, 3, 'purchase', 'Hàng về kỳ 2026-10', $2, '2026-10-01', '2026-10-20T03:00:00Z')`,
        [item, ADMIN],
      );
      return item;
    };
    const mark = (item: string, kind: string) =>
      pool().query(
        `INSERT INTO period_adm_out (period_ym, line_key, kind, marked_by, marked_at)
         VALUES ('2026-10-01', $1, $2, $3, '2026-11-12T02:00:00Z')`,
        [item, kind, ADMIN],
      );

    it('đặt 7 về 3, còn chờ 4 → adm_owed 4: mặc định 8 + 4 − 4 = 8, order_basis.adm_owed 4', async () => {
      const item = await owedSetup();
      expect(row(await f.build(YM), item)).toMatchObject({
        requested: 8,
        backlog_prev: 4,
        adm_owed: 4,
      });
      const { data } = await printOk();
      expect(data.order_qty[item]).toBe(8);
      expect(data.order_basis[item]).toMatchObject({ adm_owed: 4, debt: 4 });
    });

    it('adm_owed = min(đặt − về, còn chờ): B đã được giao 3 (còn chờ 1) → adm_owed 1', async () => {
      const item = await owedSetup();
      await pool().query(
        `UPDATE request_lines SET delivered_qty = 3 WHERE item_id = $1 AND qty = 4`,
        [item],
      );
      expect(row(await f.build(YM), item)).toMatchObject({
        backlog_prev: 1,
        adm_owed: 1,
      });
    });

    it.each(['owed_closed', 'out'])(
      'kỳ 10 đánh %s → adm_owed 0, mặc định 12',
      async (kind) => {
        const item = await owedSetup();
        await mark(item, kind);
        expect(row(await f.build(YM), item).adm_owed).toBe(0);
        expect((await printOk()).data.order_qty[item]).toBe(12);
      },
    );

    it('kỳ 10 chỉ có bản rỗng → adm_owed 0', async () => {
      const item = await owedSetup();
      await pool().query(
        `DELETE FROM report_snapshots WHERE period_ym = '2026-10-01'`,
      );
      await insertSnapshot(
        PREV,
        { ym: PREV, byItem: [], custom: [], order_qty: { [item]: 0 } },
        '2026-10-11T03:00:00Z',
      );
      expect(row(await f.build(YM), item).adm_owed).toBe(0);
    });
  });
});
