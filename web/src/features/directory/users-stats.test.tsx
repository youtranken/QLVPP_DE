import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';
import { UsersStats } from './users-stats';

describe('UsersStats', () => {
  it('Đã khóa > 0 → danger; Mất quyền > 0 → info (không cùng đỏ)', () => {
    renderWithI18n(<UsersStats stats={{ active: 9, locked: 1, no_access: 2 }} selected="active" onSelect={() => {}} reg={null} />);
    expect(screen.getByRole('tab', { name: /^Đã khóa/ })).toHaveClass('stat-card--danger');
    expect(screen.getByRole('tab', { name: /^Mất quyền/ })).toHaveClass('stat-card--info');
  });

  it('dùng cùng hàng thẻ lọc với Giao hàng (TC-04): tablist, thẻ đang chọn aria-selected, bấm thẻ đăng ký → onSelect("reg")', async () => {
    const onSelect = vi.fn();
    renderWithI18n(<UsersStats stats={{ active: 14, locked: 0, no_access: 38 }} selected="active" onSelect={onSelect} reg={{ month: 1, count: 11 }} />);
    expect(screen.getByRole('tablist', { name: 'Lọc theo tình trạng' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /^Đang dùng/ })).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: /^Chưa đặt phiếu tháng 1/ }));
    expect(onSelect).toHaveBeenCalledWith('reg');
  });
});
