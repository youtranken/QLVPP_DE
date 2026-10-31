import ExcelJS from 'exceljs';
import { buildWorkbook } from './xlsx-report';
import {
  PLAIN,
  UNIT_NAMES,
  itemRow,
  openWorkbook,
  rowValues as values,
  snapshotData,
} from './xlsx-snapshot.fixture-spec';

const data = snapshotData();
const open = async (lang: 'vi' | 'en') => openWorkbook(lang);
const row = itemRow;

describe('buildWorkbook · sheet 2 Phụ lục', () => {
  it('đúng 2 sheet: vi "Phiếu đề xuất", "Phụ lục"; en chỉ đổi tên sheet 2 → "Appendix"', async () => {
    expect((await open('vi')).worksheets.map((w) => w.name)).toEqual([
      'Phiếu đề xuất',
      'Phụ lục',
    ]);
    expect((await open('en')).worksheets.map((w) => w.name)).toEqual([
      'Phiếu đề xuất',
      'Appendix',
    ]);
  });

  it('vi: tiêu đề 7 cột, món theo thứ tự, Đặt mua = order_qty', async () => {
    const ws = (await open('vi')).worksheets[1];
    expect(values(ws, 1)).toEqual([
      'Món',
      'ĐVT',
      'Chưa giao kỳ này',
      'Nợ kỳ trước',
      'Tồn',
      'Cần mua',
      'Đặt mua',
    ]);
    expect(values(ws, 2)).toEqual(['Bút bi', 'cây', 5, 2, 3, 4, 7]);
    expect(values(ws, 3)).toEqual(['Kẹp giấy', 'hộp', 5, 2, 3, 1, 1]);
  });

  it('bản chốt cũ chưa lưu tên ĐVT → lấy tên từ bảng units: vi "cây"/"hộp"/"cái", en "stick"/"box"/"piece"; en thiếu name_en dùng tên vi; mã không có hiện mã thô', async () => {
    const vi = (await open('vi')).worksheets[1];
    expect(vi.getRow(5).getCell(2).value).toBe('cái');
    const en = (await open('en')).worksheets[1];
    expect([2, 3, 5].map((n) => en.getRow(n).getCell(2).value)).toEqual([
      'stick',
      'box',
      'piece',
    ]);
    const odd = {
      ...data,
      byItem: [row({ unit: 'thung' }), row({ key: PLAIN, unit: 'kg' })],
    };
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(
      new Uint8Array(await buildWorkbook(odd, 'en', UNIT_NAMES)).buffer,
    );
    expect(wb.worksheets[1].getRow(2).getCell(2).value).toBe('thùng');
    expect(wb.worksheets[1].getRow(3).getCell(2).value).toBe('kg');
  });

  it('bản chốt mới lưu tên ĐVT → dùng tên đã lưu (vi/en), không theo bảng units đã đổi tên', async () => {
    const frozen = snapshotData({
      byItem: [row({ unit_name: 'cây cũ', unit_name_en: 'old stick' })],
      custom: [],
    });
    const vi = (await openWorkbook('vi', frozen)).worksheets[1];
    expect(vi.getRow(2).getCell(2).value).toBe('cây cũ');
    const en = (await openWorkbook('en', frozen)).worksheets[1];
    expect(en.getRow(2).getCell(2).value).toBe('old stick');
  });

  it('cột 3 en "Undelivered this period"', async () => {
    const ws = (await open('en')).worksheets[1];
    expect(ws.getRow(1).getCell(3).value).toBe('Undelivered this period');
  });

  it('thuộc tính tệp: tiêu đề có kỳ, người lập, giờ lập của bản chốt', async () => {
    const wb = await open('vi');
    expect(wb.title).toBe('Tổng hợp đặt mua 2026-11');
    expect(wb.creator).toBe('Hành chính');
    expect(wb.created.toISOString()).toBe('2026-11-12T03:00:00.000Z');
  });

  it('nhóm "Ngoài danh mục" có tiêu đề nhóm, Tồn để trống', async () => {
    const ws = (await open('vi')).worksheets[1];
    expect(values(ws, 4)).toEqual(['Ngoài danh mục']);
    const custom = ws.getRow(5);
    expect(custom.getCell(1).value).toBe('Bìa còng');
    expect(custom.getCell(5).value).toBeNull();
    expect(custom.getCell(6).value).toBe(3);
    expect(custom.getCell(7).value).toBe(3);
  });

  it('tổng cột Đặt mua trong sheet = tổng order_qty', async () => {
    const ws = (await open('vi')).worksheets[1];
    const sum = [2, 3, 5].reduce(
      (s, n) => s + Number(ws.getRow(n).getCell(7).value),
      0,
    );
    expect(sum).toBe(7 + 1 + 3);
  });

  it('một dòng trống rồi bảng "Xuất lẻ trong kỳ"; không người nhận → "Dùng chung"', async () => {
    const ws = (await open('vi')).worksheets[1];
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

  it('một dòng trống rồi bảng "Chi tiết": Phòng ban · Người · Món · SL; phòng ban null → "Chưa có phòng ban", tên null → sub', async () => {
    const ws = (await open('vi')).worksheets[1];
    expect(values(ws, 11)).toEqual([]);
    expect(values(ws, 12)).toEqual(['Chi tiết']);
    expect(values(ws, 13)).toEqual(['Phòng ban', 'Người', 'Món', 'SL']);
    expect(values(ws, 14)).toEqual(['Phòng CT', 'Nhân viên A', 'Bút bi', 5]);
    expect(values(ws, 15)).toEqual(['Chưa có phòng ban', 'u2', 'Bìa còng', 2]);
  });

  it('lang=en: A1 "Item", tên món dùng name_en, thiếu name_en dùng name; bảng "Detail" tiếng Anh', async () => {
    const items = (await open('en')).worksheets[1];
    const detail = {
      getRow: (n: number) => items.getRow(n + 12),
    } as ExcelJS.Worksheet;
    expect(items.getCell('A1').value).toBe('Item');
    expect(items.getRow(2).getCell(1).value).toBe('Ballpoint pen');
    expect(items.getRow(3).getCell(1).value).toBe('Kẹp giấy');
    expect(values(items, 4)).toEqual(['Off-catalog']);
    expect(values(items, 9)).toEqual([
      'Ballpoint pen',
      'Shared',
      2,
      'dùng cho hội nghị',
    ]);
    expect(items.getRow(10).getCell(1).value).toBe('Kẹp giấy');
    expect(values(items, 12)).toEqual(['Detail']);
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
