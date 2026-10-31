export type XlsxLang = 'vi' | 'en';

export interface XlsxLabels {
  byItemSheet: string;
  detailSheet: string;
  item: string;
  unit: string;
  requested: string;
  backlogPrev: string;
  stock: string;
  need: string;
  order: string;
  customGroup: string;
  issuesTitle: string;
  recipient: string;
  qty: string;
  reason: string;
  shared: string;
  department: string;
  person: string;
  noDepartment: string;
  workbookTitle: string;
}

export const XLSX_LABELS: Record<XlsxLang, XlsxLabels> = {
  vi: {
    byItemSheet: 'Tổng theo món',
    detailSheet: 'Chi tiết',
    item: 'Món',
    unit: 'ĐVT',
    requested: 'Chưa giao kỳ này',
    backlogPrev: 'Nợ kỳ trước',
    stock: 'Tồn',
    need: 'Cần mua',
    order: 'Đặt mua',
    customGroup: 'Ngoài danh mục',
    issuesTitle: 'Xuất lẻ trong kỳ',
    recipient: 'Người nhận',
    qty: 'SL',
    reason: 'Lý do',
    shared: 'Dùng chung',
    department: 'Phòng ban',
    person: 'Người',
    noDepartment: 'Chưa có phòng ban',
    workbookTitle: 'Tổng hợp đặt mua',
  },
  en: {
    byItemSheet: 'By item',
    detailSheet: 'Detail',
    item: 'Item',
    unit: 'Unit',
    requested: 'Undelivered this period',
    backlogPrev: 'Carried over',
    stock: 'Stock',
    need: 'To buy',
    order: 'Order',
    customGroup: 'Off-catalog',
    issuesTitle: 'Issued during the period',
    recipient: 'Recipient',
    qty: 'Qty',
    reason: 'Reason',
    shared: 'Shared',
    department: 'Department',
    person: 'Person',
    noDepartment: 'No department',
    workbookTitle: 'Purchase summary',
  },
};
