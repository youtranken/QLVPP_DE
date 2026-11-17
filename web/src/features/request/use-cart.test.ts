import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { carryOf, useCart } from '@/features/request/use-cart';
import type { MemberItem, RequestView } from '@/features/request/request.api';
import { lineView, memberItem } from '@/test/fixtures-request';

const PEN = memberItem({ id: 'i-pen', name: 'Bút bi', unit: 'cay', max_qty: 5 });
const NOTE = memberItem({ id: 'i-note', name: 'Giấy note', max_qty: 10 });
const A4 = memberItem({ id: 'i-a4', name: 'Giấy A4', unit: 'ram', max_qty: 3 });
const ITEMS = new Map([PEN, NOTE, A4].map((i) => [i.id, i]));

const facts = (i: MemberItem) => ({ ...i, active: true });
const SERVER: RequestView = {
  id: 'r-1',
  period_ym: '2026-11',
  user_sub: 'u-member',
  full_name: 'Nguyễn Văn An',
  department: 'Phòng Công trình',
  updated_at: '2026-11-03T07:20:00.000Z',
  saved_at: '2026-11-03T07:20:00.000Z',
  is_open: true,
  lines: [
    lineView({ id: 'l-pen', item_id: PEN.id, item: facts(PEN), qty: 2 }),
    lineView({ id: 'l-note', item_id: NOTE.id, item: facts(NOTE), qty: 4 }),
    lineView({ id: 'l-admin', item_id: A4.id, item: facts(A4), qty: 1, added_by_admin: true, readonly_for_member: true }),
  ],
};

const render = (server: RequestView | null) =>
  renderHook(() => useCart(server, { ym: '2026-11', items: ITEMS, defaultMax: 20 })).result;

describe('useCart', () => {
  it('setQty vượt max bị chặn ở max (Bút bi tối đa 5 → gõ 9 thành 5)', () => {
    const cart = render(null);
    act(() => cart.current.setQty(PEN.id, 9));
    expect(cart.current.lines).toMatchObject([{ key: PEN.id, qty: 5 }]);
  });

  it('setQty về 0 thì bỏ dòng; remove cũng bỏ dòng', () => {
    const cart = render(SERVER);
    act(() => cart.current.setQty(PEN.id, 0));
    act(() => cart.current.remove(NOTE.id));
    expect(cart.current.lines.map((l) => l.key)).toEqual([A4.id]);
  });

  it('dòng readonly_for_member bất biến: setQty và remove bỏ qua', () => {
    const cart = render(SERVER);
    act(() => cart.current.setQty(A4.id, 3));
    act(() => cart.current.remove(A4.id));
    expect(cart.current.lines.find((l) => l.key === A4.id)).toMatchObject({ qty: 1, readonly: true });
    expect(cart.current.dirtyCount).toBe(0);
  });

  it('toBody(): dòng cũ gửi id, món mới gửi item_id, kèm expected_updated_at của phiếu đã có', () => {
    const cart = render(SERVER);
    act(() => cart.current.setQty(PEN.id, 3));
    act(() => cart.current.remove(NOTE.id));
    act(() => cart.current.addCustom({ custom_name: 'Băng keo 2 mặt', custom_unit: 'cuon', custom_note: null, image_file_id: 'f-1', qty: 2 }));
    expect(cart.current.toBody()).toEqual({
      ym: '2026-11',
      expected_updated_at: '2026-11-03T07:20:00.000Z',
      lines: [
        { id: 'l-pen', qty: 3 },
        { id: 'l-admin', qty: 1 },
        { custom_name: 'Băng keo 2 mặt', custom_unit: 'cuon', custom_note: null, image_file_id: 'f-1', qty: 2 },
      ],
    });
  });

  it('toBody() khi chưa có phiếu: không gửi expected_updated_at', () => {
    const cart = render(null);
    act(() => cart.current.setQty(NOTE.id, 1));
    expect(cart.current.toBody()).toEqual({ ym: '2026-11', lines: [{ item_id: NOTE.id, qty: 1 }] });
  });

  it('dirtyCount đếm thêm + sửa + bỏ; trả về như cũ thì 0', () => {
    const cart = render(SERVER);
    act(() => cart.current.setQty(PEN.id, 3));
    expect(cart.current.dirtyCount).toBe(1);
    act(() => cart.current.remove(NOTE.id));
    expect(cart.current.dirtyCount).toBe(2);
    act(() => cart.current.addCustom({ custom_name: 'Kéo', custom_unit: 'cai', custom_note: null, image_file_id: 'f-2', qty: 1 }));
    expect(cart.current.dirtyCount).toBe(3);
    act(() => cart.current.setQty(PEN.id, 2));
    act(() => cart.current.setQty(NOTE.id, 4));
    expect(cart.current.dirtyCount).toBe(1);
    // Thêm lại món đã có trên phiếu dùng lại id cũ → server sửa, không xóa rồi thêm
    expect(cart.current.toBody().lines).toContainEqual({ id: 'l-note', qty: 4 });
  });

  it('markSaved(view) đặt mốc mới: dirtyCount về 0, toBody dùng updated_at mới', () => {
    const cart = render(null);
    act(() => cart.current.setQty(PEN.id, 1));
    const saved: RequestView = {
      ...SERVER,
      updated_at: '2026-11-03T07:30:00.000Z',
      lines: [lineView({ id: 'l-new', item_id: PEN.id, item: facts(PEN), qty: 1 })],
    };
    act(() => cart.current.markSaved(saved));
    expect(cart.current.dirtyCount).toBe(0);
    expect(cart.current.toBody()).toEqual({
      ym: '2026-11',
      expected_updated_at: '2026-11-03T07:30:00.000Z',
      lines: [{ id: 'l-new', qty: 1 }],
    });
  });

  it('replaceAll giữ dòng chỉ đọc và dùng lại id của món đã có', () => {
    const cart = render(SERVER);
    act(() => cart.current.replaceAll([{ item_id: NOTE.id, qty: 6 }, { item_id: PEN.id, qty: 2 }]));
    expect(cart.current.toBody().lines).toEqual([
      { id: 'l-admin', qty: 1 },
      { id: 'l-note', qty: 6 },
      { id: 'l-pen', qty: 2 },
    ]);
    expect(cart.current.dirtyCount).toBe(1);
  });

  it('món đã ngừng trên phiếu: stepper khóa min = max = số đang có, chỉ bỏ được dòng', () => {
    const OLD = memberItem({ id: 'i-old', name: 'Bút xóa cũ', max_qty: 10, active: false });
    const server: RequestView = { ...SERVER, lines: [lineView({ id: 'l-old', item_id: OLD.id, item: { ...OLD }, qty: 3 })] };
    const cart = renderHook(() =>
      useCart(server, { ym: '2026-11', items: new Map([[OLD.id, OLD]]), defaultMax: 20 }),
    ).result;
    expect(cart.current.lines[0]).toMatchObject({ min: 3, max: 3 });
    act(() => cart.current.setQty(OLD.id, 5));
    act(() => cart.current.setQty(OLD.id, 2));
    expect(cart.current.lines[0].qty).toBe(3);
    act(() => cart.current.remove(OLD.id));
    expect(cart.current.toBody().lines).toEqual([]);
  });


  it('món còn bán nhưng SL đã lưu vượt max_qty (max bị hạ): max = SL đã lưu, giảm được, không tăng quá', () => {
    const server: RequestView = { ...SERVER, lines: [lineView({ id: 'l-pen', item_id: PEN.id, item: facts(PEN), qty: 8 })] };
    const cart = render(server);
    expect(cart.current.lines[0]).toMatchObject({ min: 1, max: 8 });
    act(() => cart.current.setQty(PEN.id, 6));
    expect(cart.current.lines[0].qty).toBe(6);
    act(() => cart.current.setQty(PEN.id, 9));
    expect(cart.current.lines[0].qty).toBe(8);
  });

  it('carryOf: bỏ dòng Adm D&E thêm và dòng bị từ chối, bỏ id; giỏ mới khởi tạo từ carry đều là dòng mới', () => {
    const rejected = lineView({ id: 'l-r', custom_name: 'Bìa', custom_unit: 'cai', image_file_id: 'f-1', review_status: 'rejected', readonly_for_member: true });
    const custom = lineView({ id: 'l-c', custom_name: 'Kéo', custom_unit: 'cai', image_file_id: 'f-2', qty: 2, review_status: 'pending' });
    const old = render({ ...SERVER, lines: [...SERVER.lines, rejected, custom] });
    const carry = carryOf(old.current.lines);
    expect(carry).toEqual([
      { item_id: PEN.id, qty: 2 },
      { item_id: NOTE.id, qty: 4 },
      { custom_name: 'Kéo', custom_unit: 'cai', custom_note: null, image_file_id: 'f-2', qty: 2 },
    ]);
    const next = renderHook(() => useCart(null, { ym: '2026-12', items: ITEMS, defaultMax: 20 }, carry)).result;
    expect(next.current.toBody()).toEqual({ ym: '2026-12', lines: carry });
    expect(next.current.dirtyCount).toBe(3);
  });

  it('replaceAll: món trùng dòng chỉ đọc (Adm D&E thêm) bị bỏ và báo, không lấy id dòng chỉ đọc; món không còn đặt được đếm riêng', () => {
    const OLD = memberItem({ id: 'i-old', name: 'Bút dạ cũ', active: false });
    const items = new Map([...ITEMS, [OLD.id, OLD]]);
    const cart = renderHook(() => useCart(SERVER, { ym: '2026-11', items, defaultMax: 20 })).result;
    let report: ReturnType<typeof cart.current.replaceAll> | undefined;
    act(() => {
      report = cart.current.replaceAll([
        { item_id: A4.id, qty: 2 },
        { item_id: PEN.id, qty: 1 },
        { item_id: OLD.id, qty: 1 },
      ]);
    });
    expect(report).toEqual({ heldByAdmin: ['Giấy A4'], unavailable: 1 });
    const keys = cart.current.lines.map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(cart.current.toBody().lines).toEqual([
      { id: 'l-admin', qty: 1 },
      { id: 'l-pen', qty: 1 },
    ]);
  });

  it('khởi tạo từ carry: món đã ngừng bị bỏ, initialReport đếm', () => {
    const OLD = memberItem({ id: 'i-old', name: 'Bút dạ cũ', active: false });
    const items = new Map([...ITEMS, [OLD.id, OLD]]);
    const cart = renderHook(() =>
      useCart(null, { ym: '2026-12', items, defaultMax: 20 }, [
        { item_id: PEN.id, qty: 2 },
        { item_id: OLD.id, qty: 1 },
      ]),
    ).result;
    expect(cart.current.lines.map((l) => l.key)).toEqual([PEN.id]);
    expect(cart.current.initialReport).toEqual({ heldByAdmin: [], unavailable: 1 });
  });
});
