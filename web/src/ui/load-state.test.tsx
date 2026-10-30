import { describe, it, expect, vi } from 'vitest';
import { EmptyState, LoadError } from '@/ui/load-state';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';

describe('LoadError', () => {
  it('hiện thông báo lỗi tiếng Việt + nút Thử lại', () => {
    renderWithI18n(<LoadError onRetry={() => {}} />);
    expect(
      screen.getByText('Không tải được dữ liệu — thử lại.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Thử lại' }),
    ).toBeInTheDocument();
  });

  it('bấm Thử lại gọi onRetry đúng 1 lần', async () => {
    const onRetry = vi.fn();
    renderWithI18n(<LoadError onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('EmptyState', () => {
  it('có art thì vẽ minh họa ẩn khỏi trình đọc màn hình', () => {
    const { container } = renderWithI18n(<EmptyState title="Chưa có món" art="no-match" />);
    expect(screen.getByText('Chưa có món')).toBeInTheDocument();
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('không có art thì không có hình', () => {
    const { container } = renderWithI18n(<EmptyState title="Chưa có món" />);
    expect(container.querySelector('svg')).toBeNull();
  });
});
