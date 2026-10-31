import type { AdminItem, Category } from '@/features/catalog/catalog.api';
import { adminItem } from '@/features/summary/adjust-fixtures';
import type { MonthReport, ReportIssue, SnapshotData, SnapshotRow } from './reports.api';

export const PEN_KEY = 'item-pen';
export const TAPE_KEY = 'custom:["Băng keo 2 mặt","cuon"]';

export function reportFixture(over: Partial<MonthReport> = {}): MonthReport {
  return {
    ym: '2026-10',
    byItem: [
      { key: PEN_KEY, item_id: PEN_KEY, name: 'Bút bi xanh', name_en: 'Blue pen', unit: 'cay', requested: 12, backlog_prev: 3, stock: 5, need: 10 },
      { key: 'item-glue', item_id: 'item-glue', name: 'Hồ dán', name_en: null, unit: 'lo', requested: 2, backlog_prev: 0, stock: 9, need: 0 },
    ],
    custom: [{ key: TAPE_KEY, name: 'Băng keo 2 mặt', unit: 'cuon', requested: 4, backlog_prev: 1, stock: null, need: 5, people: 2 }],
    byDepartment: [
      {
        department: 'Tổ Giám sát',
        people: [{ user_sub: 'u-duc', full_name: 'Phạm Văn Đức', lines: [{ name: 'Bút bi xanh', name_en: 'Blue pen', unit: 'cay', qty: 12 }] }],
      },
      {
        department: null,
        people: [{ user_sub: 'u-lan', full_name: 'Võ Thị Lan', lines: [{ name: 'Băng keo 2 mặt', name_en: null, unit: 'cuon', qty: 4 }] }],
      },
    ],
    issues: [],
    pending_custom_count: 0,
    ...over,
  };
}

export const ISSUE: ReportIssue = {
  item_name: 'Giấy A4',
  item_name_en: 'A4 paper',
  unit: 'ram',
  recipient_sub: null,
  recipient_name: null,
  qty: 2,
  reason: 'Họp giao ban',
  at: '2026-10-15T03:00:00Z',
};

export const snapshotRow = (over: Partial<SnapshotRow> = {}): SnapshotRow => ({
  id: 'snap-old',
  kind: 'xlsx',
  created_at: '2026-10-28T02:30:00Z',
  created_by_sub: 'u-admin',
  created_by_name: 'Trần Thị Bình',
  ...over,
});

export const NEW_SNAPSHOT_BY = 'Nguyễn Văn An';
// 10:00 giờ VN
export const NEW_SNAPSHOT_AT = '2026-10-29T03:00:00Z';

export const REPORT_CATEGORIES: Category[] = [
  { id: 'c-write', name: 'Bút viết', name_en: 'Writing', sort_order: 1, active: true },
  { id: 'c-glue', name: 'Keo dán', name_en: 'Glue', sort_order: 2, active: true },
];

export const REPORT_ITEMS: AdminItem[] = [
  adminItem({ id: PEN_KEY, name: 'Bút bi xanh', unit: 'cay', category_id: 'c-write', pack_note: 'Box of 20' }),
  adminItem({ id: 'item-glue', name: 'Hồ dán', unit: 'lo', category_id: 'c-glue' }),
];

export const SNAPSHOT_ID = '5f0c1c1e-9a53-4b1c-8f55-3d2b1b6f0a11';

export const snapshotDataFixture = (over: Partial<SnapshotData> = {}): SnapshotData => ({
  ...reportFixture(),
  id: SNAPSHOT_ID,
  kind: 'print',
  period_ym: '2026-10',
  order_qty: { [PEN_KEY]: 14, 'item-glue': 0, [TAPE_KEY]: 5 },
  signature_boxes: [
    { title: 'Chủ quản đơn vị', title_en: 'Head of Dept.', name: 'Ngô Văn Bảo' },
    { title: 'Người yêu cầu', title_en: 'Applicant', name: 'Lê Thị Hoa' },
  ],
  created_by: { sub: 'u-admin', name: 'Trần Thị Bình' },
  created_at: '2026-10-28T02:30:00Z',
  ...over,
});
