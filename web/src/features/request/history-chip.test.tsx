import { describe, expect, it } from 'vitest';
import { renderWithI18n, screen } from '@/test/test-utils';
import { lineView } from '@/test/fixtures-request';
import { ReviewTag } from './history-chip';

describe('ReviewTag — dòng ngoài danh mục bị từ chối', () => {
  it('app tự ghi Không mua → lý do dịch từ mã, không hiện mã', () => {
    renderWithI18n(<ReviewTag line={lineView({ review_status: 'rejected', review_note: 'auto:not_approved' })} />);
    expect(screen.getByText('Từ chối: Sản phẩm không được duyệt mua tháng này. Bạn có thể đăng ký lại sau')).toBeInTheDocument();
    expect(screen.queryByText(/auto:/)).toBeNull();
  });

  it('lý do gõ tay giữ nguyên', () => {
    renderWithI18n(<ReviewTag line={lineView({ review_status: 'rejected', review_note: 'Đã có trong kho' })} />);
    expect(screen.getByText('Từ chối: Đã có trong kho')).toBeInTheDocument();
  });
});
