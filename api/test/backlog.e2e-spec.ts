import { deliveryFixture } from './delivery.fixture';
import type { BacklogGroup } from './delivery.fixture';
import { BEFORE_DEADLINE } from './me-request.fixture';

interface DeliveriesView {
  line: {
    id: string;
    qty: number;
    delivered_qty: number;
    cancelled_qty: number;
    cancel_note: string | null;
  };
  items: {
    id: string;
    qty: number;
    movement_id: string | null;
    actor_sub: string;
    actor_name: string | null;
    created_at: string;
  }[];
}

describe('GET admin/backlog, GET admin/lines/:id/deliveries', () => {
  const f = deliveryFixture('backlog');
  const {
    A,
    ADMIN,
    B,
    as,
    at,
    backlog,
    customLine,
    deliver,
    freeze,
    http,
    imgA,
    pool,
    review,
    stockItem,
  } = f;

  // Kỳ 2026-10 hạn 10/10 → đã khóa ở mọi mốc test; 2026-12 hạn 10/12 → còn mở
  const seedLine = async (ym: string, sub: string, cols: object) => {
    await pool().query(
      `INSERT INTO periods (ym, deadline) VALUES ('2026-10-01', '2026-10-10T17:00:00Z')
       ON CONFLICT (ym) DO NOTHING`,
    );
    const { rows } = await pool().query<{ id: string }>(
      `INSERT INTO requests (period_ym, user_sub, department, created_by_sub)
       VALUES ($1::date, $2, 'Phòng CT', $2)
       ON CONFLICT (period_ym, user_sub) DO UPDATE SET updated_at = requests.updated_at
       RETURNING id`,
      [`${ym}-01`, sub],
    );
    const keys = Object.keys(cols);
    const line = await pool().query<{ id: string }>(
      `INSERT INTO request_lines (request_id, ${keys.join(', ')})
       VALUES ($1, ${keys.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING id`,
      [rows[0].id, ...Object.values(cols)],
    );
    return { request: rows[0].id, line: line.rows[0].id };
  };
  const groupOf = async (by: 'item' | 'person', key: string) =>
    (await backlog(by)).find((g: BacklogGroup) => g.key === key);
  const lineIdsOf = (g: BacklogGroup | undefined) =>
    g?.lines.map((l) => l.line_id) ?? [];
  const deliveries = (lineId: string) =>
    as(http().get(`/api/admin/lines/${lineId}/deliveries`), ADMIN, 'admin');
  const customCols = (name: string, unit: string, status = 'accepted') => ({
    custom_name: name,
    custom_unit: unit,
    image_file_id: imgA(),
    review_status: status,
  });

  beforeEach(() => freeze('2026-11-12T03:00:00Z'));

  it('nợ kỳ 2026-10 (2) + kỳ 2026-11 (3) cùng món → by=item một nhóm remaining_qty 5, 2 dòng kỳ cũ trước', async () => {
    const item = await stockItem(4);
    const old = await seedLine('2026-10', B, { item_id: item, qty: 2 });
    const cur = await seedLine('2026-11', A, {
      item_id: item,
      qty: 5,
      delivered_qty: 1,
      cancelled_qty: 1,
    });
    const group = await groupOf('item', item);
    expect(group).toMatchObject({
      key: item,
      label: { item_id: item, unit: 'cay' },
      remaining_qty: 5,
    });
    expect(group!.label.name).toMatch(/^e2e-req-item-/);
    expect(group!.lines).toEqual([
      {
        line_id: old.line,
        request_id: old.request,
        period_ym: '2026-10',
        user_sub: B,
        full_name: 'Nhân viên B',
        department: 'Phòng CT',
        user_status: 'active',
        item_id: item,
        name: group!.label.name,
        name_en: null,
        unit: 'cay',
        qty: 2,
        delivered_qty: 0,
        cancelled_qty: 0,
        remaining_qty: 2,
        stock_qty: 4,
      },
      expect.objectContaining({
        line_id: cur.line,
        period_ym: '2026-11',
        remaining_qty: 3,
        cancelled_qty: 1,
      }),
    ]);
  });

  it('trong nhóm cùng kỳ sắp theo full_name (Nhân viên A trước B)', async () => {
    const item = await stockItem(10);
    const b = await seedLine('2026-11', B, { item_id: item, qty: 1 });
    const a = await seedLine('2026-11', A, { item_id: item, qty: 1 });
    expect(lineIdsOf(await groupOf('item', item))).toEqual([a.line, b.line]);
  });

  it('không có: rejected, pending, đã hủy hết, đã giao đủ, kỳ đang mở 2026-12; còn lại 1 (hủy 2/3) vẫn có', async () => {
    const item = await stockItem(10);
    const full = await seedLine('2026-11', A, {
      item_id: item,
      qty: 2,
      delivered_qty: 2,
    });
    const allCancelled = await seedLine('2026-10', A, {
      item_id: item,
      qty: 3,
      delivered_qty: 1,
      cancelled_qty: 2,
    });
    const openPeriod = await seedLine('2026-12', A, { item_id: item, qty: 1 });
    const oneLeft = await seedLine('2026-10', B, {
      item_id: item,
      qty: 3,
      cancelled_qty: 2,
    });
    const rejected = await seedLine('2026-11', B, {
      ...customCols('Rác', 'cai', 'rejected'),
      qty: 1,
    });
    const pending = await seedLine('2026-11', B, {
      ...customCols('Chờ', 'cai', 'pending'),
      qty: 1,
    });
    expect(lineIdsOf(await groupOf('item', item))).toEqual([oneLeft.line]);
    const all = (await backlog('item')).flatMap(lineIdsOf);
    for (const gone of [full, allCancelled, openPeriod, rejected, pending]) {
      expect(all).not.toContain(gone.line);
    }
  });

  it('kỳ 2026-11 chưa có lúc 2026-11-10T16:59:59.999Z (23:59:59.999 VN); có lúc 2026-11-10T17:00:00.000Z (00:00 ngày 11 VN)', async () => {
    const item = await stockItem(10);
    await seedLine('2026-11', A, { item_id: item, qty: 2 });
    freeze('2026-11-10T16:59:59.999Z');
    expect(await groupOf('item', item)).toBeUndefined();
    freeze('2026-11-10T17:00:00.000Z');
    expect((await groupOf('item', item))?.remaining_qty).toBe(2);
  });

  it('dòng ngoài DM gom theo lower(trim(tên)) + lower(trim(ĐVT)) (CUSTOM_ITEM_KEY); khác ĐVT là nhóm khác; stock_qty null', async () => {
    const name = `Bìa ${f.SUFFIX}`;
    const x = await seedLine('2026-10', A, {
      ...customCols(`  ${name.toUpperCase()} `, 'cai'),
      qty: 2,
    });
    const y = await seedLine('2026-11', B, {
      ...customCols(name, ' Cai '),
      qty: 1,
    });
    const z = await seedLine('2026-11', A, {
      ...customCols(name, 'hop'),
      qty: 4,
    });
    const groups = (await backlog('item')).filter((g) =>
      g.lines.some((l) => [x.line, y.line, z.line].includes(l.line_id)),
    );
    expect(groups).toHaveLength(2);
    const cai = groups.find((g) => g.label.unit === 'cai')!;
    expect(cai).toMatchObject({ remaining_qty: 3, label: { item_id: null } });
    expect(lineIdsOf(cai)).toEqual([x.line, y.line]);
    expect(cai.lines.map((l) => l.stock_qty)).toEqual([null, null]);
    expect(lineIdsOf(groups.find((g) => g.label.unit === 'hop'))).toEqual([
      z.line,
    ]);
  });

  it('by=person nhóm theo người: label {user_sub, full_name, department}, remaining_qty cộng mọi món', async () => {
    const [p, q] = [await stockItem(10), await stockItem(0)];
    await seedLine('2026-10', A, { item_id: p, qty: 2 });
    await seedLine('2026-11', A, { item_id: q, qty: 3, delivered_qty: 1 });
    await seedLine('2026-11', B, { item_id: p, qty: 1 });
    const group = await groupOf('person', A);
    expect(group).toMatchObject({
      key: A,
      label: { user_sub: A, full_name: 'Nhân viên A', department: 'Phòng CT' },
      remaining_qty: 4,
    });
    expect(group!.lines.map((l) => [l.period_ym, l.stock_qty])).toEqual([
      ['2026-10', 10],
      ['2026-11', 0],
    ]);
    expect((await groupOf('person', B))?.remaining_qty).toBe(1);
  });

  it('giao bổ sung tới đủ → dòng biến mất', async () => {
    const item = await stockItem(10);
    const { line } = await seedLine('2026-10', A, { item_id: item, qty: 3 });
    await deliver(line, { qty: 2, expected_delivered_qty: 0 }).expect(200);
    expect((await groupOf('item', item))?.remaining_qty).toBe(1);
    await deliver(line, { qty: 1, expected_delivered_qty: 2 }).expect(200);
    expect(await groupOf('item', item)).toBeUndefined();
  });

  it('by=foo → 400 VALIDATION; thiếu by → theo món; member → 403', async () => {
    const res = await as(
      http().get('/api/admin/backlog?by=foo'),
      ADMIN,
      'admin',
    ).expect(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION', fields: ['by'] });
    const item = await stockItem(10);
    await seedLine('2026-10', A, { item_id: item, qty: 1 });
    const plain = await as(http().get('/api/admin/backlog'), ADMIN, 'admin');
    expect(
      (plain.body as { groups: BacklogGroup[] }).groups.some(
        (g) => g.key === item,
      ),
    ).toBe(true);
    await as(http().get('/api/admin/backlog'), A, 'member').expect(403);
  });

  it('lịch sử đợt: giao 1 rồi 2 → 2 đợt cũ trước, actor_name "Hành chính", có movement; cancel_note của dòng', async () => {
    const item = await stockItem(10);
    const { line } = await seedLine('2026-10', A, {
      item_id: item,
      qty: 5,
      cancel_note: null,
    });
    freeze('2026-11-12T03:00:00Z');
    await deliver(line, { qty: 1, expected_delivered_qty: 0 }).expect(200);
    freeze('2026-11-12T04:00:00Z');
    await deliver(line, { qty: 2, expected_delivered_qty: 1 }).expect(200);
    const res = await deliveries(line).expect(200);
    const body = res.body as DeliveriesView;
    expect(body.line).toEqual({
      id: line,
      qty: 5,
      delivered_qty: 3,
      cancelled_qty: 0,
      cancel_note: null,
    });
    expect(body.items).toEqual([
      {
        id: expect.any(String) as string,
        qty: 1,
        movement_id: expect.any(String) as string,
        actor_sub: ADMIN,
        actor_name: 'Hành chính',
        created_at: '2026-11-12T03:00:00.000Z',
      },
      expect.objectContaining({
        qty: 2,
        created_at: '2026-11-12T04:00:00.000Z',
      }),
    ]);
  });

  it('lịch sử: 4 đợt cùng mili-giây giữ thứ tự chèn (1, 2, 3, 4)', async () => {
    const item = await stockItem(20);
    const { line } = await seedLine('2026-10', A, { item_id: item, qty: 10 });
    let delivered = 0;
    for (const qty of [1, 2, 3, 4]) {
      await deliver(line, { qty, expected_delivered_qty: delivered }).expect(
        200,
      );
      delivered += qty;
    }
    const body = (await deliveries(line).expect(200)).body as DeliveriesView;
    expect(body.items.map((d) => d.qty)).toEqual([1, 2, 3, 4]);
  });

  it('dòng accepted giao 1 → lịch sử có đợt movement_id null; dòng chưa giao → items []', async () => {
    at(BEFORE_DEADLINE);
    const { line } = await customLine();
    await review(line.id, { action: 'accept' }).expect(200);
    freeze('2026-11-12T03:00:00Z');
    expect((await deliveries(line.id).expect(200)).body.items).toEqual([]);
    await deliver(line.id, { qty: 1, expected_delivered_qty: 0 }).expect(200);
    const items = (await deliveries(line.id).expect(200)).body
      .items as DeliveriesView['items'];
    expect(items).toEqual([
      expect.objectContaining({ qty: 1, movement_id: null }),
    ]);
  });

  it('lịch sử: dòng không có → 404 LINE_NOT_FOUND; id sai dạng → 400; member → 403', async () => {
    const missing = await deliveries(
      '00000000-0000-4000-8000-000000000000',
    ).expect(404);
    expect(missing.body.code).toBe('LINE_NOT_FOUND');
    await deliveries('x').expect(400);
    at(BEFORE_DEADLINE);
    const { line } = await customLine();
    await as(
      http().get(`/api/admin/lines/${line.id}/deliveries`),
      A,
      'member',
    ).expect(403);
  });
});
