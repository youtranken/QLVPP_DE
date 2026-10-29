import ExcelJS from 'exceljs';
import type { SnapshotData } from './report.types';
import { buildWorkbook } from './xlsx-report';

const ITEM = '11111111-1111-4111-8111-111111111111';
const PLAIN = '22222222-2222-4222-8222-222222222222';
const CUSTOM = 'custom:["bìa còng","cái"]';

const row = (over: object) => ({
  key: ITEM,
  item_id: ITEM,
  name: 'Bút bi',
  name_en: 'Ballpoint pen',
  unit: 'cây',
  pack_note: null,
  active: true,
  requested: 5,
  backlog_prev: 2,
  stock: 3,
  need: 4,
  ...over,
});

const data: SnapshotData = {
  ym: '2026-11',
  generated_at: '2026-11-12T03:00:00.000Z',
  byItem: [
    row({}),
    row({
      key: PLAIN,
      item_id: PLAIN,
      name: 'Kẹp giấy',
      name_en: null,
      need: 1,
    }),
  ],
  custom: [
    {
      key: CUSTOM,
      name: 'Bìa còng',
      unit: 'cái',
      requested: 2,
      backlog_prev: 1,
      stock: null,
      need: 3,
      people: 1,
    },
  ],
  byDepartment: [
    {
      department: 'Phòng CT',
      people: [
        {
          user_sub: 'u1',
          full_name: 'Nhân viên A',
          lines: [
            { name: 'Bút bi', name_en: 'Ballpoint pen', unit: 'cây', qty: 5 },
          ],
        },
      ],
    },
    {
      department: null,
      people: [
        {
          user_sub: 'u2',
          full_name: null,
          lines: [{ name: 'Bìa còng', name_en: null, unit: 'cái', qty: 2 }],
        },
      ],
    },
  ],
  issues: [
    {
      item_name: 'Bút bi',
      unit: 'cây',
      recipient_sub: null,
      recipient_name: null,
      qty: 2,
      reason: 'dùng cho hội nghị',
      at: '2026-11-03T03:00:00.000Z',
    },
    {
      item_name: 'Kẹp giấy',
      unit: 'hộp',
      recipient_sub: 'u1',
      recipient_name: 'Nhân viên A',
      qty: 1,
      reason: 'thay hộp hỏng',
      at: '2026-11-04T03:00:00.000Z',
    },
  ],
  pending_custom_count: 0,
  order_qty: { [ITEM]: 7, [PLAIN]: 1, [CUSTOM]: 3 },
  signers: { preparer: 'A', head: 'B', approver: 'C' },
  created_by: { sub: 'admin', name: 'Hành chính' },
  created_at: '2026-11-12T03:00:00.000Z',
};

async function open(lang: 'vi' | 'en') {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(new Uint8Array(await buildWorkbook(data, lang)).buffer);
  return wb;
}

const values = (ws: ExcelJS.Worksheet, n: number) =>
  (ws.getRow(n).values as unknown[]).slice(1);

describe('buildWorkbook', () => {
  it('đúng 2 sheet tên vi "Tổng theo món", "Chi tiết"', async () => {
    const wb = await open('vi');
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Tổng theo món',
      'Chi tiết',
    ]);
  });

  it('sheet 1 vi: tiêu đề 7 cột, món theo thứ tự, Đặt mua = order_qty', async () => {
    const ws = (await open('vi')).worksheets[0];
    expect(values(ws, 1)).toEqual([
      'Món',
      'ĐVT',
      'Đăng ký kỳ này',
      'Nợ kỳ trước',
      'Tồn',
      'Cần mua',
      'Đặt mua',
    ]);
    expect(values(ws, 2)).toEqual(['Bút bi', 'cây', 5, 2, 3, 4, 7]);
    expect(values(ws, 3)).toEqual(['Kẹp giấy', 'cây', 5, 2, 3, 1, 1]);
  });

  it('nhóm "Ngoài danh mục" có tiêu đề nhóm, Tồn để trống', async () => {
    const ws = (await open('vi')).worksheets[0];
    expect(values(ws, 4)).toEqual(['Ngoài danh mục']);
    const custom = ws.getRow(5);
    expect(custom.getCell(1).value).toBe('Bìa còng');
    expect(custom.getCell(5).value).toBeNull();
    expect(custom.getCell(6).value).toBe(3);
    expect(custom.getCell(7).value).toBe(3);
  });

  it('tổng cột Đặt mua trong sheet = tổng order_qty', async () => {
    const ws = (await open('vi')).worksheets[0];
    const sum = [2, 3, 5].reduce(
      (s, n) => s + Number(ws.getRow(n).getCell(7).value),
      0,
    );
    expect(sum).toBe(7 + 1 + 3);
  });

  it('một dòng trống rồi bảng "Xuất lẻ trong kỳ"; không người nhận → "Dùng chung"', async () => {
    const ws = (await open('vi')).worksheets[0];
    expect(values(ws, 6)).toEqual([]);
    expect(values(ws, 7)).toEqual(['Xuất lẻ trong kỳ']);
    expect(values(ws, 8)).toEqual(['Món', 'Người nhận', 'SL', 'Lý do']);
    expect(values(ws, 9)).toEqual([
      'Bút bi',
      'Dùng chung',
      2,
      'dùng cho hội nghị',
    ]);
    expect(values(ws, 10)).toEqual([
      'Kẹp giấy',
      'Nhân viên A',
      1,
      'thay hộp hỏng',
    ]);
  });

  it('sheet 2 vi: Phòng ban · Người · Món · SL; phòng ban null → "Chưa có phòng ban", tên null → sub', async () => {
    const ws = (await open('vi')).worksheets[1];
    expect(values(ws, 1)).toEqual(['Phòng ban', 'Người', 'Món', 'SL']);
    expect(values(ws, 2)).toEqual(['Phòng CT', 'Nhân viên A', 'Bút bi', 5]);
    expect(values(ws, 3)).toEqual(['Chưa có phòng ban', 'u2', 'Bìa còng', 2]);
  });

  it('lang=en: "By item"/"Detail", A1 "Item", tên món dùng name_en, thiếu name_en dùng name', async () => {
    const wb = await open('en');
    expect(wb.worksheets.map((w) => w.name)).toEqual(['By item', 'Detail']);
    const [items, detail] = wb.worksheets;
    expect(items.getCell('A1').value).toBe('Item');
    expect(items.getRow(2).getCell(1).value).toBe('Ballpoint pen');
    expect(items.getRow(3).getCell(1).value).toBe('Kẹp giấy');
    expect(values(items, 4)).toEqual(['Off-catalog']);
    expect(items.getRow(9).getCell(2).value).toBe('Shared');
    expect(values(detail, 1)).toEqual(['Department', 'Person', 'Item', 'Qty']);
    expect(values(detail, 2)).toEqual([
      'Phòng CT',
      'Nhân viên A',
      'Ballpoint pen',
      5,
    ]);
    expect(detail.getRow(3).getCell(1).value).toBe('No department');
  });
});
