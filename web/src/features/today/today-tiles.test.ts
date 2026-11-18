import { describe, expect, it } from 'vitest';
import { A, B, C, D, PEOPLE, person, pLine } from '@/features/delivery/people/people-fixtures';
import { peopleTabs } from '@/features/delivery/people/people-tabs';
import { backlogLine, personGroup } from '@/features/delivery/backlog-fixtures';
import { plan, planRow } from '@/features/arrivals/arrivals-fixtures';
import { CATEGORIES, ITEMS, STOCK } from '@/features/stock/stock-fixtures';
import { indexCategories, toRows } from '@/features/catalog/catalog-rows';
import { toStockRows, stockStats } from '@/features/stock/stock-rows';
import { reviewBadge } from '@/shell/use-admin-badges';
import { attentionItems, todaySummary, todayTiles, vnDaysWaiting, type TodayData } from './today-tiles';

const NOW = new Date('2026-11-18T02:00:00.000Z');
const PERIOD = { ym: '2026-12', deadline: '2026-12-10T17:00:00.000Z', days_left: 22 };
const review = (over: Partial<{ line_id: string; request_id: string; period_ym: string; user_sub: string; full_name: string; custom_name: string; created_at: string }> = {}) => ({
  line_id: 'l1',
  request_id: 'r1',
  period_ym: '2026-11',
  user_sub: 'u-1',
  full_name: 'Hoàng Minh',
  custom_name: 'Bìa còng 7cm',
  created_at: '2026-11-15T03:00:00.000Z',
  ...over,
});
const stockRows = toStockRows(toRows(ITEMS, indexCategories(CATEGORIES)), new Map(STOCK.map((f) => [f.item_id, f])));

const FULL: TodayData = {
  now: NOW,
  period: PERIOD,
  summary: { registered: 5, headcount: 16 },
  review: [review(), review({ line_id: 'l2', user_sub: 'u-2' }), review({ line_id: 'l3', period_ym: '2026-12', user_sub: 'u-3' })],
  people: PEOPLE,
  arrivals: plan([planRow({ item_id: 'i-a' }), planRow({ item_id: 'i-b', received: 10, remaining: 0 }), planRow({ item_id: 'i-c', adm_out: true })]),
  backlog: [personGroup([backlogLine()]), personGroup([backlogLine({ line_id: 'l-x', user_sub: 'u-x', period_ym: '2026-09' })])],
  stockRows,
};

const byKey = (data: TodayData) => Object.fromEntries(todayTiles(data).map((t) => [t.key, t]));

describe('todayTiles', () => {
  it('7 ô theo bản Sau, đúng thứ tự (bỏ "Thư gửi lỗi": api không lưu thư lỗi)', () => {
    expect(todayTiles(FULL).map((t) => t.key)).toEqual(['review', 'ready', 'arrivals', 'backlog', 'period', 'low', 'left']);
  });

  it('số mỗi ô dùng chung hàm đếm với trang đích', () => {
    const t = byKey(FULL);
    expect(t.review.value).toBe(reviewBadge(FULL.review!).n);
    expect(t.review.value).toBe(2);
    expect(t.ready.value).toBe(peopleTabs(PEOPLE).ready.length);
    expect(t.arrivals.value).toBe(1);
    expect(t.backlog.value).toBe(2);
    expect(t.period.value).toBe('5/16');
    expect(t.low.value).toBe(stockStats(stockRows).low);
    expect(t.left.value).toBe(0);
  });

  it('"Món ngoài danh mục chờ duyệt" tone danger khi > 0, link Kỳ tháng kỳ cũ nhất chip pending', () => {
    const t = byKey(FULL).review;
    expect(t.tone).toBe('danger');
    expect(t.to).toBe('/admin/month?ym=2026-11&chip=pending');
    expect(t.hint).toEqual({ key: 'today.tiles.review.hint', params: { month: 11, count: 3 } });
  });

  it('ô số 0 thì hint "Không có việc", tone ok', () => {
    const t = byKey({ ...FULL, review: [], people: [D], backlog: [], stockRows: [] });
    for (const key of ['review', 'ready', 'backlog', 'low', 'left']) {
      expect(t[key].value).toBe(0);
      expect(t[key].hint).toEqual({ key: 'today.tiles.none' });
      expect(t[key].tone).toBe('ok');
    }
  });

  it('biên 0/1: một món chờ là 1, tone danger; không món nào là 0, tone ok', () => {
    expect(byKey({ ...FULL, review: [review()] }).review).toMatchObject({ value: 1, tone: 'danger' });
    expect(byKey({ ...FULL, review: [] }).review).toMatchObject({ value: 0, tone: 'ok', to: '/admin/month' });
  });

  it('mỗi ô có `to` mở đúng danh sách', () => {
    const t = byKey(FULL);
    expect(t.ready.to).toBe('/admin/delivery?tab=ready');
    expect(t.arrivals.to).toBe('/admin/arrivals?short=1');
    expect(t.backlog.to).toBe('/admin/backlog');
    expect(t.period.to).toBe('/admin/month?ym=2026-12');
    expect(t.low.to).toBe('/admin/stock?filter=low');
    expect(t.left.to).toBe('/admin/delivery?tab=left');
  });

  it('người đã nghỉ còn phần: đếm như thẻ "Đã nghỉ" của Giao hàng, tone warn', () => {
    const gone = person({ user_sub: 'u-g', user_status: 'left', lines: [pLine({ line_id: 'lg', remaining_qty: 4, qty: 4 })] });
    const t = byKey({ ...FULL, people: [A, gone] }).left;
    expect(t).toMatchObject({ value: 1, tone: 'warn', hint: { key: 'today.tiles.left.hint' } });
  });

  it('chưa gửi NCC: Hàng NCC chưa về là 0 với hint "chưa gửi NCC", không phải "Không có việc"', () => {
    const t = byKey({ ...FULL, arrivals: plan([], { snapshot: null }) }).arrivals;
    expect(t).toMatchObject({ value: 0, hint: { key: 'today.tiles.arrivals.notSent' } });
  });

  it('đã gửi NCC: hint ngày gửi dd/mm', () => {
    expect(byKey(FULL).arrivals.hint).toEqual({ key: 'today.tiles.arrivals.hint', params: { date: '02/11' } });
  });

  it('kỳ đang đăng ký: nhãn tháng, hint câu khóa + số ngày còn', () => {
    const t = byKey(FULL).period;
    expect(t.label).toEqual({ key: 'today.tiles.period.label', params: { month: 12 } });
    expect(t.hint).toEqual({ key: 'today.tiles.period.hint', params: { deadline: PERIOD.deadline, count: 22 } });
  });

  it('nguồn chưa có (lỗi/đang tải) → value null, ô khác vẫn có số', () => {
    const t = byKey({ ...FULL, people: undefined, summary: undefined });
    expect(t.ready.value).toBeNull();
    expect(t.left.value).toBeNull();
    expect(t.period.value).toBeNull();
    expect(t.review.value).toBe(2);
  });
});

describe('vnDaysWaiting — theo ngày lịch giờ VN', () => {
  it('23:59:59.999 hôm qua (VN) là 1 ngày; 00:00:00 hôm nay là 0 ngày', () => {
    expect(vnDaysWaiting('2026-11-17T16:59:59.999Z', NOW)).toBe(1);
    expect(vnDaysWaiting('2026-11-17T17:00:00.000Z', NOW)).toBe(0);
  });
});

describe('todaySummary', () => {
  it('đếm ô việc có số > 0 (không tính ô kỳ đăng ký) và ô gấp (danger)', () => {
    expect(todaySummary(todayTiles(FULL))).toEqual({ work: 5, urgent: 1 });
    expect(todaySummary(todayTiles({ ...FULL, review: [], people: [D], backlog: [], stockRows: [], arrivals: plan([]) }))).toEqual({ work: 0, urgent: 0 });
  });
});

describe('attentionItems', () => {
  it('món chờ duyệt cũ nhất trước, nút Duyệt mở phiếu ở Kỳ tháng; người đã nghỉ còn phần có "Mở phiếu" ở Giao hàng', () => {
    const gone = person({ user_sub: 'u-g', full_name: 'Phạm Quốc Việt', user_status: 'left', lines: [pLine({ line_id: 'lg', qty: 17, remaining_qty: 17 })] });
    const items = attentionItems({ ...FULL, review: [review({ line_id: 'new', created_at: '2026-11-17T03:00:00.000Z' }), review()], people: [B, C, gone] });
    expect(items[0]).toMatchObject({ kind: 'review', name: 'Hoàng Minh', what: 'Bìa còng 7cm', days: 3, to: '/admin/month?ym=2026-11&chip=pending&request=r1' });
    expect(items[1]).toMatchObject({ kind: 'review', days: 1 });
    expect(items[2]).toMatchObject({ kind: 'left', name: 'Phạm Quốc Việt', qty: 17, to: '/admin/delivery?tab=left&person=u-g' });
    expect(items).toHaveLength(3);
  });

  it('biên 5: tối đa 5 món chờ duyệt — 5 thì đủ 5, 6 thì vẫn 5', () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => review({ line_id: `l${i}`, user_sub: `u${i}` }));
    expect(attentionItems({ ...FULL, people: [], review: many(5) })).toHaveLength(5);
    expect(attentionItems({ ...FULL, people: [], review: many(6) })).toHaveLength(5);
  });
});
