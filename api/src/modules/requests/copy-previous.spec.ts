import { buildCopy } from './copy-previous.service';
import type { CopyItemFacts, SourceLine } from './copy-previous.service';

const IMG = '11111111-1111-4111-8111-111111111111';
const item = (over: Partial<CopyItemFacts> = {}): CopyItemFacts => ({
  name: 'Bút bi',
  active: true,
  admin_only: false,
  max_qty: 10,
  ...over,
});
const line = (over: Partial<SourceLine> = {}): SourceLine => ({
  item_id: null,
  custom_name: null,
  custom_unit: null,
  custom_note: null,
  image_file_id: null,
  qty: 1,
  review_status: 'n/a',
  added_by_admin: false,
  ...over,
});
const custom = (over: Partial<SourceLine> = {}) =>
  line({
    custom_name: 'Bìa còng',
    custom_unit: 'cai',
    custom_note: 'màu xanh',
    image_file_id: IMG,
    review_status: 'pending',
    ...over,
  });

describe('buildCopy', () => {
  const items = new Map<string, CopyItemFacts>([
    ['ok', item({ name: 'Bút bi' })],
    ['off', item({ name: 'Bút ngừng', active: false })],
    ['adm', item({ name: 'Máy in', admin_only: true })],
    ['cap', item({ name: 'Giấy A4', max_qty: 10 })],
  ]);

  it('bỏ món ngừng, admin_only, dòng added_by_admin, dòng rejected với lý do', () => {
    const r = buildCopy(
      [
        line({ item_id: 'off', qty: 2 }),
        line({ item_id: 'adm', qty: 1 }),
        line({ item_id: 'ok', qty: 1, added_by_admin: true }),
        custom({ custom_name: 'Ghim lạ', review_status: 'rejected' }),
      ],
      items,
      20,
    );
    expect(r.lines).toEqual([]);
    expect(r.skipped).toEqual([
      { name: 'Bút ngừng', reason: 'INACTIVE' },
      { name: 'Máy in', reason: 'ADMIN_ONLY' },
      { name: 'Bút bi', reason: 'ADDED_BY_ADMIN' },
      { name: 'Ghim lạ', reason: 'REJECTED' },
    ]);
  });

  it('qty 15 với max_qty mới 10 → hạ về 10 và báo capped', () => {
    const r = buildCopy([line({ item_id: 'cap', qty: 15 })], items, 20);
    expect(r.lines).toEqual([{ item_id: 'cap', qty: 10 }]);
    expect(r.capped).toEqual([{ name: 'Giấy A4', from: 15, to: 10 }]);
  });

  it('qty 10 đúng bằng max_qty 10 → giữ 10, không có trong capped', () => {
    const r = buildCopy([line({ item_id: 'cap', qty: 10 })], items, 20);
    expect(r.lines).toEqual([{ item_id: 'cap', qty: 10 }]);
    expect(r.capped).toEqual([]);
  });

  it('dòng ngoài DM qty 20 đúng bằng default_max_qty 20 → giữ 20, không capped', () => {
    const r = buildCopy([custom({ qty: 20 })], items, 20);
    expect(r.lines[0].qty).toBe(20);
    expect(r.capped).toEqual([]);
  });

  it('dòng ngoài DM vượt default_max_qty → hạ về default', () => {
    const r = buildCopy([custom({ qty: 30 })], items, 20);
    expect(r.lines[0].qty).toBe(20);
    expect(r.capped).toEqual([{ name: 'Bìa còng', from: 30, to: 20 }]);
  });

  it('converted → dòng món item_id, không giữ custom/ảnh', () => {
    const r = buildCopy(
      [line({ item_id: 'ok', qty: 3, review_status: 'converted' })],
      items,
      20,
    );
    expect(r.lines).toEqual([{ item_id: 'ok', qty: 3 }]);
    expect(r.previously_accepted).toEqual([]);
  });

  it('accepted → dòng ngoài DM giữ ảnh/custom + previously_accepted; pending → dòng ngoài DM', () => {
    const r = buildCopy(
      [
        custom({ review_status: 'accepted', qty: 2 }),
        custom({ custom_name: 'Kẹp giấy', review_status: 'pending', qty: 4 }),
      ],
      items,
      20,
    );
    expect(r.lines).toEqual([
      {
        custom_name: 'Bìa còng',
        custom_unit: 'cai',
        custom_note: 'màu xanh',
        image_file_id: IMG,
        qty: 2,
      },
      {
        custom_name: 'Kẹp giấy',
        custom_unit: 'cai',
        custom_note: 'màu xanh',
        image_file_id: IMG,
        qty: 4,
      },
    ]);
    expect(r.previously_accepted).toEqual(['Bìa còng']);
    expect(r.skipped).toEqual([]);
  });

  it('cùng món ở dòng n/a và converted → gộp một dòng (tránh DUPLICATE_ITEM khi lưu), cộng rồi hạ max', () => {
    const r = buildCopy(
      [
        line({ item_id: 'cap', qty: 6 }),
        line({ item_id: 'cap', qty: 7, review_status: 'converted' }),
      ],
      items,
      20,
    );
    expect(r.lines).toEqual([{ item_id: 'cap', qty: 10 }]);
    expect(r.capped).toEqual([{ name: 'Giấy A4', from: 13, to: 10 }]);
  });

  it('món không còn trong danh mục → INACTIVE', () => {
    const r = buildCopy([line({ item_id: 'gone', qty: 1 })], items, 20);
    expect(r.skipped).toEqual([{ name: '', reason: 'INACTIVE' }]);
  });

  it('dòng ngoài DM có ĐVT đã ngừng → skipped UNIT_INACTIVE; ĐVT đang dùng → giữ', () => {
    const r = buildCopy(
      [
        custom({ custom_name: 'Kẹp lạ', custom_unit: 'old' }),
        custom({ custom_name: 'Kẹp thường', custom_unit: 'cai' }),
      ],
      items,
      20,
      new Set(['old']),
    );
    expect(r.skipped).toEqual([{ name: 'Kẹp lạ', reason: 'UNIT_INACTIVE' }]);
    expect(r.lines).toMatchObject([{ custom_name: 'Kẹp thường' }]);
  });
});
