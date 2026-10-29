import { reportsFixture } from './reports.fixture';

describe('GET admin/reports/:ym — Tổng theo món (BR-15)', () => {
  const f = reportsFixture('reports');
  const {
    A,
    B,
    build,
    customCols,
    customName,
    customRow,
    deliver,
    freeze,
    itemRow,
    lockedLine,
    pool,
    seedLine,
    stockItem,
  } = f;

  // Sau hạn kỳ 2026-11 (10/11 17:00Z) → kỳ mở là 2026-12
  beforeEach(() => freeze('2026-11-12T03:00:00Z'));

  it('E5-S1 đăng ký 5, đã giao 2, tồn 2 → requested 3, need 1', async () => {
    const { item, line } = await lockedLine(4, 5);
    await deliver(line.id, { qty: 2, expected_delivered_qty: 0 }).expect(200);
    const r = await build('2026-11');
    expect(itemRow(r, item)).toMatchObject({
      item_id: item,
      requested: 3,
      backlog_prev: 0,
      stock: 2,
      need: 1,
      active: true,
    });
  });

  it('E5-S1 nợ 2 kỳ 2026-10 + đăng ký 3 kỳ 2026-11, tồn 0 → requested 3, backlog_prev 2, need 5', async () => {
    const item = await stockItem(0);
    await seedLine('2026-10', B, { item_id: item, qty: 2 });
    await seedLine('2026-11', A, { item_id: item, qty: 3 });
    expect(itemRow(await build('2026-11'), item)).toMatchObject({
      requested: 3,
      backlog_prev: 2,
      stock: 0,
      need: 5,
    });
  });

  it('biên tồn: đăng ký 3 với tồn 10 → 0, tồn 3 (= cần) → 0, tồn 2 (= cần − 1) → 1', async () => {
    const [s10, s3, s2] = await Promise.all(
      [10, 3, 2].map((s) => stockItem(s)),
    );
    for (const item of [s10, s3, s2])
      await seedLine('2026-11', A, { item_id: item, qty: 3 });
    const r = await build('2026-11');
    expect(itemRow(r, s10)?.need).toBe(0);
    expect(itemRow(r, s3)?.need).toBe(0);
    expect(itemRow(r, s2)?.need).toBe(1);
  });

  it('dòng đã hủy nợ/giao đủ không tính; hủy một phần chỉ tính phần còn lại', async () => {
    const gone = await stockItem(0);
    const partial = await stockItem(0);
    await seedLine('2026-10', A, { item_id: gone, qty: 5, cancelled_qty: 5 });
    await seedLine('2026-10', B, { item_id: gone, qty: 4, delivered_qty: 4 });
    await seedLine('2026-10', A, {
      item_id: partial,
      qty: 5,
      delivered_qty: 1,
      cancelled_qty: 2,
    });
    const r = await build('2026-11');
    expect(itemRow(r, gone)).toBeUndefined();
    expect(itemRow(r, partial)).toMatchObject({
      requested: 0,
      backlog_prev: 2,
      need: 2,
    });
  });

  it('kỳ sau ym không tính; báo cáo kỳ đang mở 2026-12: requested = dòng kỳ mở, backlog_prev = kỳ đã khóa', async () => {
    const item = await stockItem(1);
    await seedLine('2026-11', A, { item_id: item, qty: 2 });
    await seedLine('2026-12', A, { item_id: item, qty: 3 });
    expect(itemRow(await build('2026-11'), item)).toMatchObject({
      requested: 2,
      backlog_prev: 0,
      need: 1,
    });
    expect(itemRow(await build('2026-12'), item)).toMatchObject({
      requested: 3,
      backlog_prev: 2,
      stock: 1,
      need: 4,
    });
  });

  it('dòng converted tính vào món đích cùng dòng thường', async () => {
    const item = await stockItem(0);
    await seedLine('2026-11', A, { item_id: item, qty: 2 });
    await seedLine('2026-11', A, {
      item_id: item,
      qty: 3,
      review_status: 'converted',
    });
    expect(itemRow(await build('2026-11'), item)).toMatchObject({
      requested: 5,
      need: 5,
    });
  });

  it('món đã ngừng (active false) còn nợ vẫn hiện', async () => {
    const item = await stockItem(0);
    await seedLine('2026-11', A, { item_id: item, qty: 2 });
    await pool().query('UPDATE items SET active = false WHERE id = $1', [item]);
    expect(itemRow(await build('2026-11'), item)).toMatchObject({
      active: false,
      requested: 2,
      need: 2,
    });
  });

  it('E5-S1 ngoài DM accepted 4 (A 3 + B 1 cùng tên khác hoa/khoảng trắng) → một hàng custom, stock null, need 4, people 2', async () => {
    const name = customName('Bia cong');
    await seedLine('2026-11', A, customCols(name, 3));
    await seedLine('2026-11', B, customCols(`  ${name.toUpperCase()}  `, 1));
    const r = await build('2026-11');
    const rows = r.custom.filter((c) =>
      c.name.toLowerCase().includes(name.toLowerCase()),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      key: expect.stringMatching(/^custom:/),
      unit: 'cai',
      requested: 4,
      backlog_prev: 0,
      stock: null,
      need: 4,
      people: 2,
    });
  });

  it('F3: ngoài DM nợ kỳ 2026-10 (2) + đăng ký kỳ 2026-11 (4) → backlog_prev 2, need 6', async () => {
    const name = customName('Kep giay');
    await seedLine('2026-10', B, customCols(name, 2));
    await seedLine('2026-11', A, customCols(name, 4));
    expect(customRow(await build('2026-11'), 'Kep giay')).toMatchObject({
      requested: 4,
      backlog_prev: 2,
      stock: null,
      need: 6,
    });
  });

  it('E5-S1 rejected/pending không vào số; pending kỳ ym tăng pending_custom_count đúng 1', async () => {
    const before = (await build('2026-11')).pending_custom_count;
    await seedLine(
      '2026-11',
      A,
      customCols(customName('Cho duyet'), 2, 'pending'),
    );
    await seedLine(
      '2026-11',
      B,
      customCols(customName('Bi tu choi'), 2, 'rejected'),
    );
    await seedLine(
      '2026-10',
      B,
      customCols(customName('Cho cu'), 2, 'pending'),
    );
    const r = await build('2026-11');
    expect(r.pending_custom_count).toBe(before + 1);
    expect(customRow(r, 'Cho duyet')).toBeUndefined();
    expect(customRow(r, 'Bi tu choi')).toBeUndefined();
    expect(customRow(r, 'Cho cu')).toBeUndefined();
  });
});
