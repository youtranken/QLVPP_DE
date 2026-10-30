import { describe, it, expect, vi } from 'vitest';
import { BulkBar } from '@/ui/bulk-bar';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';

describe('BulkBar', () => {
  it('count=0 → không render', () => {
    renderWithI18n(<BulkBar count={0} label="món" onClear={() => {}} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });
  it('count=1 là biên dưới → render "1 món đã chọn"', () => {
    renderWithI18n(<BulkBar count={1} label="món" onClear={() => {}} />);
    expect(screen.getByRole('toolbar')).toHaveTextContent('1 món đã chọn');
  });
  it('count=2 → toolbar "2 món đã chọn", hành động hiện, Bỏ chọn gọi onClear', async () => {
    const onClear = vi.fn();
    renderWithI18n(
      <BulkBar count={2} label="món" onClear={onClear}>
        <button>Ngừng</button>
      </BulkBar>,
    );
    expect(screen.getByRole('toolbar')).toHaveTextContent('2 món đã chọn');
    expect(screen.getByRole('button', { name: 'Ngừng' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ chọn' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
