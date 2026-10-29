import { snapshotsFixture } from './report-snapshots.fixture';

describe('Bản chốt đóng băng + export.xlsx (E5-S2)', () => {
  const f = snapshotsFixture('snapfrozen');
  const {
    createOk,
    deliver,
    exportXlsx,
    freeze,
    itemName,
    itemRow,
    lockedLine,
    putSigners,
    snapshot,
    workbook,
  } = f;

  beforeEach(() => freeze('2026-11-12T03:00:00Z'));

  it('E5-S2 chốt → giao thêm 2 → bản chốt và Excel ra số cũ, báo cáo sống ra số mới', async () => {
    const { item, line } = await lockedLine(4, 5);
    const { id } = await createOk('2026-11', {
      kind: 'xlsx',
      order_qty: { [item]: 6 },
    });
    await deliver(line.id, { qty: 2, expected_delivered_qty: 0 }).expect(200);

    expect(itemRow(await f.build('2026-11'), item)).toMatchObject({
      requested: 3,
      stock: 2,
    });
    const s = await snapshot(id);
    expect(itemRow(s, item)).toMatchObject({ requested: 5, stock: 4, need: 1 });
    expect(s.order_qty[item]).toBe(6);

    const ws = (await workbook(await exportXlsx(id).expect(200))).worksheets[0];
    const name = await itemName(item);
    const row = ws.getColumn(1).values.indexOf(name);
    expect((ws.getRow(row).values as unknown[]).slice(1)).toEqual([
      name,
      'cay',
      5,
      0,
      4,
      1,
      6,
    ]);
  });

  it('signers lấy từ cấu hình lúc chốt; đổi cấu hình sau không đổi bản chốt', async () => {
    const original = (
      await f.pool().query("SELECT value FROM config WHERE key = 'signers'")
    ).rows[0].value as object;
    try {
      await putSigners({
        preparer: 'Lập A',
        head: 'Trưởng B',
        approver: 'Duyệt C',
      });
      const { id } = await createOk('2026-11', { kind: 'print' });
      await putSigners({ preparer: 'Người khác' });
      expect((await snapshot(id)).signers).toEqual({
        preparer: 'Lập A',
        head: 'Trưởng B',
        approver: 'Duyệt C',
      });
    } finally {
      await putSigners(original);
    }
  });

  it('export.xlsx mặc định vi: 2 sheet, tên tệp theo kỳ, content-type xlsx', async () => {
    await lockedLine(4, 5);
    const { id } = await createOk('2026-11');
    const res = await exportXlsx(id).expect(200);
    expect(res.headers['content-type']).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="vpp-bao-cao-2026-11.xlsx"',
    );
    const wb = await workbook(res);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Tổng theo món',
      'Chi tiết',
    ]);
    expect(wb.worksheets[0].getCell('A1').value).toBe('Món');
  });

  it('export.xlsx?lang=en → tiêu đề tiếng Anh; ?lang=vi → tiếng Việt; ?lang=fr → 400 VALIDATION', async () => {
    await lockedLine(4, 5);
    const { id } = await createOk('2026-11');
    const en = await workbook(await exportXlsx(id, '?lang=en').expect(200));
    expect(en.worksheets.map((w) => w.name)).toEqual(['By item', 'Detail']);
    expect(en.worksheets[0].getCell('A1').value).toBe('Item');
    expect(en.worksheets[1].getCell('A1').value).toBe('Department');
    const vi = await workbook(await exportXlsx(id, '?lang=vi').expect(200));
    expect(vi.worksheets[0].getCell('A1').value).toBe('Món');
    const fr = await exportXlsx(id, '?lang=fr').expect(400);
    expect(f.binaryError(fr)).toMatchObject({
      code: 'VALIDATION',
      fields: ['lang'],
    });
  });
});
