import type { AdminItem } from '@/features/catalog/catalog.api';
import type { MonthReport } from '@/features/reports/reports.api';
import { parseOrderQty, type OrderQty } from '@/features/reports/use-order-qty';

export interface OrderRow {
  key: string;
  code: string | null;
  name: string;
  name_en: string | null;
  unit: string;
  image_file_id: string | null;
  need: number;
  // Món ngoài danh mục giao thẳng, không qua tủ
  stock: number | null;
  custom: boolean;
}

// Cùng tập dòng với trang Báo cáo (kể cả món đã ngừng còn Cần mua): Gửi ADM và Báo cáo ra cùng một phiếu
export function toOrderRows(report: MonthReport, items: AdminItem[]): OrderRow[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const listed = report.byItem.map((r) => {
    const item = byId.get(r.item_id);
    return {
      key: r.key,
      code: r.code ?? null,
      name: r.name,
      name_en: item?.name_en ?? r.name_en,
      unit: r.unit,
      image_file_id: item?.image_file_id ?? null,
      need: r.need,
      stock: r.stock,
      custom: false,
    };
  });
  const custom = report.custom.map((r) => ({ key: r.key, code: null, name: r.name, name_en: null, unit: r.unit, image_file_id: null, need: r.need, stock: null, custom: true }));
  return [...listed, ...custom];
}

// Số trên phiếu: ô đang gõ hợp lệ thì theo ô, chưa hợp lệ thì tạm theo Cần (nút xuất đã khóa)
export const orderOf = (qty: OrderQty, row: Pick<OrderRow, 'key' | 'need'>) => parseOrderQty(qty.value(row.key)) ?? row.need;
