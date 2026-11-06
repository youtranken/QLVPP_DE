import type { DeliveryPerson } from '../src/modules/delivery/delivery.dto';
import { arrivalsFixture } from './arrivals.fixture';
import type { BacklogGroup } from './delivery.fixture';

// Kỳ 11 đóng vai "tháng 9", kỳ 12 là tháng đang giao K*; kỳ 01 khóa lúc 10/01 17:00Z
const PREV = '2026-11';
const KSTAR = '2026-12';
const AFTER_KSTAR = '2026-12-12T03:00:00Z';
const LOCK_NEXT = Date.parse('2027-01-10T17:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

describe('V2D-9 Chưa nhận là tháng đang giao, Còn nợ chỉ tháng trước (e2e)', () => {
  const f = arrivalsFixture('dstatus');
  const { A, B, ADMIN, SUFFIX } = f;
  const C = `e2e-req-c-${SUFFIX}`;
  const D = `e2e-req-d-${SUFFIX}`;
  const MINE = () => [A, B, C, D];

  beforeAll(async () => {
    await f.pool().query(
      `INSERT INTO users (sub, full_name, department, status) VALUES
           ($1, 'Nhân viên C', 'Phòng CT', 'active'), ($2, 'Nhân viên D', 'Phòng CT', 'active')`,
      [C, D],
    );
    await f.pool().query(
      `INSERT INTO periods (ym, deadline) VALUES ('2027-01-01', '2027-01-10T17:00:00Z')
         ON CONFLICT (ym) DO UPDATE SET deadline = EXCLUDED.deadline`,
    );
  });

  beforeEach(async () => {
    await f.resetPeriod(PREV);
    await f.resetPeriod(KSTAR);
    f.freeze(AFTER_KSTAR);
  });

  const people = async (ym = KSTAR) =>
    (
      (
        await f
          .as(
            f.http().get(`/api/admin/periods/${ym}/delivery-people`),
            ADMIN,
            'admin',
          )
          .expect(200)
      ).body as { people: DeliveryPerson[] }
    ).people.filter((p) => MINE().includes(p.user_sub));
  const byId = async (ym = KSTAR) =>
    Object.fromEntries((await people(ym)).map((p) => [p.user_sub, p]));
  const backlogLines = async () =>
    (await f.backlog('person'))
      .flatMap((g: BacklogGroup) => g.lines)
      .filter((l) => MINE().includes(l.user_sub));
  const catalogLine = (item: string, qty: number, delivered = 0) => ({
    item_id: item,
    qty,
    delivered_qty: delivered,
  });

  // A giao một phần tháng K*; B chỉ nợ kỳ trước; C cả hai; D đã nhận đủ; tủ trống
  const scenario = async () => {
    const item = await f.stockItem(0);
    const itemA = await f.stockItem(0);
    const b = await f.seedLine(PREV, B, catalogLine(item, 3, 1));
    const c9 = await f.seedLine(PREV, C, catalogLine(item, 2));
    const c10 = await f.seedLine(KSTAR, C, catalogLine(item, 4));
    const a = await f.seedLine(KSTAR, A, catalogLine(itemA, 3, 1));
    const d = await f.seedLine(KSTAR, D, catalogLine(item, 2, 2));
    return { item, itemA, a, b, c9, c10, d };
  };

  it('A giao một phần tháng K* → pending (trước: debt); B chỉ nợ tháng trước → debt; C hai cờ, pending; D → done', async () => {
    await scenario();
    const p = await byId();
    expect(p[A]).toMatchObject({
      status: 'pending',
      has_pending: true,
      has_debt: false,
    });
    expect(p[B]).toMatchObject({
      status: 'debt',
      has_pending: false,
      has_debt: true,
    });
    expect(p[C]).toMatchObject({
      status: 'pending',
      has_pending: true,
      has_debt: true,
    });
    expect(p[D]).toMatchObject({
      status: 'done',
      has_pending: false,
      has_debt: false,
    });
  });

  it('trang Còn nợ không có dòng tháng K*; tổng = tổng đơn vị nợ của tab Còn nợ', async () => {
    const { b, c9 } = await scenario();
    const lines = await backlogLines();
    expect(lines.map((l) => l.line_id).sort()).toEqual([b, c9].sort());
    expect(lines.every((l) => l.period_ym === PREV)).toBe(true);
    const debtUnits = (await people())
      .filter((p) => p.has_debt)
      .flatMap((p) => p.lines)
      .filter((l) => l.is_debt)
      .reduce((s, l) => s + l.remaining_qty, 0);
    expect(lines.reduce((s, l) => s + l.remaining_qty, 0)).toBe(debtUnits);
    expect(debtUnits).toBe(4);
  });

  it('chỉ một kỳ khóa có dòng → trang Còn nợ trống, mọi phần chưa giao ở Chưa nhận', async () => {
    const item = await f.stockItem(0);
    await f.seedLine(KSTAR, A, catalogLine(item, 3, 1));
    expect(await backlogLines()).toEqual([]);
    expect((await byId())[A]).toMatchObject({
      has_pending: true,
      has_debt: false,
    });
  });

  it('mốc khóa kỳ kế: .999 → phần còn lại tháng K* là Chưa nhận; .000 → là nợ (tab Còn nợ, trang Còn nợ)', async () => {
    const { a } = await scenario();
    f.freeze(iso(LOCK_NEXT - 1));
    expect((await byId())[A]).toMatchObject({
      status: 'pending',
      has_pending: true,
      has_debt: false,
    });
    expect((await backlogLines()).map((l) => l.line_id)).not.toContain(a);

    f.freeze(iso(LOCK_NEXT));
    const next = (await byId('2027-01'))[A];
    expect(next).toMatchObject({
      status: 'debt',
      has_pending: false,
      has_debt: true,
    });
    expect(next.lines[0]).toMatchObject({ line_id: a, is_debt: true });
    expect((await backlogLines()).map((l) => l.line_id)).toContain(a);
    // Xem lại kỳ cũ sau mốc: cùng định nghĩa theo K* lúc đọc
    expect((await byId(KSTAR))[A]).toMatchObject({ has_debt: true });
  });

  const ready = async () =>
    (await people()).filter((p) => p.deliverable_now).map((p) => p.user_sub);

  it('giao được ngay: tủ trống sau khóa → 0; về 1 món của A → 1; dòng ngoài DM của B "Đã về" → 2', async () => {
    const { itemA } = await scenario();
    const name = f.customName('Kéo cắt');
    const custom = await f.seedLine(PREV, B, f.customCols(name, 1));
    const key = await f.customKey(custom);
    await f.insertSnapshot(
      PREV,
      { ym: PREV, byItem: [], custom: [], order_qty: { [key]: 1 } },
      '2026-11-11T03:00:00Z',
    );
    expect(await ready()).toEqual([]);
    await f
      .pool()
      .query('UPDATE items SET stock_qty = 1 WHERE id = $1', [itemA]);
    expect(await ready()).toEqual([A]);
    await f
      .customReceive(PREV, { line_key: key, qty: 1, expected_received: 0 })
      .expect(201);
    expect((await ready()).sort()).toEqual([A, B].sort());
  });

  it('giao được ngay theo người đăng ký trước: tủ = phần giữ cho người trước → không; +1 → có', async () => {
    const { item } = await scenario();
    // Trước nợ C (2) là nợ B (2): cùng kỳ cũ, B lưu phiếu trước
    await f
      .pool()
      .query('UPDATE items SET stock_qty = 2 WHERE id = $1', [item]);
    expect(await ready()).toEqual([B]);
    await f
      .pool()
      .query('UPDATE items SET stock_qty = 3 WHERE id = $1', [item]);
    expect((await ready()).sort()).toEqual([B, C].sort());
  });
});
