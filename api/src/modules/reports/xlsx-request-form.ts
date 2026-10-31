import type ExcelJS from 'exceljs';
import { vnDate } from '../../common/period';
import type { SignatureBox, SnapshotData } from './report.types';
import { unitNameOf } from './snapshot-unit-names';
import type { UnitNames } from './snapshot-unit-names';

// Sheet 1 theo mẫu D&E: luôn song ngữ, không theo ?lang=
const FORM = {
  sheet: 'Phiếu đề xuất',
  title: 'Phiếu đề xuất văn phòng phẩm',
  subtitle: 'STATIONERY REQUEST FORM',
  date: 'Date :',
  header: [
    'STT\nNo.',
    'Mã\nCode',
    'Tên vật dụng',
    'Item name',
    'ĐVT\nUnit',
    'SL\nQty',
  ],
  empty: 'Không có món cần đặt mua.',
  noCode: '—',
  blankName: '……………………',
  oldTitles: { preparer: 'Người lập', head: 'Trưởng phòng', approver: 'Duyệt' },
} as const;

const WIDTHS = [7, 8, 33, 25, 10, 8];
const SIGN_COLUMNS = [3, 5, 6];
const SIGN_SPACE_ROWS = 4;
const THIN = { style: 'thin' } as const;
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

export const REQUEST_FORM_SHEET = FORM.sheet;

export interface RequestFormRow {
  code: string;
  name: string;
  name_en: string;
  unit: string;
  qty: number;
}

export function requestFormRows(
  data: SnapshotData,
  names: UnitNames,
): RequestFormRow[] {
  const qty = (r: { key: string; need: number }) =>
    data.order_qty[r.key] ?? r.need;
  const items = data.byItem
    .filter((r) => qty(r) > 0)
    .map((r) => ({
      code: r.code || FORM.noCode,
      name: r.name,
      name_en: r.name_en ?? '',
      unit: unitNameOf(r, names, 'vi'),
      qty: qty(r),
    }));
  const custom = data.custom
    .filter((r) => qty(r) > 0)
    .map((r) => ({
      code: FORM.noCode,
      name: r.name,
      name_en: '',
      unit: unitNameOf(r, names, 'vi'),
      qty: qty(r),
    }));
  return [...items, ...custom];
}

// Bản chốt trước 0112 chỉ có signers: 3 ô chức danh cũ
export function signatureBoxesOf(data: SnapshotData): SignatureBox[] {
  if (data.signature_boxes) return data.signature_boxes;
  return (['preparer', 'head', 'approver'] as const).map((role) => ({
    title: FORM.oldTitles[role],
    title_en: '',
    name: data.signers?.[role] ?? '',
  }));
}

const vnDay = (iso: string) => {
  const { y, m, d } = vnDate(new Date(iso));
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
};

export function fillRequestForm(
  ws: ExcelJS.Worksheet,
  data: SnapshotData,
  names: UnitNames,
): void {
  WIDTHS.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.pageSetup = { paperSize: 9, orientation: 'portrait', fitToWidth: 1 };
  fillHeading(ws, data.created_at);
  const header = ws.addRow([...FORM.header]);
  header.font = { bold: true };
  header.alignment = {
    horizontal: 'center',
    vertical: 'middle',
    wrapText: true,
  };
  const rows = requestFormRows(data, names);
  rows.forEach((r, i) =>
    ws.addRow([i + 1, r.code, r.name, r.name_en, r.unit, r.qty]),
  );
  if (rows.length === 0) {
    const empty = ws.addRow([FORM.empty]);
    ws.mergeCells(empty.number, 1, empty.number, WIDTHS.length);
  }
  for (let n = header.number; n <= ws.rowCount; n++) {
    for (let c = 1; c <= WIDTHS.length; c++) ws.getCell(n, c).border = BORDER;
  }
  fillSignatures(ws, signatureBoxesOf(data));
}

function fillHeading(ws: ExcelJS.Worksheet, createdAt: string): void {
  ws.addRow([FORM.title]);
  ws.addRow([FORM.subtitle]);
  for (const n of [1, 2]) {
    ws.mergeCells(n, 1, n, WIDTHS.length);
    ws.getCell(n, 1).alignment = { horizontal: 'center' };
  }
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.addRow([null, null, FORM.date, vnDay(createdAt)]);
  ws.getCell('C3').alignment = { horizontal: 'right' };
  ws.addRow([]);
}

function fillSignatures(ws: ExcelJS.Worksheet, boxes: SignatureBox[]): void {
  ws.addRow([]);
  ws.addRow([]);
  const at = (texts: string[]) => {
    const row = ws.addRow([]);
    texts.forEach((t, i) => {
      const cell = row.getCell(SIGN_COLUMNS[i]);
      cell.value = t || null;
      cell.alignment = { horizontal: 'center' };
    });
    return row;
  };
  const titles = at(boxes.map((b) => b.title));
  boxes.forEach(
    (_, i) => (titles.getCell(SIGN_COLUMNS[i]).font = { bold: true }),
  );
  at(boxes.map((b) => b.title_en));
  for (let i = 0; i < SIGN_SPACE_ROWS; i++) ws.addRow([]);
  at(boxes.map((b) => b.name || FORM.blankName));
}
