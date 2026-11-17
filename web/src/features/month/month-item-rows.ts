import type { MonthReport } from '@/features/reports/reports.api';
import type { ItemSummaryRow } from '@/features/summary/summary.api';

export interface MonthItemRow {
  key: string;
  name: string;
  unit: string;
  custom: boolean;
  people: number;
  ordered: number;
  stock: number | null;
  need: number;
}

// Theo món (G1): Số người đặt và Đặt từ danh sách theo món; Tồn và Cần mua lấy nguyên số Báo cáo (needOf BR-15 ở server),
// không tính lại ở web. Món ngoài DM gộp một dòng; Cần mua của dòng đó là tổng các món ngoài DM của Báo cáo
export function monthItemRows(items: ItemSummaryRow[], report: Pick<MonthReport, 'byItem' | 'custom'>): MonthItemRow[] {
  const byId = new Map(report.byItem.map((r) => [r.item_id, r]));
  const customNeed = report.custom.reduce((sum, r) => sum + r.need, 0);
  return items.map((r) => {
    const rep = r.item_id ? byId.get(r.item_id) : undefined;
    return {
      key: r.key,
      name: r.name,
      unit: r.unit,
      custom: r.item_id === null,
      people: r.people,
      ordered: r.requested_qty,
      stock: rep ? rep.stock : null,
      need: r.item_id === null ? customNeed : (rep?.need ?? 0),
    };
  });
}
