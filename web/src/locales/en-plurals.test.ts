import { describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import en from '@/locales/en';

// Rà soát 13/11 Gu #4 (nhân viên): bản EN gọi cùng một thứ là "kinds" chỗ này, "items" chỗ khác; số nhiều kiểu "change(s)".
const EN = i18n.getFixedT('en');
const VI = i18n.getFixedT('vi');

function strings(obj: unknown, path = ''): [string, string][] {
  if (typeof obj === 'string') return [[path, obj]];
  if (obj === null || typeof obj !== 'object') return [];
  return Object.entries(obj).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
}

describe('EN: một từ "items", số nhiều theo i18next', () => {
  it('không còn "(s)" trong mọi chuỗi EN của Nhân viên (request, notifications)', () => {
    const bad = strings({ request: en.request, notifications: en.notifications }).filter(([, s]) => /\w\(s\)/.test(s));
    expect(bad).toEqual([]);
  });

  it('không còn "kinds" cho số món trong phiếu', () => {
    expect(strings(en.request).filter(([, s]) => /\bkinds?\b/.test(s))).toEqual([]);
  });

  it('giỏ / lịch sử: "1 item · 1 unit", "3 items · 12 units" (masterSum và summary cùng cách gọi)', () => {
    const sum = (key: string, n: number, u: number) => EN(key, { count: n, units: EN('request.unitCount', { count: u }) });
    expect(sum('request.cart.summary', 1, 1)).toBe('1 item · 1 unit');
    expect(sum('request.cart.summary', 3, 12)).toBe('3 items · 12 units');
    expect(sum('request.history.summary', 3, 12)).toBe('3 items · 12 units');
    expect(sum('request.history.masterSum', 8, 8)).toBe('8 items · 8 units');
    expect(EN('request.cart.barSaved', { units: EN('request.unitCount', { count: 1 }), time: '18:32' })).toBe('1 unit · Saved 18:32');
  });

  it.each([
    ['request.cart.saveDirty', 1, '1 unsaved change · Save order', '2 unsaved changes · Save order'],
    ['request.cart.barDirty', 1, '1 unsaved change', '2 unsaved changes'],
    ['request.leave.body', 1, 'Your order has 1 unsaved change — leaving discards it.', 'Your order has 2 unsaved changes — leaving discards them.'],
    ['request.unavailable', 1, '1 item can no longer be ordered and was left out.', '2 items can no longer be ordered and were left out.'],
    ['request.grid.countMatch', 1, '1 item matches', '2 items match'],
    ['request.cart.viewCart', 1, 'View order (1 item)', 'View order (2 items)'],
    ['request.history.delivery.owed', 1, '1 item still waiting', '2 items still waiting'],
    ['request.history.customCount.pending', 1, '1 off-catalog item awaiting approval', '2 off-catalog items awaiting approval'],
    ['notifications.topics.line_adjusted.more', 1, '1 more item — see History.', '2 more items — see History.'],
  ])('%s: số ít / số nhiều', (key, _n, one, two) => {
    expect(EN(key, { count: 1 })).toBe(one);
    expect(EN(key, { count: 2 })).toBe(two);
  });

  it('dải nhận: "1 item still waiting", "2 items still waiting"', () => {
    expect(EN('request.receive.stripWaiting', { count: 1 })).toBe('1 item still waiting');
    expect(EN('request.receive.stripWaiting', { count: 2 })).toBe('2 items still waiting');
  });

  it('VI giữ nguyên câu cũ', () => {
    const sum = (key: string, n: number, u: number) => VI(key, { count: n, units: VI('request.unitCount', { count: u }) });
    expect(sum('request.cart.summary', 3, 12)).toBe('3 loại món · 12 đơn vị');
    expect(sum('request.history.masterSum', 1, 1)).toBe('1 món · 1 đơn vị');
    expect(VI('request.cart.saveDirty', { count: 1 })).toBe('1 thay đổi chưa lưu · Lưu phiếu');
    expect(VI('request.receive.stripWaiting', { count: 1 })).toBe('còn chờ 1 món');
    expect(VI('request.history.delivery.owed', { count: 3 })).toBe('Còn chờ 3 món');
    expect(VI('request.history.customCount.accepted', { count: 2 })).toBe('2 món đã chấp nhận');
  });
});

describe('EN: số đếm admin (Hôm nay, Giao hàng, Kỳ tháng) theo số ít / số nhiều', () => {
  it.each([
    ['today.tiles.backlog.hint', {}, 'people · 1 month', 'people · 2 months'],
    ['today.tiles.review.hint', { month: 11 }, 'people · period 11 · oldest 1 day', 'people · period 11 · oldest 2 days'],
    ['today.attention.waiting', {}, 'Awaiting review 1 day', 'Awaiting review 2 days'],
    ['today.attention.leftQty', {}, '1 unit not received', '2 units not received'],
    ['month.table.orderValue', { qty: 3 }, '1 item · 3 qty', '2 items · 3 qty'],
    ['delivery.people.debtValue', { months: 'M11' }, '1 item · M11', '2 items · M11'],
    ['delivery.people.panel.sum', {}, 'Deliver 1 unit', 'Deliver 2 units'],
    ['delivery.confirm.sumCancel', {}, 'Cancel 1 out-of-stock item', 'Cancel 2 out-of-stock items'],
    ['delivery.bulk.rejected', {}, '1 item marked Do not buy', '2 items marked Do not buy'],
  ] as const)('%s: 1 / 2', (key, params, one, two) => {
    expect(EN(key, { ...params, count: 1 })).toBe(one);
    expect(EN(key, { ...params, count: 2 })).toBe(two);
  });

  it('hạn khóa kỳ: "1 day left" / "2 days left"', () => {
    expect(EN('today.tiles.period.hint', { lock: 'x', count: 1 })).toBe('locks x · 1 day left');
    expect(EN('today.tiles.period.hint', { lock: 'x', count: 2 })).toBe('locks x · 2 days left');
  });

  it('dòng nhiều số đếm ghép từ common.count: "1 month · 1 person · 1 unit"', () => {
    const c = (k: string, n: number) => EN(`common.count.${k}`, { count: n });
    expect(EN('delivery.backlog.summaryAll', { months: c('months', 1), people: c('people', 1), units: c('units', 1) })).toBe('1 month · 1 person · 1 unit');
    expect(EN('delivery.backlog.monthHead', { month: 'December', people: c('people', 2), units: c('units', 5) })).toBe('December · 2 people · 5 units');
    expect(EN('delivery.bulk.line', { items: c('items', 1), units: c('units', 3) })).toBe('1 item · 3 units');
    expect(VI('delivery.backlog.summaryAll', { months: VI('common.count.months', { count: 2 }), people: VI('common.count.people', { count: 3 }), units: VI('common.count.units', { count: 9 }) })).toBe('2 tháng · 3 người · 9 đơn vị');
  });

  it('tiêu đề Giao hàng gọi tháng bằng tên như Nhận hàng: "Deliveries · December"', () => {
    expect(EN('delivery.people.title', { month: 12 })).toBe('Deliveries · December');
    expect(EN('arrivals.title', { month: 12 })).toBe('Receiving · December');
    expect(VI('delivery.people.title', { month: 12 })).toBe('Giao hàng kỳ tháng 12');
  });
});

// Số trước danh từ đếm được ("{{n}} items") cần cặp _one/_other, không thì EN ra "1 items".
// Khóa cũ ngoài Hôm nay/Giao hàng/Kỳ tháng còn nợ được liệt kê ở đây — danh sách chỉ được rút ngắn.
const COUNTED = /\{\{\s*(n|count|months|qty|days|k|u|lines|units|items)\s*\}\}\s+(?:[\w-]+\s+)?(items?|units?|months?|days?|requests?|lines?|people|persons?|changes?|entries|entry|groups?)\b/;
const PLURAL_DEBT = new Set<string>([
  'common.dateRange.summary',
  'nav.badge.review',
  'nav.badge.delivery',
  'nav.badge.stock',
  'nav.periodCard.daysLeft',
  'catalog.list.groupItems',
  'catalog.bulk.maxTitle',
  'catalog.bulk.maxDone',
  'catalog.bulk.moveTitle',
  'catalog.bulk.moveDone',
  'catalog.bulk.deactivateTitle',
  'catalog.bulk.partial',
  'catalog.drawer.changes',
  'catalog.categories.deactivateBody',
  'catalog.categories.reactivated',
  'stock.page.showMore',
  'users.page.syncNoAccess',
  'audit.page.dayCount',
  'audit.batch.title',
  'summary.history.avgLabel',
  'summary.history.summaryNone',
  'summary.open.dialogSaved',
  'summary.table.groupPeople',
  'summary.adjust.subtitle',
  'summary.adjust.heading',
  'summary.adjust.units',
  'summary.adjust.changes',
  'delivery.page.shortToBacklog',
  'delivery.detail.shortWarn',
  'reports.part1.groupItems',
  'reports.part1.rows',
  'reports.send.whoLabel',
  'reports.send.status.customLabel',
  'reports.preview.sub',
  'units.page.dirty',
  'units.page.orderSaved',
  'units.page.orderPartial',
  'arrivals.batchPicked',
  'arrivals.makeup.saved',
  'arrivals.receivePicked',
  'arrivals.receivePickedPartial',
  'arrivals.saved',
  'sendAdm.leave.body',
  'sendAdm.confirm.more',
  'warn.W8',
  'warn.W19row',
  'warn.W19head',
  'warn.W21',
  'warn.W25',
]);

describe('EN: chặn số đếm thiếu _one/_other', () => {
  const counted = strings(en).filter(([k, s]) => !/_(zero|one|other)$/.test(k) && COUNTED.test(s)).map(([k]) => k);

  it('quét bắt được mẫu (tránh regex hỏng mà test vẫn xanh)', () => {
    expect(COUNTED.test('{{n}} items')).toBe(true);
    expect(COUNTED.test('{{count}} off-catalog items')).toBe(true);
    expect(COUNTED.test('{{months}} · {{people}}')).toBe(false);
  });

  it('không chuỗi mới nào thiếu _one/_other; danh sách nợ không còn khóa đã sửa', () => {
    expect(counted.filter((k) => !PLURAL_DEBT.has(k))).toEqual([]);
    expect([...PLURAL_DEBT].filter((k) => !counted.includes(k))).toEqual([]);
  });
});
