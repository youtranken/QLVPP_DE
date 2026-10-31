import ExcelJS from 'exceljs';
import type { BookingRawRow } from './booking-import';

export const BOOKING_SHEET = 'Booking';
export const BOOKING_FIRST_ROW = 8;

function cellText(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object') return String(value);
  if (value instanceof Date) return value.toISOString();
  if ('richText' in value) return value.richText.map((t) => t.text).join('');
  if ('result' in value) return cellText(value.result);
  if ('text' in value) return cellText(value.text);
  return null;
}

export async function readBookingRows(
  input: Buffer | string,
): Promise<BookingRawRow[]> {
  const wb = new ExcelJS.Workbook();
  if (typeof input === 'string') await wb.xlsx.readFile(input);
  else await wb.xlsx.load(input as unknown as ArrayBuffer);
  const ws = wb.getWorksheet(BOOKING_SHEET);
  if (!ws) throw new Error(`Không thấy sheet "${BOOKING_SHEET}".`);
  const rows: BookingRawRow[] = [];
  for (let r = BOOKING_FIRST_ROW; r <= ws.rowCount; r++) {
    const text = (col: string) => cellText(ws.getCell(`${col}${r}`).value);
    const row = {
      row: r,
      code: text('B'),
      name: text('C'),
      nameEn: text('D'),
      unit: text('E'),
    };
    if (row.code?.trim() || row.name?.trim()) rows.push(row);
  }
  return rows;
}
