import ExcelJS from 'exceljs';
import type { ReportItemRow, SnapshotData } from './report.types';
import { buildWorkbook } from './xlsx-report';
import type { XlsxLang } from './xlsx-labels';

export const ITEM = '11111111-1111-4111-8111-111111111111';
export const PLAIN = '22222222-2222-4222-8222-222222222222';
export const CUSTOM = 'custom:["bìa còng","cai"]';

export const UNIT_NAMES = new Map([
  ['cai', { name: 'cái', name_en: 'piece', active: true }],
  ['hop', { name: 'hộp', name_en: 'box', active: true }],
  ['cay', { name: 'cây', name_en: 'stick', active: true }],
  ['thung', { name: 'thùng', name_en: null, active: false }],
]);

export const itemRow = (over: Partial<ReportItemRow>): ReportItemRow => ({
  key: ITEM,
  item_id: ITEM,
  code: 'B31',
  name: 'Bút bi',
  name_en: 'Ballpoint pen',
  unit: 'cay',
  pack_note: null,
  requested: 5,
  backlog_prev: 2,
  stock: 3,
  need: 4,
  ...over,
});

export const snapshotData = (
  over: Partial<SnapshotData> = {},
): SnapshotData => ({
  ym: '2026-11',
  generated_at: '2026-11-12T03:00:00.000Z',
  byItem: [
    itemRow({}),
    itemRow({
      key: PLAIN,
      item_id: PLAIN,
      code: null,
      name: 'Kẹp giấy',
      name_en: null,
      unit: 'hop',
      need: 1,
    }),
  ],
  custom: [
    {
      key: CUSTOM,
      name: 'Bìa còng',
      unit: 'cai',
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
            { name: 'Bút bi', name_en: 'Ballpoint pen', unit: 'cay', qty: 5 },
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
          lines: [{ name: 'Bìa còng', name_en: null, unit: 'cai', qty: 2 }],
        },
      ],
    },
  ],
  issues: [
    {
      item_name: 'Bút bi',
      item_name_en: 'Ballpoint pen',
      unit: 'cay',
      recipient_sub: null,
      recipient_name: null,
      qty: 2,
      reason: 'dùng cho hội nghị',
      at: '2026-11-03T03:00:00.000Z',
    },
    {
      item_name: 'Kẹp giấy',
      item_name_en: null,
      unit: 'hop',
      recipient_sub: 'u1',
      recipient_name: 'Nhân viên A',
      qty: 1,
      reason: 'thay hộp hỏng',
      at: '2026-11-04T03:00:00.000Z',
    },
  ],
  pending_custom_count: 0,
  order_qty: { [ITEM]: 7, [PLAIN]: 1, [CUSTOM]: 3 },
  signature_boxes: [
    { title: 'Người yêu cầu', title_en: 'Applicant', name: 'A' },
  ],
  created_by: { sub: 'admin', name: 'Hành chính' },
  created_at: '2026-11-12T03:00:00.000Z',
  ...over,
});

export async function openWorkbook(
  lang: XlsxLang,
  data: SnapshotData = snapshotData(),
) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(
    new Uint8Array(await buildWorkbook(data, lang, UNIT_NAMES)).buffer,
  );
  return wb;
}

export const rowValues = (ws: ExcelJS.Worksheet, n: number) =>
  (ws.getRow(n).values as unknown[]).slice(1);
