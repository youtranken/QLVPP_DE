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
    putSignatureBoxes,
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
      'cây',
      5,
      0,
      4,
      1,
      6,
    ]);
  });

  it('bản chốt mới lưu signature_boxes của cấu hình lúc chốt (không còn signers); đổi cấu hình sau không đổi bản chốt', async () => {
    const original = (
      await f
        .pool()
        .query("SELECT value FROM config WHERE key = 'signature_boxes'")
    ).rows[0].value as object[];
    const boxes = [
      { title: 'Chủ quản đơn vị', title_en: 'Head of Dept.', name: 'Trưởng B' },
      { title: 'Người yêu cầu', title_en: 'Applicant', name: '' },
      { title: 'Duyệt', title_en: '', name: 'Duyệt C' },
    ];
    try {
      await putSignatureBoxes(boxes);
      const { id } = await createOk('2026-11', { kind: 'print' });
      await putSignatureBoxes([{ title: 'Khác', title_en: '', name: '' }]);
      const s = await snapshot(id);
      expect(s.signature_boxes).toEqual(boxes);
      expect(s).not.toHaveProperty('signers');
    } finally {
      await putSignatureBoxes(original);
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

  it('export.xlsx?lang=en: bảng Xuất lẻ dùng name_en; món không có name_en dùng name', async () => {
    const [withEn, plain] = await Promise.all([
      f.stockItem(10),
      f.stockItem(10),
    ]);
    const enName = `Pen ${withEn.slice(0, 8)}`;
    await f
      .pool()
      .query('UPDATE items SET name_en = $2 WHERE id = $1', [withEn, enName]);
    await f.issueAt(withEn, 2, '2026-11-05T03:00:00Z', null);
    await f.issueAt(plain, 1, '2026-11-06T03:00:00Z', null);
    const { id } = await createOk('2026-11');
    const issues = (await snapshot(id)).issues;
    expect(issues.find((i) => i.item_name_en === enName)).toBeDefined();
    const ws = (await workbook(await exportXlsx(id, '?lang=en').expect(200)))
      .worksheets[0];
    const names = ws.getColumn(1).values;
    expect(names).toContain(enName);
    expect(names).toContain(await itemName(plain));
    expect(names).not.toContain(await itemName(withEn));
  });
});
