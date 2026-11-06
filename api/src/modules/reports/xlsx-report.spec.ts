import type ExcelJS from 'exceljs';
import {
  CUSTOM,
  ITEM,
  PLAIN,
  itemRow,
  openWorkbook,
  rowValues as values,
  snapshotData,
} from './xlsx-snapshot.fixture-spec';

const HEADER = [
  'STT\nNo.',
  'Mã\nCode',
  'Tên vật dụng',
  'Item name',
  'ĐVT\nUnit',
  'SL\nQty',
];
const FIRST_ROW = 6;

const form = async (
  data = snapshotData(),
  lang: 'vi' | 'en' = 'vi',
): Promise<ExcelJS.Worksheet> => (await openWorkbook(lang, data)).worksheets[0];

const rowsAfterHeader = (ws: ExcelJS.Worksheet) => {
  const out: unknown[][] = [];
  for (let n = FIRST_ROW; values(ws, n).length > 0; n++)
    out.push(values(ws, n));
  return out;
};

const findRow = (ws: ExcelJS.Worksheet, text: string) => {
  let found = 0;
  ws.eachRow((r, n) => {
    if (!found && r.values && (r.values as unknown[]).includes(text)) found = n;
  });
  return found;
};

describe('buildWorkbook · sheet 1 Phiếu đề xuất (mẫu D&E)', () => {
  it('sheet 1 tên "Phiếu đề xuất"; A1 gộp A1:F1 là "Phiếu đề xuất văn phòng phẩm"; dòng 2 "STATIONERY REQUEST FORM"', async () => {
    const wb = await openWorkbook('vi');
    const ws = wb.worksheets[0];
    expect(ws.name).toBe('Phiếu đề xuất');
    expect(ws.getCell('A1').value).toBe('Phiếu đề xuất văn phòng phẩm');
    expect(ws.getCell('F1').isMerged).toBe(true);
    expect(ws.getCell('F1').master.address).toBe('A1');
    expect(ws.getCell('A1').font.bold).toBe(true);
    expect(ws.getCell('A2').value).toBe('STATIONERY REQUEST FORM');
  });

  it('"Date :" + ngày lập bản chốt theo giờ VN: 16:59:59.999Z ngày 11 → 11/11/2026, 17:00:00.000Z → 12/11/2026', async () => {
    const ws = await form(
      snapshotData({ created_at: '2026-11-11T17:00:00.000Z' }),
    );
    expect(values(ws, 3)).toEqual([
      undefined,
      undefined,
      'Date :',
      '12/11/2026',
    ]);
    const before = await form(
      snapshotData({ created_at: '2026-11-11T16:59:59.999Z' }),
    );
    expect(before.getCell('D3').value).toBe('11/11/2026');
  });

  it('tiêu đề bảng đúng 6 cột song ngữ, độ rộng cột theo mẫu D&E A 7 · B 8 · C 33 · D 25 · E 10 · F 8', async () => {
    const ws = await form();
    expect(values(ws, FIRST_ROW - 1)).toEqual(HEADER);
    expect([1, 2, 3, 4, 5, 6].map((c) => ws.getColumn(c).width)).toEqual([
      7, 8, 33, 25, 10, 8,
    ]);
    expect(ws.getCell('C5').border.top?.style).toBe('thin');
  });

  it('hàng: STT 1…n, Mã (trống → "—"), tên vi, Item name (trống → rỗng), ĐVT tên vi, SL = order_qty; ngoài DM cuối với Mã "—"', async () => {
    const ws = await form();
    expect(rowsAfterHeader(ws)).toEqual([
      [1, 'B31', 'Bút bi', 'Ballpoint pen', 'cây', 7],
      [2, '—', 'Kẹp giấy', '', 'hộp', 1],
      [3, '—', 'Bìa còng', '', 'cái', 3],
    ]);
  });

  it('bản có order_basis: order_qty = 0 vẫn có hàng SL 0, order_qty = 1 có hàng; thiếu khóa thì lấy số gộp (2 + 1 = 3)', async () => {
    const ws = await form(
      snapshotData({ order_qty: { [ITEM]: 0, [PLAIN]: 1 }, order_basis: {} }),
    );
    expect(rowsAfterHeader(ws).map((r) => [r[2], r[5]])).toEqual([
      ['Bút bi', 0],
      ['Kẹp giấy', 1],
      ['Bìa còng', 3],
    ]);
  });

  it('bản chốt không có hàng nào → một hàng "Không có món cần đặt mua."', async () => {
    const ws = await form(
      snapshotData({ byItem: [], custom: [], order_qty: { [CUSTOM]: 0 } }),
    );
    expect(ws.getCell(`A${FIRST_ROW}`).value).toBe('Không có món cần đặt mua.');
    expect(ws.getCell(`F${FIRST_ROW}`).master.address).toBe(`A${FIRST_ROW}`);
    expect(values(ws, FIRST_ROW + 1)).toEqual([]);
  });

  it('ĐVT dùng tên vi đã lưu trong bản chốt; bản chốt cũ chưa lưu → tên từ bảng units; sheet 1 không đổi theo lang=en', async () => {
    const data = snapshotData({
      byItem: [itemRow({ unit_name: 'cây (cũ)', unit_name_en: 'stick' })],
    });
    for (const lang of ['vi', 'en'] as const) {
      const ws = await form(data, lang);
      expect(values(ws, FIRST_ROW)).toEqual([
        1,
        'B31',
        'Bút bi',
        'Ballpoint pen',
        'cây (cũ)',
        7,
      ]);
      expect(values(ws, FIRST_ROW - 1)).toEqual(HEADER);
    }
  });

  it('bản chốt cũ không có code → Mã "—"', async () => {
    const old: Partial<ReturnType<typeof itemRow>> = itemRow({});
    delete old.code;
    const ws = await form(snapshotData({ byItem: [old as never], custom: [] }));
    expect(values(ws, FIRST_ROW)[1]).toBe('—');
  });

  it('1 ô ký → chỉ cột C: chức danh (đậm), chức danh en, tên', async () => {
    const ws = await form();
    const title = findRow(ws, 'Người yêu cầu');
    expect(title).toBeGreaterThan(FIRST_ROW + 3);
    expect(ws.getRow(title).getCell(3).value).toBe('Người yêu cầu');
    expect(ws.getRow(title).getCell(3).font.bold).toBe(true);
    expect(values(ws, title).filter(Boolean)).toHaveLength(1);
    expect(ws.getRow(title + 1).getCell(3).value).toBe('Applicant');
    expect(findRow(ws, 'A')).toBeGreaterThan(title + 1);
  });

  it('3 ô ký → cột C, E, F; tên trống in dòng chấm', async () => {
    const ws = await form(
      snapshotData({
        signature_boxes: [
          { title: 'Chủ quản đơn vị', title_en: 'Head of Dept.', name: 'B' },
          { title: 'Người yêu cầu', title_en: 'Applicant', name: '' },
          { title: 'Duyệt', title_en: '', name: 'C' },
        ],
      }),
    );
    const title = findRow(ws, 'Chủ quản đơn vị');
    const row = ws.getRow(title);
    expect([3, 5, 6].map((c) => row.getCell(c).value)).toEqual([
      'Chủ quản đơn vị',
      'Người yêu cầu',
      'Duyệt',
    ]);
    expect([3, 5].map((c) => ws.getRow(title + 1).getCell(c).value)).toEqual([
      'Head of Dept.',
      'Applicant',
    ]);
    const names = ws.getRow(findRow(ws, 'B'));
    expect([3, 5, 6].map((c) => names.getCell(c).value)).toEqual([
      'B',
      '……………………',
      'C',
    ]);
  });

  it('bản chốt cũ chỉ có signers → 3 ô song ngữ "Người lập / Trưởng phòng / Duyệt" + "Prepared by / Head of Dept. / Approved by" với tên cũ', async () => {
    const ws = await form(
      snapshotData({
        signature_boxes: undefined,
        signers: { preparer: 'Lập X', head: '', approver: 'Duyệt Y' },
      }),
    );
    const row = ws.getRow(findRow(ws, 'Người lập'));
    expect([3, 5, 6].map((c) => row.getCell(c).value)).toEqual([
      'Người lập',
      'Trưởng phòng',
      'Duyệt',
    ]);
    const en = ws.getRow(row.number + 1);
    expect([3, 5, 6].map((c) => en.getCell(c).value)).toEqual([
      'Prepared by',
      'Head of Dept.',
      'Approved by',
    ]);
    const names = ws.getRow(findRow(ws, 'Lập X'));
    expect([3, 5, 6].map((c) => names.getCell(c).value)).toEqual([
      'Lập X',
      '……………………',
      'Duyệt Y',
    ]);
  });
});
