import { describe, expect, it } from 'vitest';
import type { AdminItem } from '@/features/catalog/catalog.api';
import { applyArrivalFilter, differingRows, isAllArrived, isShort, parseArrivalFilter, parseQty, prefillOf, toArrivalRows } from './arrival-rows';
import { customRow, plan, planRow } from './arrivals-fixtures';

const item = (over: Partial<AdminItem>): AdminItem => ({ id: 'i-x', code: 'X9', name: 'Món thêm', name_en: null, unit: 'cai', category_id: null, image_file_id: null, stock_qty: 4, active: true, usable: true, ...over }) as AdminItem;

describe('toArrivalRows — nguồn theo bản in', () => {
  it('giữ ordered/received/remaining của kế hoạch; tủ = stock_qty; reduced theo reduced_after_snapshot', () => {
    const [r] = toArrivalRows(plan([planRow({ ordered: 12, received: 4, remaining: 8, stock_qty: 3, reduced_after_snapshot: 2 })]), []);
    expect(r).toMatchObject({ item_id: 'i-a', ordered: 12, received: 4, remaining: 8, stock: 3, reduced: 2, added: false });
  });

  it('hàng thêm bằng "Thêm món khác": ordered 0, received 0, remaining 0, added; món đã có trong kế hoạch không thêm lần hai', () => {
    const rows = toArrivalRows(plan([planRow()]), [item({}), item({ id: 'i-a' })]);
    expect(rows.map((r) => r.item_id)).toEqual(['i-a', 'i-x']);
    expect(rows[1]).toMatchObject({ ordered: 0, received: 0, remaining: 0, stock: 4, added: true });
  });
});

describe('prefillOf — điền sẵn "Về đợt này"', () => {
  it('= remaining (không bao giờ need net); ADM hết hàng → 0; hàng thêm → 0', () => {
    expect(prefillOf(toArrivalRows(plan([planRow({ ordered: 10, received: 4, remaining: 6, stock_qty: 9 })]), [])[0])).toBe(6);
    expect(prefillOf(toArrivalRows(plan([planRow({ adm_out: true })]), [])[0])).toBe(0);
    expect(prefillOf(toArrivalRows(plan([]), [item({})])[0])).toBe(0);
  });

  it('chưa có bản chốt: remaining theo ordered gộp của server', () => {
    const [r] = toArrivalRows(plan([planRow({ ordered: 10, remaining: 10, stock_qty: 5 })], { snapshot: null }), []);
    expect(prefillOf(r)).toBe(10);
  });
});

describe('isShort — "Chỉ món chưa về đủ"', () => {
  const r = (over: Parameters<typeof planRow>[0]) => toArrivalRows(plan([planRow(over)]), [])[0];
  it('received 9/10 → có; 10/10 → không; 11/10 → không; ADM hết hàng → không; món ngừng đã đặt còn thiếu → có (đã đặt thì phải nhận)', () => {
    expect(isShort(r({ received: 9 }))).toBe(true);
    expect(isShort(r({ received: 10 }))).toBe(false);
    expect(isShort(r({ received: 11 }))).toBe(false);
    expect(isShort(r({ received: 9, adm_out: true }))).toBe(false);
    expect(isShort(r({ received: 9, usable: false }))).toBe(true);
  });
});

describe('differingRows — hộp W15', () => {
  it('liệt kê hàng có qty ≠ remaining; bỏ hàng ADM hết hàng và hàng thêm', () => {
    const rows = toArrivalRows(plan([planRow({ item_id: 'a', remaining: 7 }), planRow({ item_id: 'b', remaining: 2 }), planRow({ item_id: 'c', remaining: 3, adm_out: true })]), [item({})]);
    const qty: Record<string, number> = { a: 3, b: 2, c: 0, 'i-x': 5 };
    expect(differingRows(rows, (r) => qty[r.item_id]).map((d) => [d.row.item_id, d.qty])).toEqual([['a', 3]]);
  });
});

describe('isAllArrived — trạng thái "đã về đủ"', () => {
  it('mọi remaining 0 (1 hàng ADM, 1 ngừng đã về) → đủ; 1 hàng remaining 1 → chưa; món ngừng còn 2 → chưa; chưa có bản → chưa; ngoài DM còn 1 → chưa', () => {
    const done = [planRow({ remaining: 0, received: 10 }), planRow({ item_id: 'b', adm_out: true }), planRow({ item_id: 'c', usable: false, remaining: 0, received: 10 })];
    expect(isAllArrived(plan([...done, planRow({ item_id: 'e', usable: false, remaining: 2 })]))).toBe(false);
    expect(isAllArrived(plan(done))).toBe(true);
    expect(isAllArrived(plan([...done, planRow({ item_id: 'd', remaining: 1 })]))).toBe(false);
    expect(isAllArrived(plan(done, { snapshot: null }))).toBe(false);
    expect(isAllArrived(plan(done, { custom: [customRow({ remaining: 1 })] }))).toBe(false);
    expect(isAllArrived(plan(done, { custom: [customRow({ remaining: 1, adm_out: true })] }))).toBe(true);
  });
});

describe('lọc ?q=&g=&short=1', () => {
  const rows = toArrivalRows(plan([planRow({ item_id: 'a', name: 'Bút bi', category_id: 'c-but', received: 10, remaining: 0 }), planRow({ item_id: 'b', name: 'Kẹp giấy', name_en: 'Paper clip', code: 'K14', category_id: 'c-kep' }), planRow({ item_id: 'c', name: 'Băng keo', category_id: null })]), []);
  const ids = (q: string) => applyArrivalFilter(rows, parseArrivalFilter(new URLSearchParams(q)), new Set(['c-but', 'c-kep'])).map((r) => r.item_id);

  it('tìm không dấu theo tên vi / en / mã', () => {
    expect(ids('q=but')).toEqual(['a']);
    expect(ids('q=clip')).toEqual(['b']);
    expect(ids('q=k14')).toEqual(['b']);
  });

  it('g = nhóm; g=none = chưa xếp nhóm; short=1 bỏ hàng đã về đủ; không lọc → mọi hàng', () => {
    expect(ids('g=c-kep')).toEqual(['b']);
    expect(ids('g=none')).toEqual(['c']);
    expect(ids('short=1')).toEqual(['b', 'c']);
    expect(ids('')).toEqual(['a', 'b', 'c']);
  });
});

describe('parseQty — biên ô Về đợt này', () => {
  it.each([
    ['0', 0, null],
    ['1', 1, null],
    ['99999', 99999, null],
    ['100000', 0, 'max'],
    ['-1', 0, 'invalid'],
    ['', 0, 'invalid'],
    ['1.5', 0, 'invalid'],
  ])('%j → qty %i lỗi %s', (raw, qty, error) => {
    expect(parseQty(raw)).toEqual({ qty, error });
  });
});
