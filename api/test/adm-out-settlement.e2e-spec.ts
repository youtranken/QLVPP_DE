import { DRIZZLE_DB } from '../src/database/database.module';
import type { Database } from '../src/database/database.module';
import { AdmOutSettlement } from '../src/modules/reminders/adm-out-settlement';
import { NotificationScheduler } from '../src/modules/reminders/notification-scheduler';
import { arrivalsFixture } from './arrivals.fixture';

// Kỳ quá khứ riêng: không suite nào khác có phiếu 2005-12/2006-01, headcount kỳ khóa đặt lại mỗi ca
const P = '2005-12';
const NEXT = '2006-01';
const BEFORE_LOCK = '2006-01-10T16:59:59.999Z';
const AT_LOCK = '2006-01-10T17:00:00.000Z';
const LATER = '2006-02';
const LATER_LOCK = '2006-02-10T17:00:00.000Z';

describe('V2D-5 tự hủy ADM hết hàng lúc khóa sổ kỳ sau (e2e)', () => {
  const f = arrivalsFixture('admsettle');
  const { A, B, pool, markOut } = f;

  beforeAll(async () => {
    await f.ensurePeriod(P);
    await f.ensurePeriod(NEXT);
  });

  // afterAll của suite chạy sau khi fixture đóng pool → dọn qua onCleanup
  f.onCleanup((p) =>
    p.query(
      'DELETE FROM periods WHERE ym = $1::date AND NOT EXISTS (SELECT 1 FROM requests WHERE period_ym = $1::date)',
      [`${LATER}-01`],
    ),
  );

  beforeEach(async () => {
    await pool().query(
      'UPDATE periods SET headcount = NULL, headcount_subs = NULL WHERE ym = ANY($1::date[])',
      [[`${P}-01`, `${NEXT}-01`, `${LATER}-01`]],
    );
    await pool().query("UPDATE users SET status = 'active' WHERE sub = $1", [
      B,
    ]);
  });

  const cron = (iso: string) => {
    f.freeze(iso);
    return f.app().get(NotificationScheduler).runHourly(new Date(iso));
  };
  const settled = async (key: string) =>
    (await f.auditRows('arrival.adm_out_settled', P)).filter(
      (r) => r.detail.line_key === key,
    );
  const backlogLines = async () =>
    (await f.backlog('person')).flatMap((g) => g.lines).map((l) => l.line_id);
  const nextReport = async () => {
    f.freeze(AT_LOCK);
    return f.build(NEXT);
  };
  const headcountSubs = async () =>
    (
      await pool().query<{ headcount_subs: string[] | null }>(
        'SELECT headcount_subs FROM periods WHERE ym = $1::date',
        [`${NEXT}-01`],
      )
    ).rows[0].headcount_subs;

  it('V2D-5 lock boundary settles once: 16:59:59.999Z còn 2; 17:00:00.000Z hủy 2 adm_out_of_stock, không ở Còn nợ, không vào đề nghị kỳ sau, headcount_subs cùng lần; chạy lại → 0 thay đổi', async () => {
    const bk = await f.stockItem(0);
    const other = await f.stockItem(0);
    const cLine = await f.seedLine(P, A, {
      item_id: bk,
      qty: 3,
      delivered_qty: 1,
    });
    const leftLine = await f.seedLine(P, B, { item_id: bk, qty: 1 });
    const keep = await f.seedLine(P, A, { item_id: other, qty: 2 });
    f.freeze('2005-12-20T03:00:00Z');
    await markOut(P, bk).expect(200);
    await pool().query("UPDATE users SET status = 'locked' WHERE sub = $1", [
      B,
    ]);

    await cron(BEFORE_LOCK);
    expect(await f.line(cLine)).toMatchObject({ cancelled_qty: 0 });
    expect(await headcountSubs()).toBeNull();
    // Trước mốc kỳ P còn là tháng đang giao: phần còn lại là Chưa nhận, chưa ở Còn nợ
    const before = await backlogLines();
    for (const id of [cLine, leftLine, keep]) expect(before).not.toContain(id);
    expect(f.itemRow(await nextReport(), bk)?.backlog_prev).toBe(3);

    await cron(AT_LOCK);
    expect(await f.line(cLine)).toEqual({
      qty: 3,
      delivered_qty: 1,
      cancelled_qty: 2,
      cancel_note: 'ADM hết hàng',
    });
    expect((await f.line(leftLine)).cancelled_qty).toBe(1);
    expect((await f.line(keep)).cancelled_qty).toBe(0);
    expect(await headcountSubs()).toEqual(expect.any(Array));
    expect((await settled(bk)).map((r) => [r.actor, r.detail])).toEqual([
      ['system', { period_ym: P, line_key: bk, lines: 2, units: 3 }],
    ]);
    const cancels = (await f.auditRows('line.cancel_remaining', cLine)).map(
      (r) => r.detail,
    );
    expect(cancels).toEqual([
      expect.objectContaining({
        reason_code: 'adm_out_of_stock',
        cancelled_now: 2,
        at: AT_LOCK,
      }),
    ]);
    const backlog = await backlogLines();
    expect(backlog).not.toContain(cLine);
    expect(backlog).not.toContain(leftLine);
    expect(backlog).toContain(keep);
    const report = await nextReport();
    expect(f.itemRow(report, bk)).toBeUndefined();
    expect(f.itemRow(report, other)?.backlog_prev).toBe(2);
    const bells = await f.bellsOf('line_adjusted');
    expect(bells.map((b) => [b.event_id, b.params.lines])).toEqual([
      [
        `line_adjusted:${A}:${P}:2006-01-11`,
        [expect.objectContaining({ kind: 'adm_out', qty: 2 })],
      ],
    ]);
    expect(await f.bellsOf('line_adjusted', B)).toEqual([]);

    await cron(AT_LOCK);
    await cron('2006-01-10T18:05:00.000Z');
    expect((await f.line(cLine)).cancelled_qty).toBe(2);
    expect(await settled(bk)).toHaveLength(1);
    expect(await f.auditRows('line.cancel_remaining', cLine)).toHaveLength(1);
    expect(await f.bellsOf('line_adjusted')).toHaveLength(1);
    const again = await f
      .app()
      .get<Database>(DRIZZLE_DB)
      .transaction((tx) =>
        f.app().get(AdmOutSettlement).settleAdmOut(tx, P, new Date(AT_LOCK)),
      );
    expect(again).toEqual({ lines: 0, units: 0 });
  });

  it('bỏ đánh dấu trước khóa sổ → lúc khóa không hủy, dòng thành nợ như thường', async () => {
    const bk = await f.stockItem(0);
    const l = await f.seedLine(P, A, { item_id: bk, qty: 2 });
    f.freeze('2005-12-20T03:00:00Z');
    await markOut(P, bk).expect(200);
    await f.unmarkOut(P, bk).expect(204);
    await cron(AT_LOCK);
    expect((await f.line(l)).cancelled_qty).toBe(0);
    expect(await settled(bk)).toEqual([]);
    expect(f.itemRow(await nextReport(), bk)?.backlog_prev).toBe(2);
  });

  it('cron bỏ lỡ cả tháng khóa kỳ sau: lần chạy đầu tiên sau khóa kỳ sau nữa vẫn hủy phần ADM hết hàng của P; chạy lại không đổi', async () => {
    const bk = await f.stockItem(0);
    const l = await f.seedLine(P, A, { item_id: bk, qty: 2 });
    f.freeze('2005-12-20T03:00:00Z');
    await markOut(P, bk).expect(200);
    await f.ensurePeriod(LATER);

    await cron(LATER_LOCK);
    expect(await f.line(l)).toMatchObject({
      cancelled_qty: 2,
      cancel_note: 'ADM hết hàng',
    });
    expect((await settled(bk)).map((r) => r.detail)).toEqual([
      { period_ym: P, line_key: bk, lines: 1, units: 2 },
    ]);

    await cron('2006-02-10T18:05:00.000Z');
    expect(await settled(bk)).toHaveLength(1);
    expect(await f.auditRows('line.cancel_remaining', l)).toHaveLength(1);
  });
});
