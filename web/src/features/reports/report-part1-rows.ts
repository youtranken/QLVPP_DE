import { groupTone, type Tone } from '@/lib/group-tone';
import type { AdminItem, Category } from '@/features/catalog/catalog.api';
import { pickName, type MonthReport, type ReportCustomRow, type ReportItemRow } from './reports.api';

export const NONE_GROUP = '~none';
export const CUSTOM_GROUP = '~custom';

export interface Part1Row {
  id: string;
  row: ReportItemRow | ReportCustomRow;
  custom: boolean;
  group: string;
  tone: Tone;
  packNote: string | null;
}

// Nhóm theo danh mục sống chỉ để xem trên trang; bản chốt không lưu nhóm nên bản in giữ thứ tự phẳng
export function part1Rows(report: MonthReport, items: AdminItem[] | undefined, cats: Category[] | undefined): Part1Row[] {
  const catList = cats ?? [];
  const byId = new Map((items ?? []).map((i) => [i.id, i]));
  const order = [...catList].sort((a, b) => a.sort_order - b.sort_order).map((c) => c.id);
  const rank = (g: string) => (g === CUSTOM_GROUP ? order.length + 1 : g === NONE_GROUP ? order.length : order.indexOf(g));
  const catalog = report.byItem.map((row): Part1Row => {
    const item = byId.get(row.item_id);
    const known = !!item?.category_id && order.includes(item.category_id);
    return {
      id: row.key,
      row,
      custom: false,
      group: known ? item!.category_id! : NONE_GROUP,
      tone: known ? groupTone(catList, item!.category_id) : 'g0',
      packNote: item?.pack_note ?? null,
    };
  });
  const custom = report.custom.map((row): Part1Row => ({ id: row.key, row, custom: true, group: CUSTOM_GROUP, tone: 'g0', packNote: null }));
  return [...catalog, ...custom].sort((a, b) => rank(a.group) - rank(b.group));
}

export function part1Name(r: Part1Row, lang: string) {
  return r.custom ? r.row.name : pickName(lang, r.row.name, 'name_en' in r.row ? r.row.name_en : null);
}
