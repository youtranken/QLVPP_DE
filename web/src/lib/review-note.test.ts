import { describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { reviewNoteText, reviewReasonText } from './review-note';

const vi = i18n.getFixedT('vi');
const en = i18n.getFixedT('en');

describe('ghi chú duyệt món ngoài danh mục', () => {
  it('mã app tự ghi (auto:not_approved) → câu theo ngôn ngữ người đọc', () => {
    expect(reviewNoteText('auto:not_approved', vi)).toBe('Sản phẩm không được duyệt mua tháng này. Bạn có thể đăng ký lại sau');
    expect(reviewNoteText('auto:not_approved', en)).toBe('This item was not approved for purchase this month. You can register it again later');
  });

  it('ghi chú gõ tay giữ nguyên; rỗng → null; mã auto: lạ → hiện nguyên ghi chú (không nuốt mất lý do)', () => {
    expect(reviewNoteText(' Đã có trong kho ', vi)).toBe('Đã có trong kho');
    expect(reviewNoteText(null, vi)).toBeNull();
    expect(reviewNoteText('  ', vi)).toBeNull();
    expect(reviewNoteText('auto:xyz', vi)).toBe('auto:xyz');
    expect(reviewReasonText('xyz', vi)).toBeNull();
  });
});
