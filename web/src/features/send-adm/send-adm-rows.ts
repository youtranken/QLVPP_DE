import type { AdminItem } from '@/features/catalog/catalog.api';
import type { KeyProgress, MonthReport, ReportCustomRow, ReportItemRow, SnapshotData } from '@/features/reports/reports.api';
import { parseOrderQty, type OrderQty } from '@/features/reports/use-order-qty';
import { activeNeed, defaultOrder, wantOf } from '@/lib/report-qty';

export interface OrderRow {
  key: string;
  code: string | null;
  name: string;
  name_en: string | null;
  unit: string;
  image_file_id: string | null;
  custom: boolean;
  // Đăng ký sau điều chỉnh (kể cả phần đã giao) và phần đã giao của kỳ
  registered: number;
  delivered: number;
  // Chưa giao kỳ này + nợ tháng trước, như báo cáo
  requested: number;
  backlog: number;
  want: number;
  // Cần của người đang làm việc (không tính người đã nghỉ)
  need: number;
  suggested: number;
  admOwed: number;
  admMonths: string[];
  left: number;
  usable: boolean;
  // Món ngoài danh mục giao thẳng, không qua tủ
  stock: number | null;
}

export interface RowsContext {
  progress?: Record<string, KeyProgress>;
  admMonths?: ReadonlyMap<string, string[]>;
}

function baseRow(r: ReportItemRow | ReportCustomRow, ctx: RowsContext) {
  const p = ctx.progress?.[r.key];
  return {
    key: r.key,
    unit: r.unit,
    registered: p?.registered ?? r.requested,
    delivered: p?.delivered ?? 0,
    requested: r.requested,
    backlog: r.backlog_prev,
    want: wantOf(r),
    need: activeNeed(r),
    suggested: defaultOrder(r),
    admOwed: r.adm_owed ?? 0,
    admMonths: ctx.admMonths?.get(r.key) ?? [],
    left: r.left_excluded ?? 0,
    usable: r.usable ?? true,
  };
}

// Cùng tập dòng với trang Báo cáo (kể cả món đã ngừng còn người đăng ký): Gửi ADM và Báo cáo ra cùng một phiếu
export function toOrderRows(report: Pick<MonthReport, 'byItem' | 'custom'>, items: AdminItem[], ctx: RowsContext = {}): OrderRow[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const listed = report.byItem.map((r) => ({
    ...baseRow(r, ctx),
    code: r.code ?? null,
    name: r.name,
    name_en: r.name_en,
    image_file_id: byId.get(r.item_id)?.image_file_id ?? null,
    stock: r.stock,
    custom: false,
  }));
  const custom = report.custom.map((r) => ({ ...baseRow(r, ctx), code: null, name: r.name, name_en: null, image_file_id: null, stock: null, custom: true }));
  return [...listed, ...custom];
}

// Số trên phiếu: ô đang gõ hợp lệ thì theo ô, chưa hợp lệ thì tạm theo số gợi ý (nút xuất đã khóa)
export const orderOf = (qty: OrderQty, row: Pick<OrderRow, 'key' | 'suggested'>) => parseOrderQty(qty.value(row.key)) ?? row.suggested;

type SentRows = Pick<SnapshotData, 'byItem' | 'custom' | 'order_qty' | 'order_basis'>;

// Bản cũ có thể thiếu khóa: đọc như số gộp
export const sentOrderOf = (data: SentRows, row: ReportItemRow | ReportCustomRow) => data.order_qty[row.key] ?? wantOf(row);

// Cần lúc chốt theo order_basis; bản cũ không có → tính lại từ chính hàng của bản
export function basisNeedOf(data: SentRows, row: ReportItemRow | ReportCustomRow): number {
  const b = data.order_basis?.[row.key];
  return b ? b.requested + b.debt - b.left_excluded : activeNeed(row);
}

// Ô đã sửa ở bản trước (khác số gợi ý lúc chốt) được mang sang bản mới như số đã sửa
export function carryFromSent(data: SentRows): Record<string, number> {
  const carry: Record<string, number> = {};
  for (const r of [...data.byItem, ...data.custom]) {
    const qty = sentOrderOf(data, r);
    if (qty !== defaultOrder(r)) carry[r.key] = qty;
  }
  return carry;
}

export interface OrderChange {
  key: string;
  name: string;
  name_en: string | null;
  from: number;
  to: number;
}

// Món đổi số so với bản đã gửi (cả món mới có và món đã rời báo cáo)
export function orderChanges(rows: OrderRow[], orderOfRow: (r: OrderRow) => number, sent: SentRows): OrderChange[] {
  const live = new Set(rows.map((r) => r.key));
  const now = rows.map((r) => ({ key: r.key, name: r.name, name_en: r.name_en, from: sent.order_qty[r.key] ?? 0, to: orderOfRow(r) }));
  const gone = [...sent.byItem, ...sent.custom]
    .filter((r) => !live.has(r.key))
    .map((r) => ({ key: r.key, name: r.name, name_en: 'name_en' in r ? r.name_en : null, from: sentOrderOf(sent, r), to: 0 }));
  return [...now, ...gone].filter((c) => c.from !== c.to);
}
