import { randomUUID } from 'node:crypto';
import { arrivalsFixture } from './arrivals.fixture';

const YM = '2026-11';
const LOCKED_AT = '2026-11-12T03:00:00Z';

describe('V2D-5 ADM hết hàng theo kỳ: PUT/DELETE adm-out, nhập hàng về, hủy khi giao (e2e)', () => {
  const f = arrivalsFixture('admout');
  const { A, B, ADMIN, pool, markOut, unmarkOut, receipts, plan } = f;

  beforeEach(async () => {
    await f.resetPeriod(YM);
    f.freeze(LOCKED_AT);
  });

  const marks = async (key: string) =>
    (await f.auditRows('arrival.adm_out_marked', YM)).filter(
      (r) => r.detail.line_key === key,
    );
  const unmarks = async (key: string) =>
    (await f.auditRows('arrival.adm_out_unmarked', YM)).filter(
      (r) => r.detail.line_key === key,
    );
  const settle = (lineId: string) =>
    pool().query('UPDATE request_lines SET delivered_qty = qty WHERE id = $1', [
      lineId,
    ]);

  describe('PUT/DELETE /admin/periods/:ym/adm-out/:line_key', () => {
    it('còn 1 dòng mở → PUT 200 + audit before/after; PUT lặp → 200, không audit thêm; items.active không đổi', async () => {
      const item = await f.stockItem(0);
      await f.seedLine(YM, A, { item_id: item, qty: 2 });
      const res = await markOut(YM, item).expect(200);
      expect(res.body).toEqual({
        line_key: item,
        item_id: item,
        adm_out: true,
      });
      await markOut(YM, item).expect(200);
      expect(await marks(item)).toEqual([
        {
          actor: ADMIN,
          detail: {
            line_key: item,
            before: { adm_out: false },
            after: { adm_out: true },
          },
        },
      ]);
      const { rows } = await pool().query<{ active: boolean }>(
        'SELECT active FROM items WHERE id = $1',
        [item],
      );
      expect(rows[0].active).toBe(true);
      expect((await f.rowOf(YM, item))?.adm_out).toBe(true);
    });

    it('0 dòng mở (đã giao đủ) → PUT 409 ADM_OUT_NOTHING_OPEN; món không tồn tại → 404 ITEM_NOT_FOUND', async () => {
      const item = await f.stockItem(0);
      const l = await f.seedLine(YM, A, { item_id: item, qty: 2 });
      await settle(l);
      await markOut(YM, item).expect(409, /ADM_OUT_NOTHING_OPEN/);
      expect(await marks(item)).toEqual([]);
      await markOut(YM, randomUUID()).expect(404, /ITEM_NOT_FOUND/);
    });

    it('DELETE còn 1 dòng mở → 204 + audit unmarked; DELETE khi chưa đánh → 204 không audit', async () => {
      const item = await f.stockItem(0);
      await f.seedLine(YM, A, { item_id: item, qty: 2 });
      await unmarkOut(YM, item).expect(204);
      expect(await unmarks(item)).toEqual([]);
      await markOut(YM, item).expect(200);
      await unmarkOut(YM, item).expect(204);
      expect((await unmarks(item)).map((r) => r.detail)).toEqual([
        {
          line_key: item,
          before: { adm_out: true },
          after: { adm_out: false },
        },
      ]);
      expect((await f.rowOf(YM, item))?.adm_out).toBe(false);
    });

    it('đánh dấu rồi mọi dòng giao/hủy xong → DELETE 409 ADM_OUT_FINAL; kế hoạch adm_out_final true', async () => {
      const item = await f.stockItem(0);
      const l1 = await f.seedLine(YM, A, { item_id: item, qty: 2 });
      await f.seedLine(YM, B, { item_id: item, qty: 1, cancelled_qty: 1 });
      await f.insertSnapshot(
        YM,
        {
          ym: YM,
          byItem: [{ key: item, item_id: item }],
          custom: [],
          order_qty: { [item]: 3 },
        },
        '2026-11-11T03:00:00Z',
      );
      await markOut(YM, item).expect(200);
      expect((await f.rowOf(YM, item))?.adm_out_final).toBe(false);
      await settle(l1);
      await unmarkOut(YM, item).expect(409, /ADM_OUT_FINAL/);
      expect((await f.rowOf(YM, item))?.adm_out_final).toBe(true);
    });

    it('khóa ngoài DM có ngoặc, dấu, khoảng trắng qua encodeURIComponent → 200; khóa hỏng → 400 VALIDATION', async () => {
      const name = `Kéo cắt "giấy" / A4-${f.SUFFIX}`;
      const l = await f.seedLine(YM, A, f.customCols(name, 2));
      const key = await f.customKey(l);
      expect(key).toContain('[');
      await markOut(YM, key).expect(200, {
        line_key: key,
        item_id: null,
        adm_out: true,
      });
      for (const bad of [
        'abc',
        'custom:["kéo"]',
        key.replace(', ', ','),
        'custom:[1, 2]',
        'custom:not-json',
      ]) {
        await markOut(YM, bad).expect(400, /VALIDATION/);
      }
      await unmarkOut(YM, key).expect(204);
      await f.closeOwed(YM, key).expect(200);
      await f.reopenOwed(YM, key).expect(204);
      await f.closeOwed(YM, 'custom:x').expect(400, /VALIDATION/);
    });

    // changedAt (Task 4) đọc audit kỳ theo object_type/object_id; send-state không dùng được ở đây vì audit chung DB có dòng tương lai
    it('đánh/bỏ đánh dấu ghi audit object_type period, object_id = kỳ — nguồn của cảnh báo thay đổi sau bản chốt', async () => {
      const item = await f.stockItem(0);
      await f.seedLine(YM, A, { item_id: item, qty: 2 });
      await markOut(YM, item).expect(200);
      await unmarkOut(YM, item).expect(204);
      const { rows } = await pool().query<{ action: string }>(
        `SELECT action FROM audit_log
         WHERE object_type = 'period' AND object_id = $1 AND detail->>'line_key' = $2
         ORDER BY created_at, id`,
        [YM, item],
      );
      expect(rows.map((r) => r.action)).toEqual([
        'arrival.adm_out_marked',
        'arrival.adm_out_unmarked',
      ]);
    });
  });

  describe('POST /admin/stock/receipts với món đánh dấu', () => {
    it('qty 1 cho món đang đánh dấu → 409 ITEM_ADM_OUT {item_id}, 0 dòng ghi; không gửi món đó → 200', async () => {
      const out = await f.stockItem(0);
      const ok = await f.stockItem(0);
      await f.seedLine(YM, A, { item_id: out, qty: 2 });
      await markOut(YM, out).expect(200);
      const res = await receipts({
        ym: YM,
        lines: [
          { item_id: ok, qty: 2, expected_stock_qty: 0 },
          { item_id: out, qty: 1, expected_stock_qty: 0 },
        ],
      }).expect(409);
      expect(res.body).toMatchObject({ code: 'ITEM_ADM_OUT', item_id: out });
      expect(await f.stockOf(ok)).toBe(0);
      await receipts({
        ym: YM,
        lines: [{ item_id: ok, qty: 2, expected_stock_qty: 0 }],
      }).expect(200);
      expect(await f.stockOf(ok)).toBe(2);
      expect(
        (await plan(YM)).rows.find((r) => r.item_id === ok)?.received,
      ).toBe(2);
    });
  });

  describe('POST /admin/lines/:id/cancel-remaining {reason_code: adm_out_of_stock}', () => {
    const cancelAdm = (lineId: string, qty: number, delivered = 0) =>
      f.cancel(lineId, {
        reason_code: 'adm_out_of_stock',
        expected_delivered_qty: delivered,
        expected_qty: qty,
      });

    it('món đánh dấu cho kỳ của dòng → 200, cancel_note "ADM hết hàng", không chuông line_cancelled, chuông ngày có dòng adm_out', async () => {
      const item = await f.stockItem(0);
      const l = await f.seedLine(YM, A, { item_id: item, qty: 3 });
      await markOut(YM, item).expect(200);
      await cancelAdm(l, 3).expect(200);
      expect(await f.line(l)).toMatchObject({
        cancelled_qty: 3,
        cancel_note: 'ADM hết hàng',
      });
      expect(await f.bellsOf('line_cancelled')).toEqual([]);
      const [bell] = await f.bellsOf('line_adjusted');
      expect(bell.event_id).toBe(`line_adjusted:${A}:${YM}:2026-11-12`);
      expect(bell.params.lines).toEqual([
        {
          kind: 'adm_out',
          name: expect.any(String),
          name_en: null,
          unit: 'cay',
          qty: 3,
          reason_code: 'adm_out_of_stock',
        },
      ]);
    });

    it('món không đánh dấu → 409 ITEM_NOT_ADM_OUT; đánh dấu kỳ khác (2026-10) → 409; dòng không đổi', async () => {
      const item = await f.stockItem(0);
      const l = await f.seedLine(YM, A, { item_id: item, qty: 2 });
      await cancelAdm(l, 2).expect(409, /ITEM_NOT_ADM_OUT/);
      await f.seedLine('2026-10', B, { item_id: item, qty: 1 });
      await markOut('2026-10', item).expect(200);
      await cancelAdm(l, 2).expect(409, /ITEM_NOT_ADM_OUT/);
      expect((await f.line(l)).cancelled_qty).toBe(0);
    });

    it('chủ phiếu đã nghỉ → 200, 0 chuông', async () => {
      const item = await f.stockItem(0);
      const l = await f.seedLine(YM, B, { item_id: item, qty: 2 });
      await markOut(YM, item).expect(200);
      await pool().query("UPDATE users SET status = 'locked' WHERE sub = $1", [
        B,
      ]);
      try {
        await cancelAdm(l, 2).expect(200);
        expect(await f.bellsOf('line_adjusted', B)).toEqual([]);
        expect(await f.bellsOf('line_cancelled', B)).toEqual([]);
      } finally {
        await pool().query(
          "UPDATE users SET status = 'active' WHERE sub = $1",
          [B],
        );
      }
    });

    it('cùng ngày đã có chuông giảm số → gộp vào một chuông (dòng giảm + dòng ADM hết hàng)', async () => {
      const cut = await f.stockItem(0);
      const out = await f.stockItem(0);
      const cutLine = await f.seedLine(YM, A, { item_id: cut, qty: 5 });
      const outLine = await f.seedLine(YM, A, { item_id: out, qty: 2 });
      const { request_id, updated_at } = (
        await pool().query<{ request_id: string; updated_at: Date }>(
          `SELECT l.request_id, r.updated_at FROM request_lines l
           JOIN requests r ON r.id = l.request_id WHERE l.id = $1`,
          [cutLine],
        )
      ).rows[0];
      await f
        .as(
          f.http().put(`/api/admin/requests/${request_id}/lines`),
          ADMIN,
          'admin',
        )
        .send({
          expected_updated_at: updated_at.toISOString(),
          lines: [
            { id: cutLine, qty: 4, expected_qty: 5, reason_code: 'over_quota' },
            { id: outLine, qty: 2, expected_qty: 2 },
          ],
        })
        .expect(200);
      await markOut(YM, out).expect(200);
      await cancelAdm(outLine, 2).expect(200);
      const bells = await f.bellsOf('line_adjusted');
      expect(bells).toHaveLength(1);
      expect(
        (bells[0].params.lines as { kind: string }[]).map((x) => x.kind).sort(),
      ).toEqual(['adjust', 'adm_out']);
    });
  });
});
