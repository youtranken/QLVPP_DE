import { NAME_MAX } from '../../common/dto-fields';
import { UNIT_NAME_MAX } from '../units/units.dto';

export interface BookingRawRow {
  row: number;
  code: string | null;
  name: string | null;
  nameEn: string | null;
  unit: string | null;
}

export interface BookingItem {
  row: number;
  code: string | null;
  name: string;
  nameEn: string | null;
  unitName: string;
  packNote: string | null;
  sortOrder: number;
}

export type BookingSkipReason =
  'empty_name' | 'empty_unit' | 'exists_code' | 'exists_name';

export interface BookingSkip {
  row: number;
  code: string | null;
  name: string;
  reason: BookingSkipReason;
}

export interface BookingNeedCode {
  row: number;
  name: string;
  fileCode: string | null;
}

export interface ParsedBooking {
  items: BookingItem[];
  skipped: BookingSkip[];
  needCode: BookingNeedCode[];
}

const clean = (v: string | null | undefined) =>
  (v ?? '').normalize('NFC').trim();

const PACK = /^0*(\d+)\s*viên\s*\/\s*v[ĩỉ]$/;
const ALIASES: Record<string, string> = { ream: 'ram', vĩ: 'vỉ' };

export function normalizeUnit(raw: string | null): {
  unitName: string;
  packNote: string | null;
} {
  const value = clean(raw).toLowerCase();
  const pack = PACK.exec(value);
  if (pack) return { unitName: 'vỉ', packNote: `${pack[1]} viên/vỉ` };
  return { unitName: ALIASES[value] ?? value, packNote: null };
}

export function parseBookingRows(rows: BookingRawRow[]): ParsedBooking {
  const result: ParsedBooking = { items: [], skipped: [], needCode: [] };
  const seenCodes = new Set<string>();
  for (const r of rows) {
    const fileCode = clean(r.code) || null;
    const name = clean(r.name);
    if (!fileCode && !name) continue;
    const { unitName, packNote } = normalizeUnit(r.unit);
    if (!name || !unitName) {
      result.skipped.push({
        row: r.row,
        code: fileCode,
        name,
        reason: name ? 'empty_unit' : 'empty_name',
      });
      continue;
    }
    // Mã trùng trong file: hàng đầu giữ mã cho khớp sheet D&E, hàng sau chờ Hành chính đặt mã
    const code = fileCode && !seenCodes.has(fileCode) ? fileCode : null;
    if (code) seenCodes.add(code);
    else result.needCode.push({ row: r.row, name, fileCode });
    result.items.push({
      row: r.row,
      code,
      name,
      nameEn: clean(r.nameEn) || null,
      unitName,
      packNote,
      sortOrder: r.row * 10,
    });
  }
  return result;
}

const ITEM_CODE_MAX = 40;

// Giới hạn trùng DTO món/ĐVT: script đi thẳng vào bảng nên phải tự chặn, lỗi thì rollback cả lượt
export function bookingItemProblem(item: BookingItem): string | null {
  const over = (v: string | null, max: number) => (v ?? '').length > max;
  if (over(item.name, NAME_MAX)) return 'name';
  if (over(item.nameEn, NAME_MAX)) return 'name_en';
  if (over(item.code, ITEM_CODE_MAX)) return 'code';
  if (over(item.packNote, NAME_MAX)) return 'pack_note';
  if (over(item.unitName, UNIT_NAME_MAX)) return 'unit';
  return null;
}
