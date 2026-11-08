import type { HistoryItem } from './history.api';

export interface YearGroup {
  year: string;
  items: HistoryItem[];
}

// Server chỉ trả tháng có phiếu và đã xếp mới trước; ở đây chỉ gom theo năm, không chèn tháng trống
export function historyYearGroups(items: HistoryItem[]): YearGroup[] {
  const sorted = [...items].sort((a, b) => b.period_ym.localeCompare(a.period_ym));
  const groups: YearGroup[] = [];
  for (const item of sorted) {
    const year = item.period_ym.slice(0, 4);
    const last = groups[groups.length - 1];
    if (last?.year === year) last.items.push(item);
    else groups.push({ year, items: [item] });
  }
  return groups;
}
