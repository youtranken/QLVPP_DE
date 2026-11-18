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
    ['request.grid.countAll', 1, '1 item in catalog', '2 items in catalog'],
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
