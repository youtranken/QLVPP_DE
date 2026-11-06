import { adjustFixture } from './adjust.fixture';
import { AFTER_DEADLINE } from './me-request.fixture';

describe('chuông line_adjusted: một chuông mỗi người mỗi ngày giờ VN', () => {
  const f = adjustFixture('adjust-bell');
  const { ADMIN, at, freeze, pool, seed, cut, view, newOwner, bellsOf } = f;
  const { recordsOf } = f;
  const over = { reason_code: 'over_quota' };

  it('giảm 2 dòng trong một lần → 1 chuông cho chủ phiếu, 0 cho Hành chính; link /history/2026-11; event_id theo ngày VN', async () => {
    const sub = await newOwner();
    const r = await seed([5, 3], sub);
    freeze('2026-11-12T03:00:00.000Z');
    await cut(r, {
      0: { qty: 4, ...over },
      1: { qty: 0, reason_code: 'duplicate', reason_note: 'trùng' },
    }).expect(200);
    const bells = await bellsOf(sub);
    expect(bells).toHaveLength(1);
    expect(bells[0]).toMatchObject({
      event_id: `line_adjusted:${sub}:2026-11:2026-11-12`,
      link: '/history/2026-11',
      read_at: null,
      params: { ym: '2026-11', more: 0 },
    });
    expect(
      bells[0].params.lines.map((l) => [l.before, l.after, l.reason_code]),
    ).toEqual(
      expect.arrayContaining([
        [5, 4, 'over_quota'],
        [3, 0, 'duplicate'],
      ]),
    );
    expect(bells[0].params.lines[0]).toHaveProperty('unit', 'cay');
    expect(await bellsOf(ADMIN)).toEqual([]);
    const batches = new Set((await recordsOf(r.id)).map((x) => x.batch_id));
    expect(batches.size).toBe(1);
  });

  it('5 → 4 rồi 4 → 3 cùng ngày (đã đọc chuông) → vẫn 1 dòng, params 5 → 3, read_at NULL; 2 bản ghi theo thứ tự', async () => {
    const sub = await newOwner();
    const r = await seed([5], sub);
    freeze('2026-11-12T03:00:00.000Z');
    const first = view(await cut(r, { 0: { qty: 4, ...over } }).expect(200));
    await pool().query(
      'UPDATE in_app_notifications SET read_at = now() WHERE user_sub = $1',
      [sub],
    );
    freeze('2026-11-12T09:00:00.000Z');
    await cut(first, {
      0: { qty: 3, reason_code: 'other', reason_note: 'phòng đã đủ' },
    }).expect(200);
    const bells = await bellsOf(sub);
    expect(bells).toHaveLength(1);
    expect(bells[0].read_at).toBeNull();
    expect(bells[0].params.lines).toMatchObject([
      { before: 5, after: 3, reason_code: 'other', reason_note: 'phòng đã đủ' },
    ]);
    expect(
      (await recordsOf(r.id)).map((x) => [x.qty_before, x.qty_after]),
    ).toEqual([
      [5, 4],
      [4, 3],
    ]);
  });

  it('lưu lúc 23:59:59.999 và 00:00:00.000 giờ VN → 2 event_id (2 ngày)', async () => {
    const sub = await newOwner();
    const r = await seed([5], sub);
    freeze('2026-11-12T16:59:59.999Z');
    const first = view(await cut(r, { 0: { qty: 4, ...over } }).expect(200));
    freeze('2026-11-12T17:00:00.000Z');
    await cut(first, { 0: { qty: 3, ...over } }).expect(200);
    expect((await bellsOf(sub)).map((b) => b.event_id)).toEqual([
      `line_adjusted:${sub}:2026-11:2026-11-12`,
      `line_adjusted:${sub}:2026-11:2026-11-13`,
    ]);
  });

  it('chủ phiếu đã nghỉ (status locked) → 200, bản ghi có, 0 chuông', async () => {
    const sub = await newOwner();
    const r = await seed([5], sub);
    await pool().query("UPDATE users SET status = 'locked' WHERE sub = $1", [
      sub,
    ]);
    at(AFTER_DEADLINE);
    await cut(r, { 0: { qty: 2, ...over } }).expect(200);
    expect(await recordsOf(r.id)).toHaveLength(1);
    expect(await bellsOf(sub)).toEqual([]);
  });

  it('chỉ dòng user_left → 0 chuông; user_left + over_quota → params chỉ có dòng over_quota', async () => {
    const sub = await newOwner();
    const r = await seed([5, 3], sub);
    at(AFTER_DEADLINE);
    const left = view(
      await cut(r, { 0: { qty: 1, reason_code: 'user_left' } }).expect(200),
    );
    expect(await bellsOf(sub)).toEqual([]);
    await cut(left, {
      0: { qty: 0, reason_code: 'user_left' },
      1: { qty: 2, ...over },
    }).expect(200);
    const bells = await bellsOf(sub);
    expect(bells).toHaveLength(1);
    expect(bells[0].params.lines).toMatchObject([
      { before: 3, after: 2, reason_code: 'over_quota' },
    ]);
  });

  it('5 dòng giảm → lines 5, more 0; 6 dòng → lines 5, more 1', async () => {
    for (const [n, more] of [
      [5, 0],
      [6, 1],
    ]) {
      const sub = await newOwner();
      const qtys = Array.from({ length: n }, () => 2);
      const r = await seed(qtys, sub);
      at(AFTER_DEADLINE);
      const cuts = Object.fromEntries(
        qtys.map((_, i) => [i, { qty: 1, ...over }]),
      );
      await cut(r, cuts).expect(200);
      const [bell] = await bellsOf(sub);
      expect(bell.params.lines).toHaveLength(5);
      expect(bell.params.more).toBe(more);
    }
  });
});
