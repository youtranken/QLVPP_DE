import { snapshotsFixture } from './report-snapshots.fixture';

const YM = '2026-11';

// Kỳ khóa gần nhất lúc 2026-11-12 là 2026-11: hộp hoàn tác đọc bản có hàng mới nhất của nó
describe('V2D-4 hộp hoàn tác đọc bản đã gửi (R-D3.6, R-D17.9)', () => {
  const f = snapshotsFixture('sentuse');
  const { A, ADMIN, B, insertSnapshot, pool, seedLine } = f;

  beforeEach(() => f.resetPeriod(YM));

  const sentWith = (orderQty: Record<string, number>, extra: object = {}) =>
    insertSnapshot(
      YM,
      { ym: YM, byItem: [], custom: [], order_qty: orderQty, ...extra },
      '2026-11-11T15:12:00Z',
    );
  const keyOf = async (lineId: string) =>
    (
      await pool().query<{ key: string }>(
        `SELECT 'custom:' || jsonb_build_array(lower(trim(custom_name)), lower(trim(custom_unit)))::text AS key
         FROM request_lines WHERE id = $1`,
        [lineId],
      )
    ).rows[0].key;

  describe('GET /admin/review: in_sent_snapshot, in_sent_snapshot_qty', () => {
    const reviewRow = async (lineId: string) =>
      (
        (
          await f
            .as(
              f.http().get('/api/admin/review?status=pending'),
              ADMIN,
              'admin',
            )
            .expect(200)
        ).body as { items: (Record<string, unknown> & { line_id: string })[] }
      ).items.find((r) => r.line_id === lineId);

    it('kỳ chưa có bản (hoặc chỉ bản rỗng) → null; bản không có món → false/0; Đề nghị 0 → false/0; Đề nghị 2 → true/2', async () => {
      const { line } = await f.customLine();
      const key = await keyOf(line.id);
      expect(await reviewRow(line.id)).toMatchObject({
        in_sent_snapshot: null,
        in_sent_snapshot_qty: null,
        in_sent_snapshot_at: null,
      });
      const other = await f.stockItem(0);
      await sentWith({ [other]: 0, [key]: 0 });
      expect(await reviewRow(line.id)).toMatchObject({
        in_sent_snapshot: null,
      });
      await f.resetPeriod(YM);
      await sentWith({ [other]: 3 });
      expect(await reviewRow(line.id)).toMatchObject({
        in_sent_snapshot: false,
        in_sent_snapshot_qty: 0,
      });
      await f.resetPeriod(YM);
      await sentWith({ [other]: 3, [key]: 0 });
      expect((await reviewRow(line.id))?.in_sent_snapshot).toBe(false);
      await f.resetPeriod(YM);
      await sentWith({ [other]: 3, [key]: 2 });
      expect(await reviewRow(line.id)).toMatchObject({
        in_sent_snapshot: true,
        in_sent_snapshot_qty: 2,
        in_sent_snapshot_at: '2026-11-11T15:12:00.000Z',
      });
    });
  });

  describe('GET /admin/backlog: counted_in_snapshot_qty', () => {
    const backlogLine = async (lineId: string) =>
      (await f.backlog('person'))
        .flatMap((g) => g.lines)
        .find((l) => l.line_id === lineId) as
        (Record<string, unknown> & { line_id: string }) | undefined;

    it('nợ kỳ 10 còn 4, bản kỳ 11 tính debt 3 → 3; chưa có bản → null; dòng của chính kỳ 11 là Chưa nhận → không ở Còn nợ', async () => {
      const item = await f.stockItem(0);
      const debt = await seedLine('2026-10', B, { item_id: item, qty: 4 });
      const own = await seedLine(YM, A, { item_id: item, qty: 2 });
      f.freeze('2026-11-12T03:00:00Z');
      expect((await backlogLine(debt))?.counted_in_snapshot_qty).toBeNull();
      await sentWith(
        { [item]: 5 },
        {
          order_basis: {
            [item]: {
              requested: 2,
              debt: 3,
              adm_owed: 0,
              left_excluded: 0,
              discontinued: false,
            },
          },
        },
      );
      expect((await backlogLine(debt))?.counted_in_snapshot_qty).toBe(3);
      expect(await backlogLine(own)).toBeUndefined();
    });

    it('bản cũ thiếu order_basis → lấy backlog_prev của hàng trong bản; khóa không có trong bản → 0', async () => {
      const item = await f.stockItem(0);
      const plain = await f.stockItem(0);
      const debt = await seedLine('2026-10', B, { item_id: item, qty: 4 });
      const other = await seedLine('2026-10', B, { item_id: plain, qty: 1 });
      f.freeze('2026-11-12T03:00:00Z');
      await insertSnapshot(
        YM,
        {
          ym: YM,
          byItem: [{ key: item, requested: 0, backlog_prev: 4 }],
          custom: [],
          order_qty: { [item]: 4 },
        },
        '2026-11-11T15:12:00Z',
      );
      expect((await backlogLine(debt))?.counted_in_snapshot_qty).toBe(4);
      expect((await backlogLine(other))?.counted_in_snapshot_qty).toBe(0);
    });
  });

  describe('GET /admin/items/:id/pending-arrival', () => {
    const pending = (id: string, role = 'admin', sub = ADMIN) =>
      f.as(f.http().get(`/api/admin/items/${id}/pending-arrival`), sub, role);
    // Bản thật luôn có hàng byItem cho món đặt; Tủ và hộp ngừng cùng đọc số đặt qua byItem
    const sentItem = (item: string, qty: number) =>
      sentWith(
        { [item]: qty },
        {
          byItem: [
            {
              key: item,
              item_id: item,
              name: 'x',
              unit: 'cay',
              requested: qty,
              backlog_prev: 0,
              stock: 0,
              need: 0,
            },
          ],
        },
      );
    const receive = (item: string, qty: number) =>
      pool().query(
        `INSERT INTO stock_movements (item_id, delta, reason, note, actor_sub, receipt_ym, created_at)
         VALUES ($1, $2, 'purchase', 'Hàng về kỳ 2026-11', $3, '2026-11-01', '2026-11-12T01:00:00Z')`,
        [item, qty, ADMIN],
      );

    it('bản in kỳ khóa đặt 7, về 3 → {remaining 4, unit, snapshot_at}; về đủ 7 → {remaining 0}; chưa có bản → {remaining 0}', async () => {
      const item = await f.stockItem(0);
      f.freeze('2026-11-12T03:00:00Z');
      expect((await pending(item).expect(200)).body).toEqual({ remaining: 0 });
      await sentItem(item, 7);
      await receive(item, 3);
      expect((await pending(item).expect(200)).body).toEqual({
        remaining: 4,
        unit: 'cay',
        snapshot_at: '2026-11-11T15:12:00.000Z',
      });
      await receive(item, 4);
      expect((await pending(item).expect(200)).body).toEqual({ remaining: 0 });
    });

    it('món đánh "ADM hết hàng" ở kỳ khóa → {remaining 0}; id lạ → 404 ITEM_NOT_FOUND; member → 403', async () => {
      const item = await f.stockItem(0);
      f.freeze('2026-11-12T03:00:00Z');
      await sentItem(item, 7);
      await pool().query(
        `INSERT INTO period_adm_out (period_ym, line_key, kind, marked_by, marked_at)
         VALUES ('2026-11-01', $1, 'out', $2, '2026-11-12T02:00:00Z')`,
        [item, ADMIN],
      );
      try {
        expect((await pending(item).expect(200)).body).toEqual({
          remaining: 0,
        });
      } finally {
        await pool().query('DELETE FROM period_adm_out WHERE line_key = $1', [
          item,
        ]);
      }
      const ghost = '00000000-0000-4000-8000-000000000000';
      expect((await pending(ghost).expect(404)).body.code).toBe(
        'ITEM_NOT_FOUND',
      );
      await pending(item, 'member', A).expect(403);
    });

    it('K* = kỳ khóa gần nhất như Tủ, không suy từ kỳ mở − 1: kỳ 2031-01 khóa có bản đặt 7, không có dòng kỳ 2031-02, mở 2031-04 → pending-arrival 7 = "đang về" của Tủ', async () => {
      const item = await f.stockItem(0);
      const gap = ['2031-01-01', '2031-02-01', '2031-03-01', '2031-04-01'];
      const cleanup = async () => {
        await pool().query(
          'DELETE FROM report_snapshots WHERE period_ym = ANY($1::date[])',
          [gap],
        );
        await pool().query(
          `DELETE FROM periods p WHERE p.ym = ANY($1::date[])
             AND NOT EXISTS (SELECT 1 FROM requests r WHERE r.period_ym = p.ym)`,
          [gap],
        );
      };
      await cleanup();
      try {
        await pool().query(
          `INSERT INTO periods (ym, deadline) VALUES ('2031-01-01', '2031-01-10T17:00:00Z')`,
        );
        await insertSnapshot(
          '2031-01',
          {
            ym: '2031-01',
            byItem: [
              {
                key: item,
                item_id: item,
                name: 'x',
                unit: 'cay',
                requested: 7,
                backlog_prev: 0,
                stock: 0,
                need: 0,
              },
            ],
            custom: [],
            order_qty: { [item]: 7 },
          },
          '2031-01-11T02:00:00Z',
        );
        f.freeze('2031-03-12T03:00:00Z');
        const tu = (
          await f
            .as(f.http().get('/api/admin/stock'), ADMIN, 'admin')
            .expect(200)
        ).body as { item_id: string; incoming: number }[];
        expect(tu.find((r) => r.item_id === item)?.incoming).toBe(7);
        expect((await pending(item).expect(200)).body).toEqual({
          remaining: 7,
          unit: 'cay',
          snapshot_at: '2031-01-11T02:00:00.000Z',
        });
      } finally {
        await cleanup();
      }
    });

    it('ADM còn nợ kỳ trước (bản kỳ 10 đặt 5, A còn chờ 4, chưa về) dù bản kỳ 11 không có món → {remaining 4, snapshot_at = bản kỳ 10}; cộng thêm phần bản kỳ 11 còn chờ', async () => {
      const item = await f.stockItem(0);
      f.freeze('2026-11-12T03:00:00Z');
      await f.resetPeriod('2026-10');
      try {
        await seedLine('2026-10', A, { item_id: item, qty: 4 });
        await insertSnapshot(
          '2026-10',
          {
            ym: '2026-10',
            byItem: [
              {
                key: item,
                item_id: item,
                name: 'x',
                unit: 'cay',
                requested: 4,
                backlog_prev: 0,
                stock: 0,
                need: 0,
              },
            ],
            custom: [],
            order_qty: { [item]: 5 },
          },
          '2026-10-11T04:00:00Z',
        );
        expect((await pending(item).expect(200)).body).toEqual({
          remaining: 4,
          unit: 'cay',
          snapshot_at: '2026-10-11T04:00:00.000Z',
        });
        await sentItem(item, 2);
        expect((await pending(item).expect(200)).body).toEqual({
          remaining: 6,
          unit: 'cay',
          snapshot_at: '2026-11-11T15:12:00.000Z',
        });
      } finally {
        await f.resetPeriod('2026-10');
      }
    });
  });
});
