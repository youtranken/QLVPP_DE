import type ExcelJS from 'exceljs';
import { vnDate } from '../../common/period';
import type { SignatureBox, SnapshotData } from './report.types';
import { wantOf } from './report-need';
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
  replaces: 'Thay thế bản in lúc',
  noCode: '—',
  blankName: '……………………',
} as const;

const WIDTHS = [7, 8, 33, 25, 10, 8];
const SIGN_COLUMNS = [3, 5, 6];
const SIGN_SPACE_ROWS = 4;
const THIN = { style: 'thin' } as const;
const BORDER = { top: THIN, left: THIN, bottom: THIN, right: THIN };

export const REQUEST_FORM_SHEET = FORM.sheet;

// Chức danh 3 ô của bản chốt trước 0112; trùng với web (reports.print.form.oldSigner)
const OLD_SIGNER_TITLES = {
  preparer: { title: 'Người lập', title_en: 'Prepared by' },
  head: { title: 'Trưởng phòng', title_en: 'Head of Dept.' },
  approver: { title: 'Duyệt', title_en: 'Approved by' },
} as const;

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
  const qty = (r: { key: string; requested: number; backlog_prev: number }) =>
    data.order_qty[r.key] ?? wantOf(r);
  const items = data.byItem.map((r) => ({
    code: r.code || FORM.noCode,
    name: r.name,
    name_en: r.name_en ?? '',
    unit: unitNameOf(r, names, 'vi'),
    qty: qty(r),
  }));
  const custom = data.custom.map((r) => ({
    code: FORM.noCode,
    name: r.name,
    name_en: '',
    unit: unitNameOf(r, names, 'vi'),
    qty: qty(r),
  }));
  const rows = [...items, ...custom];
  // Bản từ v2-D (có order_basis) giữ hàng Đề nghị 0 để khớp bảng Gửi ADM; bản cũ xuất lại đúng phiếu đã gửi
  return data.order_basis ? rows : rows.filter((r) => r.qty > 0);
}

// Bản chốt trước 0112 chỉ có signers: 3 ô chức danh cũ
export function signatureBoxesOf(data: SnapshotData): SignatureBox[] {
  if (data.signature_boxes) return data.signature_boxes;
  return (['preparer', 'head', 'approver'] as const).map((role) => ({
    ...OLD_SIGNER_TITLES[role],
    name: data.signers?.[role] ?? '',
  }));
}

const VN_STAMP = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  day: '2-digit',
  month: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Asia/Ho_Chi_Minh',
});

// "hh:mm dd/mm" giờ VN, ghép từng phần để không phụ thuộc locale
const vnStamp = (iso: string) => {
  const parts = VN_STAMP.formatToParts(new Date(iso));
  const p = (type: string) => parts.find((x) => x.type === type)?.value ?? '';
  return `${p('hour')}:${p('minute')} ${p('day')}/${p('month')}`;
};

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
  fillHeading(ws, data);
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

// Bản thay thế: dòng đầu đậm để ADM bỏ bản in cũ
function fillHeading(ws: ExcelJS.Worksheet, data: SnapshotData): void {
  if (data.replaces) {
    const row = ws.addRow([
      `${FORM.replaces} ${vnStamp(data.replaces.created_at)}`,
    ]);
    ws.mergeCells(row.number, 1, row.number, WIDTHS.length);
    row.getCell(1).font = { bold: true };
  }
  const title = ws.addRow([FORM.title]);
  const subtitle = ws.addRow([FORM.subtitle]);
  for (const row of [title, subtitle]) {
    ws.mergeCells(row.number, 1, row.number, WIDTHS.length);
    row.getCell(1).alignment = { horizontal: 'center' };
  }
  title.getCell(1).font = { bold: true, size: 14 };
  const date = ws.addRow([null, null, FORM.date, vnDay(data.created_at)]);
  date.getCell(3).alignment = { horizontal: 'right' };
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
