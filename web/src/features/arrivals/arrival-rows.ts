import type { AdminItem } from '@/features/catalog/catalog.api';
import type { MonthReport } from '@/features/reports/reports.api';

export const ARRIVAL_QTY_MAX = 99999;

export interface ArrivalRow {
  item_id: string;
  name: string;
  unit: string;
  image_file_id: string | null;
  // Số ADM còn phải chia về = đã xin + nợ kỳ trước
  waiting: number;
  stock: number;
  qty: number;
  edited: boolean;
}

export type ArrivalTag = 'short' | 'over' | 'exact';

// Cần mua của dòng (BR-15) tính lại từ số đang hiển thị
export const needOf = (r: Pick<ArrivalRow, 'waiting' | 'stock'>) => Math.max(0, r.waiting - r.stock);

export function toArrivalRows(report: MonthReport, items: AdminItem[]): ArrivalRow[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return report.byItem
    .filter((r) => r.item_id && r.need > 0)
    .map((r) => {
      const it = byId.get(r.item_id);
      return {
        item_id: r.item_id,
        name: r.name,
        unit: r.unit,
        image_file_id: it?.image_file_id ?? null,
        waiting: r.requested + r.backlog_prev,
        stock: it?.stock_qty ?? r.stock,
        qty: r.need,
        edited: false,
      };
    });
}

export function arrivalTag(r: ArrivalRow): ArrivalTag {
  const need = needOf(r);
  return r.qty < need ? 'short' : r.qty > need ? 'over' : 'exact';
}

// Món ngoài danh mục đang cần hàng: giao thẳng, không qua tủ
export const outsideCount = (report: MonthReport) => report.custom.filter((c) => c.need > 0).length;

export type QtyError = 'invalid' | 'max' | null;

export function parseQty(raw: string): { qty: number; error: QtyError } {
  if (!/^-?\d+$/.test(raw.trim())) return { qty: 0, error: 'invalid' };
  const n = Number(raw);
  if (n < 0) return { qty: 0, error: 'invalid' };
  if (n > ARRIVAL_QTY_MAX) return { qty: 0, error: 'max' };
  return { qty: n, error: null };
}
