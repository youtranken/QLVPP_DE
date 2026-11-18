import { foldVi } from '@/lib/search';
import { shiftYm } from '@/lib/ym';

export interface QuickEntry {
  id: string;
  label: string;
  hint?: string;
  to: string;
  terms: (string | null | undefined)[];
}

export type QuickGroupKey = 'items' | 'people' | 'periods' | 'pages';

export interface QuickShortcut {
  when: 'items' | 'people';
  make: (q: string) => QuickEntry;
}

export interface QuickSources {
  items: QuickEntry[];
  people: QuickEntry[];
  pages: QuickEntry[];
  periods: QuickEntry[];
  shortcuts: QuickShortcut[];
}

export interface QuickGroup {
  key: QuickGroupKey;
  entries: QuickEntry[];
}

export const QUICK_MIN_CHARS = 2;
export const QUICK_GROUP_MAX = 5;
export const QUICK_PERIOD_BACK = 12;

// Kỳ đang mở và 12 tháng trước, mới nhất trước; tìm được theo nhãn, "11/2026" và "2026-11"
export function periodEntries(openYm: string, label: (month: number, year: number) => string): QuickEntry[] {
  return Array.from({ length: QUICK_PERIOD_BACK + 1 }, (_, back) => {
    const ym = shiftYm(openYm, -back);
    const [year, month] = ym.split('-').map(Number);
    return { id: `period-${ym}`, label: label(month, year), to: `/admin/month?ym=${ym}`, terms: [label(month, year), ym, `${month}/${year}`] };
  });
}

const hit = (e: QuickEntry, folded: string) => e.terms.some((term) => term != null && foldVi(term).includes(folded));

export function quickSearchIndex(q: string, s: QuickSources): QuickGroup[] {
  const query = q.trim();
  if (query.length < QUICK_MIN_CHARS) return [];
  const folded = foldVi(query);
  const found = { items: s.items.filter((e) => hit(e, folded)), people: s.people.filter((e) => hit(e, folded)) };
  const shortcuts = s.shortcuts.filter((sc) => found[sc.when].length > 0).map((sc) => sc.make(query));
  const groups: QuickGroup[] = [
    { key: 'items', entries: found.items },
    { key: 'people', entries: found.people },
    { key: 'periods', entries: s.periods.filter((e) => hit(e, folded)) },
    { key: 'pages', entries: [...s.pages.filter((e) => hit(e, folded)), ...shortcuts] },
  ];
  return groups.map((g) => ({ ...g, entries: g.entries.slice(0, QUICK_GROUP_MAX) })).filter((g) => g.entries.length > 0);
}
