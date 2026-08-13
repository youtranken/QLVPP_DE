import { formatPeriod } from '@vpp/shared';
import ExcelJS from 'exceljs';

/**
 * Dựng file Excel TRÌNH KÝ theo mẫu FR-41 / SDD §7:
 * 2 sheet (Tổng hợp theo món · Chi tiết theo người), mỗi sheet có khối tiêu đề
 * (tên đơn vị, kỳ, ngày lập) và khối ô chữ ký ở cuối để in ra ký tay.
 * Chỗ logo để trống cho tới khi có tài sản thương hiệu (phụ thuộc [⏳], SDD §12).
 */

export interface SummaryRow {
  name: string;
  unit: string;
  totalQty: number;
  deliveredQty: number;
  requestCount: number;
}

export interface DetailRow {
  code: string;
  status: string;
  userName: string | null;
  userEmail: string | null;
  departmentName: string;
  itemName: string;
  unit: string;
  quantity: number;
  deliveredQty: number;
  note: string | null;
}

export interface ReportContext {
  orgName: string;
  period: string;
  createdAt: Date;
  departmentName?: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Đã gửi',
  approved: 'Đã duyệt',
  delivered: 'Đã giao',
  rejected: 'Bị từ chối',
  cancelled: 'Đã huỷ',
};

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE8EEF7' },
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

function formatDate(date: Date): string {
  return `ngày ${date.getDate()} tháng ${date.getMonth() + 1} năm ${date.getFullYear()}`;
}

/** Khối tiêu đề: tên đơn vị · tên báo cáo · kỳ · ngày lập. Trả về dòng kế tiếp. */
function writeHeader(
  sheet: ExcelJS.Worksheet,
  title: string,
  context: ReportContext,
  lastColumn: number,
): number {
  const span = (row: number, text: string, options: Partial<ExcelJS.Font> = {}) => {
    sheet.mergeCells(row, 1, row, lastColumn);
    const cell = sheet.getCell(row, 1);
    cell.value = text;
    cell.alignment = { horizontal: 'center' };
    cell.font = { name: 'Times New Roman', size: 12, ...options };
  };

  span(1, context.orgName.toUpperCase(), { bold: true, size: 13 });
  span(2, title.toUpperCase(), { bold: true, size: 14 });
  span(3, `Kỳ ${formatPeriod(context.period)}`);
  if (context.departmentName) span(4, `Phòng ban: ${context.departmentName}`, { italic: true });
  const dateRow = context.departmentName ? 5 : 4;
  span(dateRow, `Lập ${formatDate(context.createdAt)}`, { italic: true, size: 11 });

  return dateRow + 2; // chừa một dòng trống trước bảng
}

/** Khối 3 ô chữ ký ở cuối bảng — phần này để in ra ký tay (không chữ ký số). */
function writeSignatures(sheet: ExcelJS.Worksheet, startRow: number, lastColumn: number): void {
  const labels = ['Người lập', 'Trưởng bộ phận', 'Ban giám đốc'];
  const width = Math.max(1, Math.floor(lastColumn / 3));

  const labelRow = sheet.getRow(startRow + 1);
  labels.forEach((label, index) => {
    const from = index * width + 1;
    const to = index === labels.length - 1 ? lastColumn : from + width - 1;
    sheet.mergeCells(startRow + 1, from, startRow + 1, to);
    const cell = sheet.getCell(startRow + 1, from);
    cell.value = label;
    cell.alignment = { horizontal: 'center' };
    cell.font = { name: 'Times New Roman', bold: true };

    sheet.mergeCells(startRow + 2, from, startRow + 2, to);
    const hint = sheet.getCell(startRow + 2, from);
    hint.value = '(ký, ghi rõ họ tên)';
    hint.alignment = { horizontal: 'center' };
    hint.font = { name: 'Times New Roman', italic: true, size: 10 };
  });
  labelRow.height = 22;

  // Chừa khoảng trống để ký tay.
  for (let offset = 3; offset <= 6; offset += 1) sheet.getRow(startRow + offset).height = 20;
}

function writeTable(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  headers: string[],
  rows: (string | number | null)[][],
): number {
  const headerRow = sheet.getRow(startRow);
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  headerRow.height = 24;

  rows.forEach((row, rowIndex) => {
    const sheetRow = sheet.getRow(startRow + 1 + rowIndex);
    row.forEach((value, columnIndex) => {
      const cell = sheetRow.getCell(columnIndex + 1);
      cell.value = value;
      cell.border = THIN_BORDER;
      if (typeof value === 'number') cell.alignment = { horizontal: 'center' };
    });
  });

  // Kỳ rỗng vẫn phải ra file có tiêu đề + bảng trống (edge case REPORT-2).
  if (rows.length === 0) {
    sheet.mergeCells(startRow + 1, 1, startRow + 1, headers.length);
    const cell = sheet.getCell(startRow + 1, 1);
    cell.value = 'Không có dữ liệu trong kỳ';
    cell.alignment = { horizontal: 'center' };
    cell.font = { italic: true };
    cell.border = THIN_BORDER;
    return startRow + 2;
  }

  return startRow + rows.length + 1;
}

export async function buildRequestsWorkbook(
  context: ReportContext,
  summary: SummaryRow[],
  detail: DetailRow[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DE-VPP';
  workbook.created = context.createdAt;

  // ── Sheet 1: Tổng hợp theo món ──────────────────────────────────────────
  const summarySheet = workbook.addWorksheet('Tổng hợp theo món');
  summarySheet.columns = [
    { width: 6 },
    { width: 40 },
    { width: 12 },
    { width: 14 },
    { width: 14 },
    { width: 12 },
  ];
  let row = writeHeader(summarySheet, 'Bảng tổng hợp đăng ký văn phòng phẩm', context, 6);
  row = writeTable(
    summarySheet,
    row,
    ['STT', 'Tên vật tư', 'ĐVT', 'SL đăng ký', 'SL đã giao', 'Số đơn'],
    summary.map((item, index) => [
      index + 1,
      item.name,
      item.unit,
      item.totalQty,
      item.deliveredQty,
      item.requestCount,
    ]),
  );
  writeSignatures(summarySheet, row, 6);

  // ── Sheet 2: Chi tiết theo người ────────────────────────────────────────
  const detailSheet = workbook.addWorksheet('Chi tiết theo người');
  detailSheet.columns = [
    { width: 6 },
    { width: 20 },
    { width: 24 },
    { width: 18 },
    { width: 34 },
    { width: 10 },
    { width: 10 },
    { width: 12 },
    { width: 14 },
    { width: 28 },
  ];
  let detailRow = writeHeader(detailSheet, 'Chi tiết đăng ký văn phòng phẩm', context, 10);
  detailRow = writeTable(
    detailSheet,
    detailRow,
    [
      'STT',
      'Mã đơn',
      'Người đăng ký',
      'Phòng ban',
      'Tên vật tư',
      'ĐVT',
      'SL',
      'Đã giao',
      'Trạng thái',
      'Ghi chú',
    ],
    detail.map((line, index) => [
      index + 1,
      line.code,
      line.userName ?? line.userEmail ?? '',
      line.departmentName,
      line.itemName,
      line.unit,
      line.quantity,
      line.deliveredQty,
      STATUS_LABELS[line.status] ?? line.status,
      line.note ?? '',
    ]),
  );
  writeSignatures(detailSheet, detailRow, 10);

  // ExcelJS khai kiểu Buffer riêng, không trùng Buffer của Node — chuẩn hoá lại.
  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data as unknown as ArrayBuffer);
}

/** Tên file tải về: `bao-cao-vpp-2026-09.xlsx`. */
export function reportFileName(period: string): string {
  return `bao-cao-vpp-${period}.xlsx`;
}
