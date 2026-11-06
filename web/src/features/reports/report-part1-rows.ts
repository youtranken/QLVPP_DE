import type { Tone } from '@/lib/group-tone';
import { indexCategories } from '@/features/catalog/catalog-rows';
import type { AdminItem, Category } from '@/features/catalog/catalog.api';
import { defaultOrder, wantOf } from '@/lib/report-qty';
import { sentOrderOf } from '@/features/send-adm/send-adm-rows';
import { pickName, type KeyProgress, type MonthReport, type ReportCustomRow, type ReportItemRow, type SnapshotData } from './reports.api';

export const NONE_GROUP = '~none';
export const CUSTOM_GROUP = '~custom';

export interface Part1Row {
  id: string;
  row: ReportItemRow | ReportCustomRow;
  custom: boolean;
  group: string;
  tone: Tone;
  packNote: string | null;
  n: Part1Numbers;
}

export interface Part1Numbers {
  registered: number;
  delivered: number;
  received: number;
  backlog: number;
  stock: number | null;
  want: number;
  order: number;
}

export interface Part1Context {
  // Cột sống của kỳ (Đăng ký sau điều chỉnh, Đã giao, Đã về)
  progress?: Record<string, KeyProgress>;
  // Bản có hàng mới nhất: Đề nghị theo bản, không tính lại
  sent?: SnapshotData | null;
}

function numbersOf(row: ReportItemRow | ReportCustomRow, ctx: Part1Context): Part1Numbers {
  const p = ctx.progress?.[row.key];
  return {
    registered: p?.registered ?? row.requested,
    delivered: p?.delivered ?? 0,
    received: p?.received ?? 0,
    backlog: row.backlog_prev,
    stock: row.stock,
    want: wantOf(row),
    order: ctx.sent ? sentOrderOf(ctx.sent, row) : defaultOrder(row),
  };
}

// Nhóm theo danh mục sống chỉ để xem trên trang; bản chốt không lưu nhóm nên bản in giữ thứ tự phẳng
export function part1Rows(report: Pick<MonthReport, 'byItem' | 'custom'>, items: AdminItem[] | undefined, cats: Category[] | undefined, ctx: Part1Context = {}): Part1Row[] {
  const index = indexCategories(cats ?? []);
  const last = index.ordered.length;
  const byId = new Map((items ?? []).map((i) => [i.id, i]));
  const rank = (g: string) => (g === CUSTOM_GROUP ? last + 1 : g === NONE_GROUP ? last : index.rank.get(g)!);
  const catalog = report.byItem.map((row): Part1Row => {
    const item = byId.get(row.item_id);
    const known = !!item?.category_id && index.rank.has(item.category_id);
    return {
      id: row.key,
      row,
      custom: false,
      group: known ? item!.category_id! : NONE_GROUP,
      tone: known ? index.tone.get(item!.category_id!)! : 'g0',
      packNote: item?.pack_note ?? null,
      n: numbersOf(row, ctx),
    };
  });
  const custom = report.custom.map((row): Part1Row => ({ id: row.key, row, custom: true, group: CUSTOM_GROUP, tone: 'g0', packNote: null, n: numbersOf(row, ctx) }));
  return [...catalog, ...custom].sort((a, b) => rank(a.group) - rank(b.group));
}

export function part1Name(r: Part1Row, lang: string) {
  return r.custom ? r.row.name : pickName(lang, r.row.name, 'name_en' in r.row ? r.row.name_en : null);
}
