import { describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { lockedNotice } from './use-save-flow';

describe('lockedNotice', () => {
  const t = i18n.getFixedT('vi');
  it('mang giỏ sang có món bị bỏ → thêm câu "n món không còn đặt được đã bị bỏ."', () => {
    const n = lockedNotice(t, { fromYm: '2026-11', nextYm: '2026-12', carry: [], savedTime: null }, 2);
    expect(n.text).toBe(
      'Phiếu tháng 11 đã khóa lúc 00:00. Món bạn chọn đã được chuyển sang phiếu tháng 12 — bấm Lưu phiếu để giữ. 2 món không còn đặt được đã bị bỏ.',
    );
  });
  it('kỳ cũ đã lưu → câu "Phiếu đã lưu lúc hh:mm vẫn giữ"', () => {
    const n = lockedNotice(t, { fromYm: '2026-12', nextYm: '2027-01', carry: null, savedTime: '09:05' });
    expect(n.text).toBe(
      'Phiếu tháng 12 đã khóa lúc 00:00. Phiếu đã lưu lúc 09:05 vẫn giữ và sẽ được giao; thay đổi chưa lưu không kịp áp dụng. Phiếu tháng 1 đã mở.',
    );
  });
});
