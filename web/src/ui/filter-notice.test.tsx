import { describe, it, expect, vi } from 'vitest';
import { FilterNotice } from '@/ui/filter-notice';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';

describe('FilterNotice', () => {
  it('hiện "Đang lọc: {label} · {count}"', () => {
    renderWithI18n(<FilterNotice label="Sắp hết" count={4} onClear={() => {}} />);
    expect(screen.getByText('Đang lọc: Sắp hết · 4')).toBeInTheDocument();
  });
  it('bấm Xóa lọc gọi onClear', async () => {
    const onClear = vi.fn();
    renderWithI18n(<FilterNotice label="x" count={0} onClear={onClear} />);
    await userEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
  it('count là chuỗi có đơn vị: "Đang lọc: Còn dòng chờ giao · 3 người"', () => {
    renderWithI18n(<FilterNotice label="Còn dòng chờ giao" count="3 người" onClear={() => {}} />);
    expect(screen.getByText('Đang lọc: Còn dòng chờ giao · 3 người')).toBeInTheDocument();
  });
});
