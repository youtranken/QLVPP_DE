import { describe, expect, it } from 'vitest';
import { historyItem } from '@/test/history-stub';
import { historyYearGroups } from './history-year-groups';

const at = (...yms: string[]) => yms.map((period_ym) => historyItem({ period_ym }));

describe('historyYearGroups', () => {
  it('hai năm: năm mới trước, tháng mới trước', () => {
    const groups = historyYearGroups(at('2025-11', '2026-10', '2026-12', '2025-12', '2026-09', '2026-11'));
    expect(groups.map((g) => g.year)).toEqual(['2026', '2025']);
    expect(groups[0].items.map((i) => i.period_ym)).toEqual(['2026-12', '2026-11', '2026-10', '2026-09']);
    expect(groups[1].items.map((i) => i.period_ym)).toEqual(['2025-12', '2025-11']);
  });

  it('server thiếu tháng 8 → không có mục tháng 8 (không chèn tháng trống)', () => {
    const groups = historyYearGroups(at('2026-09', '2026-07'));
    expect(groups.flatMap((g) => g.items.map((i) => i.period_ym))).toEqual(['2026-09', '2026-07']);
  });

  it('rỗng → không nhóm', () => {
    expect(historyYearGroups([])).toEqual([]);
  });
});
