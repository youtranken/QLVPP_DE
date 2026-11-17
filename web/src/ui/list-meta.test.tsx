import { describe, expect, it, vi } from 'vitest';
import { ActiveFilters, ShownCount } from '@/ui/list-meta';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';

describe('ShownCount — "Đang hiện x/y" chỉ khi đang lọc và bớt dòng (TN-13)', () => {
  it.each([
    [12, 12, false, false],
    [12, 12, true, false],
    [11, 12, true, true],
    [11, 12, false, false],
    [0, 12, true, true],
  ])('shown %i / total %i, lọc=%s → hiện=%s', (shown, total, filtering, visible) => {
    renderWithI18n(
      <ShownCount shown={shown} total={total} filtering={filtering}>
        Đang hiện {shown}/{total}
      </ShownCount>,
    );
    expect(screen.queryByText(`Đang hiện ${shown}/${total}`) !== null).toBe(visible);
  });
});

describe('ActiveFilters — hàng "Đang lọc" gỡ từng chip (TC-10)', () => {
  it('mỗi điều kiện là một nút gỡ; "Xóa lọc" gỡ hết; không có điều kiện thì không render', async () => {
    const off = vi.fn();
    const all = vi.fn();
    const { rerender } = renderWithI18n(<ActiveFilters items={[{ key: 'kind', label: 'Loại: Giao hàng', onRemove: off }]} onClearAll={all} />);
    expect(screen.getByText('Đang lọc')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ lọc Loại: Giao hàng' }));
    expect(off).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    expect(all).toHaveBeenCalledTimes(1);
    rerender(<ActiveFilters items={[]} onClearAll={all} />);
    expect(screen.queryByText('Đang lọc')).not.toBeInTheDocument();
  });
});
