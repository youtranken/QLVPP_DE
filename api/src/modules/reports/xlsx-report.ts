import ExcelJS from 'exceljs';
import type {
  ReportCustomRow,
  ReportItemRow,
  SnapshotData,
} from './report.types';
import { wantOf } from './report-need';
import { unitNameOf } from './snapshot-unit-names';
import type { UnitNames } from './snapshot-unit-names';
import { XLSX_LABELS } from './xlsx-labels';
import type { XlsxLabels, XlsxLang } from './xlsx-labels';
import { REQUEST_FORM_SHEET, fillRequestForm } from './xlsx-request-form';

const localName = (
  row: { name: string; name_en: string | null },
  lang: XlsxLang,
) => (lang === 'en' && row.name_en ? row.name_en : row.name);

export async function buildWorkbook(
  data: SnapshotData,
  lang: XlsxLang,
  unitNames: UnitNames,
): Promise<Buffer> {
  const labels = XLSX_LABELS[lang];
  const unitLabel = (row: { unit: string }) => unitNameOf(row, unitNames, lang);
  const wb = new ExcelJS.Workbook();
  wb.title = `${labels.workbookTitle} ${data.ym}`;
  wb.creator = data.created_by.name ?? data.created_by.sub;
  wb.created = new Date(data.created_at);
  fillRequestForm(wb.addWorksheet(REQUEST_FORM_SHEET), data, unitNames);
  const appendix = wb.addWorksheet(labels.appendixSheet);
  fillByItem(appendix, data, labels, { lang, unitLabel });
  appendix.addRow([]);
  fillDetail(appendix, data, labels, lang);
  appendix.getColumn(1).width = 40;
  appendix.getColumn(2).width = 24;
  appendix.getColumn(3).width = 32;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function fillByItem(
  ws: ExcelJS.Worksheet,
  data: SnapshotData,
  l: XlsxLabels,
  {
    lang,
    unitLabel,
  }: { lang: XlsxLang; unitLabel: (row: { unit: string }) => string },
): void {
  const order = (r: ReportItemRow | ReportCustomRow) =>
    data.order_qty[r.key] ?? wantOf(r);
  bold(
    ws.addRow([
      l.item,
      l.unit,
      l.requested,
      l.backlogPrev,
      l.stock,
      l.need,
      l.order,
    ]),
  );
  for (const r of data.byItem) {
    ws.addRow([
      localName(r, lang),
      unitLabel(r),
      r.requested,
      r.backlog_prev,
      r.stock,
      r.need,
      order(r),
    ]);
  }
  if (data.custom.length) {
    bold(ws.addRow([l.customGroup]));
    for (const r of data.custom) {
      ws.addRow([
        r.name,
        unitLabel(r),
        r.requested,
        r.backlog_prev,
        null,
        r.need,
        order(r),
      ]);
    }
  }
  ws.addRow([]);
  bold(ws.addRow([l.issuesTitle]));
  bold(ws.addRow([l.item, l.recipient, l.qty, l.reason]));
  for (const i of data.issues) {
    ws.addRow([
      localName({ name: i.item_name, name_en: i.item_name_en }, lang),
      i.recipient_name ?? l.shared,
      i.qty,
      i.reason,
    ]);
  }
}

function fillDetail(
  ws: ExcelJS.Worksheet,
  data: SnapshotData,
  l: XlsxLabels,
  lang: XlsxLang,
): void {
  bold(ws.addRow([l.detailTitle]));
  bold(ws.addRow([l.department, l.person, l.item, l.qty]));
  for (const dept of data.byDepartment) {
    for (const person of dept.people) {
      for (const line of person.lines) {
        ws.addRow([
          dept.department ?? l.noDepartment,
          person.full_name ?? person.user_sub,
          localName(line, lang),
          line.qty,
        ]);
      }
    }
  }
}

function bold(row: ExcelJS.Row): void {
  row.font = { bold: true };
}
