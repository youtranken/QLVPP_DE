import { describe, expect, it } from 'vitest';
import { renderWithI18n, screen, within } from '@/test/test-utils';
import type { AuditEntry } from './admin.api';
import { AuditDetail } from './audit-detail';

const entry = (note: string): AuditEntry => ({
  id: 'e-1',
  actor: 'u-admin',
  actorName: 'Trần Thị Bình',
  action: 'line.review',
  objectType: 'request_line',
  objectId: 'l-1',
  detail: { ym: '2026-11', action: 'reject', auto: true, before: { review_status: 'pending', review_note: null }, after: { review_status: 'rejected', review_note: note } },
  createdAt: '2026-11-12T03:00:00.000Z',
});

describe('AuditDetail — ghi chú duyệt', () => {
  it('lý do app tự ghi (auto:not_approved) hiện câu dễ đọc, không hiện mã', () => {
    renderWithI18n(<AuditDetail entry={entry('auto:not_approved')} id="d" />);
    const row = screen.getByRole('rowheader', { name: 'Ghi chú duyệt' }).closest('tr')!;
    expect(within(row).getByText('Sản phẩm không được duyệt mua tháng này. Bạn có thể đăng ký lại sau')).toBeInTheDocument();
    expect(within(row).queryByText(/auto:/)).toBeNull();
  });

  it('ghi chú gõ tay giữ nguyên', () => {
    renderWithI18n(<AuditDetail entry={entry('Đã có trong kho')} id="d" />);
    const row = screen.getByRole('rowheader', { name: 'Ghi chú duyệt' }).closest('tr')!;
    expect(within(row).getByText('Đã có trong kho')).toBeInTheDocument();
  });
});
