import { randomUUID } from 'node:crypto';
import { arrivalsFixture } from './arrivals.fixture';

const YM = '2026-11';
const LOCKED_AT = '2026-11-12T03:00:00Z';
// Kỳ riêng quá khứ cho ranh giới khóa kỳ sau: audit mang giờ ClockService nên không để lại dòng tương lai
const OLD = '2000-07';
const OLD_NEXT = '2000-08';
const OLD_NEXT_DEADLINE_MS = Date.parse('2000-08-10T17:00:00Z');

describe('V2D-5 ADM hết hàng theo kỳ: PUT/DELETE adm-out, nhập hàng về, hủy khi giao (e2e)', () => {
  const f = arrivalsFixture('admout');
  const { A, B, ADMIN, pool, markOut, unmarkOut, receipts, plan } = f;

  beforeEach(async () => {
    await f.resetPeriod(YM);
    f.freeze(LOCKED_AT);
  });
  f.onCleanup(async (p) => {
    await p.query(
      'DELETE FROM requests WHERE period_ym = ANY($1::date[]) AND user_sub LIKE $2',
      [[`${OLD}-01`, `${OLD_NEXT}-01`], `e2e-req-%-${f.SUFFIX}`],
    );
    await p.query(
      `DELETE FROM periods p WHERE p.ym = ANY($1::date[])
         AND NOT EXISTS (SELECT 1 FROM requests r WHERE r.period_ym = p.ym)`,
      [[`${OLD}-01`, `${OLD_NEXT}-01`]],
    );
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

    it('món tạm ngưng sau khi đánh dấu (dòng chưa giao vẫn là dòng mở) → chưa chốt, DELETE 204, nhận hàng 200; món đã đặt đang tạm ngưng vẫn PUT 200', async () => {
      const item = await f.stockItem(0);
      const other = await f.stockItem(0);
      await f.seedLine(YM, A, { item_id: item, qty: 2 });
      await f.seedLine(YM, B, { item_id: other, qty: 1 });
      await f.insertSnapshot(
        YM,
        {
          ym: YM,
          byItem: [
            { key: item, item_id: item },
            { key: other, item_id: other },
          ],
          custom: [],
          order_qty: { [item]: 2, [other]: 1 },
        },
        '2026-11-11T03:00:00Z',
      );
      await markOut(YM, item).expect(200);
      await pool().query(
        'UPDATE items SET active = false WHERE id = ANY($1::uuid[])',
        [[item, other]],
      );
      expect((await f.rowOf(YM, item))?.adm_out_final).toBe(false);
      await unmarkOut(YM, item).expect(204);
      expect((await f.rowOf(YM, item))?.adm_out).toBe(false);
      await receipts({
        ym: YM,
        lines: [{ item_id: item, qty: 2, expected_stock_qty: 0 }],
      }).expect(200);
      expect(await f.stockOf(item)).toBe(2);
      await markOut(YM, other).expect(200);
      expect((await f.rowOf(YM, other))?.adm_out).toBe(true);
    });

    it('kỳ sau khóa sổ (R-D11.12): .999 → PUT 200; .000 → PUT và DELETE 409 ADM_OUT_FINAL, không audit', async () => {
      await f.ensurePeriod(OLD);
      await f.ensurePeriod(OLD_NEXT);
      const marked = await f.stockItem(0);
      const late = await f.stockItem(0);
      await f.seedLine(OLD, A, { item_id: marked, qty: 2 });
      await f.seedLine(OLD, B, { item_id: late, qty: 2 });
      f.freeze(new Date(OLD_NEXT_DEADLINE_MS - 1).toISOString());
      await markOut(OLD, marked).expect(200);
      f.freeze(new Date(OLD_NEXT_DEADLINE_MS).toISOString());
      await markOut(OLD, late).expect(409, /ADM_OUT_FINAL/);
      await unmarkOut(OLD, marked).expect(409, /ADM_OUT_FINAL/);
      const audits = async (action: string) =>
        (await f.auditRows(action, OLD)).filter((r) =>
          [marked, late].includes(r.detail.line_key as string),
        );
      expect(await audits('arrival.adm_out_marked')).toHaveLength(1);
      expect(await audits('arrival.adm_out_unmarked')).toEqual([]);
      const { rows } = await pool().query(
        `SELECT line_key FROM period_adm_out WHERE period_ym = $1::date`,
        [`${OLD}-01`],
      );
      expect(rows).toEqual([{ line_key: marked }]);
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

    // changedAt đọc audit kỳ theo object_type/object_id; ranh giới T±1 ms ở changed-after.e2e
    it('đánh/bỏ đánh dấu ghi audit object_type period, object_id = kỳ — nguồn của cảnh báo thay đổi sau bản chốt', async () => {
      const item = await f.stockItem(0);
      await f.seedLine(YM, A, { item_id: item, qty: 2 });
      await markOut(YM, item).expect(200);
      // audit mang giờ ClockService: tách mốc để thứ tự created_at xác định
      f.freeze('2026-11-12T03:00:01Z');
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
      // Kỳ 10 đã qua hạn khóa kỳ 11 → không đánh dấu qua API được nữa (ADM_OUT_FINAL); gieo dấu như đã có
      await pool().query(
        `INSERT INTO period_adm_out (period_ym, line_key, kind, marked_by, marked_at)
         VALUES ('2026-10-01', $1, 'out', $2, '2026-11-05T03:00:00Z')`,
        [item, ADMIN],
      );
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
