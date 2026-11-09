import { describe, expect, it } from 'vitest';
import { lineView } from '@/test/fixtures-request';
import { defaultReason, reasonChoices, removedReason } from './adjust-reasons';

const t = (key: string, opts?: Record<string, unknown>) => (key === 'summary.adjust.overMaxNote' ? `Vượt tối đa ${opts?.max}` : key);
const overMaxLine = (qty: number, max: number) => ({ ...lineView({}), qty, max_qty: max });

describe('reasonChoices', () => {
  it('mặc định chỉ hai lý do: Không có hàng, Khác', () => {
    expect(reasonChoices({ ownerLeft: false })).toEqual(['adm_out_of_stock', 'other']);
  });
  it('chủ phiếu đã nghỉ → thêm "Người đã nghỉ" đứng đầu', () => {
    expect(reasonChoices({ ownerLeft: true })).toEqual(['user_left', 'adm_out_of_stock', 'other']);
  });
});

describe('defaultReason', () => {
  it('dòng vượt tối đa 10 (đăng ký 19) → chọn sẵn Khác, ghi chú "Vượt tối đa 10"', () => {
    expect(defaultReason(overMaxLine(19, 10), undefined, t)).toEqual({ code: 'other', note: 'Vượt tối đa 10' });
  });
  it('biên: số cũ đúng bằng tối đa → không chọn sẵn; hơn 1 → chọn sẵn Khác', () => {
    expect(defaultReason(overMaxLine(10, 10), undefined, t)).toEqual({ code: undefined, note: '' });
    expect(defaultReason(overMaxLine(11, 10), undefined, t).code).toBe('other');
  });
  it('preset thắng: ?left=1 chọn sẵn Người đã nghỉ kể cả dòng vượt tối đa', () => {
    expect(defaultReason(overMaxLine(19, 10), 'user_left', t)).toEqual({ code: 'user_left', note: '' });
  });
  it('dòng thường chưa chọn lý do', () => {
    expect(defaultReason({ ...lineView({}), max_qty: null }, undefined, t)).toEqual({ code: undefined, note: '' });
  });
});

describe('removedReason', () => {
  it('dòng bấm X bỏ → "removed", không ghi chú', () => {
    expect(removedReason(undefined)).toEqual({ code: 'removed', note: '' });
  });
  it('mở từ ?left=1 → "user_left"', () => {
    expect(removedReason('user_left')).toEqual({ code: 'user_left', note: '' });
  });
});
