import { describe, expect, it } from 'vitest';
import { renderWithI18n, screen } from '@/test/test-utils';
import { Progress } from '@/ui/progress';

describe('Progress', () => {
  it('hiện chữ đã giao 3/5 và giá trị thanh 3 trên 5', () => {
    renderWithI18n(<Progress done={3} total={5} label="đã giao 3/5" />);
    expect(screen.getByText('đã giao 3/5')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: 'đã giao 3/5' });
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
    expect(bar.firstElementChild).toHaveStyle({ width: '60%' });
  });

  it('done lớn hơn total thì thanh kẹp 100%', () => {
    renderWithI18n(<Progress done={7} total={5} label="đã giao 7/5" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '5');
    expect(bar.firstElementChild).toHaveStyle({ width: '100%' });
  });

  it('total bằng 0 thì thanh 0%, không NaN', () => {
    renderWithI18n(<Progress done={0} total={0} label="đã giao 0/0" />);
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '0%' });
  });

  it('text: chữ hiện "3/5" khác tên đọc màn hình "Đã giao 3/5", không lặp chữ', () => {
    renderWithI18n(<Progress done={3} total={5} label="Đã giao 3/5" text="3/5" />);
    expect(screen.getByRole('progressbar', { name: 'Đã giao 3/5' })).toBeInTheDocument();
    expect(screen.getByText('3/5')).toBeInTheDocument();
    expect(screen.queryByText('Đã giao 3/5')).toBeNull();
  });
});

