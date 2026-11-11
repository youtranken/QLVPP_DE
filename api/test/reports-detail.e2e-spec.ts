import { reportsFixture } from './reports.fixture';

describe('GET admin/reports/:ym — chi tiết phòng ban, xuất lẻ, kỳ hợp lệ', () => {
  const f = reportsFixture('reports-detail');
  const {
    A,
    ADMIN,
    B,
    build,
    customCols,
    customName,
    freeze,
    issueAt,
    itemName,
    report,
    seedLine,
    stockItem,
  } = f;

  beforeEach(() => freeze('2026-11-12T03:00:00Z'));

  it('E5-S1 byDepartment theo phòng ban chụp trên phiếu (null cuối) → người → món, qty sau điều chỉnh; pending/rejected/kỳ khác không hiện', async () => {
    const item = await stockItem(0);
    const name = await itemName(item);
    await seedLine(
      '2026-11',
      A,
      { item_id: item, qty: 4, delivered_qty: 1, cancelled_qty: 1 },
      'Phòng CT',
    );
    await seedLine('2026-11', ADMIN, { item_id: item, qty: 1 }, 'Phòng HC');
    const custom = customName('Bia mau');
    await seedLine('2026-11', B, customCols(custom, 2), null);
    await seedLine('2026-11', B, customCols(customName('Treo'), 1, 'pending'));
    await seedLine('2026-11', B, customCols(customName('Bo'), 1, 'rejected'));
    await seedLine('2026-10', A, { item_id: item, qty: 9 }, 'Phòng CT');

    const depts = (await build('2026-11')).byDepartment;
    const names = depts.map((d) => d.department);
    expect(names.indexOf('Phòng CT')).toBeLessThan(names.indexOf('Phòng HC'));
    expect(names[names.length - 1]).toBeNull();
    const ct = depts.find((d) => d.department === 'Phòng CT')!;
    expect(ct.people.find((p) => p.user_sub === A)).toEqual({
      user_sub: A,
      full_name: 'Nhân viên A',
      lines: [{ name, name_en: null, unit: 'cay', qty: 4 }],
    });
    const none = depts[depts.length - 1];
    expect(none.people.find((p) => p.user_sub === B)).toEqual({
      user_sub: B,
      full_name: 'Nhân viên B',
      lines: [{ name: custom, name_en: null, unit: 'cai', qty: 2 }],
    });
  });

  it('E5-S1 xuất lẻ theo tháng dương lịch VN: 1/11 00:00 VN có, trước đó 1 ms không; 30/11 23:59:59.999 VN có, 1/12 00:00 VN không', async () => {
    const item = await stockItem(10);
    const name = await itemName(item);
    await issueAt(item, 2, '2026-11-15T03:00:00Z', B);
    await issueAt(item, 3, '2026-10-31T17:00:00Z', null);
    await issueAt(item, 4, '2026-10-31T16:59:59.999Z', B);
    await issueAt(item, 5, '2026-11-30T16:59:59.999Z', A);
    await issueAt(item, 6, '2026-11-30T17:00:00Z', A);
    const issues = (await build('2026-11')).issues.filter(
      (i) => i.item_name === name,
    );
    expect(issues).toEqual([
      {
        item_name: name,
        item_name_en: null,
        unit: 'cay',
        recipient_sub: null,
        recipient_name: null,
        qty: 3,
        reason: 'dùng cho hội nghị',
        at: '2026-10-31T17:00:00.000Z',
      },
      expect.objectContaining({
        recipient_sub: B,
        recipient_name: 'Nhân viên B',
        qty: 2,
        at: '2026-11-15T03:00:00.000Z',
      }),
      expect.objectContaining({ qty: 5, at: '2026-11-30T16:59:59.999Z' }),
    ]);
  });

  it('ym, generated_at = mốc server; kỳ không có dữ liệu (2000-01) → 200 rỗng', async () => {
    const r = await build('2000-01');
    expect(r).toEqual({
      ym: '2000-01',
      generated_at: '2026-11-12T03:00:00.000Z',
      byItem: [],
      custom: [],
      byDepartment: [],
      issues: [],
      pending_custom: [],
      pending_custom_count: 0,
      progress: {},
    });
  });

  it.each(['1999-12', '2026-13', 'abc', '2027-01', '2027-05'])(
    'ym %s → 400 INVALID_PERIOD (sai dạng hoặc sau kỳ mở 2026-12)',
    async (ym) => {
      const res = await report(ym).expect(400);
      expect(res.body).toMatchObject({ code: 'INVALID_PERIOD' });
    },
  );

  it('biên khóa sổ: 10/11 16:59:59.999Z → 2026-12 INVALID_PERIOD, 2026-11 (đang mở) PERIOD_NOT_LOCKED; 17:00:00Z → 2026-11 200, 2026-12 (đang mở) PERIOD_NOT_LOCKED', async () => {
    freeze('2026-11-10T16:59:59.999Z');
    expect((await report('2026-12').expect(400)).body.code).toBe(
      'INVALID_PERIOD',
    );
    expect((await report('2026-11').expect(409)).body.code).toBe(
      'PERIOD_NOT_LOCKED',
    );
    freeze('2026-11-10T17:00:00.000Z');
    await report('2026-11').expect(200);
    expect((await report('2026-12').expect(409)).body.code).toBe(
      'PERIOD_NOT_LOCKED',
    );
  });

  it('member → 403; sa → 200', async () => {
    await report('2026-11', A, 'member').expect(403);
    await report('2026-11', `e2e-req-sa-${f.SUFFIX}`, 'sa').expect(200);
  });
});
