import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen, userEvent, within } from '@/test/test-utils';
import { CopySummaryDialog } from './copy-previous-dialog';
import { hasCopyNotes } from './use-copy-previous';
import type { CopyPreviousResult } from './request.api';

const RESULT: CopyPreviousResult = {
  from_ym: '2026-10',
  lines: [{ item_id: 'i-pen', qty: 20 }],
  skipped: [
    { name: 'Giấy A4', reason: 'ADMIN_ONLY' },
    { name: 'Bút dạ cũ', reason: 'INACTIVE' },
    { name: 'Kéo lớn', reason: 'ADDED_BY_ADMIN' },
    { name: 'Bìa lỗ', reason: 'REJECTED' },
    { name: 'Kẹp lạ', reason: 'UNIT_INACTIVE' },
  ],
  capped: [{ name: 'Bút bi xanh', from: 30, to: 20 }],
  previously_accepted: ['Bìa còng 7cm'],
};

describe('CopySummaryDialog', () => {
  it('tóm tắt bằng lời: món bỏ kèm lý do, món hạ số lượng, món ngoài DM đã nhận', async () => {
    const onClose = vi.fn();
    renderWithI18n(
      <CopySummaryDialog summary={{ result: RESULT, report: { heldByAdmin: ['Kẹp giấy'], unavailable: 1 } }} onClose={onClose} />,
    );
    const dialog = await screen.findByRole('dialog', { name: 'Đã chép danh sách tháng 10' });
    for (const text of [
      'Đã bỏ: Giấy A4 — chỉ Adm D&E đặt',
      'Đã bỏ: Bút dạ cũ — món đã ngừng',
      'Đã bỏ: Kéo lớn — do Adm D&E thêm',
      'Đã bỏ: Bìa lỗ — Adm D&E không nhận',
      'Đã bỏ: Kẹp lạ — đơn vị tính đã ngừng dùng',
      'Đã giảm: Bút bi xanh từ 30 xuống 20 (tối đa mỗi tháng)',
      'Đã bỏ: Kẹp giấy — Adm D&E đã thêm món này',
      '1 món không còn đặt được đã bị bỏ.',
      'Bìa còng 7cm — tháng trước Adm D&E đã nhận, chép lại thành món ngoài danh mục để Adm D&E xem lại',
    ]) {
      expect(within(dialog).getByText(text)).toBeInTheDocument();
    }
    expect(within(dialog).getByText('Giỏ chưa lưu — kiểm tra rồi bấm “Lưu phiếu” để giữ.')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Đã hiểu' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('hasCopyNotes: không bỏ/giảm/đã nhận gì → false (chỉ cần toast)', () => {
    expect(hasCopyNotes({ ...RESULT, skipped: [], capped: [], previously_accepted: [] })).toBe(false);
    expect(hasCopyNotes(RESULT)).toBe(true);
  });
});
