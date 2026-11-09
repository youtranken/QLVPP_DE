import { describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { lineView } from '@/test/fixtures-request';
import { view } from '@/test/request-api-stub';
import type { LineView, RemovedLine } from './request.api';
import { receiveRows, receiveSummary } from './receive-rows';

const t = i18n.t.bind(i18n);
const line = (id: string, name: string, over: Partial<LineView> = {}) =>
  lineView({ id, custom_name: name, custom_unit: 'cay', qty: 1, review_status: 'n/a', ...over });
const rows = (lines: LineView[], removed: RemovedLine[] = []) => receiveRows({ ...view({ lines }), removed_lines: removed }, t, 'vi');

const REMOVED: RemovedLine = { name: 'Bút ghi đĩa Thiên Long', name_en: null, unit: 'cay', before: 1, reason_code: 'adm_out_of_stock', reason_note: null, at: '2026-11-08T01:30:00Z' };

describe('receiveRows / receiveSummary — phiếu 6 món theo NV-NhanHang-Popup', () => {
  const all = rows(
    [
      line('1', 'Bút bảng', { delivered_qty: 1, last_delivered_at: '2026-11-08T02:10:00.000Z' }),
      line('2', 'Bút bi', { delivered_qty: 1 }),
      line('4', 'Bút dạ quang'),
      line('5', 'Bút kim'),
      line('6', 'Bút chì'),
    ],
    [REMOVED],
  );
  const byName = (n: string) => all.find((r) => r.name === n)!;

  it('đã nhận 1/1, chờ 1, và món Hành chính bỏ thành "Không giao" kèm ghi chú', () => {
    expect(byName('Bút bảng')).toMatchObject({ registered: 1, toGive: 1, received: 1, state: 'received', receivedAt: '2026-11-08T02:10:00.000Z' });
    expect(byName('Bút dạ quang')).toMatchObject({ toGive: 1, received: 0, state: 'waiting', waiting: 1 });
    expect(byName('Bút ghi đĩa Thiên Long')).toMatchObject({ registered: 1, toGive: 0, state: 'none', note: 'HC bỏ món: Không có hàng' });
  });

  it('tóm tắt đếm theo món có toGive > 0: 2/5, còn chờ 3', () => {
    expect(receiveSummary(all)).toEqual({ done: 2, total: 5, waiting: 3 });
  });
});

describe('receiveRows — biên', () => {
  it('giảm 3→2: Đăng ký lấy số gốc của lần giảm đầu, Được giao 2', () => {
    const [r] = rows([line('1', 'A', { qty: 2, adjustments: [{ before: 3, after: 2, reason_code: 'over_quota', reason_note: null, at: 'x' }] })]);
    expect(r).toMatchObject({ registered: 3, toGive: 2 });
  });

  it('received = toGive → received; toGive − 1 → waiting 1', () => {
    const [full, short] = rows([line('1', 'A', { qty: 3, delivered_qty: 3 }), line('2', 'B', { qty: 3, delivered_qty: 2 })]);
    expect(full).toMatchObject({ state: 'received', waiting: 0 });
    expect(short).toMatchObject({ state: 'waiting', waiting: 1 });
  });

  it('phần còn lại đã hủy: toGive = qty − cancelled', () => {
    const [r] = rows([line('1', 'A', { qty: 3, delivered_qty: 1, cancelled_qty: 2 })]);
    expect(r).toMatchObject({ toGive: 1, state: 'received' });
  });

  it('món tạm ngưng chưa giao → "paused", không tính vào tóm tắt (cùng luật server); đã giao một phần thì vẫn tính', () => {
    const facts = { name: 'X', name_en: null, unit: 'cai', pack_note: null, image_file_id: null, admin_only: false };
    const all = rows([
      line('1', 'A', { item_id: 'i1', item: { ...facts, active: false }, qty: 3 }),
      line('2', 'B', { item_id: 'i2', item: { ...facts, active: false }, qty: 3, delivered_qty: 1 }),
      line('3', 'C', { qty: 1, delivered_qty: 1 }),
    ]);
    expect(all[0]).toMatchObject({ toGive: 0, state: 'paused', waiting: 0 });
    expect(all[1]).toMatchObject({ toGive: 3, state: 'waiting', waiting: 2 });
    expect(receiveSummary(all)).toEqual({ done: 1, total: 2, waiting: 1 });
    expect(receiveSummary(rows([line('1', 'A', { item_id: 'i1', item: { ...facts, active: false } }), line('3', 'C', { delivered_qty: 1 })]))).toEqual({ done: 1, total: 1, waiting: 0 });
  });

  it('dòng pending/rejected không có hàng', () => {
    expect(rows([line('1', 'A', { review_status: 'pending' }), line('2', 'B', { review_status: 'rejected' })])).toHaveLength(0);
  });

  it('lý do cũ over_quota vẫn có nhãn', () => {
    const [r] = rows([], [{ ...REMOVED, reason_code: 'over_quota' }]);
    expect(r.note).toBe('HC bỏ món: Vượt định mức');
  });
});
