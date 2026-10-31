import ExcelJS from 'exceljs';
import { BOOKING_FIRST_ROW, readBookingRows } from './booking-sheet';

const put = (ws: ExcelJS.Worksheet, row: number, cells: (string | null)[]) =>
  cells.forEach((v, i) => (ws.getCell(row, i + 2).value = v));

async function workbook(fill: (ws: ExcelJS.Worksheet) => void) {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('D&E').getCell('B8').value = 'X99';
  fill(wb.addWorksheet('Booking'));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('readBookingRows', () => {
  it('đọc sheet Booking từ hàng 8, cột B/C/D/E; bỏ hàng 7 trở lên và hàng trống', async () => {
    const buf = await workbook((ws) => {
      put(ws, BOOKING_FIRST_ROW - 1, ['Mã', 'Tên', 'Name', 'ĐVT']);
      put(ws, 8, ['B01', 'Bìa', 'Folder', 'cái']);
      put(ws, 10, [null, 'Pin A', null, 'viên']);
    });
    expect(await readBookingRows(buf)).toEqual([
      { row: 8, code: 'B01', name: 'Bìa', nameEn: 'Folder', unit: 'cái' },
      { row: 10, code: null, name: 'Pin A', nameEn: null, unit: 'viên' },
    ]);
  });

  it('ô richText ghép chữ, ô công thức lấy result, ô số thành chuỗi', async () => {
    const buf = await workbook((ws) => {
      ws.getCell('B8').value = { formula: '"K"&"04"', result: 'K04' };
      ws.getCell('C8').value = {
        richText: [{ text: 'Keo khô ' }, { text: 'Staedler' }],
      };
      ws.getCell('D8').value = 123;
      ws.getCell('E8').value = 'cái';
    });
    expect(await readBookingRows(buf)).toEqual([
      {
        row: 8,
        code: 'K04',
        name: 'Keo khô Staedler',
        nameEn: '123',
        unit: 'cái',
      },
    ]);
  });

  it('không có sheet Booking → lỗi rõ', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Khác');
    const buf = Buffer.from(await wb.xlsx.writeBuffer());
    await expect(readBookingRows(buf)).rejects.toThrow('Booking');
  });
});
