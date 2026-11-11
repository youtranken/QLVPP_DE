import { snapshotsFixture } from './report-snapshots.fixture';

describe('POST admin/reports/:ym/snapshots — bản chốt (E5-S2)', () => {
  const f = snapshotsFixture('snapshots');
  const {
    ADMIN,
    B,
    auditOf,
    create,
    createOk,
    customCols,
    customName,
    freeze,
    getSnapshot,
    list,
    lockedLine,
    seedLine,
    snapshot,
    stockItem,
  } = f;

  // Sau hạn kỳ 2026-11 (10/11 17:00Z, 00:00 11/11 giờ VN) → kỳ mở là 2026-12
  beforeEach(() => freeze('2026-11-12T03:00:00Z'));

  const twoItems = async () => {
    const { item } = await lockedLine(4, 5);
    const other = await stockItem(0);
    await seedLine('2026-11', B, { item_id: other, qty: 3 });
    return { item, other };
  };

  it('E5-S2 order_qty {A4: 7} → bản chốt A4 = 7, món khác = số gộp (đăng ký + nợ)', async () => {
    const { item, other } = await twoItems();
    const created = await createOk('2026-11', {
      kind: 'xlsx',
      order_qty: { [item]: 7 },
    });
    expect(created).toMatchObject({
      kind: 'xlsx',
      created_by: { sub: ADMIN, name: 'Hành chính' },
    });
    const s = await snapshot(created.id);
    expect(s).toMatchObject({
      id: created.id,
      kind: 'xlsx',
      period_ym: '2026-11',
    });
    expect(s.byItem.find((r) => r.key === item)?.need).toBe(1);
    expect(s.order_qty[item]).toBe(7);
    expect(s.order_qty[other]).toBe(3);
    expect(s.created_at).toBe(created.created_at);
    expect(s.created_at).toBe('2026-11-12T03:00:00.000Z');
  });

  it('khóa CUSTOM_ITEM_KEY (chuỗi mờ) nhận được; ô thiếu → số gộp của nhóm ngoài danh mục', async () => {
    await seedLine('2026-11', B, customCols(customName('bia'), 2));
    await seedLine('2026-11', B, customCols(customName('ghim'), 4));
    const live = await f.build('2026-11');
    const [bia, ghim] = ['bia', 'ghim'].map((n) => f.customRow(live, n)!);
    const s = await snapshot(
      (
        await createOk('2026-11', {
          kind: 'print',
          order_qty: { [bia.key]: 9 },
        })
      ).id,
    );
    expect(s.kind).toBe('print');
    expect(s.order_qty[bia.key]).toBe(9);
    expect(s.order_qty[ghim.key]).toBe(4);
  });

  it('biên order_qty: 0 và 1000 → 201', async () => {
    const { item } = await twoItems();
    for (const n of [0, 1000]) {
      const s = await snapshot(
        (await createOk('2026-11', { kind: 'xlsx', order_qty: { [item]: n } }))
          .id,
      );
      expect(s.order_qty[item]).toBe(n);
    }
  });

  it.each([
    ['-1', -1],
    ['1.5', 1.5],
    ['chuỗi "7"', '7'],
    ['1001', 1001],
    ['null', null],
  ])(
    'biên order_qty: %s → 400 VALIDATION fields order_qty.<key>',
    async (_n, v) => {
      const { item } = await twoItems();
      const res = await create('2026-11', {
        kind: 'xlsx',
        order_qty: { [item]: v },
      }).expect(400);
      expect(res.body).toMatchObject({
        code: 'VALIDATION',
        fields: [`order_qty.${item}`],
      });
    },
  );

  it('khóa không có trong báo cáo (uuid lạ) → 400 VALIDATION, không tạo bản chốt', async () => {
    await twoItems();
    const ghost = '00000000-0000-4000-8000-000000000000';
    const before = (await list('2026-11')).length;
    const res = await create('2026-11', {
      kind: 'xlsx',
      order_qty: { [ghost]: 1 },
    }).expect(400);
    expect(res.body).toMatchObject({
      code: 'VALIDATION',
      fields: [`order_qty.${ghost}`],
    });
    expect(await list('2026-11')).toHaveLength(before);
  });

  it('kind sai hoặc thiếu → VALIDATION fields kind; order_qty không phải object → fields order_qty', async () => {
    for (const body of [{}, { kind: 'pdf' }]) {
      const res = await create('2026-11', body).expect(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION', fields: ['kind'] });
    }
    for (const order_qty of [[1], 5, 'x']) {
      const res = await create('2026-11', { kind: 'xlsx', order_qty }).expect(
        400,
      );
      expect(res.body).toMatchObject({
        code: 'VALIDATION',
        fields: ['order_qty'],
      });
    }
  });

  it('biên kỳ: kỳ đang mở 2026-12 → 409 PERIOD_NOT_LOCKED; kỳ đã khóa 2026-11 → 201; kỳ sau 2027-01 → 400 INVALID_PERIOD; member → 403', async () => {
    // 10:00 12/11 giờ VN: kỳ 2026-11 đã khóa nên 2026-12 là kỳ mở
    const open = await create('2026-12', { kind: 'xlsx' }).expect(409);
    expect(open.body).toMatchObject({
      code: 'PERIOD_NOT_LOCKED',
      ym: '2026-12',
    });
    await lockedLine(0, 1);
    const { id } = await createOk('2026-11');
    expect((await snapshot(id)).period_ym).toBe('2026-11');
    const res = await create('2027-01', { kind: 'xlsx' }).expect(400);
    expect(res.body.code).toBe('INVALID_PERIOD');
    await create('2026-11', { kind: 'xlsx' }, B, 'member').expect(403);
  });

  it('mỗi POST tạo một bản chốt mới; list mới trước, có giờ + tên người lập', async () => {
    await twoItems();
    const first = await createOk('2026-11');
    freeze('2026-11-12T03:05:00Z');
    const second = await createOk('2026-11', { kind: 'print' });
    expect(second.id).not.toBe(first.id);
    const mine = (await list('2026-11')).filter((s) =>
      [first.id, second.id].includes(s.id),
    );
    expect(mine).toEqual([
      {
        id: second.id,
        kind: 'print',
        created_at: '2026-11-12T03:05:00.000Z',
        created_by_sub: ADMIN,
        created_by_name: 'Hành chính',
        has_items: true,
        items_count: 2,
        units_total: 8,
      },
      {
        id: first.id,
        kind: 'xlsx',
        created_at: '2026-11-12T03:00:00.000Z',
        created_by_sub: ADMIN,
        created_by_name: 'Hành chính',
        has_items: true,
        items_count: 2,
        units_total: 8,
      },
    ]);
  });

  it('audit report.snapshot_created {ym, kind, snapshot_id}; GET không audit', async () => {
    await twoItems();
    const { id } = await createOk('2026-11', { kind: 'print' });
    expect(await auditOf('report.snapshot_created', id)).toEqual([
      { ym: '2026-11', kind: 'print', snapshot_id: id },
    ]);
    const n = await f.auditCount(id);
    await snapshot(id);
    await list('2026-11');
    await f.exportXlsx(id).expect(200);
    expect(await f.auditCount(id)).toBe(n);
  });

  it('id lạ → 404 SNAPSHOT_NOT_FOUND; id không phải uuid → 400 VALIDATION', async () => {
    const ghost = '00000000-0000-4000-8000-000000000000';
    const res = await getSnapshot(ghost).expect(404);
    expect(res.body.code).toBe('SNAPSHOT_NOT_FOUND');
    const xlsx = await f.exportXlsx(ghost).expect(404);
    expect(f.binaryError(xlsx).code).toBe('SNAPSHOT_NOT_FOUND');
    expect((await getSnapshot('abc').expect(400)).body.code).toBe('VALIDATION');
  });
});
