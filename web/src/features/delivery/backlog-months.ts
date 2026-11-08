import { matchesSearch } from '@/lib/search';
import type { BacklogGroup, BacklogLine } from './backlog.api';

export interface BacklogPerson {
  user_sub: string;
  full_name: string | null;
  // Phòng ban hiện tại của người đó (nhãn nhóm của server), không phải phòng ban chụp trên phiếu
  department: string | null;
  user_status: string;
  lines: BacklogLine[];
  owed_units: number;
}

export interface BacklogMonth {
  ym: string;
  people: BacklogPerson[];
  owed_units: number;
}

export interface BacklogFilter {
  ym: string | null;
  q: string;
  left: boolean;
}

export const isLeft = (l: Pick<BacklogLine, 'user_status'>) => l.user_status !== 'active';

const nameOf = (l: Pick<BacklogLine, 'full_name' | 'user_sub'>) => l.full_name ?? l.user_sub;
const sum = (lines: BacklogLine[]) => lines.reduce((n, l) => n + l.remaining_qty, 0);
const cmpText = (a: string, b: string) => a.localeCompare(b, 'vi');

// Người khớp tên thì giữ mọi dòng của họ; không thì chỉ giữ dòng có tên món khớp
function keep(l: BacklogLine, f: BacklogFilter): boolean {
  if (f.ym && l.period_ym !== f.ym) return false;
  if (f.left && !isLeft(l)) return false;
  const q = f.q.trim();
  if (!q) return true;
  return matchesSearch(nameOf(l), q) || matchesSearch(l.name, q) || (l.name_en != null && matchesSearch(l.name_en, q));
}

// Tháng cũ trước; trong tháng: phòng ban rồi tên; trong người: thứ tự dòng của server
export function backlogMonths(groups: BacklogGroup[], f: BacklogFilter): BacklogMonth[] {
  const byMonth = new Map<string, Map<string, BacklogPerson>>();
  for (const g of groups) {
    for (const line of g.lines.filter((l) => keep(l, f))) {
      const people = byMonth.get(line.period_ym) ?? new Map<string, BacklogPerson>();
      const person = people.get(line.user_sub) ?? {
        user_sub: line.user_sub,
        full_name: line.full_name,
        department: g.label.department ?? null,
        user_status: line.user_status,
        lines: [],
        owed_units: 0,
      };
      person.lines.push(line);
      person.owed_units += line.remaining_qty;
      people.set(line.user_sub, person);
      byMonth.set(line.period_ym, people);
    }
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => cmpText(a, b))
    .map(([ym, people]) => {
      const list = [...people.values()].sort((a, b) => cmpText(a.department ?? '', b.department ?? '') || cmpText(nameOf(a), nameOf(b)));
      return { ym, people: list, owed_units: sum(list.flatMap((p) => p.lines)) };
    });
}

export const monthsOf = (groups: BacklogGroup[]): string[] => [...new Set(groups.flatMap((g) => g.lines.map((l) => l.period_ym)))].sort();

export const leftPeople = (groups: BacklogGroup[]): number => new Set(groups.flatMap((g) => g.lines.filter(isLeft).map((l) => l.user_sub))).size;
