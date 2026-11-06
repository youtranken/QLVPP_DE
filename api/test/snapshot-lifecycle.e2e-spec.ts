import { snapshotsFixture } from './report-snapshots.fixture';

const YM = '2026-11';

describe('V2D-4 lifecycle — vòng đời phiếu gửi ADM (bảng chuyển R-D5.19)', () => {
  const f = snapshotsFixture('lifecycle');
  const { ADMIN, create, list, noOrder, clearNoOrder, sendState, pool } = f;
  let item: string;

  const resetPeriod = () => f.resetPeriod(YM);
  const auditCount = async (action: string) =>
    (
      await pool().query<{ n: number }>(
        `SELECT count(*)::int AS n FROM audit_log WHERE action = $1 AND object_id = $2`,
        [action, YM],
      )
    ).rows[0].n;
  const snapshotAudits = async () =>
    (
      await pool().query<{ n: number }>(
        `SELECT count(*)::int AS n FROM audit_log WHERE action = 'report.snapshot_created' AND detail->>'ym' = $1`,
        [YM],
      )
    ).rows[0].n;
  // Mọi hàng của báo cáo về 0 (kể cả hàng của suite khác nếu còn sót)
  const zeros = async () => {
    const r = await f.build(YM);
    return Object.fromEntries(
      [...r.byItem, ...r.custom].map((row) => [row.key, 0]),
    );
  };
  const print = (order_qty: object = {}, extra: object = {}) =>
    create(YM, { kind: 'print', order_qty, ...extra });

  beforeEach(async () => {
    await resetPeriod();
    ({ item } = await f.lockedLine(0, 5));
  });

  it('Chưa gửi + In trình ký, tổng > 0 → tạo bản không replaces → Đã gửi', async () => {
    const res = await print().expect(201);
    expect(res.body).toMatchObject({ reused: false, kind: 'print' });
    expect(res.body.data.order_qty[item]).toBe(5);
    expect(res.body.data.replaces).toBeUndefined();
    const s = await sendState(YM);
    expect(s).toMatchObject({ state: 'sent', no_order_at: null });
    expect(s.sent).toMatchObject({
      id: res.body.id,
      items_count: 1,
      units_total: 5,
      replaces: null,
    });
  });

  it('Chưa gửi + In / Excel, tổng = 0 → 409 ORDER_EMPTY, 0 bản, 0 audit → vẫn Chưa gửi', async () => {
    const before = await snapshotAudits();
    for (const kind of ['print', 'xlsx']) {
      const res = await create(YM, { kind, order_qty: await zeros() }).expect(
        409,
      );
      expect(res.body.code).toBe('ORDER_EMPTY');
    }
    expect(await list(YM)).toEqual([]);
    expect(await snapshotAudits()).toBe(before);
    expect((await sendState(YM)).state).toBe('unsent');
  });

  it('Chưa gửi + "Tháng này không cần đề nghị ADM", tổng = 0 → ghi no_order_at + audit → Không cần đề nghị; gọi lặp → 200 không đổi', async () => {
    const before = await auditCount('period.no_order');
    const res = await noOrder(YM, { order_qty: await zeros() }).expect(200);
    expect(res.body).toEqual({
      no_order_at: '2026-11-12T03:00:00.000Z',
      no_order_by: ADMIN,
    });
    expect(await sendState(YM)).toMatchObject({
      state: 'no_order',
      no_order_at: '2026-11-12T03:00:00.000Z',
      no_order_by_name: 'Hành chính',
      sent: null,
    });
    f.freeze('2026-11-12T04:00:00Z');
    const again = await noOrder(YM, { order_qty: await zeros() }).expect(200);
    expect(again.body.no_order_at).toBe('2026-11-12T03:00:00.000Z');
    expect(await auditCount('period.no_order')).toBe(before + 1);
  });

  it('Chưa gửi + "Tháng này không cần đề nghị ADM", tổng > 0 → 409 ORDER_NOT_EMPTY, cờ không ghi', async () => {
    const res = await noOrder(YM, { order_qty: { [item]: 1 } }).expect(409);
    expect(res.body.code).toBe('ORDER_NOT_EMPTY');
    // Ô vắng = số mặc định 5 → server tính tổng > 0
    expect((await noOrder(YM, {}).expect(409)).body.code).toBe(
      'ORDER_NOT_EMPTY',
    );
    expect((await sendState(YM)).state).toBe('unsent');
  });

  it('Không cần đề nghị + "Lập phiếu" → xóa cờ (audit before/after) → Chưa gửi', async () => {
    await noOrder(YM, { order_qty: await zeros() }).expect(200);
    const before = await auditCount('period.no_order_cleared');
    await clearNoOrder(YM).expect(204);
    expect(await sendState(YM)).toMatchObject({
      state: 'unsent',
      no_order_at: null,
    });
    expect(await auditCount('period.no_order_cleared')).toBe(before + 1);
    const { rows } = await pool().query<{ detail: Record<string, unknown> }>(
      `SELECT detail FROM audit_log WHERE action = 'period.no_order_cleared' AND object_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [YM],
    );
    expect(rows[0].detail).toMatchObject({
      before: { no_order_at: '2026-11-12T03:00:00.000Z', no_order_by: ADMIN },
      after: { no_order_at: null },
    });
    await clearNoOrder(YM).expect(204);
    expect(await auditCount('period.no_order_cleared')).toBe(before + 1);
  });

  it('Không cần đề nghị + gọi thẳng API tạo bản, tổng > 0 → tạo bản, tự xóa cờ → Đã gửi', async () => {
    await noOrder(YM, { order_qty: await zeros() }).expect(200);
    const res = await print().expect(201);
    expect(await sendState(YM)).toMatchObject({
      state: 'sent',
      no_order_at: null,
      sent: { id: res.body.id },
    });
  });

  it('Đã gửi + "In lại bản này" / "Xuất Excel bản này" → không tạo bản → Đã gửi cùng bản', async () => {
    const { id } = (await print().expect(201)).body as { id: string };
    await f.snapshot(id);
    await f.exportXlsx(id).expect(200);
    await f.sent(YM).expect(200);
    expect(await list(YM)).toHaveLength(1);
    expect((await sendState(YM)).sent?.id).toBe(id);
  });

  it('Đã gửi + "Làm bản mới" (chỉ ở trình duyệt) → server vẫn Đã gửi theo bản mới nhất', async () => {
    const { id } = (await print().expect(201)).body;
    await f.build(YM);
    expect(await sendState(YM)).toMatchObject({
      state: 'sent',
      sent: { id },
    });
  });

  it('Đang làm bản mới + In, số trùng bản mới nhất cùng kind → dùng lại (200 reused), không dòng thay thế, không audit', async () => {
    const first = (await print({}, { reuse_if_unchanged: true }).expect(201))
      .body;
    const audits = await snapshotAudits();
    f.freeze('2026-11-12T03:05:00Z');
    const again = await print({}, { reuse_if_unchanged: true }).expect(200);
    expect(again.body).toMatchObject({
      id: first.id,
      reused: true,
      created_at: '2026-11-12T03:00:00.000Z',
    });
    expect(again.body.data.order_qty[item]).toBe(5);
    expect(await list(YM)).toHaveLength(1);
    expect(await snapshotAudits()).toBe(audits);
  });

  it('Đang làm bản mới + In, số khác bản mới nhất → bản mới có replaces → Đã gửi theo bản mới', async () => {
    const first = (await print().expect(201)).body;
    f.freeze('2026-11-12T03:05:00Z');
    const second = await print(
      { [item]: 7 },
      { reuse_if_unchanged: true },
    ).expect(201);
    expect(second.body.data.replaces).toEqual({
      id: first.id,
      created_at: '2026-11-12T03:00:00.000Z',
    });
    expect((await sendState(YM)).sent).toMatchObject({
      id: second.body.id,
      units_total: 7,
      replaces: { id: first.id },
    });
  });

  it('Đang làm bản mới + số trùng bản in mới nhất khác kind → xlsx không replaces', async () => {
    await print().expect(201);
    f.freeze('2026-11-12T03:05:00Z');
    const xlsx = await create(YM, {
      kind: 'xlsx',
      reuse_if_unchanged: true,
    }).expect(201);
    expect(xlsx.body.reused).toBe(false);
    expect(xlsx.body.data.replaces).toBeUndefined();
    expect((await sendState(YM)).sent?.id).toBe(xlsx.body.id);
  });

  it('Đang làm bản mới + tổng = 0 → 409 ORDER_EMPTY; "không cần đề nghị" → 409 ALREADY_SENT', async () => {
    const { id } = (await print().expect(201)).body;
    const empty = await print(await zeros()).expect(409);
    expect(empty.body.code).toBe('ORDER_EMPTY');
    const flag = await noOrder(YM, { order_qty: await zeros() }).expect(409);
    expect(flag.body.code).toBe('ALREADY_SENT');
    expect(await sendState(YM)).toMatchObject({
      state: 'sent',
      no_order_at: null,
      sent: { id },
    });
  });

  it('Đang làm bản mới + Rời trang / "Quay lại" → không gọi server → Đã gửi như trước', async () => {
    const { id } = (await print().expect(201)).body;
    const before = await sendState(YM);
    f.freeze('2026-11-12T05:00:00Z');
    expect(await sendState(YM)).toEqual(before);
    expect(before.sent?.id).toBe(id);
  });
});
